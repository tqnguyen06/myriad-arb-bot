/**
 * Debug the Myriad API response structure
 */

async function main() {
  const url =
    "https://myriad.markets/markets?_data=routes%2Fmarkets._index";

  console.log("Fetching:", url);
  console.log("");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MyriadArbBot/1.0",
    },
  });

  console.log("Status:", response.status);
  console.log("Content-Type:", response.headers.get("content-type"));
  console.log("");

  const text = await response.text();
  console.log("Response length:", text.length, "bytes");
  console.log("");

  // Try to parse as JSON
  try {
    const data = JSON.parse(text);
    console.log("Top-level keys:", Object.keys(data));
    console.log("");

    // Log the structure
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (Array.isArray(value)) {
        console.log(`${key}: Array with ${value.length} items`);
        if (value.length > 0) {
          console.log(`  First item keys:`, Object.keys(value[0]));
        }
      } else if (typeof value === "object" && value !== null) {
        console.log(`${key}: Object with keys:`, Object.keys(value));
      } else {
        console.log(`${key}:`, typeof value);
      }
    }

    // If there's a markets array, show the first one
    if (data.markets && Array.isArray(data.markets) && data.markets.length > 0) {
      console.log("\n\nFirst market structure:");
      console.log(JSON.stringify(data.markets[0], null, 2));
    }

    // Try other common keys
    if (data.featuredMarkets && Array.isArray(data.featuredMarkets)) {
      console.log("\n\nFirst featured market:");
      console.log(JSON.stringify(data.featuredMarkets[0], null, 2));
    }
  } catch (e) {
    console.log("Failed to parse as JSON:", e);
    console.log("\nFirst 1000 chars of response:");
    console.log(text.substring(0, 1000));
  }
}

main().catch(console.error);
