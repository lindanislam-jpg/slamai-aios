"use server";

import { Role } from "@prisma/client";
import { run, type ActionState } from "@/lib/action";
import { createUser, resetPassword, updateUser } from "@/lib/services/users";

const role = (v: FormDataEntryValue | null) => {
  const r = String(v ?? "");
  if (!(r in Role)) throw new Error("Choose a role.");
  return r as Role;
};

export async function createUserAction(_: ActionState, fd: FormData) {
  return run(async (actor) => {
    await createUser(actor, { email: String(fd.get("email") ?? ""), name: String(fd.get("name") ?? ""), role: role(fd.get("role")), password: String(fd.get("password") ?? "") });
    return "User created. Give them the temporary password securely and ask them to change it.";
  }, ["/users"]);
}

export async function updateUserAction(id: string, _: ActionState, fd: FormData) {
  return run(async (actor) => {
    await updateUser(actor, id, { role: role(fd.get("role")), active: fd.get("active") === "on" });
    return "User updated. Their sessions were signed out so the change applies immediately.";
  }, ["/users"]);
}

export async function resetPasswordAction(id: string, _: ActionState, fd: FormData) {
  return run(async (actor) => {
    await resetPassword(actor, id, String(fd.get("password") ?? ""));
    return "Password reset and sessions signed out.";
  }, ["/users"]);
}
