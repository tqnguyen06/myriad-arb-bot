import "dotenv/config";
import { createPublicClient, http, formatUnits } from "viem";
import { polygon } from "viem/chains";
import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

const WALLET = "0x0D2d5487ca075F5b4606d51533B08C3A69c6400E";
const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";
const NEG_RISK_ADAPTER = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296";

const TOKEN_ID = "67458767289404585234744660199191729864647269546936372565997492523516079162996";

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
  console.log("=== FULL DIAGNOSTICS ===\n");

  const client = createPublicClient({
    chain: polygon,
    transport: http("https://polygon-rpc.com"),
  });

  // 1. Check on-chain token balance
  console.log("1. ON-CHAIN TOKEN BALANCE:");
  const balance = await client.readContract({
    address: CTF_CONTRACT,
    abi: ctfAbi,
    functionName: "balanceOf",
    args: [WALLET, BigInt(TOKEN_ID)],
  });
  console.log(`   Token ${TOKEN_ID.slice(0, 20)}...`);
  console.log(`   Balance: ${formatUnits(balance, 6)} shares`);
  console.log("");

  // 2. Check on-chain approvals
  console.log("2. ON-CHAIN APPROVALS:");

  const ctfApproved = await client.readContract({
    address: CTF_CONTRACT,
    abi: ctfAbi,
    functionName: "isApprovedForAll",
    args: [WALLET, CTF_EXCHANGE],
  });
  console.log(`   CTF Exchange: ${ctfApproved ? "✅ APPROVED" : "❌ NOT APPROVED"}`);

  const negRiskApproved = await client.readContract({
    address: CTF_CONTRACT,
    abi: ctfAbi,
    functionName: "isApprovedForAll",
    args: [WALLET, NEG_RISK_CTF_EXCHANGE],
  });
  console.log(`   Neg Risk CTF Exchange: ${negRiskApproved ? "✅ APPROVED" : "❌ NOT APPROVED"}`);

  const adapterApproved = await client.readContract({
    address: CTF_CONTRACT,
    abi: ctfAbi,
    functionName: "isApprovedForAll",
    args: [WALLET, NEG_RISK_ADAPTER],
  });
  console.log(`   Neg Risk Adapter: ${adapterApproved ? "✅ APPROVED" : "❌ NOT APPROVED"}`);
  console.log("");

  // 3. Check CLOB server's view
  console.log("3. CLOB SERVER BALANCE/ALLOWANCE:");
  const privateKey = process.env.POLYGON_PRIVATE_KEY!;
  const signer = new Wallet(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);
  const creds = {
    key: process.env.POLY_API_KEY!,
    secret: process.env.POLY_API_SECRET!,
    passphrase: process.env.POLY_PASSPHRASE!,
  };
  const clobClient = new ClobClient("https://clob.polymarket.com", 137, signer, creds, 0);

  try {
    const ba = await clobClient.getBalanceAllowance({
      asset_type: "CONDITIONAL",
      token_id: TOKEN_ID,
    });
    console.log(`   CLOB Balance: ${ba.balance}`);
    console.log(`   CLOB Allowances:`);
    for (const [addr, allowance] of Object.entries(ba.allowances || {})) {
      const name =
        addr.toLowerCase() === CTF_EXCHANGE.toLowerCase() ? "CTF Exchange" :
        addr.toLowerCase() === NEG_RISK_CTF_EXCHANGE.toLowerCase() ? "Neg Risk CTF Exchange" :
        addr.toLowerCase() === NEG_RISK_ADAPTER.toLowerCase() ? "Neg Risk Adapter" :
        addr;
      const status = BigInt(allowance as string) > 0n ? "✅" : "❌";
      console.log(`     ${name}: ${status}`);
    }
  } catch (e: any) {
    console.log(`   Error: ${e.message || e}`);
  }
  console.log("");

  // 4. Try to update CLOB allowance
  console.log("4. UPDATING CLOB ALLOWANCE CACHE:");
  try {
    await clobClient.updateBalanceAllowance({
      asset_type: "CONDITIONAL",
      token_id: TOKEN_ID,
    });
    console.log("   ✅ Update sent");

    // Check again
    const ba2 = await clobClient.getBalanceAllowance({
      asset_type: "CONDITIONAL",
      token_id: TOKEN_ID,
    });
    console.log(`   New CLOB Allowances:`);
    for (const [addr, allowance] of Object.entries(ba2.allowances || {})) {
      const name =
        addr.toLowerCase() === CTF_EXCHANGE.toLowerCase() ? "CTF Exchange" :
        addr.toLowerCase() === NEG_RISK_CTF_EXCHANGE.toLowerCase() ? "Neg Risk CTF Exchange" :
        addr.toLowerCase() === NEG_RISK_ADAPTER.toLowerCase() ? "Neg Risk Adapter" :
        addr;
      const status = BigInt(allowance as string) > 0n ? "✅" : "❌";
      console.log(`     ${name}: ${status}`);
    }
  } catch (e: any) {
    console.log(`   Error: ${e.message || e}`);
  }

  console.log("\n=== END DIAGNOSTICS ===");
}

main().catch(console.error);
