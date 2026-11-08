<template>
  <div class="admission-list" data-test="admission-list">
    <div v-if="facilities.length" class="admission-list__counters">
      <AdmissionCheckedInCounter
        v-for="facility in counterFacilities"
        :key="facility.id"
        :facility="facility"
      />
    </div>

    <SearchBar
      v-model="query"
      :fields="$t('admission.list.searchFields')"
      :filters="filterSections"
      data-test="admission-search"
      @filter="onFilter"
    />

    <AppList
      class="mt-4"
      :columns="columns"
      :items="rows"
      :loading="loading"
      :error-message="errorMessage"
      :empty-text="emptyText"
      :lead="lead"
      @retry="load"
    >
      <template #cell.tariff="{ item }">
        <router-link
          :to="{ name: 'admission-detail', params: { id: item.id } }"
          class="admission-list__title"
          data-test="admission-row-link"
        >
          {{ item.bookableTitle || item.bookableId }}
        </router-link>
        <div class="admission-list__sub">
          {{ $t(`admission.kinds.${item.kind}`, { member: item.memberIndex }) }}
        </div>
      </template>
      <template #cell.facility="{ item }">
        {{ facilityTitle(item.facilityId) }}
      </template>
      <template #cell.booking="{ item }">
        <span class="admission-list__mono">{{ item.bookingId }}</span>
      </template>
      <template #cell.state="{ item }">
        <AdmissionStateChip :state="item.state" />
      </template>
      <template #cell.usage="{ item }">
        {{ remaining(item) }}
      </template>
      <template #cell.lastEntry="{ item }">
        {{ item.lastEntryAt ? dateTime(item.lastEntryAt) : "—" }}
      </template>
      <template #cell.open="{ item }">
        <v-btn
          small
          text
          color="primary"
          :to="{ name: 'admission-detail', params: { id: item.id } }"
          :aria-label="
            $t('admission.list.openFor', { title: item.bookableTitle })
          "
        >
          {{ $t("admission.list.open") }}
          <v-icon small right>mdi-chevron-right</v-icon>
        </v-btn>
      </template>
    </AppList>
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import AppList from "@/components/commons/AppList.vue";
import SearchBar from "@/components/commons/SearchBar.vue";
import AdmissionStateChip from "@/components/Admission/AdmissionStateChip.vue";
import AdmissionCheckedInCounter from "@/components/Admission/AdmissionCheckedInCounter.vue";
import ApiAdmissionService from "@/services/api/ApiAdmissionService";
import { getApiErrorMessage } from "@/services/api/apiErrorMessage";
import FormatService from "@/services/FormatService";
import {
  ADMISSION_STATES,
  admissionSearchOf,
  remainingDaysPart,
  stateLook,
} from "@/utils/admissionStates";

/** The most admissions one load lists; the backend's default page. */
const LIST_LIMIT = 200;

/**
 * The admissions of the tenant: narrowed by facility, tariff and
 * state behind the funnel, searched by code or booking number. The search
 * asks the backend - a code by the identifier it carries, a booking by its
 * number - so it finds what the list does not show. Above, the count of
 * checked-in admissions per facility with its note.
 */
export default {
  name: "AdmissionList",
  components: {
    AppList,
    SearchBar,
    AdmissionStateChip,
    AdmissionCheckedInCounter,
  },
  props: {
    facilities: { type: Array, default: () => [] },
    tariffs: { type: Array, default: () => [] },
    /** Whether the counters show: they need the check right. */
    showCounters: { type: Boolean, default: true },
  },
  data() {
    return {
      query: "",
      filters: { facilityId: null, bookableId: null, state: null },
      admissions: [],
      loading: false,
      errorMessage: "",
    };
  },
  computed: {
    ...mapGetters({ tenantId: "tenants/currentTenantId" }),
    counterFacilities() {
      if (!this.showCounters) return [];
      return this.filters.facilityId
        ? this.facilities.filter((f) => f.id === this.filters.facilityId)
        : this.facilities;
    },
    columns() {
      const label = (key) => this.$t(`admission.list.columns.${key}`);
      return [
        {
          key: "tariff",
          label: label("tariff"),
          width: "minmax(0, 1.5fr)",
        },
        {
          key: "facility",
          label: label("facility"),
          width: "minmax(0, 1.1fr)",
        },
        {
          key: "booking",
          label: label("booking"),
          width: "minmax(0, 0.9fr)",
        },
        { key: "state", label: label("state"), width: "minmax(0, 1.1fr)" },
        { key: "usage", label: label("usage"), width: "minmax(0, 1.2fr)" },
        {
          key: "lastEntry",
          label: label("lastEntry"),
          width: "minmax(0, 1fr)",
        },
        { key: "open", label: "", width: "auto", align: "end" },
      ];
    },
    rows() {
      return this.admissions;
    },
    filterSections() {
      const single = (key, options) => ({
        key,
        label: this.$t(`admission.list.filters.${key}`),
        options,
        selected: this.filters[key],
        multiple: false,
        empty: null,
      });
      return [
        single(
          "facilityId",
          this.facilities.map((f) => ({ value: f.id, label: f.title }))
        ),
        single(
          "bookableId",
          this.tariffs.map((t) => ({ value: t.id, label: t.title }))
        ),
        single(
          "state",
          ADMISSION_STATES.map((state) => ({
            value: state,
            label: this.$t(`admission.states.${state}`),
            icon: stateLook(state).icon,
          }))
        ),
      ];
    },
    search() {
      return admissionSearchOf(this.query);
    },
    emptyText() {
      return this.search || Object.values(this.filters).some(Boolean)
        ? this.$t("admission.list.emptyFiltered")
        : this.$t("admission.list.empty");
    },
    lead() {
      if (!this.admissions.length) return "";
      return this.admissions.length >= LIST_LIMIT
        ? this.$t("admission.list.leadLimited", { count: LIST_LIMIT })
        : this.$tc("admission.list.lead", this.admissions.length);
    },
  },
  watch: {
    query() {
      this.load();
    },
    // Another tenant: its own admissions, and the filters name the old
    // tenant's facilities and tariffs.
    tenantId() {
      this.filters = { facilityId: null, bookableId: null, state: null };
      this.load();
    },
  },
  created() {
    // Not reactive: which load answers last decides nothing on screen.
    this.loadTicket = 0;
    this.load();
  },
  methods: {
    onFilter(key, selection) {
      this.filters = { ...this.filters, [key]: selection };
      this.load();
    },
    /**
     * Loads with the search and filters as they are now. Typing, a filter
     * and a switch of the tenant may start a load while one runs; only the
     * answer of the latest is shown, whichever arrives last.
     */
    async load() {
      const ticket = ++this.loadTicket;
      this.loading = true;
      this.errorMessage = "";
      try {
        const { data } = await ApiAdmissionService.getAdmissions({
          ...this.filters,
          ...(this.search || {}),
          limit: LIST_LIMIT,
        });
        if (ticket !== this.loadTicket) return;
        this.admissions = data || [];
      } catch (error) {
        if (ticket !== this.loadTicket) return;
        this.admissions = [];
        this.errorMessage = getApiErrorMessage(
          error,
          this.$t("admission.list.error")
        );
      } finally {
        if (ticket === this.loadTicket) this.loading = false;
      }
    },
    facilityTitle(id) {
      return this.facilities.find((f) => f.id === id)?.title || "—";
    },
    remaining(admission) {
      const { key, params } = remainingDaysPart(admission);
      return this.$t(key, params);
    },
    dateTime(at) {
      return FormatService.dateTime(at);
    },
  },
};
</script>

<style scoped>
.admission-list__counters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--scb-space-4);
  margin-bottom: var(--scb-space-5);
}

.admission-list__title {
  font-weight: var(--scb-font-weight-semibold);
  color: var(--scb-text-link);
  text-decoration: none;
}

.admission-list__title:hover,
.admission-list__title:focus-visible {
  text-decoration: underline;
}

.admission-list__sub {
  font-size: var(--scb-font-size-xs);
  color: var(--scb-text-muted);
}

.admission-list__mono {
  font-family: "Roboto Mono", ui-monospace, monospace;
  font-size: var(--scb-font-size-sm);
}
</style>
