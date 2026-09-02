import { z } from "zod";

/**
 * Explicit field allowlists for every writable model. Create schemas require
 * the identifying fields; the update variants make everything optional but
 * reject an empty body, so a PATCH always means something.
 */

const nonEmpty = (msg: string) => z.string().trim().min(1, msg);

export const contactCreateSchema = z.object({
  name:    nonEmpty("Name required"),
  email:   z.string().trim().email("Invalid email").or(z.literal("")).optional(),
  phone:   z.string().trim().optional(),
  company: z.string().trim().optional(),
  stage:   z.string().trim().optional(),
  score:   z.number().int().min(0).max(100).optional(),
  tags:    z.string().trim().optional(),
  notes:   z.string().optional(),
});

export const agentCreateSchema = z.object({
  name:         nonEmpty("Name and type required"),
  type:         nonEmpty("Name and type required"),
  description:  z.string().optional(),
  systemPrompt: z.string().optional(),
  model:        z.string().trim().optional(),
  isActive:     z.boolean().optional(),
});

export const projectCreateSchema = z.object({
  name:        nonEmpty("Name required"),
  description: z.string().optional(),
  status:      z.string().trim().optional(),
});

/** Turn a create schema into a PATCH schema: all optional, but not empty. */
function toUpdateSchema<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return schema.partial().refine(
    v => Object.keys(v).length > 0,
    { message: "No fields to update" }
  );
}

export const contactUpdateSchema = toUpdateSchema(contactCreateSchema);
export const agentUpdateSchema   = toUpdateSchema(agentCreateSchema);
export const projectUpdateSchema = toUpdateSchema(projectCreateSchema);
