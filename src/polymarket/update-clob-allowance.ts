import "dotenv/config";
import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

// Token IDs we own and want to sell
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

  // signatureType 0 = EOA wallet, 1 = poly proxy, 2 = gnosis safe
  const client = new ClobClient("https://clob.polymarket.com", 137, signer, creds, 0);

  console.log("Updating CLOB balance/allowance for tokens...");
  console.log("Wallet:", signer.address);
  console.log("");

  for (const tokenId of TOKEN_IDS) {
    console.log(`Token: ${tokenId.slice(0, 20)}...`);

    try {
      // Update balance allowance for this specific token
      const result = await (client as any).updateBalanceAllowance({
        asset_type: "CONDITIONAL",
        token_id: tokenId,
      });
      console.log("  Result:", JSON.stringify(result));
    } catch (e: any) {
      console.log("  Error:", e.message || e);
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
