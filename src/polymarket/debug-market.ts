import "dotenv/config";
import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

const TOKEN_ID = "67458767289404585234744660199191729864647269546936372565997492523516079162996";

async function main() {
  const privateKey = process.env.POLYGON_PRIVATE_KEY!;
  const signer = new Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  const creds = {
    key: process.env.POLY_API_KEY!,
    secret: process.env.POLY_API_SECRET!,
    passphrase: process.env.POLY_PASSPHRASE!,
  };
  const client = new ClobClient("https://clob.polymarket.com", 137, signer, creds, 0);

  console.log("=== DEBUGGING MARKET/TOKEN ===\n");

  // Check if market is in "closed only" mode
  console.log("1. Checking closed-only mode...");
  try {
    const closedOnly = await client.getClosedOnlyMode();
    console.log("   Closed only mode:", closedOnly);
  } catch (e: any) {
    console.log("   Error:", e.message);
  }

  // Get neg risk status for this token
  console.log("\n2. Checking if token is neg-risk...");
  try {
    const negRisk = await client.getNegRisk(TOKEN_ID);
    console.log("   Neg Risk:", negRisk);
  } catch (e: any) {
    console.log("   Error:", e.message);
  }

  // Get tick size
  console.log("\n3. Checking tick size...");
  try {
    const tickSize = await client.getTickSize(TOKEN_ID);
    console.log("   Tick Size:", tickSize);
  } catch (e: any) {
    console.log("   Error:", e.message);
  }

  // Get order book
  console.log("\n4. Checking order book...");
  try {
    const book = await client.getOrderBook(TOKEN_ID);
    console.log("   Bids:", (book as any).bids?.length || 0);
    console.log("   Asks:", (book as any).asks?.length || 0);
    if ((book as any).bids?.length > 0) {
      console.log("   Best bid:", (book as any).bids[0]);
    }
    if ((book as any).asks?.length > 0) {
      console.log("   Best ask:", (book as any).asks[0]);
    }
  } catch (e: any) {
    console.log("   Error:", e.message);
  }

  // Get current price
  console.log("\n5. Checking price...");
  try {
    const price = await client.getPrice(TOKEN_ID, "sell");
    console.log("   Sell price:", price);
  } catch (e: any) {
    console.log("   Error:", e.message);
  }

  // Double-check balance allowance with full details
  console.log("\n6. Full balance/allowance check...");
  try {
    const ba = await client.getBalanceAllowance({
      asset_type: "CONDITIONAL",
      token_id: TOKEN_ID,
    });
    console.log("   Raw response:", JSON.stringify(ba, null, 2));
  } catch (e: any) {
    console.log("   Error:", e.message);
  }

  console.log("\n=== END DEBUG ===");
}

main().catch(console.error);
