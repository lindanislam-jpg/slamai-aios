import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, readJson, badRequest } from "@/lib/api";

export async function GET() {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const workflows = await db.workflow.findMany({
    where: { userId: gate.userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(workflows);
}

type WorkflowBody = {
  name?: string;
  description?: string;
  trigger?: string;
  action?: string;
  isActive?: boolean;
};

export async function POST(req: NextRequest) {
  const gate = await requireUser();
  if (!gate.ok) return gate.response;

  const body = await readJson<WorkflowBody>(req);
  if (!body?.name || !body.trigger || !body.action) {
    return badRequest("name, trigger and action are required");
  }

  const workflow = await db.workflow.create({
    data: {
      name:        body.name,
      description: body.description,
      trigger:     body.trigger,
      action:      body.action,
      isActive:    body.isActive ?? false,
      userId:      gate.userId,
    },
  });
  return NextResponse.json(workflow, { status: 201 });
}
