/**
 * Polymarket Monitoring Bot
 *
 * Continuously monitors Polymarket for spread opportunities.
 * Alerts when spreads exceed thresholds on liquid markets.
 *
 * Run with: npm run poly:bot
 */

import "dotenv/config";
import { findSpreadOpportunities, type SpreadOpportunity } from "./api.js";

// Configuration
const CONFIG = {
  MIN_SPREAD_PCT: parseFloat(process.env.POLY_MIN_SPREAD || "2"), // 2% minimum spread
  MIN_VOLUME_24HR: parseFloat(process.env.POLY_MIN_VOLUME || "5000"), // $5k daily volume
  POLL_INTERVAL_MS: parseInt(process.env.POLY_POLL_INTERVAL || "30000"), // 30 seconds
  ALERT_SPREAD_PCT: parseFloat(process.env.POLY_ALERT_SPREAD || "5"), // Alert when >5%
};

// Track seen opportunities to avoid spam
const seenOpportunities = new Map<string, { spread: number; lastAlert: number }>();
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minute cooldown between alerts for same market

// Stats
let stats = {
  startTime: Date.now(),
  scansCompleted: 0,
  totalOpportunitiesFound: 0,
  alertsTriggered: 0,
  bestSpreadSeen: 0,
  bestSpreadMarket: "",
};

function formatTime(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(mins / 60);
  if (hours > 0) {
    return `${hours}h ${mins % 60}m`;
  }
  return `${mins}m`;
}

async function scan(): Promise<void> {
  const now = Date.now();

  try {
    const opportunities = await findSpreadOpportunities(
      CONFIG.MIN_SPREAD_PCT,
      CONFIG.MIN_VOLUME_24HR
    );

    stats.scansCompleted++;
    stats.totalOpportunitiesFound += opportunities.length;

    console.log("");
    console.log("=".repeat(70));
    console.log(`[${new Date().toISOString()}] Scan #${stats.scansCompleted}`);
    console.log("");

    if (opportunities.length === 0) {
      console.log("No opportunities matching criteria.");
    } else {
      console.log(
        `Found ${opportunities.length} opportunities (>${CONFIG.MIN_SPREAD_PCT}% spread, >$${CONFIG.MIN_VOLUME_24HR} vol)`
      );
      console.log("");

      // Show top 10
      opportunities.slice(0, 10).forEach((opp, i) => {
        const m = opp.market;
        const isAlert = m.spreadPct >= CONFIG.ALERT_SPREAD_PCT;
        const prefix = isAlert ? ">>> " : "    ";

        console.log(
          `${prefix}[${i + 1}] ${m.question.substring(0, 50)}...`
        );
        console.log(
          `${prefix}    Bid: ${(m.bestBid * 100).toFixed(1)}¢ | Ask: ${(m.bestAsk * 100).toFixed(1)}¢ | Spread: ${m.spreadPct.toFixed(2)}% | Vol: $${(m.volume24hr / 1000).toFixed(1)}k`
        );

        // Track best spread
        if (m.spreadPct > stats.bestSpreadSeen) {
          stats.bestSpreadSeen = m.spreadPct;
          stats.bestSpreadMarket = m.question.substring(0, 40);
        }

        // Check if we should alert
        if (isAlert) {
          const seen = seenOpportunities.get(m.id);
          const shouldAlert =
            !seen || now - seen.lastAlert > ALERT_COOLDOWN_MS || m.spreadPct > seen.spread * 1.5;

          if (shouldAlert) {
            stats.alertsTriggered++;
            seenOpportunities.set(m.id, { spread: m.spreadPct, lastAlert: now });

            console.log(`${prefix}    🚨 ALERT: High spread opportunity!`);
            console.log(
              `${prefix}    Potential profit: $${opp.potentialProfitPer100.toFixed(2)} per $100`
            );
          }
        }
      });
    }

    // Print stats
    const runtime = now - stats.startTime;
    console.log("");
    console.log(
      `Runtime: ${formatTime(runtime)} | Scans: ${stats.scansCompleted} | Alerts: ${stats.alertsTriggered}`
    );
    if (stats.bestSpreadSeen > 0) {
      console.log(
        `Best spread seen: ${stats.bestSpreadSeen.toFixed(2)}% on "${stats.bestSpreadMarket}..."`
      );
    }
  } catch (error) {
    console.error("Scan error:", error);
  }
}

async function main(): Promise<void> {
  console.log("Polymarket Spread Monitor");
  console.log("=========================");
  console.log("");
  console.log("Configuration:");
  console.log(`  Min Spread: ${CONFIG.MIN_SPREAD_PCT}%`);
  console.log(`  Min Volume: $${CONFIG.MIN_VOLUME_24HR}`);
  console.log(`  Poll Interval: ${CONFIG.POLL_INTERVAL_MS / 1000}s`);
  console.log(`  Alert Threshold: ${CONFIG.ALERT_SPREAD_PCT}%`);
  console.log("");
  console.log("Starting monitoring...");

  // Initial scan
  await scan();

  // Continuous monitoring
  setInterval(scan, CONFIG.POLL_INTERVAL_MS);
}

main().catch(console.error);
