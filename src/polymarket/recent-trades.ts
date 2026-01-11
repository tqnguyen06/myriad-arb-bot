import "dotenv/config";
import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

async function main() {
  const privateKey = process.env.POLYGON_PRIVATE_KEY!;
  const signer = new Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  const creds = {
    key: process.env.POLY_API_KEY!,
    secret: process.env.POLY_API_SECRET!,
    passphrase: process.env.POLY_PASSPHRASE!,
  };
  const client = new ClobClient("https://clob.polymarket.com", 137, signer, creds, 0);

  console.log("=== RECENT TRADES ===\n");

  const trades = (await client.getTrades()) as any[];
  console.log(`Total trades: ${trades.length}\n`);

  // Show last 5 trades
  for (const trade of trades.slice(0, 5)) {
    console.log("---");
    console.log("Trade ID:", trade.id);
    console.log("Side:", trade.side);
    console.log("Size:", trade.size);
    console.log("Price:", trade.price);
    console.log("Status:", trade.status);
    console.log("Asset ID:", trade.asset_id?.slice(0, 25) + "...");
    console.log("Time:", new Date(parseInt(trade.match_time) * 1000).toISOString());
    console.log("Trader side:", trade.trader_side);
  }
}

main().catch(console.error);
