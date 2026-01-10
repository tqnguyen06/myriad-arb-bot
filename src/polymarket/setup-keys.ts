/**
 * Polymarket API Key Setup
 *
 * Generates API credentials from your wallet signature.
 * Run once to get your API key, secret, and passphrase.
 *
 * Prerequisites:
 * 1. Set POLYGON_PRIVATE_KEY in .env (your wallet's private key, no 0x prefix)
 * 2. Have some MATIC in wallet for gas
 *
 * Run with: npm run poly:setup
 */

import "dotenv/config";
import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

const CLOB_HOST = "https://clob.polymarket.com";
const CHAIN_ID = 137; // Polygon mainnet

async function main() {
  console.log("Polymarket API Key Setup");
  console.log("========================\n");

  // Check for private key
  const privateKey = process.env.POLYGON_PRIVATE_KEY;
  if (!privateKey) {
    console.error("ERROR: POLYGON_PRIVATE_KEY not set in .env file");
    console.log("\nTo set up:");
    console.log("1. Create a .env file with: POLYGON_PRIVATE_KEY=your_private_key_here");
    console.log("2. Make sure the wallet has USDC on Polygon for trading");
    console.log("3. Make sure the wallet has a small amount of MATIC for gas");
    process.exit(1);
  }

  try {
    // Create wallet signer
    const signer = new Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
    console.log(`Wallet address: ${signer.address}`);
    console.log("");

    // Create temporary client to generate credentials
    console.log("Generating API credentials...");
    console.log("(This signs a message with your wallet - no gas required)\n");

    const tempClient = new ClobClient(CLOB_HOST, CHAIN_ID, signer);
    const apiCreds = await tempClient.createOrDeriveApiKey();

    console.log("✅ API Credentials Generated!\n");
    console.log("Add these to your .env file:");
    console.log("─".repeat(50));
    console.log(`POLY_API_KEY=${apiCreds.key}`);
    console.log(`POLY_API_SECRET=${apiCreds.secret}`);
    console.log(`POLY_PASSPHRASE=${apiCreds.passphrase}`);
    console.log("─".repeat(50));
    console.log("");
    console.log("⚠️  Keep these secret! Anyone with these can trade from your wallet.");
    console.log("");

    // Test the credentials
    console.log("Testing credentials...");
    const client = new ClobClient(CLOB_HOST, CHAIN_ID, signer, apiCreds, 0);

    // Try to get open orders (should return empty array for new account)
    const openOrders = await client.getOpenOrders();
    console.log(`✅ Credentials work! Open orders: ${openOrders.length}`);

  } catch (error) {
    console.error("Error generating credentials:", error);
    process.exit(1);
  }
}

main();
