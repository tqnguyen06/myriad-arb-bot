/**
 * Polymarket API Client
 *
 * Fetches market data from Polymarket's Gamma API and CLOB API.
 * - Gamma API: Market discovery, metadata, events
 * - CLOB API: Real-time prices, orderbook, trading
 */

const GAMMA_API = "https://gamma-api.polymarket.com";
const CLOB_API = "https://clob.polymarket.com";

export interface PolymarketOutcome {
  name: string;
  price: number;
}

export interface PolymarketMarket {
  id: string;
  slug: string;
  question: string;
  description: string;
  outcomes: string[];
  outcomePrices: number[];
  clobTokenIds: string[];
  bestBid: number;
  bestAsk: number;
  spread: number;
  spreadPct: number;
  volume24hr: number;
  liquidity: number;
  endDate: string;
  closed: boolean;
  enableOrderBook: boolean;
}

export interface SpreadOpportunity {
  market: PolymarketMarket;
  potentialProfitPer100: number;
  volumeScore: number; // Higher = more liquid
}

// Cache
let cachedMarkets: PolymarketMarket[] = [];
let lastFetchTime = 0;
const CACHE_TTL_MS = 10000; // 10 second cache

/**
 * Parse outcome prices from various formats
 */
function parseOutcomePrices(prices: unknown): number[] {
  if (!prices) return [];
  if (Array.isArray(prices)) {
    return prices.map((p) => (typeof p === "string" ? parseFloat(p) : p));
  }
  if (typeof prices === "string") {
    try {
      const parsed = JSON.parse(prices);
      return Array.isArray(parsed) ? parsed.map((p: string) => parseFloat(p)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Fetch all open markets from Polymarket
 */
export async function fetchAllMarkets(): Promise<PolymarketMarket[]> {
  // Return cached data if fresh
  if (cachedMarkets.length > 0 && Date.now() - lastFetchTime < CACHE_TTL_MS) {
    return cachedMarkets;
  }

  const url = `${GAMMA_API}/markets?closed=false&limit=500`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "PolymarketArbBot/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch markets: ${response.status}`);
    }

    const rawMarkets = await response.json();
    const markets: PolymarketMarket[] = [];

    for (const m of rawMarkets) {
      const outcomePrices = parseOutcomePrices(m.outcomePrices);
      const bestBid = parseFloat(m.bestBid) || 0;
      const bestAsk = parseFloat(m.bestAsk) || 0;
      const spread = bestAsk > bestBid ? bestAsk - bestBid : 0;
      const spreadPct = bestAsk > 0 ? (spread / bestAsk) * 100 : 0;

      // Parse clobTokenIds - can be string or array
      let clobTokenIds: string[] = [];
      if (m.clobTokenIds) {
        if (typeof m.clobTokenIds === "string") {
          try {
            clobTokenIds = JSON.parse(m.clobTokenIds);
          } catch {
            clobTokenIds = [];
          }
        } else if (Array.isArray(m.clobTokenIds)) {
          clobTokenIds = m.clobTokenIds;
        }
      }

      markets.push({
        id: m.id,
        slug: m.slug,
        question: m.question,
        description: m.description || "",
        outcomes: m.outcomes ? (typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : m.outcomes) : [],
        outcomePrices,
        clobTokenIds,
        bestBid,
        bestAsk,
        spread,
        spreadPct,
        volume24hr: parseFloat(m.volume24hr) || 0,
        liquidity: parseFloat(m.liquidity) || 0,
        endDate: m.endDate,
        closed: m.closed || false,
        enableOrderBook: m.enableOrderBook || false,
      });
    }

    cachedMarkets = markets;
    lastFetchTime = Date.now();
    return markets;
  } catch (error) {
    if (cachedMarkets.length > 0) {
      console.warn("Fetch failed, using cached data:", error);
      return cachedMarkets;
    }
    throw error;
  }
}

/**
 * Find markets with profitable spreads
 * Filters for:
 * - Orderbook enabled
 * - Sufficient volume (>$1000 24h)
 * - Valid spread (bid < ask, both > 0)
 * - Not too extreme prices (between 5-95%)
 */
export async function findSpreadOpportunities(
  minSpreadPct: number = 1,
  minVolume24hr: number = 1000
): Promise<SpreadOpportunity[]> {
  const markets = await fetchAllMarkets();
  const opportunities: SpreadOpportunity[] = [];

  for (const market of markets) {
    // Skip if orderbook not enabled or closed
    if (!market.enableOrderBook || market.closed) continue;

    // Skip if no valid bid/ask
    if (market.bestBid <= 0 || market.bestAsk <= 0) continue;
    if (market.bestBid >= market.bestAsk) continue;

    // Skip extreme prices (too close to 0 or 1)
    if (market.bestBid < 0.05 || market.bestAsk > 0.95) continue;

    // Skip low volume
    if (market.volume24hr < minVolume24hr) continue;

    // Skip if spread too small
    if (market.spreadPct < minSpreadPct) continue;

    // Calculate potential profit
    const potentialProfitPer100 = market.spread * 100;

    // Volume score (log scale)
    const volumeScore = Math.log10(market.volume24hr + 1);

    opportunities.push({
      market,
      potentialProfitPer100,
      volumeScore,
    });
  }

  // Sort by volume (prioritize liquid markets)
  return opportunities.sort((a, b) => b.volumeScore - a.volumeScore);
}

/**
 * Get real-time price for a specific token from CLOB
 */
export async function getTokenPrice(
  tokenId: string,
  side: "buy" | "sell"
): Promise<number | null> {
  const url = `${CLOB_API}/price?token_id=${tokenId}&side=${side}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return parseFloat(data.price) || null;
  } catch {
    return null;
  }
}

/**
 * Get orderbook for a specific token
 */
export async function getOrderbook(tokenId: string): Promise<{
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
} | null> {
  const url = `${CLOB_API}/book?token_id=${tokenId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    return {
      bids: (data.bids || []).map((b: { price: string; size: string }) => ({
        price: parseFloat(b.price),
        size: parseFloat(b.size),
      })),
      asks: (data.asks || []).map((a: { price: string; size: string }) => ({
        price: parseFloat(a.price),
        size: parseFloat(a.size),
      })),
    };
  } catch {
    return null;
  }
}
