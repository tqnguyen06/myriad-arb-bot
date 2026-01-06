/**
 * Myriad Markets API Client
 *
 * Fetches market prices from the Myriad website's Remix data endpoints.
 * This is used because the smart contract doesn't expose view functions for prices.
 */

import type { Market, MarketPrices } from "./types.js";

const BASE_URL = "https://myriad.markets";

interface MyriadOutcome {
  id: number;
  marketId: number;
  title: string;
  price: number;
  shares: number;
  holders: number;
}

export interface MyriadMarket {
  id: number;
  slug: string;
  title: string;
  questionId: string;
  state: string;
  outcomes: MyriadOutcome[];
  token: { symbol: string };
}

export async function fetchMarketPrices(market: Market): Promise<MarketPrices> {
  // Fetch from Remix data endpoint
  const url = `${BASE_URL}/markets/${market.slug}?_data=routes%2Fmarkets.%24marketId`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MyriadArbBot/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch market data: ${response.status}`);
  }

  const data = await response.json();

  // Extract outcome prices from the response
  // The structure is: data.market.outcomes[].price
  const outcomes = data.market?.outcomes || [];

  if (outcomes.length < 2) {
    throw new Error(`Market ${market.name} has less than 2 outcomes`);
  }

  const prices = outcomes.map((o: MyriadOutcome) => o.price);
  const totalPrice = prices.reduce((a: number, b: number) => a + b, 0);

  return {
    marketId: market.marketId,
    prices,
    totalPrice,
    timestamp: Date.now(),
  };
}

// Cache for discovered market IDs to avoid re-scanning
let knownMaxId = 720;

/**
 * Fetch a single market by ID
 */
async function fetchMarketById(id: number): Promise<MyriadMarket | null> {
  try {
    const url = `${BASE_URL}/markets/${id}?_data=routes%2Fmarkets.%24marketId`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MyriadArbBot/1.0",
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.market || null;
    }
  } catch {
    // Ignore fetch errors for individual markets
  }
  return null;
}

/**
 * Fetch all open binary markets by scanning IDs in parallel batches.
 * The Myriad API pagination doesn't work correctly, so we probe individual IDs.
 */
export async function fetchAllMarkets(): Promise<MyriadMarket[]> {
  const markets: MyriadMarket[] = [];
  const batchSize = 30; // Concurrent requests per batch

  // Scan from ID 1 to knownMaxId
  for (let start = 1; start <= knownMaxId; start += batchSize) {
    const promises: Promise<MyriadMarket | null>[] = [];

    for (let id = start; id < Math.min(start + batchSize, knownMaxId + 1); id++) {
      promises.push(fetchMarketById(id));
    }

    const results = await Promise.all(promises);

    for (const market of results) {
      // Only include open binary markets
      if (market && market.state === "open" && market.outcomes?.length === 2) {
        markets.push(market);
        // Update max ID if we find higher
        if (market.id > knownMaxId) {
          knownMaxId = market.id + 50;
        }
      }
    }
  }

  return markets;
}

// Utility to scan all markets for arbitrage opportunities
export async function scanAllMarketsForArb(): Promise<
  Array<{
    market: MyriadMarket;
    prices: number[];
    totalPrice: number;
    deviation: number;
  }>
> {
  const markets = await fetchAllMarkets();
  const opportunities: Array<{
    market: MyriadMarket;
    prices: number[];
    totalPrice: number;
    deviation: number;
  }> = [];

  for (const market of markets) {
    // Only binary markets
    if (market.outcomes.length === 2 && market.state === "open") {
      const prices = market.outcomes.map((o) => o.price);
      const totalPrice = prices[0] + prices[1];
      const deviation = Math.abs(totalPrice - 1.0);

      opportunities.push({
        market,
        prices,
        totalPrice,
        deviation,
      });
    }
  }

  return opportunities.sort((a, b) => b.deviation - a.deviation);
}
