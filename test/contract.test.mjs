import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { daemonAccepts, hostAccepts, spec } from "../index.mjs";

const read = (name) => JSON.parse(readFileSync(new URL(`../contract/${name}`, import.meta.url), "utf8"));
const fixtures = read("fixtures.json");
const tools = read("tools.json");

test("the fixtures belong to the spec protocol", () => {
  assert.equal(fixtures.protocol, spec.protocol);
  assert.ok(fixtures.cases.length >= 60);
});

test("case names are unique", () => {
  const names = fixtures.cases.map((entry) => entry.name);
  assert.equal(new Set(names).size, names.length);
});

for (const entry of fixtures.cases) {
  test(`daemon: ${entry.name}`, () => {
    assert.equal(daemonAccepts(entry.operation, fixtures.targets[entry.target] ?? null), entry.daemon);
  });
  test(`host: ${entry.name}`, () => {
    assert.equal(hostAccepts(entry.operation), entry.host);
  });
}

test("every operation has a fixture that both layers accept", () => {
  for (const kind of spec.operations) {
    const accepted = fixtures.cases.filter((entry) => entry.operation.kind === kind && entry.daemon && entry.host);
    assert.ok(accepted.length > 0, `${kind} has no accepted case`);
  }
});

test("tool definitions name every operation but the handoff", () => {
  const names = tools.map((tool) => tool.name);
  for (const kind of spec.operations.filter((operation) => operation !== "grok_bot_connection")) {
    assert.ok(names.includes(`computer_${kind}`), `computer_${kind} is missing`);
  }
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(tool.inputSchema.additionalProperties, false);
  }
});

test("tool limits agree with the spec", () => {
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool.inputSchema.properties]));
  assert.equal(byName.computer_screenshot.max_dimension.minimum, spec.limits.screenshot_dimension.min);
  assert.equal(byName.computer_screenshot.max_dimension.maximum, spec.limits.screenshot_dimension.max);
  assert.equal(byName.computer_scroll.dx.maximum, spec.limits.scroll_distance);
  assert.equal(byName.computer_scroll.dy.minimum, -spec.limits.scroll_distance);
  assert.equal(byName.computer_type.text.maxLength, spec.limits.text_bytes);
  assert.equal(byName.computer_click.observation.maxLength, spec.limits.observation_bytes);
});
