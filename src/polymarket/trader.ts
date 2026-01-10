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
  getOpenOrders,
  getWalletAddress,
} from "./client.js";

// Configuration
const CONFIG = {
  DRY_RUN: process.env.POLY_DRY_RUN !== "false", // Default to dry run
  MIN_SPREAD_PCT: parseFloat(process.env.POLY_MIN_SPREAD || "3"), // 3% minimum
  MIN_VOLUME_24HR: parseFloat(process.env.POLY_MIN_VOLUME || "10000"), // $10k volume
  MAX_ORDER_SIZE: parseFloat(process.env.POLY_MAX_ORDER || "10"), // $10 per order
  MAX_OPEN_ORDERS: parseInt(process.env.POLY_MAX_ORDERS || "5"), // Max 5 orders
  POLL_INTERVAL_MS: parseInt(process.env.POLY_POLL_INTERVAL || "60000"), // 60 seconds
  MAX_DAILY_LOSS: parseFloat(process.env.POLY_MAX_LOSS || "50"), // Stop if down $50
};

// State tracking
let stats = {
  startTime: Date.now(),
  scansCompleted: 0,
  ordersPlaced: 0,
  ordersFilled: 0,
  totalProfit: 0,
  totalLoss: 0,
};

let activeOrders: Map<string, { market: string; side: string; price: number; size: number }> =
  new Map();

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
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

  // Calculate number of shares from USDC budget
  // size parameter = number of shares, not USDC amount
  const usdcBudget = CONFIG.MAX_ORDER_SIZE;
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
  log(`     Potential profit: $${potentialProfit.toFixed(2)}`);

  const result = await placeLimitOrder(tokenId, "BUY", buyPrice, numShares, CONFIG.DRY_RUN);

  if (result.success) {
    stats.ordersPlaced++;
    if (result.orderId) {
      activeOrders.set(result.orderId, {
        market: market.question.substring(0, 40),
        side: "BUY",
        price: buyPrice,
        size: numShares,
      });
    }
    log(`     ✅ Order placed: ${result.orderId}`);
  } else {
    log(`     ❌ Order failed: ${result.error}`);
  }
}

async function scan(): Promise<void> {
  stats.scansCompleted++;

  log("");
  log("=".repeat(70));
  log(`Scan #${stats.scansCompleted} | Mode: ${CONFIG.DRY_RUN ? "DRY RUN" : "🔴 LIVE"}`);
  log("=".repeat(70));

  // Check safety limits
  const netPnL = stats.totalProfit - stats.totalLoss;
  if (netPnL < -CONFIG.MAX_DAILY_LOSS) {
    log(`⚠️  MAX LOSS REACHED: $${netPnL.toFixed(2)} - Stopping trades`);
    return;
  }

  // Check max open orders
  const openOrders = await getOpenOrders();
  if (openOrders.length >= CONFIG.MAX_OPEN_ORDERS) {
    log(`Max open orders reached (${openOrders.length}/${CONFIG.MAX_OPEN_ORDERS})`);
    return;
  }

  // Find opportunities
  const opportunities = await findSpreadOpportunities(
    CONFIG.MIN_SPREAD_PCT,
    CONFIG.MIN_VOLUME_24HR
  );

  log(`Found ${opportunities.length} opportunities (>${CONFIG.MIN_SPREAD_PCT}% spread)`);

  if (opportunities.length === 0) {
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
  if (openOrders.length < CONFIG.MAX_OPEN_ORDERS && opportunities.length > 0) {
    log("");
    await checkAndTrade(opportunities[0]);
  }

  // Print stats
  log("");
  log(`Stats: Orders=${stats.ordersPlaced} | Open=${openOrders.length} | P&L=$${netPnL.toFixed(2)}`);
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
  console.log("");

  if (!CONFIG.DRY_RUN) {
    console.log("⚠️  LIVE TRADING ENABLED - Real money at risk!");
    console.log("   Press Ctrl+C to stop\n");
  }

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
