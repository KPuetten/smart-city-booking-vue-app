import { describe, expect, it, vi } from "vitest";
import Vue from "vue";
import { mountEditing, lastPatch } from "@tests/unit/support/bookableEditing";
import { flushPromises } from "@tests/unit/support/api";
import { toggleSwitch } from "@tests/unit/support/vuetify";
import Bookable from "@/entities/bookable";

vi.mock("@/services/api/ApiBookablesService", () => ({
  default: { getBookables: vi.fn() },
}));

import BookableEditAdmission from "@/components/Bookable/Edit/BookableEditAdmission.vue";
import BookableEditAdmissionFacility from "@/components/Bookable/Edit/BookableEditAdmissionFacility.vue";
import BookableEditAdmissionPreview from "@/components/Bookable/Edit/BookableEditAdmissionPreview.vue";
import ApiBookablesService from "@/services/api/ApiBookablesService";
import { newAdmissionDefinition } from "@/utils/admissionDefinition";

const ENABLE = "Zugangsberechtigungen ausstellen";

const ticket = (overrides = {}) =>
  new Bookable({
    id: "ten-card",
    tenantId: "t1",
    type: "ticket",
    title: "10er-Karte",
    ...overrides,
  }).toPlain();

const pool = (overrides = {}) =>
  new Bookable({
    id: "pool",
    tenantId: "t1",
    type: "event-location",
    title: "Freibad am See",
    amount: 1500,
    // The facility lists its tariffs as its children (the Hierarchie).
    relatedBookableIds: ["ten-card"],
    ...overrides,
  }).toPlain();

const click = async (wrapper, test) => {
  await wrapper.find(`[data-test="${test}"]`).trigger("click");
  await Vue.nextTick();
};

describe("BookableEditAdmission (Berechtigungsdefinition)", () => {
  it("changes nothing when it mounts", async () => {
    const { patches, bookable, stored } = mountEditing(BookableEditAdmission, {
      bookable: ticket({ admission: { usage: { mode: "quota", quota: 10 } } }),
    });
    await flushPromises();
    expect(patches).toEqual([]);
    expect(bookable).toEqual(stored);
  });

  it("switches the admissions on with the backend's defaults, and off keeping them", async () => {
    const { wrapper, patches, bookable, stored } = mountEditing(
      BookableEditAdmission,
      { bookable: ticket({ admission: null }) }
    );
    expect(wrapper.find('[data-test="admission-validity"]').exists()).toBe(
      false
    );

    await toggleSwitch(wrapper, ENABLE);
    expect(lastPatch(patches)).toEqual({ admission: newAdmissionDefinition() });

    await toggleSwitch(wrapper, ENABLE);
    expect(lastPatch(patches)).toEqual({
      admission: { ...newAdmissionDefinition(), enabled: false },
    });
    expect(bookable).toEqual(stored);
  });

  it("sets a fixed window, a quota and a bundle, each as the whole definition", async () => {
    const { wrapper, patches } = mountEditing(BookableEditAdmission, {
      bookable: ticket({ admission: newAdmissionDefinition() }),
    });

    await click(wrapper, "admission-validity-window");
    expect(lastPatch(patches).admission.validity).toEqual({
      mode: "window",
      from: null,
      to: null,
      days: null,
    });
    expect(wrapper.find('[data-test="admission-validity-from"]').exists()).toBe(
      true
    );

    await click(wrapper, "admission-usage-quota");
    expect(lastPatch(patches).admission.usage).toEqual({
      mode: "quota",
      quota: 10,
    });

    await click(wrapper, "admission-per-unit-more");
    expect(lastPatch(patches).admission).toEqual(
      expect.objectContaining({
        admissionsPerUnit: 2,
        usage: { mode: "quota", quota: 10 },
        validity: expect.objectContaining({ mode: "window" }),
      })
    );
    expect(wrapper.text()).toContain("ein Sammelticket");
  });

  it("keeps a block time as typed, so a refused one shows its Meldung", async () => {
    const { wrapper, patches } = mountEditing(BookableEditAdmission, {
      bookable: ticket({ admission: newAdmissionDefinition() }),
    });
    const field = wrapper.find('input[data-test="admission-block-minutes"]');
    await field.setValue("180");
    expect(lastPatch(patches).admission.blockMinutes).toBe(180);
    await field.setValue("");
    expect(lastPatch(patches).admission.blockMinutes).toBe(0);
  });
});

describe("BookableEditAdmissionFacility (Einlass der Einrichtung)", () => {
  it("switches the entrance on, the exit scan off, and empties the stay limit", async () => {
    const { wrapper, patches, bookable, stored } = mountEditing(
      BookableEditAdmissionFacility,
      { bookable: pool({ admissionFacility: null }) }
    );
    await toggleSwitch(wrapper, "Einlasskontrolle für diese Einrichtung");
    expect(lastPatch(patches).admissionFacility).toEqual({
      enabled: true,
      resetTime: "03:00",
      exitScan: true,
      maxStayMinutes: null,
      timezone: "Europe/Berlin",
    });

    await toggleSwitch(wrapper, "Austritte werden gescannt");
    expect(lastPatch(patches).admissionFacility.exitScan).toBe(false);

    const stay = wrapper.find('input[data-test="admission-facility-max-stay"]');
    await stay.setValue("240");
    expect(lastPatch(patches).admissionFacility.maxStayMinutes).toBe(240);
    await stay.setValue("");
    expect(lastPatch(patches).admissionFacility.maxStayMinutes).toBeNull();
    expect(bookable).toEqual(stored);
  });

  it("names the facility's tariffs, its children, and leads to its Hierarchie", async () => {
    ApiBookablesService.getBookables.mockResolvedValue({
      data: [ticket(), ticket({ id: "room-1", type: "room", title: "Raum" })],
    });
    const { wrapper } = mountEditing(BookableEditAdmissionFacility, {
      bookable: pool({
        admissionFacility: { resetTime: "03:00" },
        relatedBookableIds: ["ten-card", "room-1"],
      }),
    });
    await flushPromises();
    expect(
      wrapper.find('[data-test="admission-facility-tariffs"]').text()
    ).toContain("Tarife am Einlass: 10er-Karte");
    await click(wrapper, "admission-facility-hierarchy");
    expect(wrapper.emitted("open-section")[0][0]).toEqual({
      tabKey: "relatedBookables",
      sectionId: "related-hierarchy",
    });
  });

  it("shows the capacity of the Anzahl and leads to its field", async () => {
    const { wrapper } = mountEditing(BookableEditAdmissionFacility, {
      bookable: pool({ admissionFacility: { resetTime: "03:00" } }),
    });
    expect(
      wrapper.find('[data-test="admission-facility-capacity"]').text()
    ).toContain("1500");
    await click(wrapper, "admission-facility-capacity-jump");
    expect(wrapper.emitted("open-section")[0][0]).toEqual({
      tabKey: "pricing",
      sectionId: "pricing-amount",
    });
  });
});

describe("BookableEditAdmissionPreview (Regelvorschau)", () => {
  it("reads the tariff as edited against its facility", async () => {
    ApiBookablesService.getBookables.mockResolvedValue({
      data: [pool({ admissionFacility: { resetTime: "03:00" } })],
    });
    const { wrapper } = mountEditing(BookableEditAdmissionPreview, {
      bookable: ticket({
        admission: {
          ...newAdmissionDefinition(),
          usage: { mode: "quota", quota: 10 },
          blockMinutes: 60,
        },
      }),
    });
    await flushPromises();

    const issues = wrapper.find('[data-test="admission-preview-issues"]');
    expect(issues.text()).toContain("für 10 Nutzungstage");
    const checks = wrapper.findAll('[data-test="admission-preview-checks"] li');
    expect(checks.at(0).text()).toContain("Freibad am See");
    expect(checks.wrappers.map((li) => li.text()).join(" ")).toContain(
      "60 Minuten Sperrzeit"
    );
    expect(wrapper.find('[data-test="admission-preview-sale"]').text()).toBe(
      "Beim Kauf wird gegen die Kapazität der Einrichtung geprüft; Saison- und andere Einlass-Tarife zählen dabei nicht mit."
    );
    expect(
      wrapper.find('[data-test="admission-preview-warning"]').exists()
    ).toBe(false);
  });

  it("names a check at the entrance and a contingent per day", async () => {
    ApiBookablesService.getBookables.mockResolvedValue({
      data: [pool({ amount: 1000, admissionFacility: { resetTime: "03:00" } })],
    });
    const entry = mountEditing(BookableEditAdmissionPreview, {
      bookable: ticket({
        admission: { ...newAdmissionDefinition(), capacityCheck: "entry" },
      }),
    });
    await flushPromises();
    expect(
      entry.wrapper.find('[data-test="admission-preview-sale"]').text()
    ).toBe("Beim Kauf keine Kapazitätsprüfung – geprüft wird am Einlass.");
    expect(
      entry.wrapper.find('[data-test="admission-preview-checks"]').text()
    ).toContain("Kapazität 1.000");

    const day = mountEditing(BookableEditAdmissionPreview, {
      bookable: ticket({
        title: "Tageskarte",
        amount: 600,
        isTimePeriodRelated: true,
        timePeriods: [
          { weekdays: [1], startTime: "00:00", endTime: "23:59" },
        ],
        admission: newAdmissionDefinition(),
      }),
    });
    await flushPromises();
    const sale = day.wrapper.findAll('[data-test="admission-preview-sale"] li');
    expect(sale.at(1).text()).toBe(
      "Eigenes Kontingent des Tarifs: höchstens 600 je Tag online."
    );
  });

  it("names a tariff without a facility and leads to each facility's Hierarchie", async () => {
    // The pool does not list the tariff: the tariff naming the pool among
    // its own related bookables makes it no child of the pool.
    ApiBookablesService.getBookables.mockResolvedValue({
      data: [
        pool({ admissionFacility: { resetTime: "03:00" }, relatedBookableIds: [] }),
      ],
    });
    const push = vi.fn();
    const { wrapper } = mountEditing(BookableEditAdmissionPreview, {
      bookable: ticket({
        admission: newAdmissionDefinition(),
        relatedBookableIds: ["pool"],
      }),
      mocks: { $router: { push } },
    });
    await flushPromises();
    expect(
      wrapper.find('[data-test="admission-preview-warning"]').text()
    ).toContain("Keine Einrichtung zugeordnet");
    const button = wrapper.find('[data-test="admission-preview-hierarchy"]');
    expect(button.text()).toBe("Hierarchie von „Freibad am See“ öffnen");
    await click(wrapper, "admission-preview-hierarchy");
    expect(push).toHaveBeenCalledWith({
      name: "location-edit",
      query: { id: "pool", tab: "relatedBookables", section: "related-hierarchy" },
    });
  });
});
