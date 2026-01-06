import "dotenv/config";
import { createPublicClient, http } from "viem";
import { abstractChain, CONTRACTS } from "./config.js";

const client = createPublicClient({
  chain: abstractChain,
  transport: http(),
});

// Event topic for what we think is "Sell"
const SELL_TOPIC = "0xb1bbae7680415a1349ae813ba7d737ca09df07db1f6ce058b3e0812ec15e8886";

async function main() {
  const currentBlock = await client.getBlockNumber();
  console.log("Looking for Sell events...\n");

  const logs = await client.getLogs({
    address: CONTRACTS.PREDICTION_MARKET,
    topics: [SELL_TOPIC as `0x${string}`],
    fromBlock: currentBlock - 500n,
    toBlock: "latest",
  });

  console.log(`Found ${logs.length} potential Sell events\n`);

  // Get transaction details for first few
  for (const log of logs.slice(0, 3)) {
    console.log("TxHash:", log.transactionHash);

    // Get the transaction to see the function call
    const tx = await client.getTransaction({ hash: log.transactionHash });
    console.log("Function selector:", tx.input.substring(0, 10));
    console.log("---");
  }
}

main().catch(console.error);
