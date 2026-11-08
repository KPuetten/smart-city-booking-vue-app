<template>
  <div class="bookable-admission" data-test="admission" data-field="admission">
    <v-switch
      dense
      hide-details
      class="mt-0"
      :input-value="enabled"
      :label="$t('bookable.admission.definition.enabled')"
      data-test="admission-enabled"
      @change="setEnabled(!!$event)"
    />
    <p class="bookable-admission__hint">
      {{ $t("bookable.admission.definition.enabled-hint") }}
    </p>

    <template v-if="enabled">
      <div class="bookable-admission__box" data-field="admission.validity">
        <div class="bookable-admission__question">
          <v-icon small>mdi-calendar-range</v-icon>
          {{ $t("bookable.admission.validity.title") }}
        </div>
        <FlowSegmented
          :value="definition.validity.mode"
          :options="modeOptions('validity', validityModes)"
          :label="$t('bookable.admission.validity.title')"
          test-id="admission-validity"
          @input="setValidity({ mode: $event })"
        />
        <div
          v-if="definition.validity.mode === 'window'"
          class="bookable-admission__row"
        >
          <v-text-field
            :value="definition.validity.from"
            type="date"
            outlined
            dense
            hide-details="auto"
            :label="$t('bookable.admission.validity.from')"
            :rules="fieldRules.admissionDate"
            data-test="admission-validity-from"
            @input="setValidity({ from: $event || null })"
          />
          <v-text-field
            :value="definition.validity.to"
            type="date"
            outlined
            dense
            hide-details="auto"
            :label="$t('bookable.admission.validity.to')"
            :rules="[...fieldRules.admissionDate, windowOrder]"
            data-test="admission-validity-to"
            @input="setValidity({ to: $event || null })"
          />
        </div>
        <FlowCounter
          v-else-if="definition.validity.mode === 'duration'"
          class="bookable-admission__counter"
          :value="definition.validity.days ?? ''"
          :label="$t('bookable.admission.validity.days')"
          :unit="$tc('bookable.admission.units.days', definition.validity.days)"
          :rules="fieldRules.admissionDays"
          test-id="admission-validity-days"
          @input="setValidity({ days: wholeOrTyped($event) })"
        />
        <p class="bookable-admission__hint">
          {{
            $t(`bookable.admission.validity.${definition.validity.mode}-hint`)
          }}
        </p>
      </div>

      <div class="bookable-admission__box" data-field="admission.usage">
        <div class="bookable-admission__question">
          <v-icon small>mdi-counter</v-icon>
          {{ $t("bookable.admission.usage.title") }}
        </div>
        <FlowSegmented
          :value="definition.usage.mode"
          :options="modeOptions('usage', usageModes)"
          :label="$t('bookable.admission.usage.title')"
          test-id="admission-usage"
          @input="setUsage($event)"
        />
        <FlowCounter
          v-if="definition.usage.mode === 'quota'"
          class="bookable-admission__counter"
          :value="definition.usage.quota ?? ''"
          :label="$t('bookable.admission.usage.quota')"
          :unit="
            $tc('bookable.admission.units.usageDays', definition.usage.quota)
          "
          :rules="fieldRules.admissionQuota"
          test-id="admission-usage-quota"
          @input="
            setDefinition({
              usage: { mode: 'quota', quota: wholeOrTyped($event) },
            })
          "
        />
        <p class="bookable-admission__hint">
          {{ $t(`bookable.admission.usage.${definition.usage.mode}-hint`) }}
        </p>
      </div>

      <div class="bookable-admission__box" data-field="admission.blockMinutes">
        <div class="bookable-admission__question">
          <v-icon small>mdi-timer-sand</v-icon>
          {{ $t("bookable.admission.blockMinutes.title") }}
        </div>
        <v-text-field
          :value="definition.blockMinutes"
          type="number"
          min="0"
          :max="maxBlockMinutes"
          step="5"
          outlined
          dense
          hide-details="auto"
          class="bookable-admission__narrow"
          :label="$t('bookable.admission.blockMinutes.label')"
          :suffix="$t('bookable.admission.units.minutes')"
          :rules="fieldRules.admissionBlockMinutes"
          data-test="admission-block-minutes"
          @input="setDefinition({ blockMinutes: wholeOrTyped($event, 0) })"
        />
        <p class="bookable-admission__hint">
          {{ $t("bookable.admission.blockMinutes.hint") }}
        </p>
      </div>

      <div class="bookable-admission__box" data-field="admission.persons">
        <div class="bookable-admission__question">
          <v-icon small>mdi-account-group-outline</v-icon>
          {{ $t("bookable.admission.persons.title") }}
        </div>
        <FlowCounter
          :value="definition.admissionsPerUnit"
          :label="$t('bookable.admission.persons.perUnit')"
          :unit="
            $tc(
              'bookable.admission.units.persons',
              definition.admissionsPerUnit
            )
          "
          :rules="fieldRules.admissionPerUnit"
          test-id="admission-per-unit"
          @input="setDefinition({ admissionsPerUnit: wholeOrTyped($event, 1) })"
        />
        <p class="bookable-admission__hint">
          {{
            $t(
              definition.admissionsPerUnit > 1
                ? "bookable.admission.persons.bundle-hint"
                : "bookable.admission.persons.single-hint"
            )
          }}
        </p>
        <v-switch
          dense
          hide-details
          :input-value="definition.personalized"
          :label="$t('bookable.admission.persons.personalized')"
          data-test="admission-personalized"
          @change="setDefinition({ personalized: !!$event })"
        />
        <p class="bookable-admission__hint">
          {{ $t("bookable.admission.persons.personalized-hint") }}
        </p>
      </div>

      <div class="bookable-admission__box" data-field="admission.capacityCheck">
        <div class="bookable-admission__question">
          <v-icon small>mdi-gauge</v-icon>
          {{ $t("bookable.admission.capacity.title") }}
        </div>
        <FlowSegmented
          :value="definition.capacityCheck"
          :options="modeOptions('capacity', capacityChecks)"
          :label="$t('bookable.admission.capacity.title')"
          test-id="admission-capacity"
          @input="setDefinition({ capacityCheck: $event })"
        />
        <p class="bookable-admission__hint">
          {{
            $t(`bookable.admission.capacity.${definition.capacityCheck}-hint`)
          }}
        </p>
      </div>
    </template>
  </div>
</template>

<script>
import FlowCounter from "@/components/Bookable/Flow/FlowCounter.vue";
import FlowSegmented from "@/components/Bookable/Flow/FlowSegmented.vue";
import bookableEditing from "@/mixins/bookableEditing";
import {
  CAPACITY_CHECKS,
  MAX_BLOCK_MINUTES,
  USAGE_MODES,
  VALIDITY_MODES,
  admissionDefinitionOf,
  newAdmissionDefinition,
} from "@/utils/admissionDefinition";

/**
 * The Berechtigungsdefinition of a tariff (`admission`): whether
 * a ticket issues admissions, how long they are valid, how often they admit,
 * the block time, the persons per booked unit and the personal binding, and
 * when the capacity is checked. Shown on a ticket only; what it issues and
 * what the entrance checks reads beside it in the rule preview
 * (`BookableEditAdmissionPreview`).
 *
 * Every change rebuilds `admission` from what the bookable holds, so a
 * switched-off definition keeps its values. The values shown are the
 * backend's reading with its defaults (`admissionDefinitionOf`).
 */
export default {
  name: "BookableEditAdmission",
  components: { FlowCounter, FlowSegmented },
  mixins: [bookableEditing],
  data() {
    return {
      validityModes: VALIDITY_MODES,
      usageModes: USAGE_MODES,
      capacityChecks: CAPACITY_CHECKS,
      maxBlockMinutes: MAX_BLOCK_MINUTES,
    };
  },
  computed: {
    enabled() {
      return (
        !!this.bookable.admission && this.bookable.admission.enabled !== false
      );
    },
    definition() {
      return admissionDefinitionOf(this.bookable) || newAdmissionDefinition();
    },
  },
  methods: {
    modeOptions(group, values) {
      return values.map((value) => ({
        value,
        label: this.$t(`bookable.admission.${group}.${value}`),
      }));
    },
    /** A whole number as typed; empty is `null`, what is no number stays. */
    wholeOrTyped(value, empty = null) {
      if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
      ) {
        return empty;
      }
      const number = Number(value);
      return Number.isNaN(number) ? value : number;
    },
    windowOrder(value) {
      const { from } = this.definition.validity;
      return (
        !value ||
        !from ||
        from <= value ||
        this.$t("bookable.validation.admissionWindowOrder")
      );
    },
    setEnabled(enabled) {
      const current = this.bookable.admission;
      this.patch({
        admission: current
          ? { ...current, enabled }
          : enabled
          ? newAdmissionDefinition()
          : null,
      });
    },
    setDefinition(changes) {
      this.patch({
        admission: {
          ...newAdmissionDefinition(),
          ...this.bookable.admission,
          ...changes,
        },
      });
    },
    setValidity(changes) {
      this.setDefinition({
        validity: { ...this.definition.validity, ...changes },
      });
    },
    setUsage(mode) {
      const quota =
        mode === "quota" ? this.bookable.admission?.usage?.quota ?? 10 : null;
      this.setDefinition({ usage: { mode, quota } });
    },
  },
};
</script>

<style scoped>
.bookable-admission__box {
  margin-top: var(--scb-space-5);
  padding: var(--scb-space-4);
  background: var(--scb-surface);
  border: 1px solid var(--scb-surface-border);
  border-radius: var(--scb-radius-surface);
}

.bookable-admission__question {
  display: flex;
  align-items: center;
  gap: var(--scb-space-2);
  margin-bottom: var(--scb-space-3);
  font-size: var(--scb-font-size-md);
  font-weight: var(--scb-font-weight-semibold);
  line-height: var(--scb-line-height-base);
  color: var(--scb-text);
}

.bookable-admission__row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--scb-space-3);
  margin-top: var(--scb-space-4);
}

.bookable-admission__counter {
  margin-top: var(--scb-space-4);
}

.bookable-admission__narrow {
  max-width: 260px;
}

.bookable-admission__hint {
  margin: var(--scb-space-3) 0 0;
  font-size: var(--scb-font-size-xs);
  line-height: var(--scb-line-height-base);
  color: var(--scb-text-muted);
}
</style>
