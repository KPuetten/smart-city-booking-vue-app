import { beforeEach, describe, expect, it, vi } from "vitest";
import Vue from "vue";
import Vuex from "vuex";
import { mountComponent } from "@tests/unit/support/mount";
import { flushPromises } from "@tests/unit/support/api";

vi.mock("@/services/api/ApiAdmissionService", () => ({
  default: {
    correctAdmission: vi.fn(),
    getAdmissions: vi.fn(),
    getCheckedIn: vi.fn(),
  },
}));

import AdmissionCorrectionDialog from "@/components/Admission/AdmissionCorrectionDialog.vue";
import AdmissionDeviceTokenDialog from "@/components/Admission/AdmissionDeviceTokenDialog.vue";
import AdmissionList from "@/components/Admission/AdmissionList.vue";
import ApiAdmissionService from "@/services/api/ApiAdmissionService";

const ADMISSION = {
  id: "a-1",
  kind: "single",
  memberIndex: 0,
  state: "present",
  bookableTitle: "10er-Karte",
  bookingId: "PPBK-QPDP",
  facilityId: "pool",
  remainingDays: 9,
  entitlement: { usage: "quota", quota: 10 },
  usage: [],
};

const inDocument = (selector) => document.querySelector(selector);

async function openCorrection(action = "resetPresence") {
  const wrapper = mountComponent(AdmissionCorrectionDialog, {
    propsData: { open: false, admission: ADMISSION, action },
  });
  await wrapper.setProps({ open: true });
  await flushPromises();
  return wrapper;
}

async function type(selector, value) {
  const field = inDocument(selector);
  field.value = value;
  field.dispatchEvent(new Event("input"));
  await Vue.nextTick();
}

async function press(selector) {
  inDocument(selector).click();
  await flushPromises();
}

describe("AdmissionCorrectionDialog", () => {
  beforeEach(() => {
    ApiAdmissionService.correctAdmission.mockReset();
  });

  it("sends nothing without a reason", async () => {
    const wrapper = await openCorrection();
    await press('[data-test="admission-correction-submit"]');
    expect(ApiAdmissionService.correctAdmission).not.toHaveBeenCalled();
    const reason = wrapper.findComponent({ name: "v-textarea" });
    expect(reason.vm.errorBucket).toEqual(["Bitte eine Begründung angeben."]);
  });

  it("sends the action with the reason trimmed and hands the admission on", async () => {
    ApiAdmissionService.correctAdmission.mockResolvedValue({
      data: { ...ADMISSION, state: "absent" },
    });
    const wrapper = await openCorrection();
    await type(
      '[data-test="admission-correction-reason"]',
      "  Austritt vergessen  "
    );
    await press('[data-test="admission-correction-submit"]');
    expect(ApiAdmissionService.correctAdmission).toHaveBeenCalledWith(
      "a-1",
      "resetPresence",
      "Austritt vergessen"
    );
    expect(wrapper.emitted("corrected")[0][0].state).toBe("absent");
  });

  it("asks to look again when a scan wrote the admission in between", async () => {
    ApiAdmissionService.correctAdmission.mockRejectedValue({
      response: { status: 409, data: { code: "admission_changed" } },
    });
    const wrapper = await openCorrection("revertEntry");
    await type('[data-test="admission-correction-reason"]', "Fehlscan");
    await press('[data-test="admission-correction-submit"]');
    expect(wrapper.emitted("stale")).toBeTruthy();
    expect(
      inDocument('[data-test="admission-correction-error"]').textContent
    ).toContain("inzwischen am Einlass gescannt");
  });
});

describe("AdmissionDeviceTokenDialog", () => {
  it("shows the token once, masked until asked", async () => {
    const wrapper = mountComponent(AdmissionDeviceTokenDialog, {
      propsData: {
        open: false,
        device: { label: "Eingang Nord" },
        token: "adm.d-1.secret",
      },
      store: new Vuex.Store({
        getters: { "tenants/currentTenantId": () => "t1" },
      }),
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const field = inDocument('[data-test="admission-token-value"]');
    expect(field.type).toBe("password");
    expect(
      inDocument('[data-test="admission-token-once"]').textContent
    ).toContain("nur jetzt angezeigt");
    expect(
      inDocument('[data-test="admission-token-tenant"]').textContent
    ).toContain("t1");
  });

  it("names the button that shows and hides the token", async () => {
    const wrapper = mountComponent(AdmissionDeviceTokenDialog, {
      propsData: {
        open: false,
        device: { label: "Eingang Nord" },
        token: "adm.d-1.secret",
      },
      store: new Vuex.Store({
        getters: { "tenants/currentTenantId": () => "t1" },
      }),
    });
    await wrapper.setProps({ open: true });
    await flushPromises();
    const reveal = inDocument('[data-test="admission-token-reveal"]');
    expect(reveal.getAttribute("aria-label")).toBe("Token anzeigen");
    await press('[data-test="admission-token-reveal"]');
    expect(inDocument('[data-test="admission-token-value"]').type).toBe("text");
    expect(reveal.getAttribute("aria-label")).toBe("Token verbergen");
  });
});

describe("AdmissionList", () => {
  beforeEach(() => {
    ApiAdmissionService.getAdmissions.mockReset();
    ApiAdmissionService.getAdmissions.mockResolvedValue({ data: [ADMISSION] });
    ApiAdmissionService.getCheckedIn.mockResolvedValue({
      data: { checkedIn: 1, capacity: 1500 },
    });
  });

  const mountList = () =>
    mountComponent(AdmissionList, {
      propsData: {
        facilities: [{ id: "pool", title: "Freibad am See" }],
        tariffs: [{ id: "ten", title: "10er-Karte" }],
      },
      stubs: ["router-link", "v-btn"],
      store: new Vuex.Store({
        getters: { "tenants/currentTenantId": () => "t1" },
      }),
    });

  it("lists the admissions with their state as icon and word", async () => {
    const wrapper = mountList();
    await flushPromises();
    expect(ApiAdmissionService.getAdmissions).toHaveBeenCalledWith({
      facilityId: null,
      bookableId: null,
      state: null,
      limit: 200,
    });
    const state = wrapper.find('[data-test="admission-state"]');
    expect(state.attributes("data-state")).toBe("present");
    expect(state.text()).toBe("Eingecheckt");
    expect(wrapper.text()).toContain("9 von 10 Nutzungstagen übrig");
  });

  it("counts checked-in admissions and says that they are no people", async () => {
    const wrapper = mountList();
    await flushPromises();
    expect(
      wrapper.find('[data-test="admission-counter-value"]').text()
    ).toContain("1 von 1.500 eingecheckten Berechtigungen");
    expect(
      wrapper.find('[data-test="admission-counter-note"]').text()
    ).toContain("keine anwesenden Personen");
  });

  it("writes the figures of the count with German thousands separators", async () => {
    ApiAdmissionService.getCheckedIn.mockResolvedValue({
      data: { checkedIn: 1234, capacity: null },
    });
    const wrapper = mountList();
    await flushPromises();
    expect(
      wrapper.find('[data-test="admission-counter-value"]').text()
    ).toBe("1.234 eingecheckte Berechtigungen");
  });

  it("shows the answer of the latest load, whichever arrives last", async () => {
    let answerFirst;
    ApiAdmissionService.getAdmissions
      .mockImplementationOnce(
        () => new Promise((resolve) => (answerFirst = resolve))
      )
      .mockResolvedValueOnce({
        data: [{ ...ADMISSION, id: "a-2", bookableTitle: "Tageskarte" }],
      });
    const wrapper = mountList();
    wrapper.vm.onFilter("state", "present");
    await flushPromises();
    expect(wrapper.text()).toContain("Tageskarte");

    answerFirst({ data: [ADMISSION] });
    await flushPromises();
    expect(wrapper.text()).toContain("Tageskarte");
    expect(wrapper.text()).not.toContain("10er-Karte");
    expect(wrapper.vm.loading).toBe(false);
  });

  it("searches a code by the code and a booking by its number", async () => {
    const wrapper = mountList();
    await flushPromises();
    wrapper.vm.query = "g8lv udpm b83t bh29 8ewr pxf7 xxhp unmk";
    await flushPromises();
    expect(ApiAdmissionService.getAdmissions).toHaveBeenLastCalledWith(
      expect.objectContaining({ code: "G8LVUDPMB83TBH298EWRPXF7XXHPUNMK" })
    );
    wrapper.vm.query = "ppbk-qpdp";
    await flushPromises();
    expect(ApiAdmissionService.getAdmissions).toHaveBeenLastCalledWith(
      expect.objectContaining({ bookingId: "PPBK-QPDP" })
    );
  });
});
