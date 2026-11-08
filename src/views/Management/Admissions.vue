<script>
import { mapGetters } from "vuex";
import AdminLayout from "@/layouts/Admin.vue";
import AdmissionList from "@/components/Admission/AdmissionList.vue";
import AdmissionDeviceManagement from "@/components/Admission/AdmissionDeviceManagement.vue";
import ApiBookablesService from "@/services/api/ApiBookablesService";
import AdmissionPermissionService from "@/services/permissions/AdmissionPermissionService";
import { allowsAdmission } from "@/utils/admissionPermissions";
import {
  isAdmissionFacility,
  issuesAdmissions,
} from "@/utils/admissionDefinition";

const TABS = ["admissions", "devices"];

/**
 * Einlass: the admissions of the tenant with their
 * counters, and the admission devices. For `manageAdmissions.readAny` and
 * the owners; the tab is kept in the address (`?tab=`).
 */
export default {
  name: "Admissions",
  components: { AdminLayout, AdmissionList, AdmissionDeviceManagement },
  data() {
    return { bookables: [], loading: false };
  },
  computed: {
    ...mapGetters({ tenantId: "tenants/currentTenantId" }),
    allowed() {
      return !!this.tenantId && AdmissionPermissionService.allowRead();
    },
    canCheck() {
      return allowsAdmission(
        this.$store.state.user.data?.permissions,
        this.tenantId,
        "check"
      );
    },
    tabs() {
      return [
        { key: "admissions", icon: "mdi-ticket-account" },
        { key: "devices", icon: "mdi-cellphone-nfc" },
      ];
    },
    activeTab: {
      get() {
        const index = TABS.indexOf(this.$route.query.tab);
        return index >= 0 ? index : 0;
      },
      set(index) {
        const tab = TABS[index];
        if (tab === (this.$route.query.tab || TABS[0])) return;
        this.$router.replace({ query: { ...this.$route.query, tab } });
      },
    },
    facilities() {
      return this.bookables.filter(isAdmissionFacility);
    },
    tariffs() {
      return this.bookables.filter(issuesAdmissions);
    },
  },
  watch: {
    tenantId() {
      this.loadBookables();
    },
  },
  created() {
    this.loadBookables();
  },
  methods: {
    async loadBookables() {
      if (!this.allowed) return;
      this.loading = true;
      try {
        const { data } = await ApiBookablesService.getBookables();
        this.bookables = data || [];
      } catch (error) {
        // Without the bookables the lists show their ids; the API decides.
        this.bookables = [];
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <AdminLayout>
    <div class="page-content" data-test="admissions-page">
      <v-progress-linear :active="loading" indeterminate color="primary" />
      <v-alert
        v-if="!allowed"
        type="info"
        text
        data-test="admissions-forbidden"
      >
        {{
          tenantId
            ? $t("admission.page.forbidden")
            : $t("admission.page.noTenant")
        }}
      </v-alert>
      <v-row v-else>
        <v-col class="col-12 col-md-auto">
          <v-tabs
            v-model="activeTab"
            color="primary"
            show-arrows
            :vertical="$vuetify.breakpoint.mdAndUp"
          >
            <v-tab
              v-for="t in tabs"
              :key="t.key"
              class="d-flex justify-start"
              style="text-transform: none"
              :data-test="`admissions-tab-${t.key}`"
            >
              <v-icon left small>{{ t.icon }}</v-icon>
              {{ $t(`admission.page.tabs.${t.key}`) }}
            </v-tab>
          </v-tabs>
        </v-col>
        <v-col class="col-12 col-md-9">
          <AdmissionList
            v-if="activeTab === 0"
            :facilities="facilities"
            :tariffs="tariffs"
            :show-counters="canCheck"
          />
          <AdmissionDeviceManagement v-else :facilities="facilities" />
        </v-col>
      </v-row>
    </div>
  </AdminLayout>
</template>
