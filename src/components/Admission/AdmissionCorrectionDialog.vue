<template>
  <v-dialog
    :value="open"
    max-width="560"
    persistent
    scrollable
    @input="!$event && close()"
  >
    <v-card data-test="admission-correction-dialog">
      <v-card-title class="d-flex align-center py-4 px-6">
        <v-icon left>{{ icon }}</v-icon>
        <span class="text-h6">{{ title }}</span>
        <v-spacer />
        <v-btn
          icon
          :disabled="saving"
          :aria-label="$t('admission.correction.cancel')"
          @click="close"
        >
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-6">
        <p class="admission-correction__effect">
          {{
            action ? $t(`admission.correction.actions.${action}.effect`) : ""
          }}
        </p>
        <v-form ref="form" @submit.prevent="submit">
          <v-textarea
            v-model="reason"
            outlined
            auto-grow
            rows="2"
            counter="500"
            maxlength="500"
            :label="$t('admission.correction.reason')"
            :hint="$t('admission.correction.reasonHint')"
            persistent-hint
            :rules="[required]"
            autofocus
            data-test="admission-correction-reason"
          />
        </v-form>
        <v-alert
          v-if="error"
          type="error"
          text
          dense
          class="mt-4 mb-0"
          role="alert"
          data-test="admission-correction-error"
        >
          {{ error }}
        </v-alert>
      </v-card-text>
      <v-divider />
      <v-card-actions class="px-6 py-4">
        <v-spacer />
        <v-btn text :disabled="saving" @click="close">
          {{ $t("admission.correction.cancel") }}
        </v-btn>
        <v-btn
          color="primary"
          depressed
          :loading="saving"
          data-test="admission-correction-submit"
          @click="submit"
        >
          {{ $t("admission.correction.submit") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import ApiAdmissionService from "@/services/api/ApiAdmissionService";

const ICONS = {
  block: "mdi-cancel",
  unblock: "mdi-lock-open-variant-outline",
  resetPresence: "mdi-account-arrow-left-outline",
  revertEntry: "mdi-undo-variant",
};

/**
 * A correction of the administration: block, unblock, reset a
 * forgotten exit, take back an entry - always with a reason, which the
 * usage log keeps with the account. A scan in between (`409
 * admission_changed`) asks to look again; the page reloads the admission.
 */
export default {
  name: "AdmissionCorrectionDialog",
  props: {
    open: { type: Boolean, default: false },
    admission: { type: Object, default: null },
    action: { type: String, default: null },
  },
  data() {
    return { reason: "", saving: false, error: "" };
  },
  computed: {
    title() {
      return this.action
        ? this.$t(`admission.correction.actions.${this.action}.title`)
        : "";
    },
    icon() {
      return ICONS[this.action] || "mdi-pencil";
    },
  },
  watch: {
    open(isOpen) {
      if (isOpen) {
        this.reason = "";
        this.error = "";
        this.saving = false;
        this.$nextTick(() => this.$refs.form?.resetValidation());
      }
    },
  },
  methods: {
    required(value) {
      return (
        !!String(value || "").trim() ||
        this.$t("admission.correction.reasonRequired")
      );
    },
    close() {
      if (!this.saving) this.$emit("close");
    },
    async submit() {
      if (!this.$refs.form.validate()) return;
      this.saving = true;
      this.error = "";
      try {
        const { data } = await ApiAdmissionService.correctAdmission(
          this.admission.id,
          this.action,
          this.reason.trim()
        );
        this.$emit("corrected", data);
      } catch (error) {
        const code = error?.response?.data?.code;
        this.error = this.$te(`admission.correction.errors.${code}`)
          ? this.$t(`admission.correction.errors.${code}`)
          : this.$t("admission.correction.errors.default");
        if (
          code === "admission_changed" ||
          code === "admission_correction_not_applicable"
        ) {
          this.$emit("stale");
        }
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.admission-correction__effect {
  margin: 0 0 var(--scb-space-4);
  font-size: var(--scb-font-size-sm);
  color: var(--scb-text);
}
</style>
