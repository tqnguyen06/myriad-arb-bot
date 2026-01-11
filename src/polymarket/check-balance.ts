import { createPublicClient, http, formatUnits } from "viem";
import { polygon } from "viem/chains";

const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const WALLET = "0x0D2d5487ca075F5b4606d51533B08C3A69c6400E";

const client = createPublicClient({
  chain: polygon,
  transport: http("https://polygon-rpc.com"),
});

const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

async function main() {
  console.log("Checking USDC balance and allowance...");
  console.log("Wallet:", WALLET);
  console.log("CTF Exchange:", CTF_EXCHANGE);
  console.log("");

  const balance = await client.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [WALLET],
  });

  const allowance = await client.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [WALLET, CTF_EXCHANGE],
  });

  console.log("USDC Balance:", formatUnits(balance, 6), "USDC");
  console.log("CTF Exchange Allowance:", formatUnits(allowance, 6), "USDC");

  if (balance === 0n) {
    console.log("\n⚠️  No USDC balance! You need to deposit USDC to trade.");
  }

  if (allowance === 0n) {
    console.log("\n⚠️  No allowance set! Run: npx tsx src/polymarket/set-allowance.ts");
  } else if (allowance < balance) {
    console.log("\n⚠️  Allowance less than balance. Consider increasing allowance.");
  }
}

main().catch(console.error);
