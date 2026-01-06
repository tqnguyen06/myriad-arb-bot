/**
 * Price Monitor for Myriad Markets
 *
 * This module continuously monitors Up/Down markets for arbitrage opportunities.
 * An opportunity exists when the sum of outcome prices deviates from $1.00.
 */

import "dotenv/config";
import { createPublicClient, http, formatUnits } from "viem";
import { abstractChain, CONTRACTS, BOT_CONFIG } from "./config.js";
import { PREDICTION_MARKET_ABI } from "./abi.js";
import type { MarketPrices, ArbitrageOpportunity, Market } from "./types.js";

// Known Up/Down market question IDs
// You need to discover these by monitoring the contract or scraping the frontend
const MONITORED_MARKETS: Market[] = [
  // Example - replace with actual market IDs from Myriad
  // {
  //   questionId: "0x935f27056af34cf2883997dcba39b898322292e6b604fb24614bd7b1cbb4b9fe",
  //   name: "BTC Up or Down?",
  //   outcomes: ["Up", "Down"],
  //   token: "PTS",
  //   resolved: false,
  // },
];

const client = createPublicClient({
  chain: abstractChain,
  transport: http(),
});

async function getPrice(
  questionId: `0x${string}`,
  outcomeIndex: number
): Promise<number> {
  try {
    const price = await client.readContract({
      address: CONTRACTS.PREDICTION_MARKET,
      abi: PREDICTION_MARKET_ABI,
      functionName: "getPrice",
      args: [questionId, BigInt(outcomeIndex)],
    });
    return parseFloat(formatUnits(price, 18));
  } catch (error) {
    // If getPrice doesn't exist, try alternative method
    console.error(`getPrice failed for ${questionId}:`, error);
    return 0;
  }
}

async function getMarketPrices(
  questionId: `0x${string}`
): Promise<MarketPrices> {
  const [price0, price1] = await Promise.all([
    getPrice(questionId, 0),
    getPrice(questionId, 1),
  ]);

  return {
    questionId,
    prices: [price0, price1],
    totalPrice: price0 + price1,
    timestamp: Date.now(),
  };
}

function detectArbitrage(
  market: Market,
  prices: MarketPrices
): ArbitrageOpportunity | null {
  const deviation = Math.abs(prices.totalPrice - 1.0);

  // Long arbitrage: total < 1.0 (buy both outcomes)
  if (prices.totalPrice < 1.0 - BOT_CONFIG.MIN_PROFIT_THRESHOLD) {
    const profit = 1.0 - prices.totalPrice;
    return {
      market,
      prices,
      type: "long",
      profit,
      profitAmount: profit * BOT_CONFIG.MAX_POSITION_SIZE_USDC,
    };
  }

  // Short arbitrage: total > 1.0 (sell both outcomes if you hold them)
  if (prices.totalPrice > 1.0 + BOT_CONFIG.MIN_PROFIT_THRESHOLD) {
    const profit = prices.totalPrice - 1.0;
    return {
      market,
      prices,
      type: "short",
      profit,
      profitAmount: profit * BOT_CONFIG.MAX_POSITION_SIZE_USDC,
    };
  }

  return null;
}

async function monitorMarkets(): Promise<void> {
  console.log("=".repeat(60));
  console.log(`[${new Date().toISOString()}] Scanning markets...`);

  if (MONITORED_MARKETS.length === 0) {
    console.log("\nNo markets configured to monitor!");
    console.log("You need to add market question IDs to MONITORED_MARKETS.");
    console.log("\nTo find market IDs:");
    console.log("1. Open browser dev tools on myriad.markets");
    console.log('2. Go to Network tab, filter by "Fetch/XHR"');
    console.log("3. Look for market data requests");
    console.log("4. Find the questionId/conditionId fields\n");
    return;
  }

  for (const market of MONITORED_MARKETS) {
    if (market.resolved) continue;

    try {
      const prices = await getMarketPrices(market.questionId);

      console.log(`\n${market.name}`);
      console.log(`  ${market.outcomes[0]}: ${(prices.prices[0] * 100).toFixed(2)}%`);
      console.log(`  ${market.outcomes[1]}: ${(prices.prices[1] * 100).toFixed(2)}%`);
      console.log(`  Total: ${(prices.totalPrice * 100).toFixed(2)}%`);

      const opportunity = detectArbitrage(market, prices);

      if (opportunity) {
        console.log("\n  *** ARBITRAGE OPPORTUNITY DETECTED ***");
        console.log(`  Type: ${opportunity.type.toUpperCase()}`);
        console.log(`  Profit: ${(opportunity.profit * 100).toFixed(2)}%`);
        console.log(`  Est. Amount: $${opportunity.profitAmount.toFixed(2)}`);
        console.log("  *".repeat(20));

        // Here you would trigger the execution
        // await executeArbitrage(opportunity);
      }
    } catch (error) {
      console.error(`Error monitoring ${market.name}:`, error);
    }
  }
}

async function main(): Promise<void> {
  console.log("Myriad Markets Arbitrage Monitor");
  console.log("================================\n");
  console.log(`Chain: Abstract (${abstractChain.id})`);
  console.log(`Contract: ${CONTRACTS.PREDICTION_MARKET}`);
  console.log(`Min Profit Threshold: ${BOT_CONFIG.MIN_PROFIT_THRESHOLD * 100}%`);
  console.log(`Poll Interval: ${BOT_CONFIG.POLL_INTERVAL_MS}ms`);
  console.log(`Dry Run: ${BOT_CONFIG.DRY_RUN}`);
  console.log("\nStarting monitor...\n");

  // Initial scan
  await monitorMarkets();

  // Continuous monitoring
  setInterval(async () => {
    await monitorMarkets();
  }, BOT_CONFIG.POLL_INTERVAL_MS);
}

main().catch(console.error);
