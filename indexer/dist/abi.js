export const factoryAbi = [
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
];
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
];
