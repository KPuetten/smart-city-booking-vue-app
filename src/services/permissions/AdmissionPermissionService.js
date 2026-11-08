import user from "@/store/modules/user";
import store from "@/store";
import { allowsAdmission } from "@/utils/admissionPermissions";

/**
 * Who may read and correct admissions and manage the admission devices at
 * the current tenant - `allowsAdmission` over the sign-in's permissions.
 */
class AdmissionPermissionService {
  static _allows(right) {
    return allowsAdmission(
      user.state.data?.permissions,
      store.getters["tenants/currentTenantId"],
      right
    );
  }

  static allowRead() {
    return AdmissionPermissionService._allows("read");
  }

  static allowCorrect() {
    return AdmissionPermissionService._allows("correct");
  }

  static allowManageDevices() {
    return AdmissionPermissionService._allows("manageDevices");
  }
}

export default AdmissionPermissionService;
