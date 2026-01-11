import "dotenv/config";
import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

// BOTH tokens you own
const TOKEN_IDS = [
  "67458767289404585234744660199191729864647269546936372565997492523516079162996",
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

  console.log("Checking and updating CLOB allowances for ALL tokens...\n");

  for (const tokenId of TOKEN_IDS) {
    console.log(`Token: ${tokenId.slice(0, 25)}...`);

    // Get current state
    try {
      const ba = await client.getBalanceAllowance({
        asset_type: "CONDITIONAL",
        token_id: tokenId,
      });
      console.log(`  Balance: ${ba.balance}`);

      // Check each allowance
      let allGood = true;
      for (const [addr, allowance] of Object.entries(ba.allowances || {})) {
        const val = BigInt(allowance as string);
        if (val === 0n) {
          console.log(`  ❌ ${addr}: NO ALLOWANCE`);
          allGood = false;
        } else {
          console.log(`  ✅ ${addr}: OK`);
        }
      }

      if (!allGood) {
        console.log("  Updating CLOB cache...");
        await client.updateBalanceAllowance({
          asset_type: "CONDITIONAL",
          token_id: tokenId,
        });

        // Check again
        const ba2 = await client.getBalanceAllowance({
          asset_type: "CONDITIONAL",
          token_id: tokenId,
        });
        console.log("  After update:");
        for (const [addr, allowance] of Object.entries(ba2.allowances || {})) {
          const val = BigInt(allowance as string);
          console.log(`    ${addr}: ${val > 0n ? "✅" : "❌"}`);
        }
      }
    } catch (e: any) {
      console.log(`  Error: ${e.message || e}`);
    }
    console.log("");
  }

  console.log("Done!");
}

main().catch(console.error);
