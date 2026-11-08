<template>
  <div
    class="bookable-admission-facility"
    data-test="admission-facility"
    data-field="admissionFacility"
  >
    <v-switch
      dense
      hide-details
      class="mt-0"
      :input-value="enabled"
      :label="$t('bookable.admission.facility.enabled')"
      data-test="admission-facility-enabled"
      @change="setEnabled(!!$event)"
    />
    <p class="bookable-admission-facility__hint">
      {{ $t("bookable.admission.facility.enabled-hint") }}
    </p>
    <div
      v-if="enabled"
      class="bookable-admission-facility__tariffs"
      data-test="admission-facility-tariffs"
    >
      <v-icon small>mdi-ticket-outline</v-icon>
      <span>
        {{
          tariffs.length
            ? $t("bookable.admission.facility.tariffs", {
                tariffs: tariffs.map((tariff) => tariff.title).join(", "),
              })
            : $t("bookable.admission.facility.tariffs-none")
        }}
      </span>
      <v-btn
        text
        small
        color="primary"
        data-test="admission-facility-hierarchy"
        @click="
          $emit('open-section', {
            tabKey: 'relatedBookables',
            sectionId: 'related-hierarchy',
          })
        "
      >
        {{ $t("bookable.admission.facility.toHierarchy") }}
      </v-btn>
    </div>

    <div v-if="enabled" class="bookable-admission-facility__grid">
      <v-text-field
        :value="settings.resetTime"
        type="time"
        outlined
        dense
        hide-details="auto"
        :label="$t('bookable.admission.facility.resetTime')"
        :hint="$t('bookable.admission.facility.resetTime-hint')"
        persistent-hint
        :rules="fieldRules.admissionResetTime"
        data-test="admission-facility-reset-time"
        @input="setSettings({ resetTime: $event })"
      />
      <v-text-field
        :value="settings.maxStayMinutes ?? ''"
        type="number"
        min="1"
        outlined
        dense
        hide-details="auto"
        :label="$t('bookable.admission.facility.maxStay')"
        :suffix="$t('bookable.admission.units.minutes')"
        :hint="$t('bookable.admission.facility.maxStay-hint')"
        persistent-hint
        :rules="fieldRules.admissionMaxStay"
        data-test="admission-facility-max-stay"
        @input="setMaxStay"
      />
      <div class="bookable-admission-facility__wide">
        <v-switch
          dense
          hide-details
          :input-value="settings.exitScan"
          :label="$t('bookable.admission.facility.exitScan')"
          data-test="admission-facility-exit-scan"
          @change="setSettings({ exitScan: !!$event })"
        />
        <p class="bookable-admission-facility__hint">
          {{
            $t(
              settings.exitScan
                ? "bookable.admission.facility.exitScan-on-hint"
                : "bookable.admission.facility.exitScan-off-hint"
            )
          }}
        </p>
      </div>
      <div
        class="bookable-admission-facility__wide bookable-admission-facility__capacity"
        data-test="admission-facility-capacity"
      >
        <v-icon small>mdi-gauge</v-icon>
        <span>
          {{
            capacity
              ? $t("bookable.admission.facility.capacity", { capacity })
              : $t("bookable.admission.facility.capacity-unlimited")
          }}
        </span>
        <v-btn
          text
          small
          color="primary"
          class="bookable-admission-facility__jump"
          data-test="admission-facility-capacity-jump"
          @click="
            $emit('open-section', {
              tabKey: 'pricing',
              sectionId: 'pricing-amount',
            })
          "
        >
          {{ $t("bookable.admission.facility.capacity-change") }}
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script>
import bookableEditing from "@/mixins/bookableEditing";
import otherBookables from "@/mixins/otherBookables";
import {
  facilitySettingsOf,
  newFacilitySettings,
} from "@/utils/admissionDefinition";

/**
 * The settings of a facility (glossary „Einrichtung“, `admissionFacility`)
 * on a bookable that is no ticket: the time of the daily reset,
 * whether exits are scanned, the stay limit. Its capacity is its Anzahl
 * (`amount`), which has its field in „Preise & Kapazität“: shown here, with
 * a jump there, so the field keeps its one component (ADR 0002). Its tariffs
 * are its children in the Hierarchie (`relatedBookableIds`), named here with
 * a jump there.
 */
export default {
  name: "BookableEditAdmissionFacility",
  mixins: [bookableEditing, otherBookables],
  computed: {
    /** The tickets this facility lists as its children, by title. */
    tariffs() {
      return (this.bookable.relatedBookableIds || [])
        .map((id) => this.bookables.find((other) => other.id === id))
        .filter((other) => other?.type === "ticket");
    },
    enabled() {
      return (
        !!this.bookable.admissionFacility &&
        this.bookable.admissionFacility.enabled !== false
      );
    },
    settings() {
      return facilitySettingsOf(this.bookable) || newFacilitySettings();
    },
    capacity() {
      const amount = Number(this.bookable.amount);
      return amount > 0 ? amount : null;
    },
  },
  methods: {
    setEnabled(enabled) {
      const current = this.bookable.admissionFacility;
      this.patch({
        admissionFacility: current
          ? { ...current, enabled }
          : enabled
          ? newFacilitySettings()
          : null,
      });
    },
    setSettings(changes) {
      this.patch({
        admissionFacility: {
          ...newFacilitySettings(),
          ...this.bookable.admissionFacility,
          ...changes,
        },
      });
    },
    /** Empty is no stay limit; what is no number stays to show its Meldung. */
    setMaxStay(value) {
      if (value === null || String(value).trim() === "") {
        this.setSettings({ maxStayMinutes: null });
        return;
      }
      const number = Number(value);
      this.setSettings({
        maxStayMinutes: Number.isNaN(number) ? value : number,
      });
    },
  },
};
</script>

<style scoped>
.bookable-admission-facility__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--scb-space-4);
  margin-top: var(--scb-space-5);
}

.bookable-admission-facility__wide {
  grid-column: 1 / -1;
}

.bookable-admission-facility__tariffs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--scb-space-2);
  margin-bottom: var(--scb-space-4);
  font-size: var(--scb-font-size-sm);
  color: var(--scb-text);
}

.bookable-admission-facility__capacity {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--scb-space-2);
  padding: var(--scb-space-3) var(--scb-space-4);
  font-size: var(--scb-font-size-sm);
  color: var(--scb-text);
  background: var(--scb-surface);
  border: 1px solid var(--scb-surface-border);
  border-radius: var(--scb-radius-surface);
}

.bookable-admission-facility__jump {
  margin-left: auto;
}

.bookable-admission-facility__hint {
  margin: var(--scb-space-2) 0 0;
  font-size: var(--scb-font-size-xs);
  line-height: var(--scb-line-height-base);
  color: var(--scb-text-muted);
}
</style>
