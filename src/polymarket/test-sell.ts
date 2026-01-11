import "dotenv/config";
import { ClobClient, Side } from "@polymarket/clob-client";
import { Wallet } from "ethers";

// Token we own - 488 shares
const TOKEN_ID = "67458767289404585234744660199191729864647269546936372565997492523516079162996";
const SELL_PRICE = 0.18; // Current ask is around 0.184
const SELL_SIZE = 10; // Try selling just 10 shares as a test

async function main() {
  const privateKey = process.env.POLYGON_PRIVATE_KEY!;
  const signer = new Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);

  const creds = {
    key: process.env.POLY_API_KEY!,
    secret: process.env.POLY_API_SECRET!,
    passphrase: process.env.POLY_PASSPHRASE!,
  };

  const client = new ClobClient("https://clob.polymarket.com", 137, signer, creds, 0);

  console.log("Testing SELL order...");
  console.log("Wallet:", signer.address);
  console.log("Token:", TOKEN_ID.slice(0, 30) + "...");
  console.log("Price:", SELL_PRICE);
  console.log("Size:", SELL_SIZE);
  console.log("");

  try {
    // First check balance allowance
    console.log("Checking balance allowance...");
    const ba = await client.getBalanceAllowance({
      asset_type: "CONDITIONAL",
      token_id: TOKEN_ID,
    });
    console.log("Balance Allowance:", JSON.stringify(ba, null, 2));
    console.log("");

    // Try to create and post the order
    console.log("Creating SELL order...");
    const result = await client.createAndPostOrder({
      tokenID: TOKEN_ID,
      side: Side.SELL,
      price: SELL_PRICE,
      size: SELL_SIZE,
    });

    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (e: any) {
    console.log("Error:", e.message || e);
    if (e.response) {
      console.log("Response data:", e.response.data);
    }
  }
}

main().catch(console.error);
