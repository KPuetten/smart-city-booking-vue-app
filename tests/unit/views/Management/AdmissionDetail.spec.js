import { beforeEach, describe, expect, it, vi } from "vitest";
import Vuex from "vuex";
import { mountComponent } from "@tests/unit/support/mount";
import { flushPromises, forbiddenError } from "@tests/unit/support/api";

const rights = vi.hoisted(() => ({ read: true }));

vi.mock("@/services/api/ApiAdmissionService", () => ({
  default: { getAdmission: vi.fn(), getDevices: vi.fn() },
}));
vi.mock("@/services/api/ApiBookablesService", () => ({
  default: { getBookable: vi.fn() },
}));
vi.mock("@/services/permissions/AdmissionPermissionService", () => ({
  default: {
    allowRead: () => rights.read,
    allowCorrect: () => false,
    allowManageDevices: () => false,
  },
}));
vi.mock("@/layouts/Admin.vue", () => ({
  default: {
    name: "AdminLayout",
    render(h) {
      return h("div", this.$slots.default);
    },
  },
}));

import AdmissionDetail from "@/views/Management/AdmissionDetail.vue";
import ApiAdmissionService from "@/services/api/ApiAdmissionService";
import ApiBookablesService from "@/services/api/ApiBookablesService";

/**
 * A single admission is read with the same right as the list
 * (`manageAdmissions.readAny`, or an owner). Without it the page says so,
 * as the list does, and asks the API for nothing.
 */

const ADMISSION = {
  id: "a-1",
  kind: "single",
  state: "present",
  facilityId: "pool",
  bookableTitle: "10er-Karte",
  bookingId: "PPBK-QPDP",
  entitlement: { usage: "quota", quota: 10, capacityCheck: "none" },
  usage: [],
};

function mountDetail({ tenantId = "t1" } = {}) {
  return mountComponent(AdmissionDetail, {
    store: new Vuex.Store({
      getters: { "tenants/currentTenantId": () => tenantId },
    }),
    mocks: { $route: { params: { id: "a-1" } } },
    stubs: ["router-link", "AdmissionCorrectionDialog"],
  });
}

const textOf = (wrapper, test) =>
  wrapper.find(`[data-test="${test}"]`).text();

beforeEach(() => {
  vi.clearAllMocks();
  rights.read = true;
  ApiAdmissionService.getAdmission.mockResolvedValue({ data: ADMISSION });
  ApiAdmissionService.getDevices.mockResolvedValue({ data: [] });
  ApiBookablesService.getBookable.mockResolvedValue({
    data: { id: "pool", title: "Freibad" },
  });
});

describe("AdmissionDetail without the right to read", () => {
  it("says the right is missing, as the list does, and loads nothing", async () => {
    rights.read = false;
    const wrapper = mountDetail();
    await flushPromises();

    expect(textOf(wrapper, "admission-detail-forbidden")).toContain(
      "„Einlass: Alle lesen“"
    );
    expect(wrapper.find('[data-test="admission-detail-error"]').exists()).toBe(
      false
    );
    expect(ApiAdmissionService.getAdmission).not.toHaveBeenCalled();
    expect(ApiAdmissionService.getDevices).not.toHaveBeenCalled();
  });

  it("asks for a tenant first when none is chosen", async () => {
    const wrapper = mountDetail({ tenantId: null });
    await flushPromises();
    expect(
      wrapper.find('[data-test="admission-detail-forbidden"]').exists()
    ).toBe(true);
    expect(ApiAdmissionService.getAdmission).not.toHaveBeenCalled();
  });

  it("names the missing right when the API refuses it", async () => {
    ApiAdmissionService.getAdmission.mockRejectedValue(forbiddenError());
    const wrapper = mountDetail();
    await flushPromises();
    expect(textOf(wrapper, "admission-detail-error")).toContain(
      "„Einlass: Alle lesen“"
    );
  });
});

describe("AdmissionDetail with the right to read", () => {
  it("loads the admission and the devices of its log", async () => {
    const wrapper = mountDetail();
    await flushPromises();
    expect(ApiAdmissionService.getAdmission).toHaveBeenCalledWith("a-1");
    expect(ApiAdmissionService.getDevices).toHaveBeenCalledTimes(1);
    expect(
      wrapper.find('[data-test="admission-detail-forbidden"]').exists()
    ).toBe(false);
  });
});
