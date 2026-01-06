import "dotenv/config";
import { createPublicClient, http, parseAbiItem, formatUnits } from "viem";
import { abstractChain, CONTRACTS } from "./config.js";

const client = createPublicClient({
  chain: abstractChain,
  transport: http(),
});

// Market 317 is "Up or Down?"
const MARKET_ID = 317n;

// Common function signatures to try
const functionsToTry = [
  // Price getters
  "function getOutcomePrice(uint256 marketId, uint256 outcomeId) view returns (uint256)",
  "function getPrice(uint256 marketId, uint256 outcomeId) view returns (uint256)",
  "function price(uint256 marketId, uint256 outcomeId) view returns (uint256)",
  "function calcBuyAmount(uint256 marketId, uint256 outcomeId, uint256 investmentAmount) view returns (uint256)",
  "function calcSellAmount(uint256 marketId, uint256 outcomeId, uint256 returnAmount) view returns (uint256)",
  // Market info
  "function markets(uint256 marketId) view returns (tuple(uint256,uint256,uint256,bool))",
  "function getMarket(uint256 marketId) view returns (tuple(uint256,uint256,uint256,bool))",
  "function marketInfo(uint256 marketId) view returns (tuple(uint256,uint256))",
  // Outcome counts
  "function getOutcomeCount(uint256 marketId) view returns (uint256)",
  "function outcomeCount(uint256 marketId) view returns (uint256)",
  // Liquidity
  "function getLiquidity(uint256 marketId) view returns (uint256)",
  "function liquidity(uint256 marketId) view returns (uint256)",
];

async function main() {
  console.log("Probing contract functions...\n");
  console.log(`Contract: ${CONTRACTS.PREDICTION_MARKET}`);
  console.log(`Test Market ID: ${MARKET_ID}\n`);

  for (const funcSig of functionsToTry) {
    const funcName = funcSig.match(/function (\w+)/)?.[1] || "unknown";
    const hasOutcomeId = funcSig.includes("outcomeId");
    const hasAmount = funcSig.includes("Amount");

    try {
      const abi = [parseAbiItem(funcSig)];
      let args: bigint[];

      if (hasAmount) {
        args = [MARKET_ID, 0n, 1000000n]; // marketId, outcomeId, 1 USDC
      } else if (hasOutcomeId) {
        args = [MARKET_ID, 0n];
      } else {
        args = [MARKET_ID];
      }

      const result = await client.readContract({
        address: CONTRACTS.PREDICTION_MARKET,
        abi,
        functionName: funcName,
        args,
      });

      console.log(`SUCCESS: ${funcName}(${args.join(", ")}) = ${result}`);
    } catch (error: unknown) {
      // Silent fail - function doesn't exist
    }
  }

  console.log("\nDone probing.");
}

main().catch(console.error);
