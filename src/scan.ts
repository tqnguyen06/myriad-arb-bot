/**
 * Scan all Myriad markets for arbitrage opportunities
 */

import { scanAllMarketsForArb, fetchAllMarkets } from "./api.js";

async function main() {
  console.log("Scanning Myriad Markets for Arbitrage Opportunities");
  console.log("====================================================\n");

  // First, list all binary markets with their current prices
  console.log("All Binary Markets:\n");
  const markets = await fetchAllMarkets();

  let binaryCount = 0;
  for (const market of markets) {
    if (market.outcomes.length === 2 && market.state === "open") {
      binaryCount++;
      const prices = market.outcomes.map((o) => o.price);
      const total = prices[0] + prices[1];
      const deviation = Math.abs(total - 1.0);

      const status =
        deviation > 0.01
          ? ">>> ARB <<<"
          : deviation > 0.005
            ? "* close *"
            : "";

      console.log(`[${market.id}] ${market.title.substring(0, 50)}...`);
      console.log(
        `    ${market.outcomes[0].title}: ${(prices[0] * 100).toFixed(2)}%`
      );
      console.log(
        `    ${market.outcomes[1].title}: ${(prices[1] * 100).toFixed(2)}%`
      );
      console.log(`    Total: ${(total * 100).toFixed(2)}% ${status}`);
      console.log("");
    }
  }

  console.log(`Found ${binaryCount} binary markets\n`);

  // Now show top arbitrage opportunities
  console.log("=".repeat(50));
  console.log("ARBITRAGE OPPORTUNITIES RANKED BY DEVIATION");
  console.log("=".repeat(50) + "\n");

  const opportunities = await scanAllMarketsForArb();

  for (const opp of opportunities.slice(0, 10)) {
    const type = opp.totalPrice < 1.0 ? "LONG" : "SHORT";
    const profitPer100 = opp.deviation * 100;

    console.log(`Market ID: ${opp.market.id}`);
    console.log(`Title: ${opp.market.title}`);
    console.log(`Slug: ${opp.market.slug}`);
    console.log(
      `Prices: ${opp.prices.map((p) => (p * 100).toFixed(2) + "%").join(" + ")}`
    );
    console.log(`Total: ${(opp.totalPrice * 100).toFixed(2)}%`);
    console.log(`Deviation: ${(opp.deviation * 100).toFixed(3)}%`);
    console.log(`Type: ${type} (${type === "LONG" ? "buy both" : "sell both"})`);
    console.log(`Profit per $100: $${profitPer100.toFixed(2)}`);
    console.log("");
  }

  // Summary
  const profitable = opportunities.filter((o) => o.deviation > 0.01);
  console.log("=".repeat(50));
  console.log("SUMMARY");
  console.log("=".repeat(50));
  console.log(`Total binary markets: ${binaryCount}`);
  console.log(`Markets with >1% deviation: ${profitable.length}`);

  if (profitable.length > 0) {
    console.log(
      "\nPotentially profitable markets:"
    );
    for (const p of profitable) {
      console.log(
        `  [${p.market.id}] ${(p.deviation * 100).toFixed(2)}% - ${p.market.title.substring(0, 40)}`
      );
    }
  } else {
    console.log("\nNo significant arbitrage opportunities found.");
    console.log("Markets are efficiently priced (total ~= 100%)");
  }
}

main().catch(console.error);
