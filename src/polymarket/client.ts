/**
 * Polymarket Trading Client
 *
 * Handles order placement, cancellation, and position management.
 */

import "dotenv/config";
import { ClobClient, Side, OrderType } from "@polymarket/clob-client";
import { Wallet } from "ethers";

const CLOB_HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137; // Polygon mainnet

export interface TradeConfig {
  dryRun: boolean;
  maxOrderSize: number; // Max USDC per order
  minSpreadPct: number; // Minimum spread to trade
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
  details?: {
    tokenId: string;
    side: string;
    price: number;
    size: number;
  };
}

let client: ClobClient | null = null;
let walletAddress: string = "";

/**
 * Initialize the trading client
 */
export async function initClient(): Promise<boolean> {
  const privateKey = process.env.POLYGON_PRIVATE_KEY;
  const apiKey = process.env.POLY_API_KEY;
  const apiSecret = process.env.POLY_API_SECRET;
  const passphrase = process.env.POLY_PASSPHRASE;

  if (!privateKey) {
    console.error("ERROR: POLYGON_PRIVATE_KEY not set");
    return false;
  }

  if (!apiKey || !apiSecret || !passphrase) {
    console.error("ERROR: API credentials not set. Run: npm run poly:setup");
    return false;
  }

  try {
    const signer = new Wallet(
      privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
    );
    walletAddress = signer.address;

    const creds = {
      key: apiKey,
      secret: apiSecret,
      passphrase: passphrase,
    };

    client = new ClobClient(CLOB_HOST, CHAIN_ID, signer, creds, 0);
    console.log(`Trading client initialized for: ${walletAddress}`);
    return true;
  } catch (error) {
    console.error("Failed to initialize client:", error);
    return false;
  }
}

/**
 * Get wallet address
 */
export function getWalletAddress(): string {
  return walletAddress;
}

/**
 * Check if client is ready
 */
export function isReady(): boolean {
  return client !== null;
}

/**
 * Get open orders
 */
export async function getOpenOrders(): Promise<unknown[]> {
  if (!client) throw new Error("Client not initialized");
  return client.getOpenOrders();
}

/**
 * Get balances/positions
 */
export async function getBalances(): Promise<unknown> {
  if (!client) throw new Error("Client not initialized");
  // The CLOB client doesn't have a direct balance method
  // Positions can be checked via open orders and fills
  return { address: walletAddress };
}

/**
 * Place a limit order
 */
export async function placeLimitOrder(
  tokenId: string,
  side: "BUY" | "SELL",
  price: number,
  size: number,
  dryRun: boolean = true
): Promise<OrderResult> {
  if (!client) {
    return { success: false, error: "Client not initialized" };
  }

  const details = {
    tokenId: tokenId.substring(0, 20) + "...",
    side,
    price,
    size,
  };

  if (dryRun) {
    console.log(`[DRY RUN] Would place order:`, details);
    return {
      success: true,
      orderId: "dry-run-" + Date.now(),
      details,
    };
  }

  try {
    const orderSide = side === "BUY" ? Side.BUY : Side.SELL;

    const response = await client.createAndPostOrder({
      tokenID: tokenId,
      price: price,
      size: size,
      side: orderSide,
    });

    // Check if response contains an error
    if (response && typeof response === "object") {
      const resp = response as Record<string, unknown>;
      if (resp.error || resp.status === 400) {
        const errorMsg = String(resp.error || "Order rejected");
        console.error(`Order rejected:`, errorMsg);
        return {
          success: false,
          error: errorMsg,
          details,
        };
      }
    }

    console.log(`Order placed:`, response);

    const resp = response as Record<string, unknown>;
    return {
      success: true,
      orderId: String(resp.orderID || resp.id || ""),
      details,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Order failed:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
      details,
    };
  }
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string): Promise<boolean> {
  if (!client) throw new Error("Client not initialized");

  try {
    await client.cancelOrder({ orderID: orderId });
    return true;
  } catch (error) {
    console.error(`Failed to cancel order ${orderId}:`, error);
    return false;
  }
}

/**
 * Cancel all open orders
 */
export async function cancelAllOrders(): Promise<number> {
  if (!client) throw new Error("Client not initialized");

  try {
    const openOrders = await client.getOpenOrders();
    let cancelled = 0;

    for (const order of openOrders as Array<{ id: string }>) {
      try {
        await client.cancelOrder({ orderID: order.id });
        cancelled++;
      } catch {
        // Continue cancelling others
      }
    }

    return cancelled;
  } catch (error) {
    console.error("Failed to cancel orders:", error);
    return 0;
  }
}

/**
 * Place a market making order pair (bid and ask)
 * Returns the potential profit if both sides fill
 */
export async function placeMarketMakingOrders(
  tokenId: string,
  currentBid: number,
  currentAsk: number,
  size: number,
  dryRun: boolean = true
): Promise<{
  success: boolean;
  bidOrder?: OrderResult;
  askOrder?: OrderResult;
  potentialProfit?: number;
}> {
  // Place our bid slightly above current best bid
  // Place our ask slightly below current best ask
  const ourBid = Math.round((currentBid + 0.001) * 1000) / 1000;
  const ourAsk = Math.round((currentAsk - 0.001) * 1000) / 1000;

  // Check if there's still profit after our prices
  const spread = ourAsk - ourBid;
  if (spread <= 0) {
    return {
      success: false,
      potentialProfit: 0,
    };
  }

  const potentialProfit = spread * size;

  console.log(`Market making: Bid ${ourBid} / Ask ${ourAsk} (spread: ${(spread * 100).toFixed(2)}%)`);

  const bidOrder = await placeLimitOrder(tokenId, "BUY", ourBid, size, dryRun);
  const askOrder = await placeLimitOrder(tokenId, "SELL", ourAsk, size, dryRun);

  return {
    success: bidOrder.success && askOrder.success,
    bidOrder,
    askOrder,
    potentialProfit,
  };
}
