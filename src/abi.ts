// Myriad PredictionMarketV3_3 ABI
// Reverse-engineered from transaction data on Abstract chain
// Contract: 0x3e0F5F8F5Fb043aBFA475C0308417Bf72c463289

export const PREDICTION_MARKET_ABI = [
  // Write Functions - confirmed from transaction analysis
  // buy(uint256 marketId, uint256 outcomeId, uint256 minOutcomeSharesToBuy, uint256 value)
  // Selector: 0x1281311d
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "outcomeId", type: "uint256" },
      { name: "minOutcomeSharesToBuy", type: "uint256" },
      { name: "value", type: "uint256" },
    ],
    name: "buy",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  // sell(uint256 marketId, uint256 outcomeId, uint256 value, uint256 maxOutcomeSharesToSell)
  // Selector: 0x3620875e
  {
    inputs: [
      { name: "marketId", type: "uint256" },
      { name: "outcomeId", type: "uint256" },
      { name: "value", type: "uint256" },
      { name: "maxOutcomeSharesToSell", type: "uint256" },
    ],
    name: "sell",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },

  // Events - confirmed from log analysis
  // Topic: 0x9dcabe311735ed0d65f0c22c5425d1f17331f94c9d0767f59e58473cf95ada61
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "marketId", type: "uint256" },
      { indexed: true, name: "buyer", type: "address" },
      { indexed: false, name: "outcomeId", type: "uint256" },
      { indexed: false, name: "shares", type: "uint256" },
      { indexed: false, name: "cost", type: "uint256" },
    ],
    name: "OutcomeSharesBought",
    type: "event",
  },
  // Topic: 0xb1bbae7680415a1349ae813ba7d737ca09df07db1f6ce058b3e0812ec15e8886
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "marketId", type: "uint256" },
      { indexed: true, name: "seller", type: "address" },
      { indexed: false, name: "outcomeId", type: "uint256" },
      { indexed: false, name: "shares", type: "uint256" },
      { indexed: false, name: "proceeds", type: "uint256" },
    ],
    name: "OutcomeSharesSold",
    type: "event",
  },
] as const;

// Standard ERC20 ABI for USDC.e
export const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
