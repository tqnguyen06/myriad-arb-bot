import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Account,
  formatUnits,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { abstractChain, CONTRACTS } from "./config.js";
import { PREDICTION_MARKET_ABI, ERC20_ABI } from "./abi.js";
import type { TradeResult } from "./types.js";

export class MyriadClient {
  public readonly publicClient: PublicClient;
  public readonly walletClient: WalletClient;
  public readonly account: Account;

  constructor(privateKey: `0x${string}`) {
    this.account = privateKeyToAccount(privateKey);

    this.publicClient = createPublicClient({
      chain: abstractChain,
      transport: http(),
    });

    this.walletClient = createWalletClient({
      account: this.account,
      chain: abstractChain,
      transport: http(),
    });
  }

  // Get USDC.e balance
  async getUsdcBalance(): Promise<number> {
    const balance = await this.publicClient.readContract({
      address: CONTRACTS.USDC_E,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [this.account.address],
    });
    return parseFloat(formatUnits(balance, 6)); // USDC has 6 decimals
  }

  // Check and set approval for USDC.e spending
  async ensureApproval(amount: bigint): Promise<void> {
    const allowance = await this.publicClient.readContract({
      address: CONTRACTS.USDC_E,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [this.account.address, CONTRACTS.PREDICTION_MARKET],
    });

    if (allowance < amount) {
      console.log("Approving USDC.e spend...");
      const hash = await this.walletClient.writeContract({
        address: CONTRACTS.USDC_E,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACTS.PREDICTION_MARKET, amount * 10n], // Approve 10x to reduce future approvals
      });
      await this.publicClient.waitForTransactionReceipt({ hash });
      console.log("Approval confirmed:", hash);
    }
  }

  // Buy shares of an outcome
  // buy(uint256 marketId, uint256 outcomeId, uint256 minOutcomeSharesToBuy, uint256 value)
  async buy(
    marketId: number,
    outcomeId: number,
    amountUsdc: number,
    minSharesToBuy: bigint = 0n
  ): Promise<TradeResult> {
    try {
      // USDC.e has 6 decimals
      const value = parseUnits(amountUsdc.toString(), 6);

      // Ensure approval
      await this.ensureApproval(value);

      console.log(`Buying outcome ${outcomeId} on market ${marketId} for ${amountUsdc} USDC...`);

      const hash = await this.walletClient.writeContract({
        address: CONTRACTS.PREDICTION_MARKET,
        abi: PREDICTION_MARKET_ABI,
        functionName: "buy",
        args: [BigInt(marketId), BigInt(outcomeId), minSharesToBuy, value],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
      });

      return {
        success: receipt.status === "success",
        txHash: hash,
        gasUsed: receipt.gasUsed,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Sell shares of an outcome
  // sell(uint256 marketId, uint256 outcomeId, uint256 value, uint256 maxOutcomeSharesToSell)
  async sell(
    marketId: number,
    outcomeId: number,
    valueUsdc: number,
    maxSharesToSell: bigint = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") // max uint256
  ): Promise<TradeResult> {
    try {
      const value = parseUnits(valueUsdc.toString(), 6);

      console.log(`Selling outcome ${outcomeId} on market ${marketId} for ${valueUsdc} USDC...`);

      const hash = await this.walletClient.writeContract({
        address: CONTRACTS.PREDICTION_MARKET,
        abi: PREDICTION_MARKET_ABI,
        functionName: "sell",
        args: [BigInt(marketId), BigInt(outcomeId), value, maxSharesToSell],
      });

      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
      });

      return {
        success: receipt.status === "success",
        txHash: hash,
        gasUsed: receipt.gasUsed,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
