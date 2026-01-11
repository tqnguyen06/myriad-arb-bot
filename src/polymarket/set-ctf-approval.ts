import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { polygon } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"; // Conditional Token Framework
const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"; // CTF Exchange
const NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a"; // Neg Risk CTF Exchange

const ctfAbi = [
  {
    name: "setApprovalForAll",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "approved", type: "bool" },
    ],
    outputs: [],
  },
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
  const privateKey = process.env.POLYGON_PRIVATE_KEY;
  if (!privateKey) {
    console.error("ERROR: POLYGON_PRIVATE_KEY not set");
    process.exit(1);
  }

  const account = privateKeyToAccount(
    (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`
  );

  console.log("Setting CTF approvals for selling shares...");
  console.log("Wallet:", account.address);
  console.log("");

  const publicClient = createPublicClient({
    chain: polygon,
    transport: http("https://polygon-rpc.com"),
  });

  const walletClient = createWalletClient({
    account,
    chain: polygon,
    transport: http("https://polygon-rpc.com"),
  });

  // Approve CTF Exchange
  console.log("Approving CTF Exchange...");
  const isCtfApproved = await publicClient.readContract({
    address: CTF_CONTRACT,
    abi: ctfAbi,
    functionName: "isApprovedForAll",
    args: [account.address, CTF_EXCHANGE],
  });

  if (isCtfApproved) {
    console.log("  Already approved!");
  } else {
    const hash1 = await walletClient.writeContract({
      address: CTF_CONTRACT,
      abi: ctfAbi,
      functionName: "setApprovalForAll",
      args: [CTF_EXCHANGE, true],
    });
    console.log("  TX:", hash1);
    await publicClient.waitForTransactionReceipt({ hash: hash1 });
    console.log("  ✅ CTF Exchange approved!");
  }

  // Approve Neg Risk CTF Exchange
  console.log("Approving Neg Risk CTF Exchange...");
  const isNegRiskApproved = await publicClient.readContract({
    address: CTF_CONTRACT,
    abi: ctfAbi,
    functionName: "isApprovedForAll",
    args: [account.address, NEG_RISK_CTF_EXCHANGE],
  });

  if (isNegRiskApproved) {
    console.log("  Already approved!");
  } else {
    const hash2 = await walletClient.writeContract({
      address: CTF_CONTRACT,
      abi: ctfAbi,
      functionName: "setApprovalForAll",
      args: [NEG_RISK_CTF_EXCHANGE, true],
    });
    console.log("  TX:", hash2);
    await publicClient.waitForTransactionReceipt({ hash: hash2 });
    console.log("  ✅ Neg Risk CTF Exchange approved!");
  }

  console.log("\nDone! You can now sell your shares.");
}

main().catch(console.error);
