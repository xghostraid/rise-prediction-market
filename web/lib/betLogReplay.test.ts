import { describe, expect, it } from "vitest";
import { replayImpliedYesPercents } from "./betLogReplay";

describe("replayImpliedYesPercents", () => {
  it("replays pool and matches parimutuel implied odds", () => {
    const steps = [
      { blockNumber: 1n, logIndex: 0, kind: "yes" as const, amount: 3n * 10n ** 18n },
      { blockNumber: 1n, logIndex: 1, kind: "no" as const, amount: 1n * 10n ** 18n },
    ];
    const out = replayImpliedYesPercents(steps);
    expect(out).toHaveLength(2);
    expect(out[0]!.yesPct).toBe(100);
    expect(out[1]!.yesPct).toBe(75);
  });
});
