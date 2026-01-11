import "dotenv/config";
import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

async function main() {
  console.log("Debug: Checking orders and positions...\n");

  const privateKey = process.env.POLYGON_PRIVATE_KEY;
  if (!privateKey) {
    console.error("No private key");
    return;
  }

  const signer = new Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  console.log("Wallet:", signer.address);

  const creds = {
    key: process.env.POLY_API_KEY!,
    secret: process.env.POLY_API_SECRET!,
    passphrase: process.env.POLY_PASSPHRASE!,
  };

  const client = new ClobClient("https://clob.polymarket.com", 137, signer, creds, 0);

  // Check open orders
  console.log("\n--- Open Orders ---");
  try {
    const openOrders = await client.getOpenOrders();
    console.log(`Found ${(openOrders as unknown[]).length} open orders`);
    if ((openOrders as unknown[]).length > 0) {
      console.log(JSON.stringify((openOrders as unknown[]).slice(0, 3), null, 2));
    }
  } catch (e) {
    console.error("Failed to get open orders:", e);
  }

  // Check trades/fills
  console.log("\n--- Recent Trades ---");
  try {
    const trades = await client.getTrades();
    console.log(`Found ${(trades as unknown[]).length} trades`);
    if ((trades as unknown[]).length > 0) {
      console.log(JSON.stringify((trades as unknown[]).slice(0, 3), null, 2));
    }
  } catch (e) {
    console.error("Failed to get trades:", e);
  }
}

main().catch(console.error);
