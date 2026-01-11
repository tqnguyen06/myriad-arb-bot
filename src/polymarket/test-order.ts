/**
 * Test placing a small order on Polymarket
 */

import "dotenv/config";
import { ClobClient, Side } from "@polymarket/clob-client";
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

  // Test token - Buffalo Bills Super Bowl (from the logs)
  const tokenId = "19740329944962592380580142050369523795065853055987745520766432334608119837023";

  console.log("\nTesting order placement...");
  console.log("Token:", tokenId.substring(0, 20) + "...");
  console.log("Side: BUY");
  console.log("Price: 0.01 (very low, won't fill)");
  console.log("Size: 10 shares");

  try {
    // Place a limit order at a very low price (won't fill, just testing)
    const response = await client.createAndPostOrder({
      tokenID: tokenId,
      price: 0.01,
      size: 10,
      side: Side.BUY,
    });

    console.log("\nResponse:", JSON.stringify(response, null, 2));

    // If successful, cancel the order
    if (response && typeof response === 'object') {
      const resp = response as Record<string, unknown>;
      if (resp.orderID) {
        console.log("\nOrder placed! Cancelling...");
        await client.cancelOrder({ orderID: String(resp.orderID) });
        console.log("Order cancelled");
      }
    }
  } catch (error) {
    console.error("\nError:", error);
  }
}

main();
