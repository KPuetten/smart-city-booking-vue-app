<template>
  <div
    class="admission-preview"
    data-test="admission-preview"
    aria-live="polite"
  >
    <p v-if="!preview" class="admission-preview__empty">
      {{ $t("bookable.admission.preview.off") }}
    </p>
    <template v-else>
      <section class="admission-preview__group">
        <h3 class="admission-preview__heading">
          <v-icon small>mdi-ticket-confirmation-outline</v-icon>
          {{ $t("bookable.admission.preview.issuesHeading") }}
        </h3>
        <ul
          class="admission-preview__list"
          data-test="admission-preview-issues"
        >
          <li v-for="line in preview.issues" :key="line.key">
            {{ $t(line.key, line.params) }}
          </li>
        </ul>
      </section>

      <section class="admission-preview__group">
        <h3 class="admission-preview__heading">
          <v-icon small>mdi-cart-outline</v-icon>
          {{ $t("bookable.admission.preview.saleHeading") }}
        </h3>
        <ul class="admission-preview__list" data-test="admission-preview-sale">
          <li v-for="line in preview.sale" :key="line.key">
            {{ $t(line.key, line.params) }}
          </li>
        </ul>
      </section>

      <section class="admission-preview__group">
        <h3 class="admission-preview__heading">
          <v-icon small>mdi-gate</v-icon>
          {{
            facility
              ? $t("bookable.admission.preview.checksHeading", {
                  facility: facility.title,
                })
              : $t("bookable.admission.preview.checksHeadingNoFacility")
          }}
        </h3>
        <ol
          class="admission-preview__steps"
          data-test="admission-preview-checks"
        >
          <li v-for="line in preview.checks" :key="line.key">
            {{ $t(line.key, line.params) }}
          </li>
        </ol>
      </section>

      <v-alert
        v-for="warning in preview.warnings"
        :key="warning.key"
        type="warning"
        text
        dense
        class="admission-preview__warning"
        data-test="admission-preview-warning"
      >
        {{ $t(warning.key, warning.params) }}
        <template v-if="warning.key.endsWith('noFacility')">
          <v-btn
            v-for="candidate in facilityCandidates"
            :key="candidate.id"
            text
            small
            color="warning"
            class="ml-1"
            data-test="admission-preview-hierarchy"
            @click="openFacilityHierarchy(candidate)"
          >
            {{
              $t("bookable.admission.preview.toFacilityHierarchy", {
                facility: candidate.title,
              })
            }}
          </v-btn>
        </template>
      </v-alert>
    </template>
  </div>
</template>

<script>
import bookableEditing from "@/mixins/bookableEditing";
import otherBookables from "@/mixins/otherBookables";
import {
  admissionFacilities,
  admissionPreview,
  facilityOfTariff,
} from "@/utils/admissionDefinition";
import { editRouteOf } from "@/utils/bookableFlow";

/**
 * The rule preview of a tariff: in plain words what the tariff
 * issues and what the entrance checks, in the order of the check, read off
 * the tariff as edited - so every change of the definition shows here at
 * once, before it is saved. The facility is the bookable with entrance
 * settings that lists the tariff as its child (its Hierarchie), as the
 * issuance picks it; without one the preview says so and leads to the
 * Hierarchie of each facility, where the tariff is added.
 */
export default {
  name: "BookableEditAdmissionPreview",
  mixins: [bookableEditing, otherBookables],
  computed: {
    facility() {
      return facilityOfTariff(this.bookable, this.bookables);
    },
    preview() {
      return admissionPreview(this.bookable, { facility: this.facility });
    },
    facilityCandidates() {
      return admissionFacilities(this.bookables);
    },
  },
  methods: {
    openFacilityHierarchy(facility) {
      this.$router.push({
        name: editRouteOf(facility.type),
        query: {
          id: facility.id,
          tab: "relatedBookables",
          section: "related-hierarchy",
        },
      });
    },
  },
};
</script>

<style scoped>
.admission-preview__group + .admission-preview__group {
  margin-top: var(--scb-space-5);
}

.admission-preview__heading {
  display: flex;
  align-items: center;
  gap: var(--scb-space-2);
  margin: 0 0 var(--scb-space-2);
  font-size: var(--scb-font-size-md);
  font-weight: var(--scb-font-weight-semibold);
  line-height: var(--scb-line-height-base);
  color: var(--scb-text);
}

.admission-preview__list,
.admission-preview__steps {
  margin: 0;
  padding-left: var(--scb-space-5);
  font-size: var(--scb-font-size-sm);
  line-height: var(--scb-line-height-base);
  color: var(--scb-text);
}

.admission-preview__list li + li,
.admission-preview__steps li + li {
  margin-top: var(--scb-space-1);
}

.admission-preview__warning {
  margin: var(--scb-space-4) 0 0;
}

.admission-preview__empty {
  margin: 0;
  font-size: var(--scb-font-size-sm);
  color: var(--scb-text-muted);
}
</style>
