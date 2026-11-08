<template>
  <div class="admission-devices" data-test="admission-devices">
    <div class="admission-devices__head">
      <p class="admission-devices__lead">{{ $t("admission.devices.lead") }}</p>
      <v-btn
        v-if="canManage"
        color="primary"
        depressed
        :disabled="!facilities.length"
        data-test="admission-device-create"
        @click="openCreate"
      >
        <v-icon left>mdi-plus</v-icon>
        {{ $t("admission.devices.create") }}
      </v-btn>
    </div>
    <v-alert
      v-if="canManage && !facilities.length"
      type="info"
      text
      dense
      data-test="admission-devices-no-facility"
    >
      {{ $t("admission.devices.noFacility") }}
    </v-alert>

    <AppList
      :columns="columns"
      :items="devices"
      :loading="loading"
      :error-message="errorMessage"
      :empty-text="$t('admission.devices.empty')"
      @retry="load"
    >
      <template #cell.label="{ item }">
        <div class="admission-devices__label">{{ item.label }}</div>
        <div class="admission-devices__sub">
          {{ facilityTitle(item.facilityId) }}
        </div>
      </template>
      <template #cell.status="{ item }">
        <span class="admission-devices__status" :data-status="item.status">
          <v-icon
            small
            :color="item.status === 'blocked' ? 'error' : 'success'"
            aria-hidden="true"
          >
            {{
              item.status === "blocked"
                ? "mdi-cancel"
                : "mdi-check-circle-outline"
            }}
          </v-icon>
          {{ $t(`admission.devices.status.${item.status}`) }}
        </span>
        <div v-if="item.blockReason" class="admission-devices__sub">
          {{ item.blockReason }}
        </div>
      </template>
      <template #cell.token="{ item }">
        <span class="admission-devices__mono">
          {{ item.tokenHint ? `…${item.tokenHint}` : "—" }}
        </span>
        <div v-if="item.tokenRenewedAt" class="admission-devices__sub">
          {{
            $t("admission.devices.renewedAt", {
              at: dateTime(item.tokenRenewedAt),
            })
          }}
        </div>
      </template>
      <template #cell.lastSeen="{ item }">
        {{
          item.lastSeenAt
            ? dateTime(item.lastSeenAt)
            : $t("admission.devices.never")
        }}
      </template>
      <template #cell.actions="{ item }">
        <div v-if="canManage" class="admission-devices__actions">
          <v-btn
            small
            text
            color="primary"
            :data-test="`admission-device-renew-${item.id}`"
            @click="askRenew(item)"
          >
            <v-icon small left>mdi-key-change</v-icon>
            {{ $t("admission.devices.renew") }}
          </v-btn>
          <v-btn
            v-if="item.status !== 'blocked'"
            small
            text
            color="error"
            :data-test="`admission-device-block-${item.id}`"
            @click="askBlock(item)"
          >
            <v-icon small left>mdi-cancel</v-icon>
            {{ $t("admission.devices.block") }}
          </v-btn>
          <v-btn
            v-else
            small
            text
            :loading="busyId === item.id"
            :data-test="`admission-device-unblock-${item.id}`"
            @click="unblock(item)"
          >
            <v-icon small left>mdi-lock-open-variant-outline</v-icon>
            {{ $t("admission.devices.unblock") }}
          </v-btn>
        </div>
      </template>
    </AppList>

    <!-- Register a device -->
    <v-dialog v-model="createOpen" max-width="520" persistent>
      <v-card data-test="admission-device-create-dialog">
        <v-card-title class="py-4 px-6 text-h6">
          {{ $t("admission.devices.createTitle") }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-6">
          <v-form ref="createForm" @submit.prevent="create">
            <v-text-field
              v-model="draft.label"
              outlined
              dense
              autofocus
              :label="$t('admission.devices.fields.label')"
              :hint="$t('admission.devices.fields.labelHint')"
              persistent-hint
              :rules="[required]"
              class="mb-4"
              data-test="admission-device-label"
            />
            <v-select
              v-model="draft.facilityId"
              outlined
              dense
              :items="facilities"
              item-text="title"
              item-value="id"
              :label="$t('admission.devices.fields.facility')"
              :rules="[required]"
              data-test="admission-device-facility"
            />
          </v-form>
          <v-alert
            v-if="dialogError"
            type="error"
            text
            dense
            class="mb-0"
            role="alert"
          >
            {{ dialogError }}
          </v-alert>
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-6 py-4">
          <v-spacer />
          <v-btn text :disabled="saving" @click="createOpen = false">
            {{ $t("admission.correction.cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            depressed
            :loading="saving"
            data-test="admission-device-create-submit"
            @click="create"
          >
            {{ $t("admission.devices.createSubmit") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Renew or block: a question first -->
    <v-dialog v-model="confirmOpen" max-width="520" persistent>
      <v-card v-if="confirming" data-test="admission-device-confirm">
        <v-card-title class="py-4 px-6 text-h6">
          {{
            $t(`admission.devices.${confirming.action}Title`, {
              label: confirming.device.label,
            })
          }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-6">
          <p>{{ $t(`admission.devices.${confirming.action}Question`) }}</p>
          <v-form
            v-if="confirming.action === 'block'"
            ref="blockForm"
            @submit.prevent="confirm"
          >
            <v-text-field
              v-model="blockReason"
              outlined
              dense
              autofocus
              :label="$t('admission.devices.fields.blockReason')"
              :rules="[required]"
              data-test="admission-device-block-reason"
            />
          </v-form>
          <v-alert
            v-if="dialogError"
            type="error"
            text
            dense
            class="mb-0"
            role="alert"
          >
            {{ dialogError }}
          </v-alert>
        </v-card-text>
        <v-divider />
        <v-card-actions class="px-6 py-4">
          <v-spacer />
          <v-btn text :disabled="saving" @click="confirmOpen = false">
            {{ $t("admission.correction.cancel") }}
          </v-btn>
          <v-btn
            :color="confirming.action === 'block' ? 'error' : 'primary'"
            depressed
            :loading="saving"
            data-test="admission-device-confirm-submit"
            @click="confirm"
          >
            {{ $t(`admission.devices.${confirming.action}`) }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <AdmissionDeviceTokenDialog
      :open="!!issued"
      :device="issued && issued.device"
      :token="issued ? issued.token : ''"
      @close="issued = null"
    />
  </div>
</template>

<script>
import { mapGetters } from "vuex";
import AppList from "@/components/commons/AppList.vue";
import AdmissionDeviceTokenDialog from "@/components/Admission/AdmissionDeviceTokenDialog.vue";
import ApiAdmissionService from "@/services/api/ApiAdmissionService";
import AdmissionPermissionService from "@/services/permissions/AdmissionPermissionService";
import FormatService from "@/services/FormatService";

/**
 * The admission devices of the tenant (glossary „Einlassgerät“):
 * a scanner or a browser at the entrance of one facility, with a token of
 * its own. Reading is `manageAdmissions.readAny`; registering, renewing and
 * blocking are the tenant owner's. A token is shown once, in
 * `AdmissionDeviceTokenDialog`, and never kept by the page.
 */
export default {
  name: "AdmissionDeviceManagement",
  components: { AppList, AdmissionDeviceTokenDialog },
  props: {
    facilities: { type: Array, default: () => [] },
  },
  data() {
    return {
      devices: [],
      loading: false,
      errorMessage: "",
      createOpen: false,
      draft: { label: "", facilityId: null },
      confirmOpen: false,
      confirming: null,
      blockReason: "",
      saving: false,
      dialogError: "",
      busyId: "",
      // `{ device, token }` while the token dialog is open, else null.
      issued: null,
    };
  },
  computed: {
    ...mapGetters({ tenantId: "tenants/currentTenantId" }),
    canManage() {
      return AdmissionPermissionService.allowManageDevices();
    },
    columns() {
      const label = (key) => this.$t(`admission.devices.columns.${key}`);
      return [
        { key: "label", label: label("label"), width: "minmax(180px, 1.4fr)" },
        { key: "status", label: label("status"), width: "minmax(130px, 1fr)" },
        { key: "token", label: label("token"), width: "minmax(130px, 1fr)" },
        {
          key: "lastSeen",
          label: label("lastSeen"),
          width: "minmax(130px, 1fr)",
        },
        {
          key: "actions",
          label: "",
          width: "auto",
          align: "end",
        },
      ];
    },
  },
  watch: {
    // Another tenant: its own devices. An open dialog belongs to the old
    // one - the token dialog would name the new tenant beside the old token.
    tenantId() {
      this.createOpen = false;
      this.confirmOpen = false;
      this.issued = null;
      this.load();
    },
  },
  created() {
    this.load();
  },
  methods: {
    required(value) {
      return (
        !!String(value || "").trim() || this.$t("admission.devices.required")
      );
    },
    facilityTitle(id) {
      return this.facilities.find((f) => f.id === id)?.title || "—";
    },
    dateTime(at) {
      return FormatService.dateTime(at);
    },
    async load() {
      this.loading = true;
      this.errorMessage = "";
      try {
        const { data } = await ApiAdmissionService.getDevices();
        this.devices = data || [];
      } catch (error) {
        this.devices = [];
        this.errorMessage = this.$t("admission.devices.error");
      } finally {
        this.loading = false;
      }
    },
    openCreate() {
      this.draft = {
        label: "",
        facilityId: this.facilities.length === 1 ? this.facilities[0].id : null,
      };
      this.dialogError = "";
      this.createOpen = true;
      this.$nextTick(() => this.$refs.createForm?.resetValidation());
    },
    async create() {
      if (!this.$refs.createForm.validate()) return;
      this.saving = true;
      this.dialogError = "";
      try {
        const { data } = await ApiAdmissionService.createDevice({
          label: this.draft.label.trim(),
          facilityId: this.draft.facilityId,
        });
        this.createOpen = false;
        this.issued = data;
        await this.load();
      } catch (error) {
        this.dialogError = this.$t("admission.devices.saveError");
      } finally {
        this.saving = false;
      }
    },
    askRenew(device) {
      this.confirming = { action: "renew", device };
      this.dialogError = "";
      this.confirmOpen = true;
    },
    askBlock(device) {
      this.confirming = { action: "block", device };
      this.blockReason = "";
      this.dialogError = "";
      this.confirmOpen = true;
    },
    async confirm() {
      const { action, device } = this.confirming;
      if (action === "block" && !this.$refs.blockForm.validate()) return;
      this.saving = true;
      this.dialogError = "";
      try {
        if (action === "renew") {
          const { data } = await ApiAdmissionService.renewDeviceToken(
            device.id
          );
          this.issued = data;
        } else {
          await ApiAdmissionService.blockDevice(
            device.id,
            this.blockReason.trim()
          );
        }
        this.confirmOpen = false;
        await this.load();
      } catch (error) {
        this.dialogError = this.$t("admission.devices.saveError");
      } finally {
        this.saving = false;
      }
    },
    async unblock(device) {
      this.busyId = device.id;
      try {
        await ApiAdmissionService.unblockDevice(device.id);
        await this.load();
      } catch (error) {
        this.errorMessage = this.$t("admission.devices.saveError");
      } finally {
        this.busyId = "";
      }
    },
  },
};
</script>

<style scoped>
.admission-devices__head {
  display: flex;
  align-items: flex-start;
  gap: var(--scb-space-4);
  margin-bottom: var(--scb-space-4);
}

.admission-devices__lead {
  flex: 1;
  margin: 0;
  font-size: var(--scb-font-size-sm);
  color: var(--scb-text-muted);
}

.admission-devices__label {
  font-weight: var(--scb-font-weight-semibold);
}

.admission-devices__sub {
  font-size: var(--scb-font-size-xs);
  color: var(--scb-text-muted);
}

.admission-devices__status {
  display: inline-flex;
  align-items: center;
  gap: var(--scb-space-1);
}

.admission-devices__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--scb-space-1);
}

.admission-devices__mono {
  font-family: "Roboto Mono", ui-monospace, monospace;
}
</style>
