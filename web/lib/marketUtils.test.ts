import { describe, expect, it } from "vitest";
import {
  centsFromYesPercent,
  filterMarketRows,
  parseBracketCategory,
  poolYesPercent,
  sanitizeQuestionPreview,
  sortMarketRows,
  stripCategoryPrefix,
  validateDecimalAmount,
} from "./marketUtils";

describe("poolYesPercent", () => {
  it("is 50% when empty pool", () => {
    expect(poolYesPercent(undefined, undefined)).toBe(50);
    expect(poolYesPercent(0n, 0n)).toBe(50);
  });
  it("weights YES correctly", () => {
    expect(poolYesPercent(75n, 25n)).toBe(75);
    expect(poolYesPercent(1n, 3n)).toBe(25);
  });
});

describe("parseBracketCategory / stripCategoryPrefix", () => {
  it("parses Crypto from dummy format", () => {
    expect(parseBracketCategory("[Crypto] #1 - Hello?")).toBe("Crypto");
    expect(stripCategoryPrefix("[Crypto] #1 - Hello?")).toBe("#1 - Hello?");
  });
  it("returns null when no bracket", () => {
    expect(parseBracketCategory("Plain question")).toBeNull();
  });
});

describe("centsFromYesPercent", () => {
  it("rounds to cents", () => {
    expect(centsFromYesPercent(33.3)).toEqual({ yes: 33, no: 67 });
  });
});

describe("filterMarketRows", () => {
  const rows = [
    {
      addr: "0x1111111111111111111111111111111111111111" as const,
      question: "[Crypto] A",
      yesPct: 50,
    },
    {
      addr: "0x2222222222222222222222222222222222222222" as const,
      question: "[Politics] B",
      yesPct: 50,
    },
  ];
  it("filters by category", () => {
    expect(filterMarketRows(rows, { search: "", category: "Crypto" })).toHaveLength(1);
  });
  it("filters by search", () => {
    expect(filterMarketRows(rows, { search: "politics", category: "All" })).toHaveLength(1);
    expect(filterMarketRows(rows, { search: "0x2222", category: "All" })).toHaveLength(1);
  });
});

describe("validateDecimalAmount", () => {
  it("accepts valid decimals", () => {
    expect(validateDecimalAmount("0.01")).toEqual({ ok: true, value: "0.01" });
    expect(validateDecimalAmount("1")).toEqual({ ok: true, value: "1" });
  });
  it("rejects bad input", () => {
    expect(validateDecimalAmount("").ok).toBe(false);
    expect(validateDecimalAmount("00.1").ok).toBe(false);
    expect(validateDecimalAmount("-1").ok).toBe(false);
    expect(validateDecimalAmount("1e-3").ok).toBe(false);
    expect(validateDecimalAmount("0").ok).toBe(false);
  });
});

describe("sortMarketRows", () => {
  const mk = (addr: string, q: string, ty: bigint, tn: bigint, yesPct = 50) =>
    ({
      addr: addr as `0x${string}`,
      question: q,
      totalYes: ty,
      totalNo: tn,
      yesPct,
    }) as const;

  it("keeps order for new", () => {
    const rows = [mk("0x0000000000000000000000000000000000000001", "a", 1n, 0n), mk("0x0000000000000000000000000000000000000002", "b", 100n, 0n)];
    const out = sortMarketRows(rows, "new");
    expect(out[0]?.addr).toBe("0x0000000000000000000000000000000000000001");
  });

  it("sorts by liquidity for trending", () => {
    const rows = [mk("0x0000000000000000000000000000000000000001", "a", 1n, 0n), mk("0x0000000000000000000000000000000000000002", "b", 100n, 0n)];
    const out = sortMarketRows(rows, "trending");
    expect(out[0]?.addr).toBe("0x0000000000000000000000000000000000000002");
  });

  it("competitive puts near 50% yes first", () => {
    const rows = [
      mk("0x0000000000000000000000000000000000000001", "a", 50n, 50n, 50),
      mk("0x0000000000000000000000000000000000000002", "b", 90n, 10n, 90),
    ];
    const out = sortMarketRows(rows, "competitive");
    expect(out[0]?.yesPct).toBe(50);
  });
});

describe("sanitizeQuestionPreview", () => {
  it("strips angle brackets and truncates", () => {
    expect(sanitizeQuestionPreview("<script>x</script>ok", 10)).toBe("scriptx/sc");
  });
});
