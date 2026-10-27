import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { aiStatus, suggestForPhoto } from "@/lib/ai/vision";
import { uploadPhotos } from "@/lib/services/photos";
import { createProject } from "@/lib/services/projects";
import { jpeg, makeActor, resetDb } from "./helpers";

beforeEach(resetDb);
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENAI_API_KEY;
  delete process.env.AI_PROVIDER;
});

function reply(content: object) {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content), refusal: null } }] }), { status: 200 });
}

describe("AI photo review via OpenAI", () => {
  it("is selected when only OPENAI_API_KEY is set", () => {
    expect(aiStatus().configured).toBe(false);
    process.env.OPENAI_API_KEY = "sk-test";
    expect(aiStatus()).toMatchObject({ configured: true, provider: "openai", model: "gpt-4o" });
  });

  it("stores a draft limited to the app's vocabularies and audits it", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(qc, { name: "AI test" });
    const [up] = await uploadPhotos(qc, p.id, [{ name: "a.jpg", data: await jpeg({}) }], { category: "Frame assembly" });
    const fetchMock = vi.fn().mockResolvedValue(
      reply({
        caption: "Fillet weld on frame corner",
        description: "A fillet weld is visible.",
        category: "Not a real category",
        possibleObservations: ["Possible spatter"],
        possibleDefectCategories: ["Porosity", "Made up"],
        visibleText: "",
        imageQualityNotes: "",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const s = await suggestForPhoto(qc, (up as { id: string }).id);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.messages[1].content[0].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    expect(s.category).toBe("General quality evidence");
    expect(s.possibleDefectCategories).toEqual(["Porosity"]);
    expect(await db.auditEvent.count({ where: { action: "photo.ai_suggest" } })).toBe(1);
  });

  it("reports a rejected key without touching the photo", async () => {
    process.env.OPENAI_API_KEY = "sk-bad";
    const qc = await makeActor("QC_INSPECTOR");
    const p = await createProject(qc, { name: "AI test" });
    const [up] = await uploadPhotos(qc, p.id, [{ name: "a.jpg", data: await jpeg({}) }], { category: "Frame assembly" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const id = (up as { id: string }).id;
    await expect(suggestForPhoto(qc, id)).rejects.toThrow(/OPENAI_API_KEY/);
    expect((await db.photo.findUnique({ where: { id } }))?.aiSuggestion).toBeNull();
  });
});
