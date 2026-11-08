<template>
  <span
    class="admission-state"
    :class="`admission-state--${look.color}`"
    :data-state="state"
    data-test="admission-state"
  >
    <v-icon small :color="look.color" aria-hidden="true">{{
      look.icon
    }}</v-icon>
    <span class="admission-state__word">{{
      $t(`admission.states.${state}`)
    }}</span>
  </span>
</template>

<script>
import { stateLook } from "@/utils/admissionStates";

/**
 * The state of an admission as an icon and its word - never by colour
 * alone.
 */
export default {
  name: "AdmissionStateChip",
  props: {
    state: { type: String, required: true },
  },
  computed: {
    look() {
      return stateLook(this.state);
    },
  },
};
</script>

<style scoped>
.admission-state {
  display: inline-flex;
  align-items: center;
  gap: var(--scb-space-1);
  padding: 2px var(--scb-space-2);
  font-size: var(--scb-font-size-sm);
  font-weight: var(--scb-font-weight-medium);
  line-height: var(--scb-line-height-base);
  color: var(--scb-text);
  border: 1px solid var(--scb-surface-border);
  border-radius: var(--scb-radius-pill);
  background: var(--scb-surface);
  white-space: nowrap;
}
</style>
