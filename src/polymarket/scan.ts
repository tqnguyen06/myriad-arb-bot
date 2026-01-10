/**
 * Polymarket Scanner
 *
 * Scans Polymarket for spread opportunities and displays them.
 * Run with: npm run poly:scan
 */

import "dotenv/config";
import { fetchAllMarkets, findSpreadOpportunities } from "./api.js";

async function main() {
  console.log("Scanning Polymarket for Opportunities");
  console.log("=====================================\n");

  // Fetch all markets
  const markets = await fetchAllMarkets();
  console.log(`Total open markets: ${markets.length}`);

  // Filter to binary markets with orderbook
  const tradeable = markets.filter(
    (m) => m.enableOrderBook && !m.closed && m.outcomes.length === 2
  );
  console.log(`Tradeable binary markets: ${tradeable.length}`);
  console.log("");

  // Find spread opportunities
  const opportunities = await findSpreadOpportunities(1, 1000);

  console.log("=".repeat(80));
  console.log("SPREAD OPPORTUNITIES (>1% spread, >$1k daily volume)");
  console.log("=".repeat(80));
  console.log("");

  if (opportunities.length === 0) {
    console.log("No opportunities found matching criteria.");
    return;
  }

  console.log(`Found ${opportunities.length} opportunities\n`);

  // Display top opportunities
  opportunities.slice(0, 20).forEach((opp, i) => {
    const m = opp.market;
    console.log(`${i + 1}. ${m.question}`);
    console.log(`   Slug: ${m.slug}`);
    console.log(
      `   Bid: ${(m.bestBid * 100).toFixed(1)}¢ | Ask: ${(m.bestAsk * 100).toFixed(1)}¢ | Spread: ${m.spreadPct.toFixed(2)}%`
    );
    console.log(
      `   24h Vol: $${(m.volume24hr / 1000).toFixed(1)}k | Liquidity: $${(m.liquidity / 1000).toFixed(1)}k`
    );
    console.log(`   Potential profit per $100: $${opp.potentialProfitPer100.toFixed(2)}`);
    console.log("");
  });

  // Summary stats
  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));

  const totalVolume = opportunities.reduce((sum, o) => sum + o.market.volume24hr, 0);
  const avgSpread =
    opportunities.reduce((sum, o) => sum + o.market.spreadPct, 0) / opportunities.length;

  console.log(`Total opportunities: ${opportunities.length}`);
  console.log(`Combined 24h volume: $${(totalVolume / 1000000).toFixed(2)}M`);
  console.log(`Average spread: ${avgSpread.toFixed(2)}%`);
  console.log("");

  // Spread distribution
  const spreadBuckets = {
    "1-2%": opportunities.filter((o) => o.market.spreadPct >= 1 && o.market.spreadPct < 2).length,
    "2-5%": opportunities.filter((o) => o.market.spreadPct >= 2 && o.market.spreadPct < 5).length,
    "5-10%": opportunities.filter((o) => o.market.spreadPct >= 5 && o.market.spreadPct < 10).length,
    ">10%": opportunities.filter((o) => o.market.spreadPct >= 10).length,
  };

  console.log("Spread distribution:");
  Object.entries(spreadBuckets).forEach(([range, count]) => {
    console.log(`  ${range}: ${count} markets`);
  });
}

main().catch(console.error);
