/**
 * What the signed-in user may do with the admissions at a tenant, as the
 * backend's rights table decides it (`admission.*`, `admissionDevice.*`,
 * group `manageAdmissions`, docs/admission.md section 5):
 *
 *   check         `manageAdmissions.create` - check in and out
 *   read          `manageAdmissions.readAny` - the admissions, their log,
 *                 the devices
 *   correct       `manageAdmissions.updateAny` - block, unblock, reset a
 *                 presence, take an entry back
 *   manageDevices the tenant owner - register devices, renew and block
 *                 their tokens
 *
 * The instance owner and the tenant owner may everything. Pure over the
 * permissions of the sign-in (`user.data.permissions`), so the navigation
 * can ask it without loading a permission service (see `Navbar.vue`).
 */

const LEVELS = Object.freeze({
  check: "create",
  read: "readAny",
  correct: "updateAny",
});

/**
 * @param {?Object} permissions `user.data.permissions` of the sign-in
 * @param {?string} tenantId The current tenant
 * @param {"check"|"read"|"correct"|"manageDevices"} right
 * @returns {boolean}
 */
export function allowsAdmission(permissions, tenantId, right) {
  if (!permissions) return false;
  if (permissions.instanceOwner === true) return true;
  if (!tenantId) return false;
  const membership = (permissions.tenants || []).find(
    (entry) => entry.tenantId === tenantId
  );
  if (!membership) return false;
  if (membership.isOwner === true) return true;
  if (right === "manageDevices") return false;
  const level = LEVELS[right];
  return !!level && membership.manageAdmissions?.[level] === true;
}
