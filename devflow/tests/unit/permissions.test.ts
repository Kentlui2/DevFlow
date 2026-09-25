import { describe, it, expect } from "vitest";
import { permissions } from "@/lib/auth/permissions";

describe("permissions", () => {
  it("only owners can edit or delete a project", () => {
    expect(permissions.editProject("owner")).toBe(true);
    expect(permissions.editProject("developer")).toBe(false);
    expect(permissions.editProject("viewer")).toBe(false);
  });

  it("viewers cannot create tasks, but owners and developers can", () => {
    expect(permissions.createTask("owner")).toBe(true);
    expect(permissions.createTask("developer")).toBe(true);
    expect(permissions.createTask("viewer")).toBe(false);
  });

  it("everyone with project access can view analytics and activity", () => {
    for (const role of ["owner", "developer", "viewer"] as const) {
      expect(permissions.viewAnalytics(role)).toBe(true);
      expect(permissions.viewActivity(role)).toBe(true);
    }
  });
});
