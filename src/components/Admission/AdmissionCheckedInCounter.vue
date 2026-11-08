<template>
  <div class="admission-counter" data-test="admission-counter">
    <div class="admission-counter__figures">
      <v-icon class="admission-counter__icon" aria-hidden="true">
        mdi-account-arrow-right-outline
      </v-icon>
      <div>
        <div class="admission-counter__facility">{{ facility.title }}</div>
        <div
          class="admission-counter__value"
          data-test="admission-counter-value"
        >
          <template v-if="error">{{
            $t("admission.counter.unavailable")
          }}</template>
          <template v-else-if="count === null">…</template>
          <template v-else>
            {{
              capacity
                ? $t("admission.counter.valueOf", {
                    count: formatted(count),
                    capacity: formatted(capacity),
                  })
                : $t("admission.counter.value", { count: formatted(count) })
            }}
          </template>
        </div>
      </div>
      <v-btn
        icon
        small
        class="admission-counter__reload"
        :aria-label="$t('admission.counter.reload')"
        :loading="loading"
        data-test="admission-counter-reload"
        @click="load"
      >
        <v-icon small>mdi-refresh</v-icon>
      </v-btn>
    </div>
    <p class="admission-counter__note" data-test="admission-counter-note">
      <v-icon small aria-hidden="true">mdi-information-outline</v-icon>
      {{ $t("admission.counter.note") }}
    </p>
  </div>
</template>

<script>
import ApiAdmissionService from "@/services/api/ApiAdmissionService";

/**
 * The number of checked-in admissions of a facility - with its note: it
 * counts admissions, not people, and is
 * no occupancy display and no basis for a safety or evacuation concept.
 */
export default {
  name: "AdmissionCheckedInCounter",
  props: {
    facility: { type: Object, required: true },
  },
  data() {
    return { count: null, capacity: null, loading: false, error: false };
  },
  watch: {
    "facility.id": "load",
  },
  created() {
    this.load();
  },
  methods: {
    /** A figure as the language writes it: „1.000“ in German. */
    formatted(value) {
      return new Intl.NumberFormat(this.$i18n?.locale || "de").format(value);
    },
    async load() {
      this.loading = true;
      this.error = false;
      try {
        const { data } = await ApiAdmissionService.getCheckedIn(
          this.facility.id
        );
        this.count = data.checkedIn;
        this.capacity = data.capacity || null;
      } catch (error) {
        this.error = true;
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<style scoped>
.admission-counter {
  padding: var(--scb-space-4);
  background: var(--scb-surface);
  border: 1px solid var(--scb-surface-border);
  border-radius: var(--scb-radius-surface);
}

.admission-counter__figures {
  display: flex;
  align-items: center;
  gap: var(--scb-space-3);
}

.admission-counter__icon {
  font-size: 32px;
}

.admission-counter__facility {
  font-size: var(--scb-font-size-sm);
  color: var(--scb-text-muted);
}

.admission-counter__value {
  font-size: var(--scb-font-size-lead);
  font-weight: var(--scb-font-weight-semibold);
  color: var(--scb-text);
}

.admission-counter__reload {
  margin-left: auto;
}

.admission-counter__note {
  display: flex;
  gap: var(--scb-space-2);
  margin: var(--scb-space-3) 0 0;
  font-size: var(--scb-font-size-xs);
  line-height: var(--scb-line-height-base);
  color: var(--scb-text-muted);
}
</style>
