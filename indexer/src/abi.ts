export const factoryAbi = [
  {
    type: "function",
    name: "marketCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "marketById",
    inputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "MarketCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "market", type: "address", indexed: true, internalType: "address" },
      { name: "collateral", type: "address", indexed: true, internalType: "address" },
      { name: "oracle", type: "address", indexed: false, internalType: "address" },
      { name: "tradingEndsAt", type: "uint64", indexed: false, internalType: "uint64" },
      {
        name: "claimDelayAfterResolve",
        type: "uint64",
        indexed: false,
        internalType: "uint64",
      },
      { name: "question", type: "string", indexed: false, internalType: "string" },
    ],
  },
] as const;

export const orderbookFactoryAbi = [
  {
    type: "function",
    name: "marketCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "marketById",
    inputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "OrderBookMarketCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "market", type: "address", indexed: true, internalType: "address" },
      { name: "collateral", type: "address", indexed: true, internalType: "address" },
      { name: "collateralDecimals", type: "uint8", indexed: false, internalType: "uint8" },
      { name: "oracle", type: "address", indexed: false, internalType: "address" },
      { name: "tradingEndsAt", type: "uint64", indexed: false, internalType: "uint64" },
      {
        name: "claimDelayAfterResolve",
        type: "uint64",
        indexed: false,
        internalType: "uint64",
      },
      { name: "question", type: "string", indexed: false, internalType: "string" },
    ],
  },
] as const;

export const marketEventsAbi = [
  {
    type: "event",
    name: "BetYes",
    inputs: [
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "BetNo",
    inputs: [
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Resolved",
    inputs: [
      { name: "outcome", type: "uint8", indexed: false, internalType: "uint8" },
      { name: "claimsOpenAt", type: "uint64", indexed: false, internalType: "uint64" },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "user", type: "address", indexed: true, internalType: "address" },
      { name: "payout", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
] as const;

export const poolMarketReadAbi = [
  {
    type: "function",
    name: "collateral",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "oracle",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tradingEndsAt",
    inputs: [],
    outputs: [{ name: "", type: "uint64", internalType: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimDelayAfterResolve",
    inputs: [],
    outputs: [{ name: "", type: "uint64", internalType: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "question",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
] as const;

export const orderbookMarketReadAbi = [
  {
    type: "function",
    name: "collateral",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "oracle",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tradingEndsAt",
    inputs: [],
    outputs: [{ name: "", type: "uint64", internalType: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "claimDelayAfterResolve",
    inputs: [],
    outputs: [{ name: "", type: "uint64", internalType: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "question",
    inputs: [],
    outputs: [{ name: "", type: "string", internalType: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "shareUnit",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
] as const;

