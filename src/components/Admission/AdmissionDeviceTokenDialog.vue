<template>
  <v-dialog :value="open" max-width="620" persistent scrollable>
    <v-card data-test="admission-token-dialog">
      <v-card-title class="d-flex align-center py-4 px-6">
        <v-icon left color="primary">mdi-key-variant</v-icon>
        <span class="text-h6">{{ $t("admission.devices.token.title") }}</span>
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-6">
        <p class="mb-3">
          {{
            $t("admission.devices.token.lead", {
              label: device ? device.label : "",
            })
          }}
        </p>
        <v-alert
          type="warning"
          text
          dense
          class="mb-4"
          data-test="admission-token-once"
        >
          {{ $t("admission.devices.token.once") }}
        </v-alert>
        <v-text-field
          :value="token"
          :type="revealed ? 'text' : 'password'"
          readonly
          outlined
          dense
          hide-details
          class="admission-token__field"
          :label="$t('admission.devices.token.label')"
          data-test="admission-token-value"
        >
          <template #append>
            <v-btn
              icon
              small
              :aria-label="
                revealed
                  ? $t('admission.devices.token.hide')
                  : $t('admission.devices.token.show')
              "
              data-test="admission-token-reveal"
              @click="revealed = !revealed"
            >
              <v-icon>{{ revealed ? "mdi-eye-off" : "mdi-eye" }}</v-icon>
            </v-btn>
          </template>
        </v-text-field>
        <div class="d-flex align-center mt-3" style="gap: 8px">
          <v-btn
            small
            outlined
            color="primary"
            data-test="admission-token-copy"
            @click="copy"
          >
            <v-icon left small>mdi-content-copy</v-icon>
            {{ $t("admission.devices.token.copy") }}
          </v-btn>
          <span v-if="copied" class="admission-token__copied" role="status">
            {{ $t("admission.devices.token.copied") }}
          </span>
        </div>
        <h3 class="admission-token__heading">
          {{ $t("admission.devices.token.pairHeading") }}
        </h3>
        <p class="admission-token__tenant" data-test="admission-token-tenant">
          {{ $t("admission.devices.token.tenant") }}
          <span class="admission-token__mono">{{ tenantId }}</span>
        </p>
        <ol class="admission-token__steps">
          <li>{{ $t("admission.devices.token.pair1") }}</li>
          <li>{{ $t("admission.devices.token.pair2") }}</li>
          <li>{{ $t("admission.devices.token.pair3") }}</li>
        </ol>
      </v-card-text>
      <v-divider />
      <v-card-actions class="px-6 py-4">
        <v-spacer />
        <v-btn
          color="primary"
          depressed
          data-test="admission-token-done"
          @click="$emit('close')"
        >
          {{ $t("admission.devices.token.done") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { mapGetters } from "vuex";

/**
 * The token of an admission device, shown once - after the registration or
 * a renewal. The backend keeps only its hash, so closing the dialog
 * is the last chance to take it over: it starts masked, can be revealed and
 * copied, and is dropped by the page once the dialog closes.
 */
export default {
  name: "AdmissionDeviceTokenDialog",
  props: {
    open: { type: Boolean, default: false },
    device: { type: Object, default: null },
    token: { type: String, default: "" },
  },
  data() {
    return { revealed: false, copied: false };
  },
  computed: {
    ...mapGetters({ tenantId: "tenants/currentTenantId" }),
  },
  watch: {
    open(isOpen) {
      if (isOpen) {
        this.revealed = false;
        this.copied = false;
      }
    },
  },
  methods: {
    async copy() {
      try {
        await navigator.clipboard.writeText(this.token);
        this.copied = true;
      } catch (error) {
        this.revealed = true;
      }
    },
  },
};
</script>

<style scoped>
.admission-token__field ::v-deep input {
  font-family: "Roboto Mono", ui-monospace, monospace;
}

.admission-token__mono {
  font-family: "Roboto Mono", ui-monospace, monospace;
}

.admission-token__tenant {
  margin: var(--scb-space-4) 0 0;
  font-size: var(--scb-font-size-sm);
}

.admission-token__copied {
  font-size: var(--scb-font-size-sm);
  color: var(--scb-text-muted);
}

.admission-token__heading {
  margin: var(--scb-space-5) 0 var(--scb-space-2);
  font-size: var(--scb-font-size-md);
  font-weight: var(--scb-font-weight-semibold);
}

.admission-token__steps {
  margin: 0;
  padding-left: var(--scb-space-5);
  font-size: var(--scb-font-size-sm);
}
</style>
