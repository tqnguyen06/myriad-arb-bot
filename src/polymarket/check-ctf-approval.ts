import "dotenv/config";
import { createPublicClient, http } from "viem";
import { polygon } from "viem/chains";

const WALLET = "0x0D2d5487ca075F5b4606d51533B08C3A69c6400E";
const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"; // Conditional Token Framework
const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"; // CTF Exchange
const NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a"; // Neg Risk CTF Exchange

const client = createPublicClient({
  chain: polygon,
  transport: http("https://polygon-rpc.com"),
});

// ERC1155 uses isApprovedForAll instead of allowance
const ctfAbi = [
  {
    name: "isApprovedForAll",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

async function main() {
  console.log("Checking CTF (conditional token) approvals...");
  console.log("Wallet:", WALLET);
  console.log("");

  // Check approval for CTF Exchange
  const ctfApproved = await client.readContract({
    address: CTF_CONTRACT,
    abi: ctfAbi,
    functionName: "isApprovedForAll",
    args: [WALLET, CTF_EXCHANGE],
  });
  console.log("CTF Exchange approved:", ctfApproved);

  // Check approval for Neg Risk CTF Exchange
  const negRiskApproved = await client.readContract({
    address: CTF_CONTRACT,
    abi: ctfAbi,
    functionName: "isApprovedForAll",
    args: [WALLET, NEG_RISK_CTF_EXCHANGE],
  });
  console.log("Neg Risk CTF Exchange approved:", negRiskApproved);

  if (!ctfApproved || !negRiskApproved) {
    console.log("\n⚠️  You need to approve the exchange to sell your shares!");
    console.log("Run: npx tsx src/polymarket/set-ctf-approval.ts");
  }
}

main().catch(console.error);
