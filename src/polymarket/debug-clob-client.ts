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

  console.log("CLOB Client methods containing 'allow', 'balance', or 'approve':");
  const proto = Object.getPrototypeOf(client);
  const methods = Object.getOwnPropertyNames(proto).filter(
    (m) => typeof (client as any)[m] === "function"
  );

  const relevantMethods = methods.filter(
    (m) =>
      m.toLowerCase().includes("allow") ||
      m.toLowerCase().includes("balance") ||
      m.toLowerCase().includes("approve")
  );
  console.log(relevantMethods);

  console.log("\nAll CLOB Client methods:");
  console.log(methods);

  // Try to get balance allowance
  console.log("\nTrying getBalanceAllowance...");
  try {
    const ba = await (client as any).getBalanceAllowance({ asset_type: "CONDITIONAL" });
    console.log("Balance Allowance (CONDITIONAL):", ba);
  } catch (e) {
    console.log("Error:", e);
  }

  // Try updateBalanceAllowance
  console.log("\nTrying updateBalanceAllowance...");
  try {
    const result = await (client as any).updateBalanceAllowance({ asset_type: "CONDITIONAL" });
    console.log("Update result:", result);
  } catch (e) {
    console.log("Error:", e);
  }
}

main().catch(console.error);
