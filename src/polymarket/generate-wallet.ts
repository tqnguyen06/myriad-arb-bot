/**
 * Generate a new Ethereum wallet for Polymarket trading
 */

import { Wallet } from "ethers";

const wallet = Wallet.createRandom();

console.log("=".repeat(50));
console.log("NEW WALLET GENERATED");
console.log("=".repeat(50));
console.log("");
console.log("Address:", wallet.address);
console.log("");
console.log("Private Key:", wallet.privateKey);
console.log("");
console.log("=".repeat(50));
console.log("");
console.log("IMPORTANT:");
console.log("1. Save the private key securely - you cannot recover it!");
console.log("2. Send USDC (on Polygon network) to the address above");
console.log("3. Update your .env file with:");
console.log(`   POLYGON_PRIVATE_KEY=${wallet.privateKey}`);
console.log("4. Run 'npm run poly:setup' to generate new API credentials");
console.log("");
