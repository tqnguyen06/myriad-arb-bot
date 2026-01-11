import "dotenv/config";
import { createPublicClient, http, formatUnits } from "viem";
import { polygon } from "viem/chains";

// Token IDs from trades - these are the markets you traded
const TOKEN_IDS = [
  "67458767289404585234744660199191729864647269546936372565997492523516079162996", // Yes token
  "113554675031456886662456333518442351760965732494459471513820718399879139049322", // No token
];

const WALLET = "0x0D2d5487ca075F5b4606d51533B08C3A69c6400E";
const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"; // Conditional Token Framework

const client = createPublicClient({
  chain: polygon,
  transport: http("https://polygon-rpc.com"),
});

const ctfAbi = [
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
  console.log("Checking conditional token (share) balances...");
  console.log("Wallet:", WALLET);
  console.log("");

  for (const tokenId of TOKEN_IDS) {
    try {
      const balance = await client.readContract({
        address: CTF_CONTRACT,
        abi: ctfAbi,
        functionName: "balanceOf",
        args: [WALLET, BigInt(tokenId)],
      });
      const label = tokenId.startsWith("67") ? "Yes" : "No";
      console.log(`${label} Token (${tokenId.slice(0, 15)}...):`);
      console.log(`  Balance: ${formatUnits(balance, 6)} shares`);
      console.log("");
    } catch (e) {
      console.log(`Token ${tokenId.slice(0, 15)}... Error:`, e);
    }
  }
}

main().catch(console.error);
