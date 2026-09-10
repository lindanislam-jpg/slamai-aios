import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkText, htmlToText, estimateTokens, normalise } from "../src/lib/voice/chunking";

test("short text stays as one passage", () => {
  const chunks = chunkText("We cover Dublin, Kildare and Meath.");
  assert.equal(chunks.length, 1);
});

test("long text is split into several passages", () => {
  const paragraph = "This is a sentence about our plumbing services. ".repeat(40);
  const chunks = chunkText(`${paragraph}\n\n${paragraph}\n\n${paragraph}`);
  assert.ok(chunks.length > 1, "expected the text to be split");
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 1600, `passage too long: ${chunk.length}`);
  }
});

test("empty and whitespace-only input produces nothing", () => {
  assert.deepEqual(chunkText(""), []);
  assert.deepEqual(chunkText("   \n\n  "), []);
});

test("a paragraph longer than the target is split on sentences", () => {
  const long = "Our engineers are fully insured and Gas Safe registered. ".repeat(60);
  const chunks = chunkText(long);
  assert.ok(chunks.length > 1);
  assert.ok(chunks[0].trim().endsWith("."), "should break on a sentence boundary");
});

test("HTML is reduced to readable text", () => {
  const html = `
    <html><head><style>.a{color:red}</style><script>alert(1)</script></head>
    <body><nav>Home About</nav><h1>ABC Plumbing</h1>
    <p>We cover Dublin &amp; Kildare.</p><p>Call-out fee is &euro;60.</p>
    <footer>© 2026</footer></body></html>`;

  const text = htmlToText(html);
  assert.ok(text.includes("ABC Plumbing"));
  assert.ok(text.includes("Dublin & Kildare"));
  assert.ok(text.includes("€60"));
  assert.ok(!text.includes("alert"), "scripts must be stripped");
  assert.ok(!text.includes("color:red"), "styles must be stripped");
  assert.ok(!text.includes("Home About"), "navigation furniture must be stripped");
});

test("numeric HTML entities are decoded", () => {
  assert.ok(htmlToText("<p>&#8364;60 and &#x20AC;80</p>").includes("€60"));
});

test("normalise collapses runaway whitespace", () => {
  assert.equal(normalise("a  \t b\n\n\n\nc"), "a b\n\nc");
});

test("token estimates scale with length", () => {
  assert.ok(estimateTokens("a".repeat(400)) > estimateTokens("a".repeat(40)));
});
