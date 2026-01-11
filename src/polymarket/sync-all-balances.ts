import "dotenv/config";
import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

// Current tokens you own
const TOKEN_IDS = [
  "98328612241005079298480582300548815593588797496125488765752746802492445498580",
  "113190006934473670027813688637035351508576068082510530239150849587212889396175",
];

async function main() {
  const privateKey = process.env.POLYGON_PRIVATE_KEY!;
  const signer = new Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  const creds = {
    key: process.env.POLY_API_KEY!,
    secret: process.env.POLY_API_SECRET!,
    passphrase: process.env.POLY_PASSPHRASE!,
  };
  const client = new ClobClient("https://clob.polymarket.com", 137, signer, creds, 0);

  console.log("=== SYNCING ALL BALANCES WITH CLOB SERVER ===\n");

  // 1. Update USDC balance (for BUY orders)
  console.log("1. Updating USDC (collateral) balance...");
  try {
    await client.updateBalanceAllowance({ asset_type: "COLLATERAL" });
    const ba = await client.getBalanceAllowance({ asset_type: "COLLATERAL" });
    console.log(`   USDC Balance: ${(parseInt(ba.balance) / 1e6).toFixed(2)}`);
    console.log("   ✅ USDC synced\n");
  } catch (e: any) {
    console.log(`   Error: ${e.message}\n`);
  }

  // 2. Update each token balance (for SELL orders)
  for (const tokenId of TOKEN_IDS) {
    console.log(`2. Updating token ${tokenId.slice(0, 20)}...`);
    try {
      await client.updateBalanceAllowance({
        asset_type: "CONDITIONAL",
        token_id: tokenId,
      });
      const ba = await client.getBalanceAllowance({
        asset_type: "CONDITIONAL",
        token_id: tokenId,
      });
      console.log(`   Token Balance: ${(parseInt(ba.balance) / 1e6).toFixed(2)} shares`);

      // Check allowances
      let allOk = true;
      for (const [addr, val] of Object.entries(ba.allowances || {})) {
        if (BigInt(val as string) === 0n) {
          console.log(`   ❌ ${addr}: NO ALLOWANCE`);
          allOk = false;
        }
      }
      if (allOk) {
        console.log("   ✅ Token synced with all allowances\n");
      }
    } catch (e: any) {
      console.log(`   Error: ${e.message}\n`);
    }
  }

  console.log("=== SYNC COMPLETE ===");
  console.log("\nNow check Railway logs - orders should work.");
}

main().catch(console.error);
