import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { login, LoginError, resolveSession, destroySession } from "@/lib/session";
import { createProject } from "@/lib/services/projects";
import { makeActor, resetDb } from "./helpers";

beforeEach(resetDb);

describe("authentication", () => {
  it("signs in, resolves the session, and signs out", async () => {
    const a = await makeActor("QC_INSPECTOR");
    const { token } = await login(a.email.toUpperCase(), "test-password-123");
    const actor = await resolveSession(token);
    expect(actor?.id).toBe(a.id);
    expect(actor?.permissions.has("inspection.write")).toBe(true);
    // Only the hash is stored.
    expect(await db.session.count({ where: { tokenHash: token } })).toBe(0);
    await destroySession(token);
    expect(await resolveSession(token)).toBeNull();
  });

  it("rejects wrong passwords with a generic message and locks out after repeated failures", async () => {
    const a = await makeActor("QC_INSPECTOR");
    for (let i = 0; i < 5; i++) await expect(login(a.email, "wrong-password")).rejects.toThrow("Incorrect email or password.");
    await expect(login(a.email, "test-password-123")).rejects.toThrow(/Too many failed attempts/);
    await expect(login("nobody@test.invalid", "whatever")).rejects.toBeInstanceOf(LoginError);
  });

  it("refuses deactivated users and drops their sessions", async () => {
    const a = await makeActor("QC_INSPECTOR");
    const { token } = await login(a.email, "test-password-123");
    await db.user.update({ where: { id: a.id }, data: { active: false } });
    expect(await resolveSession(token)).toBeNull();
    await expect(login(a.email, "test-password-123")).rejects.toThrow();
  });

  it("enforces permissions in the service layer, not just the UI", async () => {
    const viewer = await makeActor("PRODUCTION_VIEWER");
    await expect(createProject(viewer, { name: "Should fail" })).rejects.toThrow(/permission/);
  });
});
