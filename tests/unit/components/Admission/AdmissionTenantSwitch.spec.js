import { beforeEach, describe, expect, it, vi } from "vitest";
import Vuex from "vuex";
import { mountComponent } from "@tests/unit/support/mount";
import { flushPromises } from "@tests/unit/support/api";

vi.mock("@/services/api/ApiAdmissionService", () => ({
  default: {
    getAdmissions: vi.fn(),
    getAdmission: vi.fn(),
    getCheckedIn: vi.fn(),
    getDevices: vi.fn(),
  },
}));
vi.mock("@/services/api/ApiBookablesService", () => ({
  default: { getBookable: vi.fn() },
}));
vi.mock("@/services/permissions/AdmissionPermissionService", () => ({
  default: {
    allowRead: () => true,
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

import AdmissionList from "@/components/Admission/AdmissionList.vue";
import AdmissionDeviceManagement from "@/components/Admission/AdmissionDeviceManagement.vue";
import AdmissionDetail from "@/views/Management/AdmissionDetail.vue";
import ApiAdmissionService from "@/services/api/ApiAdmissionService";
import ApiBookablesService from "@/services/api/ApiBookablesService";

/**
 * The page „Einlass“ follows the tenant chosen in the navigation, as the
 * page „Mitglieder“ does: a switch loads the admissions, the devices and the
 * single admission of the new tenant.
 */

function tenantStore(current = "t1") {
  return new Vuex.Store({
    modules: {
      tenants: {
        namespaced: true,
        state: () => ({ current }),
        getters: { currentTenantId: (state) => state.current },
        mutations: {
          select(state, tenantId) {
            state.current = tenantId;
          },
        },
      },
    },
  });
}

async function switchTenant(store, tenantId) {
  store.commit("tenants/select", tenantId);
  await flushPromises();
}

beforeEach(() => {
  vi.clearAllMocks();
  ApiAdmissionService.getAdmissions.mockResolvedValue({ data: [] });
  ApiAdmissionService.getCheckedIn.mockResolvedValue({
    data: { checkedIn: 0, capacity: null },
  });
  ApiAdmissionService.getDevices.mockResolvedValue({ data: [] });
  ApiAdmissionService.getAdmission.mockResolvedValue({
    data: {
      id: "a-1",
      kind: "single",
      state: "present",
      facilityId: "pool",
      bookableTitle: "10er-Karte",
      entitlement: { usage: "quota", quota: 10, capacityCheck: "none" },
      usage: [],
    },
  });
  ApiBookablesService.getBookable.mockResolvedValue({
    data: { id: "pool", title: "Freibad" },
  });
});

describe("a switch of the tenant", () => {
  it("loads the admissions of the new tenant and drops the old filters", async () => {
    const store = tenantStore();
    const wrapper = mountComponent(AdmissionList, {
      propsData: { facilities: [{ id: "pool", title: "Freibad" }], tariffs: [] },
      stubs: ["router-link", "v-btn"],
      store,
    });
    await flushPromises();
    wrapper.vm.onFilter("facilityId", "pool");
    await flushPromises();
    expect(ApiAdmissionService.getAdmissions).toHaveBeenLastCalledWith(
      expect.objectContaining({ facilityId: "pool" })
    );

    await switchTenant(store, "t2");
    expect(ApiAdmissionService.getAdmissions).toHaveBeenCalledTimes(3);
    expect(ApiAdmissionService.getAdmissions).toHaveBeenLastCalledWith(
      expect.objectContaining({ facilityId: null, bookableId: null, state: null })
    );
  });

  it("loads the devices of the new tenant and closes the token of the old", async () => {
    const store = tenantStore();
    const wrapper = mountComponent(AdmissionDeviceManagement, {
      propsData: { facilities: [] },
      store,
    });
    await flushPromises();
    expect(ApiAdmissionService.getDevices).toHaveBeenCalledTimes(1);
    wrapper.vm.issued = { device: { label: "Eingang" }, token: "adm.d-1.secret" };

    await switchTenant(store, "t2");
    expect(ApiAdmissionService.getDevices).toHaveBeenCalledTimes(2);
    expect(wrapper.vm.issued).toBeNull();
  });

  it("asks for the admission and the devices again", async () => {
    const store = tenantStore();
    mountComponent(AdmissionDetail, {
      store,
      mocks: { $route: { params: { id: "a-1" } } },
      stubs: ["router-link", "AdmissionCorrectionDialog"],
    });
    await flushPromises();
    expect(ApiAdmissionService.getAdmission).toHaveBeenCalledTimes(1);
    expect(ApiAdmissionService.getDevices).toHaveBeenCalledTimes(1);

    await switchTenant(store, "t2");
    expect(ApiAdmissionService.getAdmission).toHaveBeenCalledTimes(2);
    expect(ApiAdmissionService.getDevices).toHaveBeenCalledTimes(2);
  });
});
