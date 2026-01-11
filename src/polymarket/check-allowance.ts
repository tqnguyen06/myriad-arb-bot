/**
 * Check balance and allowance for Polymarket trading
 */

import "dotenv/config";
import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

async function main() {
  const pk = process.env.POLYGON_PRIVATE_KEY || "";
  if (!pk) {
    console.log("No private key set");
    return;
  }

  const signer = new Wallet(pk.startsWith("0x") ? pk : "0x" + pk);
  console.log("Wallet:", signer.address);

  const client = new ClobClient("https://clob.polymarket.com", 137, signer, {
    key: process.env.POLY_API_KEY || "",
    secret: process.env.POLY_API_SECRET || "",
    passphrase: process.env.POLY_PASSPHRASE || "",
  }, 0);

  console.log("Checking balance and allowance...");

  try {
    const result = await client.getBalanceAllowance();
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
