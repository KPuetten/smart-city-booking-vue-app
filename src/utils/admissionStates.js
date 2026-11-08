/**
 * The vocabulary of the admissions in the administration (glossary
 * „Zugangsberechtigung“): their states, kinds and usage log,
 * and which correction applies to an admission as it stands - the rules of
 * the backend's `correctionOf` (admission-service.js), mirrored so a
 * correction that would be refused is not offered. Labels are keys of the
 * German catalogue (`admission.*`); the state is told by an icon and a word,
 * never by colour alone.
 */

export const ADMISSION_STATES = Object.freeze([
  "issued",
  "present",
  "absent",
  "consumed",
  "expired",
  "blocked",
  "invalid",
]);

/** Icon and Vuetify colour of each state, beside its word. */
const STATE_LOOK = Object.freeze({
  issued: { icon: "mdi-ticket-outline", color: "info" },
  present: { icon: "mdi-login-variant", color: "success" },
  absent: { icon: "mdi-logout-variant", color: "secondary" },
  consumed: { icon: "mdi-ticket-confirmation", color: "secondary" },
  expired: { icon: "mdi-calendar-remove-outline", color: "grey" },
  blocked: { icon: "mdi-cancel", color: "error" },
  invalid: { icon: "mdi-close-octagon-outline", color: "error" },
});

export function stateLook(state) {
  return (
    STATE_LOOK[state] || { icon: "mdi-help-circle-outline", color: "grey" }
  );
}

export const CORRECTIONS = Object.freeze([
  "block",
  "unblock",
  "resetPresence",
  "revertEntry",
]);

const LIVE_AFTER_ENTRY = ["present", "absent", "consumed"];

/** The entries of the log not taken back by a correction, oldest first. */
function standingEntries(admission) {
  const usage = admission?.usage || [];
  const reverted = new Set(
    usage.filter((entry) => entry.reverts).map((entry) => entry.reverts)
  );
  return usage.filter(
    (entry) => entry.type === "entry" && !reverted.has(entry.at)
  );
}

/**
 * Whether the correction `action` applies to the admission as it stands,
 * as the backend decides it; it refuses the others with
 * `409 admission_correction_not_applicable`.
 */
export function correctionApplies(action, admission) {
  if (!admission) return false;
  const { state, kind } = admission;
  switch (action) {
    case "block":
      return !["blocked", "invalid"].includes(state) && kind !== "bundle";
    case "unblock":
      return state === "blocked";
    case "resetPresence":
      return state === "present";
    case "revertEntry":
      return (
        LIVE_AFTER_ENTRY.includes(state) &&
        standingEntries(admission).length > 0
      );
    default:
      return false;
  }
}

/** The corrections that apply to the admission, in the order offered. */
export function applicableCorrections(admission) {
  return CORRECTIONS.filter((action) => correctionApplies(action, admission));
}

/**
 * The days of use as a text part: left of a quota, „unbegrenzt“, or the one
 * day of a single admission.
 *
 * @returns {{ key: string, params?: Object }}
 */
export function remainingDaysPart(admission) {
  const usage = admission?.entitlement?.usage;
  if (usage === "unlimited" || admission?.remainingDays === null) {
    return { key: "admission.remaining.unlimited" };
  }
  if (usage === "quota") {
    return {
      key: "admission.remaining.quota",
      params: {
        left: admission.remainingDays,
        quota: admission.entitlement.quota,
      },
    };
  }
  return {
    key:
      admission.remainingDays > 0
        ? "admission.remaining.singleOpen"
        : "admission.remaining.singleUsed",
  };
}

/**
 * The usage log newest first, each entry with what the administration
 * reads: its kind, the change of state, who or what wrote it and why.
 * `devicesById` names the devices by their label.
 */
export function usageRows(admission, devicesById = {}) {
  return [...(admission?.usage || [])]
    .map((entry, index) => ({
      key: `${entry.at}-${index}`,
      at: entry.at,
      type: entry.type,
      day: entry.day,
      dayConsumed: !!entry.dayConsumed,
      fromState: entry.fromState,
      toState: entry.toState,
      reason: entry.reason || "",
      reverted: false,
      actor: entry.deviceId
        ? {
            kind: "device",
            label: devicesById[entry.deviceId]?.label || entry.deviceId,
          }
        : entry.userId
        ? { kind: "user", label: entry.userId }
        : entry.runId
        ? { kind: "reset", label: "" }
        : { kind: "system", label: "" },
      reverts: entry.reverts ?? null,
    }))
    .map((row, index, rows) => ({
      ...row,
      reverted:
        row.type === "entry" &&
        rows.some(
          (other) => other.reverts !== null && other.reverts === row.at
        ),
    }))
    .sort((a, b) => b.at - a.at);
}

/**
 * The search of the list read as what it is: a code of an admission (32
 * characters of its alphabet, groups and hyphens allowed) or a booking
 * number. Empty is no search.
 *
 * @returns {?{ code?: string, bookingId?: string }}
 */
export function admissionSearchOf(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/[\s-]/g, "").toUpperCase();
  if (/^[0-9A-HJ-NP-X]{32}$/.test(compact)) return { code: compact };
  return { bookingId: trimmed.toUpperCase() };
}
