import "dotenv/config";
import { createPublicClient, http, formatUnits } from "viem";
import { polygon } from "viem/chains";
import { ClobClient } from "@polymarket/clob-client";
import { Wallet } from "ethers";

const WALLET = "0x0D2d5487ca075F5b4606d51533B08C3A69c6400E";
const CTF_CONTRACT = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";

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
  console.log("=== CURRENT POSITIONS ===\n");
  console.log("Wallet:", WALLET);

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

  // Get all trades to find unique token IDs
  console.log("\nScanning trades for token IDs...");
  const trades = (await clobClient.getTrades()) as any[];

  const tokenIds = new Set<string>();
  for (const trade of trades) {
    if (trade.asset_id) {
      tokenIds.add(trade.asset_id);
    }
    // Also check maker_orders for asset IDs
    if (trade.maker_orders) {
      for (const mo of trade.maker_orders) {
        if (mo.asset_id) {
          tokenIds.add(mo.asset_id);
        }
      }
    }
  }

  console.log(`Found ${tokenIds.size} unique tokens in trade history\n`);

  // Check on-chain balance for each token
  console.log("Checking on-chain balances...\n");
  const positions: { tokenId: string; balance: number }[] = [];

  for (const tokenId of tokenIds) {
    try {
      const balance = await viemClient.readContract({
        address: CTF_CONTRACT,
        abi: ctfAbi,
        functionName: "balanceOf",
        args: [WALLET, BigInt(tokenId)],
      });

      const balanceNum = parseFloat(formatUnits(balance, 6));
      if (balanceNum > 0) {
        positions.push({ tokenId, balance: balanceNum });
        console.log(`✅ ${tokenId.slice(0, 25)}... : ${balanceNum} shares`);
      }
    } catch (e) {
      // Skip errors
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`TOTAL POSITIONS: ${positions.length}`);

  if (positions.length === 0) {
    console.log("\nNo open positions! All shares have been sold or resolved.");
  } else {
    console.log("\nPositions with balances:");
    for (const pos of positions) {
      // Get price info
      try {
        const price = await clobClient.getPrice(pos.tokenId, "sell");
        const value = pos.balance * parseFloat((price as any).price || "0");
        console.log(`  ${pos.tokenId.slice(0, 20)}...`);
        console.log(`    Shares: ${pos.balance}`);
        console.log(`    Price: ${(price as any).price}`);
        console.log(`    Value: ~$${value.toFixed(2)}`);
      } catch {
        console.log(`  ${pos.tokenId.slice(0, 20)}...`);
        console.log(`    Shares: ${pos.balance}`);
        console.log(`    Price: unknown`);
      }
    }
  }

  // Also show open orders
  console.log("\n" + "=".repeat(50));
  console.log("OPEN ORDERS:");
  try {
    const openOrders = await clobClient.getOpenOrders();
    console.log(`${(openOrders as any[]).length} open orders`);
    for (const order of (openOrders as any[]).slice(0, 5)) {
      console.log(`  ${order.side} ${order.original_size} @ ${order.price} (${order.asset_id?.slice(0, 15)}...)`);
    }
  } catch (e) {
    console.log("  Error fetching orders");
  }
}

main().catch(console.error);
