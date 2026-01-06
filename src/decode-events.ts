import { keccak256, toBytes } from "viem";

// Calculate keccak256 hash of event signatures
const events = [
  "Buy(uint256,address,uint256,uint256,uint256)",
  "Sell(uint256,address,uint256,uint256,uint256)",
  "OutcomeSharesBought(uint256,address,uint256,uint256,uint256)",
  "OutcomeSharesSold(uint256,address,uint256,uint256,uint256)",
  "Trade(uint256,address,uint256,uint256,uint256)",
  "MarketResolved(uint256,uint256)",
  "MarketCreated(uint256,string)",
];

console.log("Event signature hashes:");
for (const e of events) {
  const hash = keccak256(toBytes(e));
  console.log(e, "->", hash.substring(0, 22) + "...");
}

console.log("\nKnown event topics from contract:");
console.log("0x9dcabe311735ed0d65... (834 events) - likely Buy");
console.log("0xb1bbae7680415a1349... (821 events) - likely Sell");
console.log("0xc993f9a8447446a00c... (46 events)  - likely MarketResolved");
