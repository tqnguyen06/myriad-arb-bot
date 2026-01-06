export interface Market {
  marketId: number; // Numeric market ID used by the contract
  slug: string; // URL slug for API requests
  name: string;
  outcomes: string[]; // e.g., ["Up", "Down"]
  token: "USDC" | "PTS";
  resolved: boolean;
}

export interface MarketPrices {
  marketId: number;
  prices: number[]; // Price per outcome (0-1 scale)
  totalPrice: number; // Sum of all outcome prices
  timestamp: number;
}

export interface ArbitrageOpportunity {
  market: Market;
  prices: MarketPrices;
  type: "long" | "short"; // long = buy both, short = sell both
  profit: number; // Expected profit percentage
  profitAmount: number; // Expected profit in USD
}

export interface Position {
  marketId: number;
  outcomeIndex: number;
  shares: bigint;
  avgCost: number;
}

export interface TradeResult {
  success: boolean;
  txHash?: `0x${string}`;
  error?: string;
  gasUsed?: bigint;
}

export interface BotStats {
  totalTrades: number;
  successfulTrades: number;
  totalProfit: number;
  startTime: number;
  opportunitiesFound: number;
}

// API response types
export interface MyriadMarketResponse {
  market: {
    id: number;
    slug: string;
    question: string;
    resolved: boolean;
    outcomes: {
      id: number;
      name: string;
      price: number;
    }[];
  };
}
