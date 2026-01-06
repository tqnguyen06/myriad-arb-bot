/**
 * Myriad Markets Arbitrage Bot
 * Continuous monitoring and execution
 */

import "dotenv/config";
import { MyriadClient } from "./client.js";
import { fetchAllMarkets, type MyriadMarket } from "./api.js";
import { abstractChain, CONTRACTS, BOT_CONFIG } from "./config.js";
import type { BotStats } from "./types.js";

interface ArbOpportunity {
  market: MyriadMarket;
  prices: number[];
  totalPrice: number;
  deviation: number;
  type: "long" | "short";
  profitPerDollar: number;
}

class MyriadArbBot {
  private client: MyriadClient;
  private running = false;
  private stats: BotStats = {
    totalTrades: 0,
    successfulTrades: 0,
    totalProfit: 0,
    startTime: Date.now(),
    opportunitiesFound: 0,
  };

  constructor(privateKey: `0x${string}`) {
    this.client = new MyriadClient(privateKey);
  }

  private detectArbitrage(market: MyriadMarket): ArbOpportunity | null {
    if (market.outcomes.length !== 2 || market.state !== "open") return null;

    const prices = market.outcomes.map((o) => o.price);
    const totalPrice = prices[0] + prices[1];
    const deviation = Math.abs(totalPrice - 1.0);

    if (totalPrice < 1.0 - BOT_CONFIG.MIN_PROFIT_THRESHOLD) {
      return {
        market,
        prices,
        totalPrice,
        deviation,
        type: "long",
        profitPerDollar: 1.0 - totalPrice,
      };
    }
    if (totalPrice > 1.0 + BOT_CONFIG.MIN_PROFIT_THRESHOLD) {
      return {
        market,
        prices,
        totalPrice,
        deviation,
        type: "short",
        profitPerDollar: totalPrice - 1.0,
      };
    }
    return null;
  }

  private async executeLongArb(opp: ArbOpportunity): Promise<boolean> {
    const { market, prices, profitPerDollar } = opp;
    const positionSize = BOT_CONFIG.MAX_POSITION_SIZE_USDC;

    console.log(`\n  EXECUTING LONG ARB on [${market.id}] ${market.title}`);
    console.log(`  Expected profit: $${(profitPerDollar * positionSize).toFixed(2)}`);

    if (BOT_CONFIG.DRY_RUN) {
      console.log("  [DRY RUN] Would buy both outcomes");
      return true;
    }

    const amount0 = (positionSize * prices[0]) / (prices[0] + prices[1]);
    const amount1 = (positionSize * prices[1]) / (prices[0] + prices[1]);

    const result0 = await this.client.buy(market.id, 0, amount0);
    if (!result0.success) {
      console.log(`  FAILED outcome 0: ${result0.error}`);
      return false;
    }
    console.log(`  Bought outcome 0: ${result0.txHash}`);

    const result1 = await this.client.buy(market.id, 1, amount1);
    if (!result1.success) {
      console.log(`  FAILED outcome 1: ${result1.error}`);
      return false;
    }
    console.log(`  Bought outcome 1: ${result1.txHash}`);

    this.stats.totalTrades += 2;
    this.stats.successfulTrades += 2;
    this.stats.totalProfit += profitPerDollar * positionSize;
    return true;
  }

  private async scanMarkets(): Promise<void> {
    const ts = new Date().toISOString();
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[${ts}] Scanning...`);

    try {
      const markets = await fetchAllMarkets();
      const binary = markets.filter(
        (m) => m.outcomes.length === 2 && m.state === "open"
      );
      console.log(`Found ${binary.length} binary markets\n`);

      for (const market of binary) {
        const prices = market.outcomes.map((o) => o.price);
        const total = prices[0] + prices[1];
        const dev = Math.abs(total - 1.0);
        const flag =
          dev > BOT_CONFIG.MIN_PROFIT_THRESHOLD ? " >>> ARB <<<" : "";
        console.log(
          `  [${market.id}] ${(prices[0] * 100).toFixed(1)}% + ${(prices[1] * 100).toFixed(1)}% = ${(total * 100).toFixed(2)}%${flag}`
        );

        const opp = this.detectArbitrage(market);
        if (opp) {
          this.stats.opportunitiesFound++;
          console.log(
            `\n  >>> OPPORTUNITY: ${opp.type.toUpperCase()} ${(opp.deviation * 100).toFixed(3)}% <<<`
          );
          if (opp.type === "long") await this.executeLongArb(opp);
        }
      }

      const rt = ((Date.now() - this.stats.startTime) / 60000).toFixed(1);
      console.log(
        `\n  Runtime: ${rt}m | Opps: ${this.stats.opportunitiesFound} | Profit: $${this.stats.totalProfit.toFixed(2)}`
      );
    } catch (e) {
      console.error("Scan error:", e);
    }
  }

  async start(): Promise<void> {
    console.log("MYRIAD ARB BOT\n");
    console.log(`Chain: Abstract (${abstractChain.id})`);
    console.log(`Contract: ${CONTRACTS.PREDICTION_MARKET}`);
    console.log(`Wallet: ${this.client.account.address}`);
    console.log(`Threshold: ${BOT_CONFIG.MIN_PROFIT_THRESHOLD * 100}%`);
    console.log(`Max Size: $${BOT_CONFIG.MAX_POSITION_SIZE_USDC}`);
    console.log(`Dry Run: ${BOT_CONFIG.DRY_RUN}\n`);

    try {
      const bal = await this.client.getUsdcBalance();
      console.log(`USDC Balance: $${bal.toFixed(2)}`);
    } catch {
      console.log("USDC Balance: N/A");
    }

    this.running = true;
    this.stats.startTime = Date.now();
    await this.scanMarkets();

    while (this.running) {
      await new Promise((r) => setTimeout(r, BOT_CONFIG.POLL_INTERVAL_MS));
      await this.scanMarkets();
    }
  }

  stop(): void {
    this.running = false;
    console.log(
      `\nStopped. Opps: ${this.stats.opportunitiesFound} | Profit: $${this.stats.totalProfit.toFixed(2)}`
    );
  }
}

async function main() {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) {
    console.error("Set PRIVATE_KEY in .env");
    process.exit(1);
  }
  const key = pk.startsWith("0x")
    ? (pk as `0x${string}`)
    : (`0x${pk}` as `0x${string}`);
  const bot = new MyriadArbBot(key);
  process.on("SIGINT", () => {
    bot.stop();
    process.exit(0);
  });
  await bot.start();
}

main().catch(console.error);
