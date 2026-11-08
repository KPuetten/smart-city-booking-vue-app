import { describe, expect, it } from "vitest";
import {
  admissionSearchOf,
  applicableCorrections,
  remainingDaysPart,
  usageRows,
} from "@/utils/admissionStates";

const admission = (overrides = {}) => ({
  id: "a-1",
  kind: "single",
  state: "issued",
  remainingDays: 10,
  entitlement: { usage: "quota", quota: 10 },
  usage: [{ type: "issue", at: 1 }],
  ...overrides,
});

describe("admissionStates", () => {
  it("offers only the corrections the backend applies", () => {
    expect(applicableCorrections(admission())).toEqual(["block"]);
    expect(
      applicableCorrections(
        admission({
          state: "present",
          usage: [
            { type: "issue", at: 1 },
            { type: "entry", at: 2 },
          ],
        })
      )
    ).toEqual(["block", "resetPresence", "revertEntry"]);
    expect(applicableCorrections(admission({ state: "blocked" }))).toEqual([
      "unblock",
    ]);
    expect(applicableCorrections(admission({ state: "invalid" }))).toEqual([]);
    // The parent ticket of a bundle admits nobody and is not blocked.
    expect(applicableCorrections(admission({ kind: "bundle" }))).toEqual([]);
    // An entry taken back is not taken back twice.
    expect(
      applicableCorrections(
        admission({
          state: "absent",
          usage: [
            { type: "entry", at: 2 },
            { type: "correction", at: 3, reverts: 2 },
          ],
        })
      )
    ).toEqual(["block"]);
  });

  it("lists the log newest first, with the device's label and the entry taken back", () => {
    const rows = usageRows(
      admission({
        usage: [
          { type: "issue", at: 1 },
          { type: "entry", at: 2, deviceId: "d-1", dayConsumed: true },
          {
            type: "correction",
            at: 3,
            userId: "u-1",
            reason: "Fehlscan",
            reverts: 2,
          },
          { type: "reset", at: 4, runId: "r-1" },
        ],
      }),
      { "d-1": { label: "Eingang Nord" } }
    );
    expect(rows.map((row) => row.type)).toEqual([
      "reset",
      "correction",
      "entry",
      "issue",
    ]);
    expect(rows[2]).toEqual(
      expect.objectContaining({
        actor: { kind: "device", label: "Eingang Nord" },
        dayConsumed: true,
        reverted: true,
      })
    );
    expect(rows[1]).toEqual(
      expect.objectContaining({ reason: "Fehlscan", reverted: false })
    );
    expect(rows[1].actor.kind).toBe("user");
    expect(rows[0].actor.kind).toBe("reset");
  });

  it("reads the search as a code or a booking number", () => {
    expect(
      admissionSearchOf("g8lv udpm b83t bh29 8ewr pxf7 xxhp unmk")
    ).toEqual({ code: "G8LVUDPMB83TBH298EWRPXF7XXHPUNMK" });
    expect(admissionSearchOf(" ppbk-qpdp ")).toEqual({
      bookingId: "PPBK-QPDP",
    });
    expect(admissionSearchOf("  ")).toBeNull();
  });

  it("words the days of use", () => {
    expect(remainingDaysPart(admission({ remainingDays: 9 }))).toEqual({
      key: "admission.remaining.quota",
      params: { left: 9, quota: 10 },
    });
    expect(
      remainingDaysPart(
        admission({ entitlement: { usage: "unlimited" }, remainingDays: null })
      ).key
    ).toBe("admission.remaining.unlimited");
    expect(
      remainingDaysPart(
        admission({ entitlement: { usage: "single" }, remainingDays: 0 })
      ).key
    ).toBe("admission.remaining.singleUsed");
  });
});
