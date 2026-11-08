import { describe, expect, it } from "vitest";
import {
  admissionDefinitionErrors,
  admissionDefinitionOf,
  admissionPreview,
  facilityOfTariff,
  facilitySettingsErrors,
  facilitySettingsOf,
  germanDate,
  issuesAdmissions,
  newAdmissionDefinition,
  tariffContingent,
} from "@/utils/admissionDefinition";
import { bookableIssues } from "@/utils/bookableValidation";
import { expertOptionUsed } from "@/utils/bookableExpertMode";
import { getVisibleBookableEditSections } from "@/utils/bookableEditSections";

const tariff = (admission, extra = {}) => ({
  id: "season",
  type: "ticket",
  title: "Saisonkarte",
  admission,
  ...extra,
});

const pool = {
  id: "pool",
  type: "event-location",
  title: "Freibad",
  amount: 1000,
  relatedBookableIds: ["season"],
  admissionFacility: { resetTime: "03:00", exitScan: true },
};

const keys = (parts) =>
  parts.map((part) => part.key.split(".").slice(3).join("."));

describe("admissionDefinition", () => {
  it("reads a definition with the backend's defaults, and none where switched off", () => {
    expect(admissionDefinitionOf(tariff({}))).toEqual({
      validity: { mode: "booking", from: null, to: null, days: null },
      usage: { mode: "single", quota: null },
      blockMinutes: 0,
      personalized: false,
      admissionsPerUnit: 1,
      capacityCheck: "booking",
    });
    expect(admissionDefinitionOf(tariff({ enabled: false }))).toBeNull();
    expect(admissionDefinitionOf(tariff(null))).toBeNull();
    // Only a ticket carries one, as the backend refuses it elsewhere.
    expect(issuesAdmissions({ type: "room", admission: {} })).toBe(false);
  });

  it("reads facility settings only of a bookable that is no ticket", () => {
    expect(facilitySettingsOf(pool)).toEqual({
      resetTime: "03:00",
      exitScan: true,
      maxStayMinutes: null,
      timezone: "Europe/Berlin",
    });
    expect(facilitySettingsOf({ ...pool, type: "ticket" })).toBeNull();
    expect(
      facilitySettingsOf({ ...pool, admissionFacility: { enabled: false } })
    ).toBeNull();
  });

  it("finds the facility that lists the tariff as its child, as the issuance does", () => {
    const room = {
      id: "room",
      type: "room",
      title: "Raum",
      relatedBookableIds: ["season"],
    };
    expect(facilityOfTariff(tariff({}), [room, pool])).toBe(pool);
    // A tariff naming the facility among its own children is no child of it.
    expect(
      facilityOfTariff(tariff({}, { relatedBookableIds: ["pool"] }), [
        { ...pool, relatedBookableIds: [] },
      ])
    ).toBeNull();
    expect(facilityOfTariff(tariff({}, { id: undefined }), [pool])).toBeNull();
  });

  it("refuses what the backend refuses", () => {
    expect(admissionDefinitionErrors(tariff(newAdmissionDefinition()))).toEqual(
      []
    );
    const errors = (admission) =>
      admissionDefinitionErrors(tariff(admission)).map((e) => e.name);
    expect(
      errors({ validity: { mode: "window", from: "2027-05-01" } })
    ).toEqual(["date"]);
    expect(
      errors({
        validity: { mode: "window", from: "2027-09-15", to: "2027-05-01" },
      })
    ).toEqual(["windowOrder"]);
    expect(errors({ validity: { mode: "duration", days: 0 } })).toEqual([
      "days",
    ]);
    expect(errors({ usage: { mode: "quota", quota: 2.5 } })).toEqual(["quota"]);
    expect(errors({ blockMinutes: 1441 })).toEqual(["blockMinutes"]);
    expect(errors({ admissionsPerUnit: 51 })).toEqual(["admissionsPerUnit"]);
    expect(
      facilitySettingsErrors({
        ...pool,
        admissionFacility: { resetTime: "3 Uhr", maxStayMinutes: 0 },
      }).map((e) => e.name)
    ).toEqual(["resetTime", "maxStayMinutes"]);
  });

  it("blocks the save at the tab Einlass, and only while the section shows", () => {
    const issues = bookableIssues(
      tariff({ usage: { mode: "quota", quota: null } })
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        field: "admission",
        message: "bookable.validation.admissionQuota",
        tab: "admission",
        section: "admission-definition",
      })
    );
    // Expert mode off, and a tariff that does not use the entrance.
    const hidden = bookableIssues(
      tariff({ enabled: false, usage: { mode: "quota" } }),
      { shown: (option) => option !== "admission" }
    );
    expect(hidden.filter((issue) => issue.field === "admission")).toEqual([]);
  });

  it("shows the definition on a ticket and the settings on a facility", () => {
    const ids = (bookable) =>
      getVisibleBookableEditSections("admission", { bookable }).map(
        (section) => section.id
      );
    expect(ids(tariff({}))).toEqual([
      "admission-definition",
      "admission-preview",
    ]);
    expect(ids(tariff(null))).toEqual(["admission-definition"]);
    expect(ids(pool)).toEqual(["admission-facility"]);
    expect(expertOptionUsed("admission", pool)).toBe(true);
    expect(expertOptionUsed("admission", tariff({ enabled: false }))).toBe(
      false
    );
  });

  it("words the rule preview in the order of the check", () => {
    const preview = admissionPreview(
      tariff({
        validity: { mode: "window", from: "2027-05-01", to: "2027-09-15" },
        usage: { mode: "unlimited" },
        blockMinutes: 180,
        personalized: true,
        capacityCheck: "entry",
      }),
      { facility: pool }
    );
    expect(keys(preview.issues)).toEqual([
      "issues.single",
      "issues.validity.window",
      "issues.usage.unlimited",
      "issues.personalized",
      "issues.binding",
    ]);
    expect(preview.issues[1].params).toEqual({
      from: "01.05.2027",
      to: "15.09.2027",
    });
    expect(keys(preview.checks)).toEqual([
      "checks.code.single",
      "checks.valid",
      "checks.usage.unlimited",
      "checks.presence.exitScan",
      "checks.blockTime",
      "checks.capacity.entry",
      "checks.photo",
      "checks.reset",
    ]);
    expect(preview.checks[0].params).toEqual({ facility: "Freibad" });
    expect(preview.checks[5].params).toEqual({ capacity: "1.000" });
    // A season ticket checks at the entrance; the purchase checks nothing
    // of the facility, and an unlimited tariff has no contingent.
    expect(keys(preview.sale)).toEqual(["sale.capacity.entry"]);
    expect(keys(preview.warnings)).toEqual([]);
  });

  it("names where the capacity is checked, and the tariff's own contingent", () => {
    const wholeDay = {
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startTime: "00:00",
      endTime: "23:59",
    };
    const day = admissionPreview(
      tariff(
        { capacityCheck: "booking" },
        { amount: 600, isTimePeriodRelated: true, timePeriods: [wholeDay] }
      ),
      { facility: pool }
    );
    expect(keys(day.sale)).toEqual([
      "sale.capacity.booking",
      "sale.contingent.day",
    ]);
    expect(day.sale[1].params).toEqual({ count: "600" });
    // At the entrance nothing of the capacity is left to check.
    expect(keys(day.checks)).not.toContain("checks.capacity.entry");
    expect(
      keys(day.checks).filter((key) => key.startsWith("checks.capacity"))
    ).toEqual([]);

    const none = admissionPreview(
      tariff({ capacityCheck: "none" }, { amount: 1200 }),
      { facility: pool }
    );
    expect(keys(none.sale)).toEqual([
      "sale.capacity.none",
      "sale.contingent.total",
    ]);
    expect(none.sale[1].params).toEqual({ count: "1.200" });
  });

  it("reads the contingent of a tariff as the backend counts it", () => {
    expect(tariffContingent({ amount: null })).toBeNull();
    expect(tariffContingent({ amount: 0 })).toBeNull();
    expect(tariffContingent({ amount: "" })).toBeNull();
    expect(tariffContingent({ amount: 200 })).toEqual({
      count: 200,
      per: "total",
    });
    expect(
      tariffContingent({
        amount: 600,
        isTimePeriodRelated: true,
        timePeriods: [{ startTime: "00:00", endTime: "24:00" }],
      })
    ).toEqual({ count: 600, per: "day" });
    expect(
      tariffContingent({
        amount: 50,
        isTimePeriodRelated: true,
        timePeriods: [{ startTime: "10:00", endTime: "12:00" }],
      })
    ).toEqual({ count: 50, per: "period" });
  });

  it("names a bundle, a quota, a facility without exit scan and a missing facility", () => {
    const preview = admissionPreview(
      tariff({ usage: { mode: "quota", quota: 10 }, admissionsPerUnit: 4 }),
      {
        facility: {
          ...pool,
          admissionFacility: { exitScan: false, maxStayMinutes: 240 },
        },
      }
    );
    expect(preview.issues[0].params).toEqual({ count: 4 });
    expect(keys(preview.checks)).toEqual(
      expect.arrayContaining([
        "checks.code.bundle",
        "checks.usage.quota",
        "checks.presence.noExitScan",
        "checks.presence.maxStay",
      ])
    );
    expect(keys(admissionPreview(tariff({})).warnings)).toEqual([
      "warnings.noFacility",
    ]);
    expect(admissionPreview(tariff(null))).toBeNull();
  });

  it("writes a day as the German catalogue does", () => {
    expect(germanDate("2027-05-01")).toBe("01.05.2027");
    expect(germanDate(null)).toBe("");
  });
});
