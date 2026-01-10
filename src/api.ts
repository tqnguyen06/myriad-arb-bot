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

// Cache for last successful fetch
let cachedMarkets: MyriadMarket[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 5000; // 5 second cache to stay responsive while avoiding rate limits

/**
 * Fetch all available markets from the Myriad API.
 * Note: The API only exposes ~12 featured/active markets regardless of pagination.
 * This is an API limitation, not a bug in our code.
 */
export async function fetchAllMarkets(): Promise<MyriadMarket[]> {
  // Return cached data if fresh
  if (cachedMarkets.length > 0 && Date.now() - lastFetchTime < CACHE_TTL_MS) {
    return cachedMarkets;
  }

  const url = `${BASE_URL}/markets?_data=routes%2Fmarkets._index`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    // Handle rate limiting gracefully
    if (response.status === 429 || response.status === 1015) {
      console.warn("Rate limited, using cached data");
      return cachedMarkets;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch markets: ${response.status}`);
    }

    const data = await response.json();

    // Combine featured and paginated markets
    const featured = data.featuredMarkets || [];
    const paginatedData = data.paginatedMarkets?.initialData?.data || [];

    // Deduplicate by ID
    const marketMap = new Map<number, MyriadMarket>();
    for (const m of [...featured, ...paginatedData]) {
      if (m && !marketMap.has(m.id)) {
        marketMap.set(m.id, m);
      }
    }

    cachedMarkets = Array.from(marketMap.values());
    lastFetchTime = Date.now();
    return cachedMarkets;
  } catch (error) {
    // On error, return cached data if available
    if (cachedMarkets.length > 0) {
      console.warn("Fetch failed, using cached data:", error);
      return cachedMarkets;
    }
    throw error;
  }
}

// Known market IDs discovered from blockchain events
// These are markets that have had activity but may not appear in featured list
let knownMarketIds: Set<number> = new Set();

/**
 * Add known market IDs from blockchain discovery
 */
export function addKnownMarketIds(ids: number[]) {
  ids.forEach((id) => knownMarketIds.add(id));
}

/**
 * Fetch a single market by its numeric ID
 * Returns null if market not found or not accessible
 */
export async function fetchMarketById(
  marketId: number
): Promise<MyriadMarket | null> {
  // First check if we have it cached
  const cached = cachedMarkets.find((m) => m.id === marketId);
  if (cached) return cached;

  // Try to fetch from the market page directly by constructing possible slugs
  // This is a fallback - most markets should come from fetchAllMarkets
  return null;
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
