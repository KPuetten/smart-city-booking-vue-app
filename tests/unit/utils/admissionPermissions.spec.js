import { describe, expect, it } from "vitest";
import { allowsAdmission } from "@/utils/admissionPermissions";

const member = (manageAdmissions, extra = {}) => ({
  tenants: [{ tenantId: "t1", manageAdmissions, ...extra }],
});

describe("allowsAdmission", () => {
  it("gives the entrance staff the check alone", () => {
    const staff = member({ create: true, readAny: false, updateAny: false });
    expect(allowsAdmission(staff, "t1", "check")).toBe(true);
    expect(allowsAdmission(staff, "t1", "read")).toBe(false);
    expect(allowsAdmission(staff, "t1", "correct")).toBe(false);
    expect(allowsAdmission(staff, "t1", "manageDevices")).toBe(false);
  });

  it("reads and corrects by its levels, the devices only as an owner", () => {
    const office = member({ create: false, readAny: true, updateAny: true });
    expect(allowsAdmission(office, "t1", "read")).toBe(true);
    expect(allowsAdmission(office, "t1", "correct")).toBe(true);
    expect(allowsAdmission(office, "t1", "manageDevices")).toBe(false);
    const owner = member({}, { isOwner: true });
    expect(allowsAdmission(owner, "t1", "manageDevices")).toBe(true);
    expect(
      allowsAdmission({ instanceOwner: true }, null, "manageDevices")
    ).toBe(true);
  });

  it("allows nothing at another tenant, without a tenant or permissions", () => {
    const office = member({ readAny: true });
    expect(allowsAdmission(office, "t2", "read")).toBe(false);
    expect(allowsAdmission(office, null, "read")).toBe(false);
    expect(allowsAdmission(null, "t1", "read")).toBe(false);
    expect(allowsAdmission(member(undefined), "t1", "read")).toBe(false);
  });
});
