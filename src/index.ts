/**
 * Myriad Markets Arbitrage Bot
 *
 * Strategy: Binary Outcome Arbitrage
 * - When Up + Down < $1.00: Buy both outcomes, guaranteed profit on resolution
 * - When Up + Down > $1.00: Sell both if holding
 */

import "dotenv/config";
import { MyriadClient } from "./client.js";
import { fetchAllMarkets, type MyriadMarket } from "./api.js";
import { abstractChain, CONTRACTS, BOT_CONFIG } from "./config.js";
import type { TradeResult } from "./types.js";

interface ArbOpportunity {
  market: MyriadMarket;
  prices: number[];
  totalPrice: number;
  deviation: number;
  type: "long" | "short";
}

class MyriadArbBot {
  private client: MyriadClient | null = null;
  private running: boolean = false;
  private stats = {
    scans: 0,
    opportunitiesFound: 0,
    tradesExecuted: 0,
    totalProfit: 0,
  };

  constructor(private privateKey?: `0x${string}`) {
    if (privateKey) {
      this.client = new MyriadClient(privateKey);
    }
  }

  private detectArbitrage(market: MyriadMarket): ArbOpportunity | null {
    if (market.outcomes.length !== 2 || market.state !== "open") {
      return null;
    }

    const prices = market.outcomes.map((o) => o.price);
    const totalPrice = prices[0] + prices[1];
    const deviation = Math.abs(totalPrice - 1.0);

    // Long arb: total < 1.0 (buy both)
    if (totalPrice < 1.0 - BOT_CONFIG.MIN_PROFIT_THRESHOLD) {
      return {
        market,
        prices,
        totalPrice,
        deviation,
        type: "long",
      };
    }

    // Short arb: total > 1.0 (sell both)
    if (totalPrice > 1.0 + BOT_CONFIG.MIN_PROFIT_THRESHOLD) {
      return {
        market,
        prices,
        totalPrice,
        deviation,
        type: "short",
      };
    }

    return null;
  }

  private async executeLongArb(opp: ArbOpportunity): Promise<boolean> {
    if (!this.client || BOT_CONFIG.DRY_RUN) {
      console.log("  [DRY RUN] Would buy both outcomes");
      return true;
    }

    const amountPerSide = BOT_CONFIG.MAX_POSITION_SIZE_USDC / 2;

    console.log(`  Buying ${opp.market.outcomes[0].title}...`);
    const result0 = await this.client.buy(opp.market.id, 0, amountPerSide);
    if (!result0.success) {
      console.error(`  Failed: ${result0.error}`);
      return false;
    }
    console.log(`  TX: ${result0.txHash}`);

    console.log(`  Buying ${opp.market.outcomes[1].title}...`);
    const result1 = await this.client.buy(opp.market.id, 1, amountPerSide);
    if (!result1.success) {
      console.error(`  Failed: ${result1.error}`);
      console.error("  WARNING: Partial fill - directional exposure!");
      return false;
    }
    console.log(`  TX: ${result1.txHash}`);

    return true;
  }

  private async scanMarkets(): Promise<void> {
    this.stats.scans++;
    const timestamp = new Date().toISOString();

    console.log(`\n${"=".repeat(60)}`);
    console.log(`[${timestamp}] Scan #${this.stats.scans}`);

    try {
      const markets = await fetchAllMarkets();
      const binaryMarkets = markets.filter(
        (m) => m.outcomes.length === 2 && m.state === "open"
      );

      console.log(`Fetched ${binaryMarkets.length} binary markets\n`);

      for (const market of binaryMarkets) {
        const prices = market.outcomes.map((o) => o.price);
        const total = prices[0] + prices[1];
        const deviation = Math.abs(total - 1.0);

        // Always log markets
        const devStr = deviation > 0.005 ? ` (${(deviation * 100).toFixed(2)}% dev)` : "";
        console.log(
          `[${market.id}] ${(prices[0] * 100).toFixed(1)}% + ${(prices[1] * 100).toFixed(1)}% = ${(total * 100).toFixed(2)}%${devStr}`
        );

        // Check for arb
        const opp = this.detectArbitrage(market);
        if (opp) {
          this.stats.opportunitiesFound++;
          console.log(`\n>>> ARBITRAGE OPPORTUNITY <<<`);
          console.log(`  Market: ${market.title}`);
          console.log(`  Type: ${opp.type.toUpperCase()}`);
          console.log(`  Deviation: ${(opp.deviation * 100).toFixed(3)}%`);
          console.log(`  Est. Profit: $${(opp.deviation * BOT_CONFIG.MAX_POSITION_SIZE_USDC).toFixed(2)}`);

          if (opp.type === "long") {
            const success = await this.executeLongArb(opp);
            if (success) {
              this.stats.tradesExecuted++;
              this.stats.totalProfit += opp.deviation * BOT_CONFIG.MAX_POSITION_SIZE_USDC;
            }
          }
          console.log("");
        }
      }

      console.log(`\nStats: ${this.stats.opportunitiesFound} opps found, ${this.stats.tradesExecuted} trades, $${this.stats.totalProfit.toFixed(2)} profit`);
    } catch (error) {
      console.error("Error fetching markets:", error);
    }
  }

  async start(): Promise<void> {
    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║           MYRIAD MARKETS ARBITRAGE BOT                     ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("Configuration:");
    console.log(`  Chain: Abstract (${abstractChain.id})`);
    console.log(`  Contract: ${CONTRACTS.PREDICTION_MARKET}`);
    console.log(`  Min Profit Threshold: ${BOT_CONFIG.MIN_PROFIT_THRESHOLD * 100}%`);
    console.log(`  Max Position Size: $${BOT_CONFIG.MAX_POSITION_SIZE_USDC}`);
    console.log(`  Poll Interval: ${BOT_CONFIG.POLL_INTERVAL_MS}ms`);
    console.log(`  Dry Run: ${BOT_CONFIG.DRY_RUN}`);

    if (this.client) {
      console.log(`  Wallet: ${this.client.account.address}`);
      const balance = await this.client.getUsdcBalance();
      console.log(`  USDC.e Balance: $${balance.toFixed(2)}`);
    } else {
      console.log("  Wallet: Not configured (monitor only)");
    }

    console.log("\nStarting continuous monitoring...");
    console.log("Press Ctrl+C to stop\n");

    this.running = true;

    // Initial scan
    await this.scanMarkets();

    // Continuous loop
    while (this.running) {
      await new Promise((r) => setTimeout(r, BOT_CONFIG.POLL_INTERVAL_MS));
      await this.scanMarkets();
    }
  }

  stop(): void {
    this.running = false;
    console.log("\nBot stopped.");
    console.log(`Final stats: ${this.stats.tradesExecuted} trades, $${this.stats.totalProfit.toFixed(2)} profit`);
  }
}

async function main(): Promise<void> {
  const privateKey = process.env.PRIVATE_KEY;

  let formattedKey: `0x${string}` | undefined;
  if (privateKey) {
    formattedKey = privateKey.startsWith("0x")
      ? (privateKey as `0x${string}`)
      : (`0x${privateKey}` as `0x${string}`);
  }

  const bot = new MyriadArbBot(formattedKey);

  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    bot.stop();
    process.exit(0);
  });

  await bot.start();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
