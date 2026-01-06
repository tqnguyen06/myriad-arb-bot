import "dotenv/config";
import { createPublicClient, http } from "viem";
import { abstractChain, CONTRACTS } from "./config.js";

const client = createPublicClient({
  chain: abstractChain,
  transport: http(),
});

async function main() {
  const currentBlock = await client.getBlockNumber();
  console.log("Current block:", currentBlock);

  const logs = await client.getLogs({
    address: CONTRACTS.PREDICTION_MARKET,
    fromBlock: currentBlock - 100n,
    toBlock: "latest",
  });

  console.log("\nRecent transactions:");
  for (const log of logs.slice(0, 5)) {
    console.log("TxHash:", log.transactionHash);
    console.log("Topic0:", log.topics[0]);
    console.log("---");
  }
}

main().catch(console.error);
