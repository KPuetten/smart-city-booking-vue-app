/**
 * The admission definition of a tariff and the settings of a facility, as
 * the editor reads and writes them (glossary „Zugangsberechtigung“,
 * „Berechtigungsdefinition“, „Einrichtung“). The backend names the
 * vocabulary and the defaults (smart-city-booking-backend
 * `src/commons/entities/admission/admission-definition.js`); this module
 * mirrors them and nothing more, and words the rule preview: what a
 * tariff issues and what the entrance checks, as parts of the German
 * catalogue (`bookable.admission.preview.*`).
 *
 * A definition lives on a ticket (`bookable.admission`), the settings on a
 * bookable that is no ticket (`bookable.admissionFacility`). Switched off
 * (`enabled: false`) they stay on the bookable, so switching on again keeps
 * what was set.
 */

export const VALIDITY_MODES = Object.freeze(["booking", "window", "duration"]);
export const USAGE_MODES = Object.freeze(["single", "unlimited", "quota"]);
export const CAPACITY_CHECKS = Object.freeze(["booking", "entry", "none"]);

/** `MAX_BLOCK_MINUTES` and `MAX_ADMISSIONS_PER_UNIT` of the backend. */
export const MAX_BLOCK_MINUTES = 24 * 60;
export const MAX_ADMISSIONS_PER_UNIT = 50;

export const DEFAULT_RESET_TIME = "03:00";
export const DEFAULT_TIMEZONE = "Europe/Berlin";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const isWhole = (value, min, max = Infinity) =>
  value !== null &&
  value !== "" &&
  Number.isInteger(Number(value)) &&
  Number(value) >= min &&
  Number(value) <= max;

/** The definition a tariff gets when its admissions are switched on. */
export function newAdmissionDefinition() {
  return {
    enabled: true,
    validity: { mode: "booking", from: null, to: null, days: null },
    usage: { mode: "single", quota: null },
    blockMinutes: 0,
    personalized: false,
    admissionsPerUnit: 1,
    capacityCheck: "booking",
  };
}

/** The settings a facility gets when its entrance is switched on. */
export function newFacilitySettings() {
  return {
    enabled: true,
    resetTime: DEFAULT_RESET_TIME,
    exitScan: true,
    maxStayMinutes: null,
    timezone: DEFAULT_TIMEZONE,
  };
}

/** Whether the tariff issues admissions: a ticket with a definition on. */
export function issuesAdmissions(bookable) {
  return (
    bookable?.type === "ticket" &&
    !!bookable.admission &&
    bookable.admission.enabled !== false
  );
}

/** Whether the bookable is a facility whose entrance is checked. */
export function isAdmissionFacility(bookable) {
  return (
    !!bookable &&
    bookable.type !== "ticket" &&
    !!bookable.admissionFacility &&
    bookable.admissionFacility.enabled !== false
  );
}

/**
 * The definition with every default filled in, as the backend reads it
 * (`normalizeDefinition`), or `null` where the tariff issues none.
 */
export function admissionDefinitionOf(bookable) {
  if (!issuesAdmissions(bookable)) return null;
  const definition = bookable.admission;
  const usageMode = definition.usage?.mode ?? "single";
  return {
    validity: {
      mode: definition.validity?.mode ?? "booking",
      from: definition.validity?.from ?? null,
      to: definition.validity?.to ?? null,
      days: definition.validity?.days ?? null,
    },
    usage: {
      mode: usageMode,
      quota: usageMode === "quota" ? definition.usage?.quota ?? null : null,
    },
    blockMinutes: definition.blockMinutes ?? 0,
    personalized: definition.personalized === true,
    admissionsPerUnit: definition.admissionsPerUnit ?? 1,
    capacityCheck: definition.capacityCheck ?? "booking",
  };
}

/** The facility settings with every default filled in, or `null`. */
export function facilitySettingsOf(bookable) {
  if (!isAdmissionFacility(bookable)) return null;
  const settings = bookable.admissionFacility;
  return {
    resetTime: settings.resetTime ?? DEFAULT_RESET_TIME,
    exitScan: settings.exitScan !== false,
    maxStayMinutes: settings.maxStayMinutes ?? null,
    timezone: settings.timezone ?? DEFAULT_TIMEZONE,
  };
}

/**
 * The facility a tariff's admissions are checked at: the first facility that
 * lists the tariff as its child (`relatedBookableIds` - a parent lists its
 * children, as the Hierarchie and the checkout read it), as the backend's
 * issuance picks it (`facilityOf`), or `null`.
 *
 * @param {Object} tariff
 * @param {Object[]} bookables The tenant's bookables
 */
export function facilityOfTariff(tariff, bookables = []) {
  if (!tariff?.id) return null;
  return (
    admissionFacilities(bookables).find((bookable) =>
      (bookable.relatedBookableIds || []).includes(tariff.id)
    ) || null
  );
}

/** The bookables with entrance settings (glossary „Einrichtung“). */
export function admissionFacilities(bookables = []) {
  return bookables.filter((bookable) => isAdmissionFacility(bookable));
}

/** A day `YYYY-MM-DD` as the German catalogue writes it, `01.05.2027`. */
export function germanDate(day) {
  if (!DATE_PATTERN.test(day || "")) return day || "";
  const [year, month, date] = day.split("-");
  return `${date}.${month}.${year}`;
}

/**
 * What blocks a save of the definition, as the backend refuses it
 * (`definitionErrors`): the field and the key of its message. Empty while it
 * is fine or switched off.
 */
export function admissionDefinitionErrors(bookable) {
  const definition = admissionDefinitionOf(bookable);
  if (!definition) return [];
  const errors = [];
  const add = (field, name) => errors.push({ field, name });
  const { validity, usage } = definition;
  if (validity.mode === "window") {
    if (!DATE_PATTERN.test(validity.from ?? "")) add("validity.from", "date");
    if (!DATE_PATTERN.test(validity.to ?? "")) add("validity.to", "date");
    if (!errors.length && validity.from > validity.to) {
      add("validity.to", "windowOrder");
    }
  }
  if (validity.mode === "duration" && !isWhole(validity.days, 1)) {
    add("validity.days", "days");
  }
  if (usage.mode === "quota" && !isWhole(usage.quota, 1)) {
    add("usage.quota", "quota");
  }
  if (!isWhole(definition.blockMinutes, 0, MAX_BLOCK_MINUTES)) {
    add("blockMinutes", "blockMinutes");
  }
  if (!isWhole(definition.admissionsPerUnit, 1, MAX_ADMISSIONS_PER_UNIT)) {
    add("admissionsPerUnit", "admissionsPerUnit");
  }
  return errors;
}

/** What blocks a save of the facility settings (`facilityErrors`). */
export function facilitySettingsErrors(bookable) {
  const settings = facilitySettingsOf(bookable);
  if (!settings) return [];
  const errors = [];
  if (!TIME_PATTERN.test(settings.resetTime)) {
    errors.push({ field: "resetTime", name: "resetTime" });
  }
  if (
    settings.maxStayMinutes !== null &&
    settings.maxStayMinutes !== "" &&
    !isWhole(settings.maxStayMinutes, 1)
  ) {
    errors.push({ field: "maxStayMinutes", name: "maxStayMinutes" });
  }
  return errors;
}

const PREVIEW = "bookable.admission.preview";
const part = (key, params = {}) => ({ key: `${PREVIEW}.${key}`, params });

/** A count as the German catalogue writes it, `1.000`. */
const germanCount = (value) => Number(value).toLocaleString("de-DE");

const isWholeDay = (period) =>
  period?.startTime === "00:00" &&
  ["23:59", "24:00"].includes(period?.endTime);

/**
 * The tariff's own contingent, its `amount`, or null where it is
 * unlimited. The backend counts it over the bookings that overlap the booked
 * period where the tariff is booked by time periods - per day where every
 * period is a whole day - and over every booking of the tariff otherwise
 * (smart-city-booking-backend `docs/admission.md`, "When the capacity is
 * checked"). Manual bookings of the administration are not checked, so it is
 * what is sold online.
 *
 * @param {Object} tariff
 * @returns {?{ count: number, per: "day"|"period"|"total" }}
 */
export function tariffContingent(tariff) {
  // An `amount` of 0 or none is unlimited, as the backend reads it.
  const amount = Number(tariff?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  let per = "total";
  if (tariff.isTimePeriodRelated === true) {
    const periods = tariff.timePeriods || [];
    per = periods.length > 0 && periods.every(isWholeDay) ? "day" : "period";
  }
  return { count: amount, per };
}

/**
 * The rule preview of a tariff: what it issues, what the purchase
 * checks of the capacity and what the entrance checks, in the order
 * of the check (docs/admission.md, sections 1 and 4).
 * Each line is a part `{ key, params }` of the German catalogue; `null`
 * where the tariff issues no admissions.
 *
 * @param {Object} tariff The ticket as edited
 * @param {{ facility?: ?Object }} [context] The facility it is checked at,
 *   `facilityOfTariff`; without one the preview names the gap
 * @returns {?{ issues: Object[], sale: Object[], checks: Object[],
 *   warnings: Object[] }}
 */
export function admissionPreview(tariff, { facility = null } = {}) {
  const definition = admissionDefinitionOf(tariff);
  if (!definition) return null;
  const settings = facilitySettingsOf(facility);
  const { validity, usage } = definition;
  const perUnit = Number(definition.admissionsPerUnit) || 1;

  const issues = [
    perUnit > 1
      ? part("issues.bundle", { count: perUnit })
      : part("issues.single"),
  ];
  if (validity.mode === "window") {
    issues.push(
      part("issues.validity.window", {
        from: germanDate(validity.from) || "…",
        to: germanDate(validity.to) || "…",
      })
    );
  } else if (validity.mode === "duration") {
    issues.push(
      part("issues.validity.duration", { days: validity.days ?? "…" })
    );
  } else {
    issues.push(part("issues.validity.booking"));
  }
  if (usage.mode === "quota") {
    issues.push(part("issues.usage.quota", { quota: usage.quota ?? "…" }));
  } else {
    issues.push(part(`issues.usage.${usage.mode}`));
  }
  if (definition.personalized) issues.push(part("issues.personalized"));
  issues.push(part("issues.binding"));

  const facilityName = facility?.title || "";
  const checks = [
    part(perUnit > 1 ? "checks.code.bundle" : "checks.code.single", {
      facility: facilityName || "…",
    }),
    part("checks.valid"),
  ];
  if (usage.mode === "single") checks.push(part("checks.usage.single"));
  if (usage.mode === "quota") checks.push(part("checks.usage.quota"));
  if (usage.mode === "unlimited") checks.push(part("checks.usage.unlimited"));
  if (!settings || settings.exitScan) {
    checks.push(part("checks.presence.exitScan"));
  } else {
    checks.push(part("checks.presence.noExitScan"));
  }
  if (settings && Number(settings.maxStayMinutes) > 0) {
    checks.push(
      part("checks.presence.maxStay", { minutes: settings.maxStayMinutes })
    );
  }
  if (Number(definition.blockMinutes) > 0) {
    checks.push(
      part("checks.blockTime", { minutes: Number(definition.blockMinutes) })
    );
  }
  if (definition.capacityCheck === "entry") {
    const capacity = facility?.amount;
    checks.push(
      part("checks.capacity.entry", {
        capacity:
          capacity === null || capacity === undefined || capacity === ""
            ? "…"
            : germanCount(capacity),
      })
    );
  }
  if (definition.personalized) checks.push(part("checks.photo"));
  if (settings) {
    checks.push(part("checks.reset", { time: settings.resetTime }));
  }

  // At the purchase: the facility's capacity counts only for a tariff that
  // checks at the booking, and only over the tickets of such tariffs; the
  // tariff's own contingent counts whatever it checks.
  const sale = [part(`sale.capacity.${definition.capacityCheck}`)];
  const contingent = tariffContingent(tariff);
  if (contingent) {
    sale.push(
      part(`sale.contingent.${contingent.per}`, {
        count: germanCount(contingent.count),
      })
    );
  }

  const warnings = [];
  if (!facility) warnings.push(part("warnings.noFacility"));
  return { issues, sale, checks, warnings };
}
