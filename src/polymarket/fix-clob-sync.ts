import "dotenv/config";
import { createPublicClient, http, formatUnits } from "viem";
import { polygon } from "viem/chains";
import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

const WALLET = "0x0D2d5487ca075F5b4606d51533B08C3A69c6400E";
const CTF = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";

const abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }, { name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function main() {
  const viemClient = createPublicClient({
    chain: polygon,
    transport: http("https://polygon-rpc.com"),
  });

  const privateKey = process.env.POLYGON_PRIVATE_KEY!;
  const signer = new Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  const creds = {
    key: process.env.POLY_API_KEY!,
    secret: process.env.POLY_API_SECRET!,
    passphrase: process.env.POLY_PASSPHRASE!,
  };
  const clobClient = new ClobClient("https://clob.polymarket.com", 137, signer, creds, 0);

  console.log("=== FINDING AND FIXING ALL TOKEN BALANCES ===\n");

  // 1. First sync USDC
  console.log("1. Syncing USDC balance...");
  await clobClient.updateBalanceAllowance({ asset_type: "COLLATERAL" });
  const usdc = await clobClient.getBalanceAllowance({ asset_type: "COLLATERAL" });
  console.log(`   USDC: $${(parseInt(usdc.balance) / 1e6).toFixed(2)}\n`);

  // 2. Get ALL token IDs from trades
  console.log("2. Getting all token IDs from trades...");
  const trades = (await clobClient.getTrades()) as any[];
  const tokenIds = new Set<string>();

  for (const trade of trades) {
    if (trade.asset_id) tokenIds.add(trade.asset_id);
    if (trade.maker_orders) {
      for (const mo of trade.maker_orders) {
        if (mo.asset_id) tokenIds.add(mo.asset_id);
      }
    }
  }
  console.log(`   Found ${tokenIds.size} unique tokens\n`);

  // 3. Check each token on-chain and sync with CLOB
  console.log("3. Checking and syncing each token...\n");

  for (const tokenId of tokenIds) {
    // Check on-chain balance
    const onChain = await viemClient.readContract({
      address: CTF,
      abi,
      functionName: "balanceOf",
      args: [WALLET, BigInt(tokenId)],
    });
    const onChainBal = parseFloat(formatUnits(onChain, 6));

    if (onChainBal > 0) {
      console.log(`Token ${tokenId.slice(0, 25)}...`);
      console.log(`  On-chain: ${onChainBal.toFixed(2)} shares`);

      // Get CLOB balance
      const clob = await clobClient.getBalanceAllowance({
        asset_type: "CONDITIONAL",
        token_id: tokenId,
      });
      const clobBal = parseInt(clob.balance) / 1e6;
      console.log(`  CLOB: ${clobBal.toFixed(2)} shares`);

      // If mismatch, force sync
      if (Math.abs(onChainBal - clobBal) > 0.01) {
        console.log(`  ⚠️ MISMATCH - forcing sync...`);
        await clobClient.updateBalanceAllowance({
          asset_type: "CONDITIONAL",
          token_id: tokenId,
        });

        // Verify
        const clob2 = await clobClient.getBalanceAllowance({
          asset_type: "CONDITIONAL",
          token_id: tokenId,
        });
        console.log(`  After sync: ${(parseInt(clob2.balance) / 1e6).toFixed(2)} shares`);
      } else {
        console.log(`  ✅ In sync`);
      }
      console.log("");
    }
  }

  console.log("=== DONE ===");
}

main().catch(console.error);
