import store from "@/store";

const tenantOf = (tenant) => tenant || store.getters["tenants/currentTenantId"];

/**
 * The administration of the admissions and their devices
 * (`/api/:tenant/admission`, docs/admission.md of the backend). The code of
 * an admission comes only with the single admission; a device token only in
 * the answer that creates or renews it, once.
 */
export default {
  /** `filters`: `facilityId`, `bookableId`, `bookingId`, `state`, `code`, `limit`. */
  getAdmissions(filters = {}, tenant) {
    const params = Object.fromEntries(
      Object.entries(filters).filter(
        ([, value]) => value !== undefined && value !== null && value !== ""
      )
    );
    return ApiClient.get(`api/${tenantOf(tenant)}/admission/admissions`, {
      params,
    });
  },

  getAdmission(id, tenant) {
    return ApiClient.get(`api/${tenantOf(tenant)}/admission/admissions/${id}`);
  },

  /** `action`: `block`, `unblock`, `resetPresence`, `revertEntry`; `reason` required. */
  correctAdmission(id, action, reason, tenant) {
    return ApiClient.post(
      `api/${tenantOf(tenant)}/admission/admissions/${id}/corrections`,
      { action, reason }
    );
  },

  /** The number of checked-in admissions of a facility, not of people. */
  getCheckedIn(facilityId, tenant) {
    return ApiClient.get(
      `api/${tenantOf(tenant)}/admission/facilities/${facilityId}/checked-in`
    );
  },

  getDevices(tenant) {
    return ApiClient.get(`api/${tenantOf(tenant)}/admission/devices`);
  },

  /** Answers `{ device, token }`; the token is not shown again. */
  createDevice({ facilityId, label }, tenant) {
    return ApiClient.post(`api/${tenantOf(tenant)}/admission/devices`, {
      facilityId,
      label,
    });
  },

  /** Answers `{ device, token }`; the old token stops working. */
  renewDeviceToken(id, tenant) {
    return ApiClient.post(
      `api/${tenantOf(tenant)}/admission/devices/${id}/token`,
      {}
    );
  },

  blockDevice(id, reason, tenant) {
    return ApiClient.post(
      `api/${tenantOf(tenant)}/admission/devices/${id}/block`,
      { reason }
    );
  },

  unblockDevice(id, tenant) {
    return ApiClient.post(
      `api/${tenantOf(tenant)}/admission/devices/${id}/unblock`,
      {}
    );
  },
};
