import "dotenv/config";
import { ClobClient, Side } from "@polymarket/clob-client";
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

  console.log("Attempting SELL order...");
  console.log("Wallet:", signer.address);
  console.log("Token:", TOKEN_ID.slice(0, 30) + "...");
  console.log("");

  try {
    const result = await client.createAndPostOrder({
      tokenID: TOKEN_ID,
      side: Side.SELL,
      price: 0.18,
      size: 5, // Just 5 shares as test
    });
    console.log("✅ SUCCESS!");
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (e: any) {
    console.log("❌ FAILED");
    console.log("Error:", e.message || e);
    if (e.response?.data) {
      console.log("Response:", JSON.stringify(e.response.data, null, 2));
    }
  }
}

main().catch(console.error);
