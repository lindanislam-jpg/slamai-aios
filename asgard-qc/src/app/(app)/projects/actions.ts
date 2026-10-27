"use server";

import { run, type ActionState } from "@/lib/action";
import { createProject, createUnit, updateProject, updateUnit } from "@/lib/services/projects";
import { formToObject } from "@/lib/validation";

function projectFields(fd: FormData) {
  const raw = formToObject(fd);
  const stages = typeof raw.stages === "string" ? raw.stages.split("\n").map((s) => s.trim()).filter(Boolean) : undefined;
  return { ...raw, stages } as Record<string, unknown>;
}

export async function createProjectAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const p = await createProject(actor, projectFields(fd) as Parameters<typeof createProject>[1]);
    return { message: `${p.code} created.`, redirect: `/projects/${p.id}` };
  }, ["/projects"]);
}

export async function updateProjectAction(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    await updateProject(actor, id, projectFields(fd));
    return "Project updated.";
  }, [`/projects/${id}`, "/projects"]);
}

export async function createUnitAction(projectId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const u = await createUnit(actor, { ...formToObject(fd), projectId } as Parameters<typeof createUnit>[1]);
    return `${u.ref} added.`;
  }, [`/projects/${projectId}`, "/frames"]);
}

export async function updateUnitAction(projectId: string, id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return run(async (actor) => {
    const u = await updateUnit(actor, id, formToObject(fd));
    return `${u.ref} updated.`;
  }, [`/projects/${projectId}`, "/frames"]);
}
