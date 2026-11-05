// AI providers: token prices, cost per call, and the schema conversion for Claude.
import { test } from "node:test";
import assert from "node:assert/strict";
await import(new URL("./load.ts", import.meta.url).href); // extensionless relative imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ai = (name: string): Promise<any> => import(new URL(`../../src/lib/ai/${name}.ts`, import.meta.url).href);
const { priceOf, costUsd } = await ai("pricing");
const { toClaudeSchema } = await ai("schema");

test("Claude Opus 5.5 prices", () => {
  const p = priceOf("claude-opus-5-5", "2026-11-05");
  assert.equal(p.known, true);
  assert.deepEqual([p.input, p.output, p.cacheRead, p.cacheWrite], [4, 20, 0.2, 5]);
  // 10k input + 2k output (incl. thinking) + 5k cache read
  assert.equal(costUsd({ input: 10_000, output: 2_000, cacheRead: 5_000 }, p), 0.04 + 0.04 + 0.001);
});

test("Gemini Flash prices change on 2027-01-01, model version and alias both priced", () => {
  assert.equal(priceOf("gemini-3.8-flash", "2026-12-31").input, 0.75);
  assert.equal(priceOf("gemini-3.8-flash", "2027-01-01").input, 1.5);
  assert.equal(priceOf("gemini-3.8-flash-001", "2026-11-05").output, 3.75);
  assert.equal(priceOf("gemini-flash-latest", "2026-11-05").known, true);
  assert.equal(priceOf("models/gemini-2.5-flash", "2026-11-05").input, 0.3);
});

test("unknown model is flagged, overrides win", () => {
  assert.equal(priceOf("some-new-model", "2026-11-05").known, false);
  const p = priceOf("claude-opus-5-5", "2026-11-05", { "claude-opus-5-5": { input: 3 } });
  assert.equal(p.input, 3);
  assert.equal(p.output, 20);
  assert.equal(priceOf("x-model", "2026-11-05", { "x-model": { input: 1, output: 2 } }).known, true);
});

test("schema for Claude: additionalProperties false on every object, nullable → union", () => {
  const s = toClaudeSchema({
    type: "object",
    properties: {
      summary: { type: "string" },
      issues: { type: "array", items: { type: "object", properties: { code: { type: "string", nullable: true } }, required: ["code"] } },
      meta: { type: "object" },
    },
    required: ["summary"],
  });
  assert.equal(s.additionalProperties, false);
  const issues = (s.properties as Record<string, Record<string, unknown>>).issues;
  const item = issues.items as Record<string, unknown>;
  assert.equal(item.additionalProperties, false);
  assert.deepEqual((item.properties as Record<string, Record<string, unknown>>).code.type, ["string", "null"]);
  assert.equal("nullable" in (item.properties as Record<string, Record<string, unknown>>).code, false);
  assert.deepEqual((s.properties as Record<string, Record<string, unknown>>).meta, { type: "object", additionalProperties: false, properties: {} });
  assert.deepEqual(s.required, ["summary"]);
});
