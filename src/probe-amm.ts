import "dotenv/config";
import { createPublicClient, http, parseAbiItem, formatUnits } from "viem";
import { abstractChain, CONTRACTS } from "./config.js";

const client = createPublicClient({
  chain: abstractChain,
  transport: http(),
});

const MARKET_ID = 317n;

// Try AMM-related functions that might give us reserve data to calculate prices
const ammFunctions = [
  // Reserve functions
  "function getReserves(uint256 marketId) view returns (uint256[] memory)",
  "function reserves(uint256 marketId, uint256 outcomeId) view returns (uint256)",
  "function getPoolBalances(uint256 marketId) view returns (uint256[] memory)",
  "function poolBalance(uint256 marketId, uint256 outcomeId) view returns (uint256)",
  // Outcome token supply
  "function totalSupply(uint256 marketId, uint256 outcomeId) view returns (uint256)",
  "function outcomeTokenSupply(uint256 marketId, uint256 outcomeId) view returns (uint256)",
  // LMSR/CPMM style
  "function funding(uint256 marketId) view returns (uint256)",
  "function b(uint256 marketId) view returns (uint256)",
  // Calc functions with different signatures
  "function calcBuySharesAmount(uint256 marketId, uint256 outcomeId, uint256 collateralAmount) view returns (uint256)",
  "function calcSellSharesReturn(uint256 marketId, uint256 outcomeId, uint256 sharesAmount) view returns (uint256)",
  "function getCollateralForOutcome(uint256 marketId, uint256 outcomeId, uint256 shares) view returns (uint256)",
  "function getOutcomeForCollateral(uint256 marketId, uint256 outcomeId, uint256 collateral) view returns (uint256)",
  // Market state
  "function isResolved(uint256 marketId) view returns (bool)",
  "function resolved(uint256 marketId) view returns (bool)",
  "function winningOutcome(uint256 marketId) view returns (uint256)",
  // Position/balance
  "function balanceOf(address account, uint256 marketId, uint256 outcomeId) view returns (uint256)",
  "function positionBalance(address account, uint256 marketId, uint256 outcomeId) view returns (uint256)",
];

async function main() {
  console.log("Probing AMM-related functions...\n");

  for (const funcSig of ammFunctions) {
    const funcName = funcSig.match(/function (\w+)/)?.[1] || "unknown";

    try {
      const abi = [parseAbiItem(funcSig)];
      let args: (bigint | string)[];

      if (funcSig.includes("address account")) {
        args = ["0x0000000000000000000000000000000000000001", MARKET_ID, 0n];
      } else if (funcSig.includes("outcomeId") && funcSig.includes("collateral")) {
        args = [MARKET_ID, 0n, 1000000000000000000n]; // 1e18
      } else if (funcSig.includes("outcomeId") && funcSig.includes("shares")) {
        args = [MARKET_ID, 0n, 1000000000000000000n];
      } else if (funcSig.includes("outcomeId")) {
        args = [MARKET_ID, 0n];
      } else {
        args = [MARKET_ID];
      }

      const result = await client.readContract({
        address: CONTRACTS.PREDICTION_MARKET,
        abi,
        functionName: funcName,
        args: args as any,
      });

      console.log(`SUCCESS: ${funcName}`);
      console.log(`  Args: ${args.join(", ")}`);
      console.log(`  Result: ${result}`);
      console.log("");
    } catch {
      // Silent fail
    }
  }

  console.log("Done.");
}

main().catch(console.error);
