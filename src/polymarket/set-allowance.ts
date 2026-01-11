/**
 * Set up trading allowances for Polymarket
 *
 * This approves the CTF Exchange contract to spend your USDC
 */

import "dotenv/config";
import { Wallet, Contract, providers } from "ethers";

// Polygon USDC contract
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
// Polymarket CTF Exchange
const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
// Polymarket Neg Risk CTF Exchange
const NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";
// Polymarket Neg Risk Adapter
const NEG_RISK_ADAPTER = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296";

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];

async function main() {
  const pk = process.env.POLYGON_PRIVATE_KEY || "";
  if (!pk) {
    console.log("No private key set");
    return;
  }

  // Connect to Polygon
  const provider = new providers.JsonRpcProvider("https://polygon-mainnet.g.alchemy.com/v2/e0l6H5h159K0lmUDOmSVMlM0C9rVgPoU");
  const signer = new Wallet(pk.startsWith("0x") ? pk : "0x" + pk, provider);

  console.log("Wallet:", signer.address);

  // Check MATIC balance for gas
  const maticBalance = await provider.getBalance(signer.address);
  console.log("MATIC balance:", (Number(maticBalance) / 1e18).toFixed(4), "MATIC");

  if (maticBalance < BigInt(1e16)) { // Less than 0.01 MATIC
    console.log("\n⚠️  Not enough MATIC for gas! Send some MATIC to this wallet.");
    return;
  }

  // Check USDC balance and allowances
  const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, signer);

  const balance = await usdc.balanceOf(signer.address);
  console.log("USDC in wallet:", (Number(balance) / 1e6).toFixed(2), "USDC");

  const allowance1 = await usdc.allowance(signer.address, CTF_EXCHANGE);
  const allowance2 = await usdc.allowance(signer.address, NEG_RISK_CTF_EXCHANGE);
  const allowance3 = await usdc.allowance(signer.address, NEG_RISK_ADAPTER);

  console.log("\nCurrent allowances:");
  console.log("  CTF Exchange:", (Number(allowance1) / 1e6).toFixed(2), "USDC");
  console.log("  Neg Risk CTF Exchange:", (Number(allowance2) / 1e6).toFixed(2), "USDC");
  console.log("  Neg Risk Adapter:", (Number(allowance3) / 1e6).toFixed(2), "USDC");

  // If allowances are 0, we need to approve
  const MAX_UINT = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

  // Gas settings for Polygon (need higher fees due to network congestion)
  const gasOptions = {
    maxPriorityFeePerGas: 50000000000, // 50 gwei
    maxFeePerGas: 300000000000, // 300 gwei (high to handle congestion)
    gasLimit: 100000, // Manual gas limit for approve
  };

  if (allowance1 == BigInt(0)) {
    console.log("\nApproving CTF Exchange...");
    const tx1 = await usdc.approve(CTF_EXCHANGE, MAX_UINT, gasOptions);
    console.log("  TX:", tx1.hash);
    await tx1.wait();
    console.log("  ✅ Approved");
  }

  if (allowance2 == BigInt(0)) {
    console.log("\nApproving Neg Risk CTF Exchange...");
    const tx2 = await usdc.approve(NEG_RISK_CTF_EXCHANGE, MAX_UINT, gasOptions);
    console.log("  TX:", tx2.hash);
    await tx2.wait();
    console.log("  ✅ Approved");
  }

  if (allowance3 == BigInt(0)) {
    console.log("\nApproving Neg Risk Adapter...");
    const tx3 = await usdc.approve(NEG_RISK_ADAPTER, MAX_UINT, gasOptions);
    console.log("  TX:", tx3.hash);
    await tx3.wait();
    console.log("  ✅ Approved");
  }

  console.log("\n✅ Allowances set up! Try placing an order now.");
}

main().catch(console.error);
