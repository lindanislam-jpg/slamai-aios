import { test } from "node:test";
import assert from "node:assert/strict";
import { can, canAssignRole, isRole } from "../src/lib/voice/roles";

test("an owner can do everything", () => {
  assert.equal(can("owner", "billing.write"), true);
  assert.equal(can("owner", "workspace.delete"), true);
});

test("an admin cannot touch billing or delete the workspace", () => {
  assert.equal(can("admin", "billing.write"), false);
  assert.equal(can("admin", "workspace.delete"), false);
  assert.equal(can("admin", "team.write"), true);
});

test("a manager runs the day to day but cannot change the team", () => {
  assert.equal(can("manager", "agent.write"), true);
  assert.equal(can("manager", "leads.write"), true);
  assert.equal(can("manager", "team.write"), false);
  assert.equal(can("manager", "billing.read"), false);
});

test("staff can work leads but not reconfigure the AI", () => {
  assert.equal(can("staff", "leads.write"), true);
  assert.equal(can("staff", "appointments.write"), true);
  assert.equal(can("staff", "agent.write"), false);
  assert.equal(can("staff", "knowledge.write"), false);
});

test("an unknown role has no permissions at all", () => {
  assert.equal(can("superuser", "calls.read"), false);
  assert.equal(can("", "calls.read"), false);
});

test("nobody can promote someone to their own level or above", () => {
  assert.equal(canAssignRole("admin", "owner"), false);
  assert.equal(canAssignRole("admin", "admin"), false);
  assert.equal(canAssignRole("admin", "manager"), true);
  assert.equal(canAssignRole("manager", "manager"), false);
  assert.equal(canAssignRole("manager", "staff"), true);
  assert.equal(canAssignRole("staff", "staff"), false);
});

test("an owner may assign any role", () => {
  assert.equal(canAssignRole("owner", "owner"), true);
  assert.equal(canAssignRole("owner", "staff"), true);
});

test("role validation rejects made-up roles", () => {
  assert.equal(isRole("owner"), true);
  assert.equal(isRole("root"), false);
});
