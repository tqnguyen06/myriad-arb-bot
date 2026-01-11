import "dotenv/config";
import { createPublicClient, http, formatUnits } from "viem";
import { polygon } from "viem/chains";
import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

const WALLET = "0x0D2d5487ca075F5b4606d51533B08C3A69c6400E";
const CTF = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";

// These are the FULL token IDs
const TOKENS = [
  "98328612241005079298480582300548815593588797496125488765752746802492445498580",
  "113190006934473670027813688637035351508576068082510530239150849587212889396175",
];

const abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "id", type: "uint256" },
    ],
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

  console.log("=== VERIFYING TOKEN BALANCES ===\n");

  for (const tokenId of TOKENS) {
    console.log(`Token: ${tokenId}`);

    // On-chain balance
    const onChain = await viemClient.readContract({
      address: CTF,
      abi,
      functionName: "balanceOf",
      args: [WALLET, BigInt(tokenId)],
    });
    console.log(`  On-chain: ${formatUnits(onChain, 6)} shares`);

    // CLOB balance
    try {
      const clob = await clobClient.getBalanceAllowance({
        asset_type: "CONDITIONAL",
        token_id: tokenId,
      });
      console.log(`  CLOB: ${(parseInt(clob.balance) / 1e6).toFixed(6)} shares`);

      if (onChain > 0n && clob.balance === "0") {
        console.log("  ⚠️  MISMATCH! CLOB cache is stale");
        console.log("  Forcing update...");
        await clobClient.updateBalanceAllowance({
          asset_type: "CONDITIONAL",
          token_id: tokenId,
        });
        // Check again
        const clob2 = await clobClient.getBalanceAllowance({
          asset_type: "CONDITIONAL",
          token_id: tokenId,
        });
        console.log(`  CLOB after update: ${(parseInt(clob2.balance) / 1e6).toFixed(6)} shares`);
      }
    } catch (e: any) {
      console.log(`  CLOB Error: ${e.message}`);
    }
    console.log("");
  }
}

main().catch(console.error);
