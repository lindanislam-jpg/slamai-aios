"use server";

import type { DocStatus } from "@prisma/client";
import { run, type ActionState } from "@/lib/action";
import { formToObject } from "@/lib/validation";
import { addCalibration, approveRevision, createDocument, createEquipment, setDocumentStatus, updateEquipment } from "@/lib/services/documents";

export async function createDocumentAction(_p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const d = await createDocument(actor, formToObject(fd) as Parameters<typeof createDocument>[1]);
    return `${d.docNo} registered. Upload its first revision below.`;
  }, ["/documents"]);
}

export async function approveRevisionAction(revisionId: string, _p: ActionState, _fd: FormData) {
  void _fd;
  return run(async (actor) => {
    await approveRevision(actor, revisionId);
    return "Revision approved.";
  }, ["/documents"]);
}

export async function documentStatusAction(id: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    await setDocumentStatus(actor, id, String(fd.get("status")) as DocStatus);
    return "Status updated.";
  }, ["/documents"]);
}

export async function createEquipmentAction(_p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const e = await createEquipment(actor, formToObject(fd) as Parameters<typeof createEquipment>[1]);
    return `${e.assetNo} added.`;
  }, ["/documents"]);
}

export async function addCalibrationAction(equipmentId: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    await addCalibration(actor, equipmentId, formToObject(fd) as Parameters<typeof addCalibration>[2]);
    return "Calibration recorded.";
  }, ["/documents"]);
}

export async function updateEquipmentAction(equipmentId: string, _p: ActionState, fd: FormData) {
  return run(async (actor) => {
    const e = await updateEquipment(actor, equipmentId, formToObject(fd) as Parameters<typeof updateEquipment>[2]);
    return `${e.assetNo} updated.`;
  }, ["/documents", "/cmr", "/alerts"]);
}
