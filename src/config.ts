import { defineChain } from "viem";

// Abstract Chain Definition
export const abstractChain = defineChain({
  id: 2741,
  name: "Abstract",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://api.mainnet.abs.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Abscan",
      url: "https://abscan.org",
    },
  },
});

// Contract Addresses
export const CONTRACTS = {
  PREDICTION_MARKET: "0x3e0F5F8F5Fb043aBFA475C0308417Bf72c463289" as const,
  USDC_E: "0x84A71ccD554Cc1b02749b35d22F684CC8ec987e1" as const,
  PTS_TOKEN: "0x0b07cf011B6e2b7E0803b892d97f751659940F23" as const,
} as const;

// Bot Configuration
export const BOT_CONFIG = {
  MIN_PROFIT_THRESHOLD: parseFloat(process.env.MIN_PROFIT_THRESHOLD || "0.01"),
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || "10000"), // 10s to avoid rate limits
  DRY_RUN: process.env.DRY_RUN === "true",
  MAX_POSITION_SIZE_USDC: 100, // Max $100 per trade to start
};

// Known Up/Down Market IDs (you'll need to discover these)
// These are the question IDs from the contract
export const UP_DOWN_MARKETS = [
  // Add market IDs here as you discover them
  // Format: { id: "0x...", name: "BTC Up or Down?", token: "USDC" }
];
