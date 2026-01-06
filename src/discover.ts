/**
 * Market Discovery Script v2
 * Queries recent blocks only to avoid RPC limits
 */

import "dotenv/config";
import { createPublicClient, http } from "viem";
import { abstractChain, CONTRACTS } from "./config.js";

const client = createPublicClient({
  chain: abstractChain,
  transport: http(),
});

async function main() {
  console.log("Myriad Market Discovery v2");
  console.log("==========================\n");

  const currentBlock = await client.getBlockNumber();
  console.log("Current block:", currentBlock, "\n");

  console.log("Scanning recent events (last 5000 blocks)...\n");

  try {
    const fromBlock = currentBlock - 5000n;

    const logs = await client.getLogs({
      address: CONTRACTS.PREDICTION_MARKET,
      fromBlock: fromBlock,
      toBlock: "latest",
    });

    console.log("Found", logs.length, "events\n");

    // Group by event signature
    const topicCounts = new Map<string, number>();
    for (const log of logs) {
      const topic0 = log.topics[0] || "no-topic";
      topicCounts.set(topic0, (topicCounts.get(topic0) || 0) + 1);
    }

    console.log("Event signatures:");
    for (const [topic, count] of topicCounts) {
      console.log("  " + topic.substring(0, 20) + "... : " + count + " events");
    }

    // Collect unique questionIds
    const questionIds = new Set<string>();
    for (const log of logs) {
      if (log.topics[1]) {
        questionIds.add(log.topics[1]);
      }
    }

    console.log("\n" + questionIds.size + " unique questionIds found:\n");
    let i = 0;
    for (const qid of questionIds) {
      console.log("  " + qid);
      if (++i >= 25) {
        console.log("  ... and " + (questionIds.size - 25) + " more");
        break;
      }
    }

    console.log("\nLast 10 events:");
    for (const log of logs.slice(-10)) {
      console.log("  Block " + log.blockNumber);
      if (log.topics[1]) console.log("    qId: " + log.topics[1]);
    }

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log("Error:", msg);
  }
}

main();
