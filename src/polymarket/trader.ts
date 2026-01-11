/**
 * Polymarket Trading Bot
 *
 * Monitors markets and executes trades on spread opportunities.
 *
 * Run with: npm run poly:trade
 */

import "dotenv/config";
import { findSpreadOpportunities, getOrderbook, type SpreadOpportunity } from "./api.js";
import {
  initClient,
  isReady,
  placeLimitOrder,
  cancelAllOrders,
  cancelOrder,
  getOpenOrders,
  getOrder,
  getWalletAddress,
  getTrades,
  getTokenBalance,
  getUsdcBalance,
} from "./client.js";

// Configuration
const CONFIG = {
  DRY_RUN: process.env.POLY_DRY_RUN !== "false", // Default to dry run
  MIN_SPREAD_PCT: parseFloat(process.env.POLY_MIN_SPREAD || "3"), // 3% minimum
  MIN_VOLUME_24HR: parseFloat(process.env.POLY_MIN_VOLUME || "10000"), // $10k volume
  MAX_ORDER_SIZE: parseFloat(process.env.POLY_MAX_ORDER || "5"), // $5 per order (conservative)
  MAX_OPEN_ORDERS: parseInt(process.env.POLY_MAX_ORDERS || "2"), // Max 2 open orders
  POLL_INTERVAL_MS: parseInt(process.env.POLY_POLL_INTERVAL || "60000"), // 60 seconds
  MAX_DAILY_LOSS: parseFloat(process.env.POLY_MAX_LOSS || "50"), // Stop if down $50
  ORDER_TTL_MS: parseInt(process.env.POLY_ORDER_TTL || "300000"), // 5 minutes TTL for orders
};

// State tracking
let stats = {
  startTime: Date.now(),
  scansCompleted: 0,
  ordersPlaced: 0,
  ordersFilled: 0,
  ordersCancelled: 0,
  sellOrdersPlaced: 0,
  totalProfit: 0,
  totalLoss: 0,
};

// Track active BUY orders with metadata for TTL and sell targeting
interface ActiveOrder {
  market: string;
  tokenId: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
  targetSellPrice: number; // The ask price we want to sell at
  placedAt: number; // Timestamp for TTL
}

let activeOrders: Map<string, ActiveOrder> = new Map();

// Track positions we need to sell (filled BUY orders)
interface Position {
  tokenId: string;
  market: string;
  size: number;
  buyPrice: number;
  targetSellPrice: number;
  acquiredAt: number;
}

let positions: Map<string, Position> = new Map(); // tokenId -> Position

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/**
 * Load existing positions from recent trades on startup.
 * This handles the case where the bot restarts and has positions it doesn't know about.
 */
async function loadExistingPositions(): Promise<void> {
  log("Loading existing positions from trades...");

  try {
    const trades = (await getTrades()) as Array<Record<string, unknown>>;
    log(`Found ${trades.length} recent trades`);

    // Track unique token IDs where we were the maker on BUY side
    const tokenIds = new Set<string>();
    const walletAddr = getWalletAddress().toLowerCase();

    for (const trade of trades) {
      const makerOrders = trade.maker_orders as Array<Record<string, unknown>> | undefined;
      if (!makerOrders) continue;

      for (const makerOrder of makerOrders) {
        const makerAddr = String(makerOrder.maker_address || "").toLowerCase();
        const side = String(makerOrder.side || "").toUpperCase();
        const assetId = String(makerOrder.asset_id || "");

        // If we were the maker on a BUY order, we may own these tokens
        if (makerAddr === walletAddr && side === "BUY" && assetId) {
          tokenIds.add(assetId);
        }
      }
    }

    log(`Found ${tokenIds.size} unique tokens from our BUY trades`);

    // Check on-chain balance for each token
    for (const tokenId of tokenIds) {
      const balance = await getTokenBalance(tokenId);

      if (balance > 0) {
        log(`  Found position: ${balance} shares of token ${tokenId.slice(0, 20)}...`);

        // Add to positions for selling
        // Use a conservative sell price - we'll update it when we try to sell
        positions.set(tokenId, {
          tokenId,
          market: "Loaded from trades",
          size: Math.floor(balance), // Use whole shares
          buyPrice: 0, // Unknown - will calculate profit from current price
          targetSellPrice: 0, // Will be set when we try to sell
          acquiredAt: Date.now(),
        });
      }
    }

    log(`Loaded ${positions.size} positions to sell`);
  } catch (error) {
    log(`Failed to load existing positions: ${error}`);
  }
}

/**
 * Calculate available USDC balance (total minus committed in open BUY orders)
 */
async function getAvailableUsdc(): Promise<{ total: number; committed: number; available: number }> {
  const total = await getUsdcBalance();

  // Get committed amount from both tracked orders and API orders
  let committed = 0;

  // From our tracked active BUY orders
  for (const order of activeOrders.values()) {
    if (order.side === "BUY") {
      committed += order.price * order.size;
    }
  }

  // Also check API for any orders we're not tracking
  try {
    const apiOrders = (await getOpenOrders()) as Array<Record<string, unknown>>;
    for (const order of apiOrders) {
      const side = String(order.side || "").toUpperCase();
      if (side === "BUY") {
        const size = parseFloat(String(order.original_size || order.size || 0));
        const price = parseFloat(String(order.price || 0));
        const orderId = String(order.id || "");
        // Don't double-count orders we're already tracking
        if (!activeOrders.has(orderId)) {
          committed += size * price;
        }
      }
    }
  } catch (error) {
    log(`Warning: Could not check API orders: ${error}`);
  }

  const available = Math.max(0, total - committed);
  return { total, committed, available };
}

/**
 * Calculate available shares for a token (total minus committed in open SELL orders)
 */
async function getAvailableShares(tokenId: string): Promise<{ total: number; committed: number; available: number }> {
  const total = await getTokenBalance(tokenId);

  let committed = 0;

  // From our tracked active SELL orders
  for (const order of activeOrders.values()) {
    if (order.side === "SELL" && order.tokenId === tokenId) {
      committed += order.size;
    }
  }

  // Also check API for any SELL orders we're not tracking
  try {
    const apiOrders = (await getOpenOrders()) as Array<Record<string, unknown>>;
    for (const order of apiOrders) {
      const side = String(order.side || "").toUpperCase();
      const assetId = String(order.asset_id || "");
      if (side === "SELL" && assetId === tokenId) {
        const size = parseFloat(String(order.original_size || order.size || 0));
        const orderId = String(order.id || "");
        if (!activeOrders.has(orderId)) {
          committed += size;
        }
      }
    }
  } catch (error) {
    log(`Warning: Could not check API orders: ${error}`);
  }

  const available = Math.max(0, total - committed);
  return { total, committed, available };
}

async function checkAndTrade(opportunity: SpreadOpportunity): Promise<void> {
  const market = opportunity.market;

  // Check we have token IDs
  if (!market.clobTokenIds || market.clobTokenIds.length < 1) {
    log(`  No token IDs for ${market.question.substring(0, 40)}...`);
    return;
  }

  const tokenId = market.clobTokenIds[0]; // Yes token

  // Use Gamma API's bid/ask - more reliable than sparse CLOB orderbook
  const bestBid = market.bestBid;
  const bestAsk = market.bestAsk;

  if (bestBid <= 0 || bestAsk <= 0 || bestBid >= bestAsk) {
    log(`  Invalid prices: bid=${bestBid} ask=${bestAsk}`);
    return;
  }

  const spread = bestAsk - bestBid;
  const spreadPct = (spread / bestAsk) * 100;

  if (spreadPct < CONFIG.MIN_SPREAD_PCT) {
    log(`  Spread too small: ${spreadPct.toFixed(2)}% < ${CONFIG.MIN_SPREAD_PCT}%`);
    return;
  }

  // Check available USDC before placing order
  const usdcInfo = await getAvailableUsdc();
  log(`  USDC: $${usdcInfo.total.toFixed(2)} total, $${usdcInfo.committed.toFixed(2)} in orders, $${usdcInfo.available.toFixed(2)} available`);

  if (usdcInfo.available < 1) {
    log(`  Insufficient available USDC: $${usdcInfo.available.toFixed(2)} < $1 minimum`);
    return;
  }

  // Calculate number of shares from available USDC (capped at MAX_ORDER_SIZE)
  // size parameter = number of shares, not USDC amount
  const usdcBudget = Math.min(CONFIG.MAX_ORDER_SIZE, usdcInfo.available);
  const buyPrice = bestBid;
  const numShares = Math.floor(usdcBudget / buyPrice); // How many shares we can buy
  const orderValue = numShares * buyPrice; // Actual USDC spent

  // Polymarket minimum order is $1
  if (orderValue < 1) {
    log(`  Order too small: $${orderValue.toFixed(2)} < $1 minimum`);
    return;
  }

  const potentialProfit = spread * numShares;

  log(`  📈 TRADING: ${market.question.substring(0, 40)}...`);
  log(`     Spread: ${spreadPct.toFixed(2)}% | Buy ${numShares} shares @ ${buyPrice} = $${orderValue.toFixed(2)}`);
  log(`     Target sell @ ${bestAsk} | Potential profit: $${potentialProfit.toFixed(2)}`);

  const result = await placeLimitOrder(tokenId, "BUY", buyPrice, numShares, CONFIG.DRY_RUN);

  if (result.success) {
    stats.ordersPlaced++;
    if (result.orderId) {
      activeOrders.set(result.orderId, {
        market: market.question.substring(0, 40),
        tokenId,
        side: "BUY",
        price: buyPrice,
        size: numShares,
        targetSellPrice: bestAsk,
        placedAt: Date.now(),
      });
    }
    log(`     ✅ Order placed: ${result.orderId}`);
  } else {
    log(`     ❌ Order failed: ${result.error}`);
  }
}

/**
 * Check for filled orders and move them to positions for selling
 */
async function checkOrderFills(): Promise<void> {
  if (activeOrders.size === 0) return;

  log(`Checking ${activeOrders.size} active orders for fills...`);

  for (const [orderId, order] of Array.from(activeOrders.entries())) {
    // Skip dry-run orders
    if (orderId.startsWith("dry-run-")) {
      // Simulate fill after 2 scans for dry run
      if (Date.now() - order.placedAt > CONFIG.POLL_INTERVAL_MS * 2) {
        log(`  [DRY RUN] Simulating fill for ${order.market}`);
        activeOrders.delete(orderId);
        stats.ordersFilled++;

        if (order.side === "BUY") {
          // Add to positions to sell
          positions.set(order.tokenId, {
            tokenId: order.tokenId,
            market: order.market,
            size: order.size,
            buyPrice: order.price,
            targetSellPrice: order.targetSellPrice,
            acquiredAt: Date.now(),
          });
        }
      }
      continue;
    }

    try {
      const orderData = (await getOrder(orderId)) as Record<string, unknown>;
      const status = String(orderData.status || orderData.order_status || "").toUpperCase();

      if (status === "FILLED" || status === "MATCHED") {
        log(`  ✅ Order FILLED: ${order.market}`);
        activeOrders.delete(orderId);
        stats.ordersFilled++;

        if (order.side === "BUY") {
          // Add to positions - we need to sell these
          positions.set(order.tokenId, {
            tokenId: order.tokenId,
            market: order.market,
            size: order.size,
            buyPrice: order.price,
            targetSellPrice: order.targetSellPrice,
            acquiredAt: Date.now(),
          });
          log(`     Added to positions for selling @ ${order.targetSellPrice}`);
        } else if (order.side === "SELL") {
          // SELL filled - calculate profit
          const profit = (order.price - order.targetSellPrice) * order.size; // targetSellPrice stores buyPrice for sells
          stats.totalProfit += profit;
          log(`     💰 PROFIT: $${profit.toFixed(2)}`);
        }
      } else if (status === "CANCELLED" || status === "EXPIRED") {
        log(`  ⚠️ Order ${status}: ${order.market}`);
        activeOrders.delete(orderId);
      }
      // Otherwise order is still open - keep tracking
    } catch (error) {
      // Order may not exist anymore
      log(`  Failed to check order ${orderId}: ${error}`);
    }
  }
}

/**
 * Place SELL orders for positions we're holding
 */
async function sellPositions(): Promise<void> {
  if (positions.size === 0) return;

  log(`Placing SELL orders for ${positions.size} positions...`);

  for (const [tokenId, position] of Array.from(positions.entries())) {
    let sellPrice = position.targetSellPrice;

    // If we don't have a target sell price (loaded position), get current ask
    if (sellPrice <= 0) {
      try {
        const orderbook = await getOrderbook(tokenId);
        if (!orderbook) {
          log(`  No orderbook for ${tokenId.slice(0, 20)}..., skipping`);
          continue;
        }

        // Get best ask (lowest ask price) and best bid (highest bid price)
        const bestAsk = orderbook.asks.length > 0
          ? Math.min(...orderbook.asks.map(a => a.price))
          : 0;
        const bestBid = orderbook.bids.length > 0
          ? Math.max(...orderbook.bids.map(b => b.price))
          : 0;

        if (bestAsk > 0) {
          sellPrice = bestAsk;
          log(`  Got current ask price: ${sellPrice} for ${tokenId.slice(0, 20)}...`);
        } else if (bestBid > 0) {
          // No ask, use bid + 2% as sell price (try to capture some spread)
          sellPrice = Math.round((bestBid * 1.02) * 1000) / 1000;
          log(`  No ask, using bid+2%: ${sellPrice} for ${tokenId.slice(0, 20)}...`);
        } else {
          log(`  No orderbook data for ${tokenId.slice(0, 20)}..., skipping`);
          continue;
        }
      } catch (error) {
        log(`  Failed to get orderbook for ${tokenId.slice(0, 20)}...: ${error}`);
        continue;
      }
    }

    // Check available shares before selling
    const sharesInfo = await getAvailableShares(tokenId);
    log(`  Shares for ${tokenId.slice(0, 15)}...: ${sharesInfo.total.toFixed(0)} total, ${sharesInfo.committed.toFixed(0)} in orders, ${sharesInfo.available.toFixed(0)} available`);

    if (sharesInfo.available < 1) {
      log(`  Insufficient available shares: ${sharesInfo.available.toFixed(0)} < 1`);
      positions.delete(tokenId); // Remove from positions - already have SELL order out
      continue;
    }

    // Adjust sell size to available shares
    const sellSize = Math.min(position.size, Math.floor(sharesInfo.available));
    if (sellSize < 1) {
      log(`  Sell size too small after adjustment: ${sellSize}`);
      positions.delete(tokenId);
      continue;
    }

    log(`  Selling ${sellSize} shares of ${position.market} @ ${sellPrice}`);

    const result = await placeLimitOrder(
      tokenId,
      "SELL",
      sellPrice,
      sellSize,
      CONFIG.DRY_RUN
    );

    if (result.success) {
      stats.sellOrdersPlaced++;
      positions.delete(tokenId);

      if (result.orderId) {
        // Track the sell order (store buyPrice in targetSellPrice for profit calc)
        activeOrders.set(result.orderId, {
          market: position.market,
          tokenId,
          side: "SELL",
          price: sellPrice,
          size: sellSize, // Use adjusted sell size
          targetSellPrice: position.buyPrice, // Store buy price for profit calculation
          placedAt: Date.now(),
        });
      }
      log(`     ✅ SELL order placed: ${result.orderId}`);
    } else {
      log(`     ❌ SELL failed: ${result.error}`);
    }
  }
}

/**
 * Cancel orders that have exceeded TTL
 */
async function cancelStaleOrders(): Promise<void> {
  const now = Date.now();
  const staleOrderIds: string[] = [];

  for (const [orderId, order] of Array.from(activeOrders.entries())) {
    const age = now - order.placedAt;
    if (age > CONFIG.ORDER_TTL_MS) {
      staleOrderIds.push(orderId);
    }
  }

  if (staleOrderIds.length === 0) return;

  log(`Cancelling ${staleOrderIds.length} stale orders (>${CONFIG.ORDER_TTL_MS / 1000}s old)...`);

  for (const orderId of staleOrderIds) {
    const order = activeOrders.get(orderId)!;

    if (orderId.startsWith("dry-run-")) {
      log(`  [DRY RUN] Would cancel: ${order.market}`);
      activeOrders.delete(orderId);
      stats.ordersCancelled++;
      continue;
    }

    const cancelled = await cancelOrder(orderId);
    if (cancelled) {
      log(`  ❌ Cancelled stale order: ${order.market}`);
      activeOrders.delete(orderId);
      stats.ordersCancelled++;
    }
  }
}

async function scan(): Promise<void> {
  stats.scansCompleted++;

  log("");
  log("=".repeat(70));
  log(`Scan #${stats.scansCompleted} | Mode: ${CONFIG.DRY_RUN ? "DRY RUN" : "🔴 LIVE"}`);
  log("=".repeat(70));

  // Step 1: Check for filled orders and update positions
  await checkOrderFills();

  // Step 2: Place SELL orders for any positions we're holding
  await sellPositions();

  // Step 3: Cancel stale orders that exceeded TTL
  await cancelStaleOrders();

  // Check safety limits
  const netPnL = stats.totalProfit - stats.totalLoss;
  if (netPnL < -CONFIG.MAX_DAILY_LOSS) {
    log(`⚠️  MAX LOSS REACHED: $${netPnL.toFixed(2)} - Stopping trades`);
    return;
  }

  // Check max open orders (from our tracking, not API - more accurate)
  const buyOrderCount = Array.from(activeOrders.values()).filter(o => o.side === "BUY").length;
  if (buyOrderCount >= CONFIG.MAX_OPEN_ORDERS) {
    log(`Max open BUY orders reached (${buyOrderCount}/${CONFIG.MAX_OPEN_ORDERS})`);
    log("");
    printStats();
    return;
  }

  // Find opportunities
  const opportunities = await findSpreadOpportunities(
    CONFIG.MIN_SPREAD_PCT,
    CONFIG.MIN_VOLUME_24HR
  );

  log(`Found ${opportunities.length} opportunities (>${CONFIG.MIN_SPREAD_PCT}% spread)`);

  if (opportunities.length === 0) {
    log("");
    printStats();
    return;
  }

  // Show top opportunities
  log("");
  opportunities.slice(0, 5).forEach((opp, i) => {
    const m = opp.market;
    log(
      `[${i + 1}] ${m.question.substring(0, 45)}... | Spread: ${m.spreadPct.toFixed(2)}% | Vol: $${(m.volume24hr / 1000).toFixed(1)}k`
    );
  });

  // Trade on the best opportunity (if we have room for orders)
  if (buyOrderCount < CONFIG.MAX_OPEN_ORDERS && opportunities.length > 0) {
    log("");
    await checkAndTrade(opportunities[0]);
  }

  // Print stats
  log("");
  printStats();
}

function printStats(): void {
  const netPnL = stats.totalProfit - stats.totalLoss;
  const buyOrders = Array.from(activeOrders.values()).filter(o => o.side === "BUY").length;
  const sellOrders = Array.from(activeOrders.values()).filter(o => o.side === "SELL").length;

  log(`Stats: BUY=${buyOrders} SELL=${sellOrders} Positions=${positions.size} | Filled=${stats.ordersFilled} Cancelled=${stats.ordersCancelled} | P&L=$${netPnL.toFixed(2)}`);
}

async function main(): Promise<void> {
  console.log("Polymarket Trading Bot");
  console.log("======================\n");

  // Initialize client
  const ready = await initClient();
  if (!ready) {
    console.error("Failed to initialize trading client");
    process.exit(1);
  }

  console.log(`Wallet: ${getWalletAddress()}`);
  console.log("");
  console.log("Configuration:");
  console.log(`  Mode: ${CONFIG.DRY_RUN ? "DRY RUN (no real trades)" : "🔴 LIVE TRADING"}`);
  console.log(`  Min Spread: ${CONFIG.MIN_SPREAD_PCT}%`);
  console.log(`  Min Volume: $${CONFIG.MIN_VOLUME_24HR}`);
  console.log(`  Max Order Size: $${CONFIG.MAX_ORDER_SIZE}`);
  console.log(`  Max Open Orders: ${CONFIG.MAX_OPEN_ORDERS}`);
  console.log(`  Max Daily Loss: $${CONFIG.MAX_DAILY_LOSS}`);
  console.log(`  Poll Interval: ${CONFIG.POLL_INTERVAL_MS / 1000}s`);
  console.log(`  Order TTL: ${CONFIG.ORDER_TTL_MS / 1000}s`);
  console.log("");
  console.log("Strategy: Buy at bid → Sell at ask → Capture spread");
  console.log(`  - Unfilled orders cancelled after ${CONFIG.ORDER_TTL_MS / 60000} minutes`);
  console.log(`  - Filled BUY orders automatically get SELL orders placed`);
  console.log("");

  if (!CONFIG.DRY_RUN) {
    console.log("⚠️  LIVE TRADING ENABLED - Real money at risk!");
    console.log("   Press Ctrl+C to stop\n");
  }

  // Load any existing positions from previous runs
  await loadExistingPositions();

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n\nShutting down...");
    if (!CONFIG.DRY_RUN) {
      console.log("Cancelling open orders...");
      const cancelled = await cancelAllOrders();
      console.log(`Cancelled ${cancelled} orders`);
    }
    console.log("Final stats:", stats);
    process.exit(0);
  });

  // Initial scan
  await scan();

  // Continuous monitoring
  setInterval(scan, CONFIG.POLL_INTERVAL_MS);
}

main().catch(console.error);
