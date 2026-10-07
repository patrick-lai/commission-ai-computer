import { writeFileSync } from "node:fs";

const targets = {
  default: { bundle_id: "test.fixture", process_id: 42, process_start: "fixture-launch", window_id: 7, title: "Fixture", x: 400, y: 300, width: 640, height: 480, scale: 2 },
  grok_bot: { bundle_id: "com.anysphere.sand", process_id: 43, process_start: "fixture-launch", window_id: 8, title: "Handoff", x: 0, y: 0, width: 640, height: 480, scale: 2 },
};

const cases = [];
const add = (name, operation, daemon, host, target = "default", note) => {
  const entry = { name, operation, target, daemon, host };
  if (note !== undefined) entry.note = note;
  cases.push(entry);
};

const token = (bytes) => "t".repeat(bytes);
const observation = token(128);
const accent = "é";

for (const kind of ["status", "apps", "snapshot", "stop"]) add(`${kind} needs no arguments`, { kind }, true, true);
add("unknown fields are refused by the daemon only", { kind: "status", extra: 1 }, false, true, "default", "The daemon denies unknown fields; the host ignores them.");
add("unknown kinds are refused", { kind: "teleport" }, false, false);

add("windows accepts a bundle id", { kind: "windows", bundle_id: "com.apple.TextEdit" }, true, true);
add("windows refuses an empty bundle id", { kind: "windows", bundle_id: "" }, false, false);
add("windows accepts 256 bytes", { kind: "windows", bundle_id: token(256) }, true, true);
add("windows refuses 257 bytes", { kind: "windows", bundle_id: token(257) }, false, false);
add("limits count bytes, not characters", { kind: "windows", bundle_id: accent.repeat(128) }, true, true);
add("limits count bytes, not characters (over)", { kind: "windows", bundle_id: accent.repeat(129) }, false, false);

add("select accepts a bundle id alone", { kind: "select", bundle_id: "com.apple.TextEdit" }, true, true);
add("select accepts a null window id", { kind: "select", bundle_id: "a.b", window_id: null }, true, true);
add("select refuses window id 0", { kind: "select", bundle_id: "a.b", window_id: 0 }, false, false);
add("select accepts window id 1", { kind: "select", bundle_id: "a.b", window_id: 1 }, true, true);
add("select accepts the largest window id", { kind: "select", bundle_id: "a.b", window_id: 4294967295 }, true, true);
add("select refuses a window id past 32 bits", { kind: "select", bundle_id: "a.b", window_id: 4294967296 }, false, false);
add("select refuses a fractional window id", { kind: "select", bundle_id: "a.b", window_id: 1.5 }, false, false);
add("select refuses an empty bundle id", { kind: "select", bundle_id: "" }, false, false);

add("screenshot accepts no size", { kind: "screenshot" }, true, true);
add("screenshot accepts a null size", { kind: "screenshot", max_dimension: null }, true, true);
add("screenshot refuses 319", { kind: "screenshot", max_dimension: 319 }, false, false);
add("screenshot accepts 320", { kind: "screenshot", max_dimension: 320 }, true, true);
add("screenshot accepts 2048", { kind: "screenshot", max_dimension: 2048 }, true, true);
add("screenshot refuses 2049", { kind: "screenshot", max_dimension: 2049 }, false, false);
add("screenshot refuses a fractional size", { kind: "screenshot", max_dimension: 1280.5 }, false, false);

add("click accepts a reference", { kind: "click", observation: "o", reference: "r" }, true, true);
add("click accepts a point inside the window", { kind: "click", observation: "o", x: 10, y: 20 }, true, true);
add("click refuses a point on the right edge", { kind: "click", observation: "o", x: 640, y: 20 }, false, true, "default", "The daemon checks the window bounds; the host checks only that the numbers are finite.");
add("click refuses a negative point", { kind: "click", observation: "o", x: -1, y: 20 }, false, true, "default", "The daemon checks the window bounds; the host checks only that the numbers are finite.");
add("click refuses a reference with a point", { kind: "click", observation: "o", reference: "r", x: 1, y: 1 }, false, true, "default", "The daemon refuses an ambiguous target; the host prefers the reference.");
add("click refuses no target at all", { kind: "click", observation: "o" }, false, false);
add("click refuses a lone x", { kind: "click", observation: "o", x: 1 }, false, false);
add("click refuses an empty reference", { kind: "click", observation: "o", reference: "" }, false, false);
add("click accepts a 128 byte reference", { kind: "click", observation: "o", reference: token(128) }, true, true);
add("click refuses a 129 byte reference", { kind: "click", observation: "o", reference: token(129) }, false, false);
add("click accepts a double click", { kind: "click", observation: "o", reference: "r", count: 2 }, true, true);
add("click refuses a count of 0", { kind: "click", observation: "o", reference: "r", count: 0 }, false, false);
add("click refuses a count of 3", { kind: "click", observation: "o", reference: "r", count: 3 }, false, false);
add("click accepts the right button", { kind: "click", observation: "o", reference: "r", button: "right" }, true, true);
add("click refuses an unknown button", { kind: "click", observation: "o", reference: "r", button: "side" }, false, false);
add("click refuses an empty observation", { kind: "click", observation: "", reference: "r" }, false, false);
add("click accepts a 128 byte observation", { kind: "click", observation, reference: "r" }, true, true);
add("click refuses a 129 byte observation", { kind: "click", observation: token(129), reference: "r" }, false, false);
add("click needs an observation", { kind: "click", reference: "r" }, false, false);

add("hover accepts a point inside the window", { kind: "hover", observation: "o", x: 639, y: 479 }, true, true);
add("hover refuses a point below the window", { kind: "hover", observation: "o", x: 1, y: 480 }, false, true, "default", "The daemon checks the window bounds; the host checks only that the numbers are finite.");
add("hover needs both coordinates", { kind: "hover", observation: "o", x: 1 }, false, false);

add("drag accepts two points inside the window", { kind: "drag", observation: "o", from_x: 1, from_y: 1, to_x: 600, to_y: 400 }, true, true);
add("drag refuses an end outside the window", { kind: "drag", observation: "o", from_x: 1, from_y: 1, to_x: 700, to_y: 400 }, false, true, "default", "The daemon checks the window bounds; the host checks only that the numbers are finite.");
add("drag needs all four coordinates", { kind: "drag", observation: "o", from_x: 1, from_y: 1, to_x: 2 }, false, false);

add("scroll accepts 20000", { kind: "scroll", observation: "o", x: 1, y: 1, dx: 20000, dy: -20000 }, true, true);
add("scroll refuses 20001", { kind: "scroll", observation: "o", x: 1, y: 1, dx: 0, dy: 20001 }, false, false);
add("scroll refuses -20001", { kind: "scroll", observation: "o", x: 1, y: 1, dx: -20001, dy: 0 }, false, false);
add("scroll needs a distance", { kind: "scroll", observation: "o", x: 1, y: 1, dx: 0 }, false, false);
add("scroll refuses a point outside the window", { kind: "scroll", observation: "o", x: 900, y: 1, dx: 0, dy: 1 }, false, true, "default", "The daemon checks the window bounds; the host checks only that the numbers are finite.");

add("type accepts text", { kind: "type", observation: "o", text: "Hello" }, true, true);
add("type refuses empty text", { kind: "type", observation: "o", text: "" }, false, false);
add("type accepts 16384 bytes", { kind: "type", observation: "o", text: token(16384) }, true, true);
add("type refuses 16385 bytes", { kind: "type", observation: "o", text: token(16385) }, false, false);
add("type counts bytes, not characters", { kind: "type", observation: "o", text: accent.repeat(8192) }, true, true);
add("type counts bytes, not characters (over)", { kind: "type", observation: "o", text: accent.repeat(8193) }, false, false);
add("type accepts a reference", { kind: "type", observation: "o", text: "x", reference: "r" }, true, true);
add("type refuses an empty reference", { kind: "type", observation: "o", text: "x", reference: "" }, false, false);
add("type refuses a 129 byte reference", { kind: "type", observation: "o", text: "x", reference: token(129) }, false, false);

add("key accepts a combination", { kind: "key", observation: "o", key: "Cmd+a" }, true, true);
add("key refuses an empty key", { kind: "key", observation: "o", key: "" }, false, false);
add("key accepts 128 bytes", { kind: "key", observation: "o", key: token(128) }, true, true);
add("key refuses 129 bytes", { kind: "key", observation: "o", key: token(129) }, false, false);

add("handoff accepts the handoff window", { kind: "grok_bot_connection", observation: "o", reference: "r" }, true, true, "grok_bot");
add("handoff refuses any other window", { kind: "grok_bot_connection", observation: "o", reference: "r" }, false, true, "default", "Only the daemon knows which window is selected.");
add("handoff refuses an empty reference", { kind: "grok_bot_connection", observation: "o", reference: "" }, false, false, "grok_bot");

writeFileSync(new URL("../contract/fixtures.json", import.meta.url), `${JSON.stringify({ protocol: 1, targets, cases }, null, 2)}\n`);
console.log(`${cases.length} cases`);
