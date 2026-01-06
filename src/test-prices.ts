/**
 * Test script to verify we can read market prices from the contract
 */

import "dotenv/config";
import { createPublicClient, http, formatUnits } from "viem";
import { abstractChain, CONTRACTS } from "./config.js";
import { PREDICTION_MARKET_ABI } from "./abi.js";

const client = createPublicClient({
  chain: abstractChain,
  transport: http(),
});

const MARKETS = [
  {
    questionId: "0x935f27056af34cf2883997dcba39b898322292e6b604fb24614bd7b1cbb4b9fe",
    name: "BTC: Pump or Dump?",
  },
  {
    questionId: "0x66ec83e1b5d401c2f705d2895e03f32cd60085f490f01446db1d8ded82181401",
    name: "ETH: Pump or Dump?",
  },
  {
    questionId: "0x07d1e464c47a410a7f237898192cdccf033302c143afa9ee0c2addee2f564084",
    name: "Up or Down? (Main)",
  },
];

async function testGetPrice(questionId: string, outcomeIndex: number): Promise<number | null> {
  try {
    const price = await client.readContract({
      address: CONTRACTS.PREDICTION_MARKET,
      abi: PREDICTION_MARKET_ABI,
      functionName: "getPrice",
      args: [questionId as `0x${string}`, BigInt(outcomeIndex)],
    });
    return parseFloat(formatUnits(price, 18));
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    getPrice failed: ${msg.substring(0, 100)}`);
    return null;
  }
}

async function testGetBuyPrice(questionId: string, outcomeIndex: number, amount: bigint): Promise<bigint | null> {
  try {
    const cost = await client.readContract({
      address: CONTRACTS.PREDICTION_MARKET,
      abi: PREDICTION_MARKET_ABI,
      functionName: "getBuyPrice",
      args: [questionId as `0x${string}`, BigInt(outcomeIndex), amount],
    });
    return cost;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`    getBuyPrice failed: ${msg.substring(0, 100)}`);
    return null;
  }
}

async function main() {
  console.log("Testing Myriad Price Reading");
  console.log("============================\n");
  console.log(`Contract: ${CONTRACTS.PREDICTION_MARKET}`);
  console.log(`Chain: Abstract (${abstractChain.id})\n`);

  for (const market of MARKETS) {
    console.log(`\n${market.name}`);
    console.log(`  questionId: ${market.questionId}`);

    // Try getPrice for both outcomes
    console.log("\n  Testing getPrice():");
    const price0 = await testGetPrice(market.questionId, 0);
    const price1 = await testGetPrice(market.questionId, 1);

    if (price0 !== null && price1 !== null) {
      console.log(`    Outcome 0: ${(price0 * 100).toFixed(2)}%`);
      console.log(`    Outcome 1: ${(price1 * 100).toFixed(2)}%`);
      console.log(`    Total: ${((price0 + price1) * 100).toFixed(2)}%`);

      const deviation = Math.abs((price0 + price1) - 1.0);
      if (deviation > 0.01) {
        console.log(`    >>> POTENTIAL ARB: ${(deviation * 100).toFixed(2)}% deviation <<<`);
      }
    }

    // Try getBuyPrice (cost to buy 1 share)
    console.log("\n  Testing getBuyPrice() for 1e18 shares:");
    const buyAmount = BigInt(1e18); // 1 share
    const buyCost0 = await testGetBuyPrice(market.questionId, 0, buyAmount);
    const buyCost1 = await testGetBuyPrice(market.questionId, 1, buyAmount);

    if (buyCost0 !== null) {
      console.log(`    Cost for 1 share of Outcome 0: ${formatUnits(buyCost0, 18)}`);
    }
    if (buyCost1 !== null) {
      console.log(`    Cost for 1 share of Outcome 1: ${formatUnits(buyCost1, 18)}`);
    }
  }

  console.log("\n\nDone!");
}

main().catch(console.error);
