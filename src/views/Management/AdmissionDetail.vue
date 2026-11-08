<script>
import { mapGetters } from "vuex";
import AdminLayout from "@/layouts/Admin.vue";
import AdmissionStateChip from "@/components/Admission/AdmissionStateChip.vue";
import AdmissionCorrectionDialog from "@/components/Admission/AdmissionCorrectionDialog.vue";
import ApiAdmissionService from "@/services/api/ApiAdmissionService";
import ApiBookablesService from "@/services/api/ApiBookablesService";
import AdmissionPermissionService from "@/services/permissions/AdmissionPermissionService";
import FormatService from "@/services/FormatService";
import {
  CORRECTIONS,
  correctionApplies,
  remainingDaysPart,
  usageRows,
} from "@/utils/admissionStates";

/**
 * One admission: its state, what it allows - the definition
 * copied at its issuance -, its code for a reissue, the usage log, and the
 * corrections of the administration with their reason. The booking is
 * named by its number and linked; the admission carries no personal data.
 */
export default {
  name: "AdmissionDetail",
  components: { AdminLayout, AdmissionStateChip, AdmissionCorrectionDialog },
  data() {
    return {
      admission: null,
      facility: null,
      devicesById: {},
      loading: false,
      error: "",
      correction: null,
      corrected: "",
    };
  },
  computed: {
    ...mapGetters({ tenantId: "tenants/currentTenantId" }),
    id() {
      return this.$route.params.id;
    },
    /** As the list: `manageAdmissions.readAny` or an owner, at a tenant. */
    allowed() {
      return !!this.tenantId && AdmissionPermissionService.allowRead();
    },
    canCorrect() {
      return AdmissionPermissionService.allowCorrect();
    },
    corrections() {
      return CORRECTIONS.map((action) => ({
        action,
        applies: correctionApplies(action, this.admission),
      }));
    },
    entitlement() {
      return this.admission?.entitlement || {};
    },
    facts() {
      const e = this.entitlement;
      const t = (key, params) =>
        this.$t(`admission.detail.facts.${key}`, params);
      const remaining = remainingDaysPart(this.admission);
      return [
        {
          key: "validity",
          label: t("validity"),
          value: t("validityValue", {
            from: FormatService.date(e.validFrom),
            to: FormatService.date(e.validTo),
          }),
        },
        {
          key: "usage",
          label: t("usage"),
          value:
            this.$t(`bookable.admission.usage.${e.usage}`) +
            (e.usage === "quota" ? ` (${e.quota})` : ""),
        },
        {
          key: "remaining",
          label: t("remaining"),
          value: this.$t(remaining.key, remaining.params),
        },
        {
          key: "blockMinutes",
          label: t("blockMinutes"),
          value: e.blockMinutes
            ? t("minutes", { minutes: e.blockMinutes })
            : t("none"),
        },
        {
          key: "personalized",
          label: t("personalized"),
          value: e.personalized ? t("yes") : t("no"),
        },
        {
          key: "capacityCheck",
          label: t("capacityCheck"),
          value: this.$t(`bookable.admission.capacity.${e.capacityCheck}`),
        },
        {
          key: "entries",
          label: t("entries"),
          value: String(this.admission.entryCount || 0),
        },
        {
          key: "lastEntry",
          label: t("lastEntry"),
          value: this.admission.lastEntryAt
            ? FormatService.dateTime(this.admission.lastEntryAt)
            : "—",
        },
        {
          key: "lastExit",
          label: t("lastExit"),
          value: this.admission.lastExitAt
            ? FormatService.dateTime(this.admission.lastExitAt)
            : "—",
        },
      ];
    },
    log() {
      return usageRows(this.admission, this.devicesById);
    },
  },
  watch: {
    id: "load",
    // Another tenant: the admission is asked for there, with its devices; an
    // admission of the old tenant is not found there.
    tenantId() {
      this.facility = null;
      this.refresh();
    },
  },
  created() {
    this.refresh();
  },
  methods: {
    /** The admission and the devices of its log - nothing without the right. */
    refresh() {
      if (!this.allowed) {
        this.admission = null;
        this.devicesById = {};
        return;
      }
      this.load();
      this.loadDevices();
    },
    async load() {
      if (!this.allowed) return;
      this.loading = true;
      this.error = "";
      try {
        const { data } = await ApiAdmissionService.getAdmission(this.id);
        this.admission = data;
        this.loadFacility(data.facilityId);
      } catch (error) {
        this.admission = null;
        const status = error?.response?.status;
        this.error =
          status === 404
            ? this.$t("admission.detail.notFound")
            : status === 403
            ? this.$t("admission.page.forbidden")
            : this.$t("admission.detail.error");
      } finally {
        this.loading = false;
      }
    },
    async loadFacility(id) {
      if (!id || this.facility?.id === id) return;
      try {
        const { data } = await ApiBookablesService.getBookable(id);
        this.facility = data;
      } catch (error) {
        this.facility = null;
      }
    },
    async loadDevices() {
      try {
        const { data } = await ApiAdmissionService.getDevices();
        this.devicesById = Object.fromEntries(
          (data || []).map((device) => [device.id, device])
        );
      } catch (error) {
        this.devicesById = {};
      }
    },
    openCorrection(action) {
      this.corrected = "";
      this.correction = action;
    },
    onCorrected(admission) {
      this.corrected = this.$t(
        `admission.correction.actions.${this.correction}.done`
      );
      this.admission = admission;
      this.correction = null;
    },
    dateTime(at) {
      return FormatService.dateTime(at);
    },
    eventLabel(row) {
      return this.$t(`admission.usage.events.${row.type}`);
    },
    actorLabel(row) {
      return this.$t(`admission.usage.actors.${row.actor.kind}`, {
        label: row.actor.label,
      });
    },
    /** A reason the system wrote by its code, one of staff as typed. */
    reasonLabel(row) {
      if (!row.reason) return "—";
      const key = `admission.usage.reasons.${row.reason}`;
      return this.$te(key) ? this.$t(key) : row.reason;
    },
    stateChange(row) {
      if (!row.fromState || row.fromState === row.toState) {
        return row.toState ? this.$t(`admission.states.${row.toState}`) : "—";
      }
      return `${this.$t(`admission.states.${row.fromState}`)} → ${this.$t(
        `admission.states.${row.toState}`
      )}`;
    },
  },
};
</script>

<template>
  <AdminLayout :title="$t('admission.detail.title')">
    <div class="admission-detail" data-test="admission-detail">
      <v-btn
        text
        small
        color="primary"
        class="admission-detail__back"
        :to="{ name: 'admissions' }"
      >
        <v-icon small left>mdi-arrow-left</v-icon>
        {{ $t("admission.detail.back") }}
      </v-btn>
      <v-progress-linear :active="loading" indeterminate color="primary" />
      <v-alert
        v-if="!allowed"
        type="info"
        text
        data-test="admission-detail-forbidden"
      >
        {{
          tenantId
            ? $t("admission.page.forbidden")
            : $t("admission.page.noTenant")
        }}
      </v-alert>
      <v-alert
        v-else-if="error"
        type="warning"
        text
        data-test="admission-detail-error"
      >
        {{ error }}
      </v-alert>

      <template v-if="admission">
        <header class="admission-detail__head">
          <div>
            <h2 class="admission-detail__title">
              {{ admission.bookableTitle }}
            </h2>
            <div class="admission-detail__meta">
              <span>
                {{
                  $t(`admission.kinds.${admission.kind}`, {
                    member: admission.memberIndex,
                  })
                }}
              </span>
              <span v-if="facility">· {{ facility.title }}</span>
              <span>
                ·
                {{ $t("admission.detail.booking") }}
                <router-link
                  :to="{
                    name: 'booking-details',
                    params: { bookingId: admission.bookingId },
                  }"
                  class="admission-detail__mono"
                  >{{ admission.bookingId }}</router-link
                >
              </span>
            </div>
          </div>
          <AdmissionStateChip
            :state="admission.state"
            class="admission-detail__state"
          />
        </header>

        <v-alert
          v-if="corrected"
          type="success"
          text
          dense
          role="status"
          data-test="admission-corrected"
        >
          {{ corrected }}
        </v-alert>

        <div class="admission-detail__grid">
          <section class="admission-detail__card">
            <h3 class="admission-detail__heading">
              <v-icon small>mdi-card-account-details-outline</v-icon>
              {{ $t("admission.detail.entitlement") }}
            </h3>
            <dl class="admission-detail__facts">
              <template v-for="fact in facts">
                <dt :key="`${fact.key}-label`">{{ fact.label }}</dt>
                <dd
                  :key="`${fact.key}-value`"
                  :data-test="`admission-fact-${fact.key}`"
                >
                  {{ fact.value }}
                </dd>
              </template>
            </dl>
            <div v-if="admission.code" class="admission-detail__code">
              <span class="admission-detail__code-label">
                {{ $t("admission.detail.code") }}
              </span>
              <span class="admission-detail__mono" data-test="admission-code">
                {{ admission.code }}
              </span>
            </div>
          </section>

          <section
            class="admission-detail__card"
            data-test="admission-corrections"
          >
            <h3 class="admission-detail__heading">
              <v-icon small>mdi-wrench-outline</v-icon>
              {{ $t("admission.detail.corrections") }}
            </h3>
            <p class="admission-detail__hint">
              {{
                canCorrect
                  ? $t("admission.detail.correctionsHint")
                  : $t("admission.detail.correctionsReadOnly")
              }}
            </p>
            <div class="admission-detail__actions">
              <v-btn
                v-for="entry in corrections"
                :key="entry.action"
                outlined
                small
                :color="entry.action === 'block' ? 'error' : 'primary'"
                :disabled="!canCorrect || !entry.applies"
                :data-test="`admission-correct-${entry.action}`"
                @click="openCorrection(entry.action)"
              >
                {{ $t(`admission.correction.actions.${entry.action}.title`) }}
              </v-btn>
            </div>
          </section>
        </div>

        <section
          class="admission-detail__card admission-detail__log"
          data-test="admission-log"
        >
          <h3 class="admission-detail__heading">
            <v-icon small>mdi-history</v-icon>
            {{ $t("admission.detail.log") }}
          </h3>
          <div
            role="table"
            class="admission-log"
            :aria-label="$t('admission.detail.log')"
          >
            <div role="row" class="admission-log__row admission-log__head">
              <div role="columnheader">
                {{ $t("admission.usage.columns.at") }}
              </div>
              <div role="columnheader">
                {{ $t("admission.usage.columns.event") }}
              </div>
              <div role="columnheader">
                {{ $t("admission.usage.columns.state") }}
              </div>
              <div role="columnheader">
                {{ $t("admission.usage.columns.actor") }}
              </div>
              <div role="columnheader">
                {{ $t("admission.usage.columns.reason") }}
              </div>
            </div>
            <div
              v-for="row in log"
              :key="row.key"
              role="row"
              class="admission-log__row"
              :class="{ 'admission-log__row--reverted': row.reverted }"
              data-test="admission-log-row"
            >
              <div role="cell">{{ dateTime(row.at) }}</div>
              <div role="cell">
                {{ eventLabel(row) }}
                <span v-if="row.dayConsumed" class="admission-log__tag">
                  {{ $t("admission.usage.dayConsumed") }}
                </span>
                <span v-if="row.reverted" class="admission-log__tag">
                  {{ $t("admission.usage.reverted") }}
                </span>
              </div>
              <div role="cell">{{ stateChange(row) }}</div>
              <div role="cell">{{ actorLabel(row) }}</div>
              <div role="cell">{{ reasonLabel(row) }}</div>
            </div>
          </div>
        </section>
      </template>

      <AdmissionCorrectionDialog
        :open="!!correction"
        :admission="admission"
        :action="correction"
        @corrected="onCorrected"
        @stale="load"
        @close="correction = null"
      />
    </div>
  </AdminLayout>
</template>

<style scoped>
.admission-detail__back {
  margin-bottom: var(--scb-space-3);
}

.admission-detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--scb-space-3);
  margin-bottom: var(--scb-space-4);
}

.admission-detail__title {
  margin: 0;
  font-size: var(--scb-font-size-header);
  font-weight: var(--scb-font-weight-semibold);
  color: var(--scb-text);
}

.admission-detail__meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--scb-space-1);
  font-size: var(--scb-font-size-sm);
  color: var(--scb-text-muted);
}

.admission-detail__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: var(--scb-space-4);
}

.admission-detail__card {
  padding: var(--scb-space-4);
  background: var(--scb-surface);
  border: 1px solid var(--scb-surface-border);
  border-radius: var(--scb-radius-surface);
}

.admission-detail__log {
  margin-top: var(--scb-space-4);
}

.admission-detail__heading {
  display: flex;
  align-items: center;
  gap: var(--scb-space-2);
  margin: 0 0 var(--scb-space-3);
  font-size: var(--scb-font-size-md);
  font-weight: var(--scb-font-weight-semibold);
  color: var(--scb-text);
}

.admission-detail__facts {
  display: grid;
  grid-template-columns: minmax(140px, auto) 1fr;
  gap: var(--scb-space-1) var(--scb-space-4);
  margin: 0;
  font-size: var(--scb-font-size-sm);
}

.admission-detail__facts dt {
  color: var(--scb-text-muted);
}

.admission-detail__facts dd {
  margin: 0;
  color: var(--scb-text);
}

.admission-detail__code {
  margin-top: var(--scb-space-4);
  padding-top: var(--scb-space-3);
  border-top: 1px solid var(--scb-rule);
  font-size: var(--scb-font-size-sm);
}

.admission-detail__code-label {
  display: block;
  color: var(--scb-text-muted);
}

.admission-detail__mono {
  font-family: "Roboto Mono", ui-monospace, monospace;
}

.admission-detail__hint {
  margin: 0 0 var(--scb-space-3);
  font-size: var(--scb-font-size-sm);
  color: var(--scb-text-muted);
}

.admission-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--scb-space-2);
}

.admission-log {
  font-size: var(--scb-font-size-sm);
}

.admission-log__row {
  display: grid;
  grid-template-columns:
    minmax(110px, 0.9fr) minmax(150px, 1.2fr) minmax(150px, 1.2fr)
    minmax(120px, 1fr) minmax(140px, 1.4fr);
  gap: var(--scb-space-3);
  padding: var(--scb-space-2) 0;
  border-top: 1px solid var(--scb-rule);
  color: var(--scb-text);
}

.admission-log__head {
  border-top: 0;
  font-size: var(--scb-font-size-xs);
  color: var(--scb-text-muted);
}

.admission-log__row--reverted > div:nth-child(2) {
  text-decoration: line-through;
}

.admission-log__tag {
  display: inline-block;
  margin-left: var(--scb-space-1);
  padding: 0 var(--scb-space-1);
  font-size: var(--scb-font-size-xs);
  color: var(--scb-text-muted);
  border: 1px solid var(--scb-surface-border);
  border-radius: var(--scb-radius-badge);
  text-decoration: none;
}

@media (max-width: 959px) {
  .admission-log__head {
    display: none;
  }

  .admission-log__row {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
