import { readFileSync } from "node:fs";

export const spec = JSON.parse(readFileSync(new URL("./contract/spec.json", import.meta.url), "utf8"));

const encoder = new TextEncoder();
const bytes = (text) => encoder.encode(text).length;
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const isInteger = (value, min, max) => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
const isText = (value) => typeof value === "string";
const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const within = (text, limit) => text.length > 0 && bytes(text) <= limit;
const absent = (value) => value === undefined || value === null;

const SHAPES = {
  status: { required: {}, optional: {} },
  apps: { required: {}, optional: {} },
  windows: { required: { bundle_id: isText }, optional: {} },
  select: { required: { bundle_id: isText }, optional: { window_id: (value) => isInteger(value, 0, 4294967295) } },
  snapshot: { required: {}, optional: {} },
  screenshot: { required: {}, optional: { max_dimension: (value) => isInteger(value, 0, 65535) } },
  click: {
    required: { observation: isText },
    optional: { reference: isText, x: isNumber, y: isNumber, button: (value) => spec.buttons.includes(value), count: (value) => isInteger(value, 0, 255) },
  },
  hover: { required: { observation: isText, x: isNumber, y: isNumber }, optional: {} },
  drag: { required: { observation: isText, from_x: isNumber, from_y: isNumber, to_x: isNumber, to_y: isNumber }, optional: {} },
  scroll: { required: { observation: isText, x: isNumber, y: isNumber, dx: isNumber, dy: isNumber }, optional: {} },
  type: { required: { observation: isText, text: isText }, optional: { reference: isText } },
  key: { required: { observation: isText, key: isText }, optional: {} },
  grok_bot_connection: { required: { observation: isText, reference: isText }, optional: {} },
  stop: { required: {}, optional: {} },
};

function parses(operation) {
  if (!isObject(operation) || !isText(operation.kind)) return false;
  const shape = SHAPES[operation.kind];
  if (shape === undefined) return false;
  const allowed = new Set(["kind", ...Object.keys(shape.required), ...Object.keys(shape.optional)]);
  if (Object.keys(operation).some((key) => !allowed.has(key))) return false;
  for (const [key, check] of Object.entries(shape.required)) {
    if (!check(operation[key])) return false;
  }
  for (const [key, check] of Object.entries(shape.optional)) {
    if (!absent(operation[key]) && !check(operation[key])) return false;
  }
  return true;
}

function insideWindow(target, x, y) {
  return target !== null && target !== undefined && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && y >= 0 && x < target.width && y < target.height;
}

export function daemonAccepts(operation, target) {
  if (!parses(operation)) return false;
  const limits = spec.limits;
  if (spec.input_operations.includes(operation.kind) && !within(operation.observation, limits.observation_bytes)) return false;
  switch (operation.kind) {
    case "windows":
      return within(operation.bundle_id, limits.bundle_id_bytes);
    case "select":
      return within(operation.bundle_id, limits.bundle_id_bytes) && operation.window_id !== 0;
    case "screenshot":
      return absent(operation.max_dimension) || (operation.max_dimension >= limits.screenshot_dimension.min && operation.max_dimension <= limits.screenshot_dimension.max);
    case "click": {
      const count = absent(operation.count) ? 1 : operation.count;
      if (count < limits.click_count.min || count > limits.click_count.max) return false;
      const hasReference = !absent(operation.reference);
      const hasPoint = !absent(operation.x) || !absent(operation.y);
      if (hasReference && !hasPoint) return within(operation.reference, limits.reference_bytes);
      if (!hasReference && !absent(operation.x) && !absent(operation.y)) return insideWindow(target, operation.x, operation.y);
      return false;
    }
    case "hover":
      return insideWindow(target, operation.x, operation.y);
    case "scroll":
      return insideWindow(target, operation.x, operation.y) && Math.abs(operation.dx) <= limits.scroll_distance && Math.abs(operation.dy) <= limits.scroll_distance;
    case "drag":
      return insideWindow(target, operation.from_x, operation.from_y) && insideWindow(target, operation.to_x, operation.to_y);
    case "type":
      return within(operation.text, limits.text_bytes) && (absent(operation.reference) || within(operation.reference, limits.reference_bytes));
    case "key":
      return within(operation.key, limits.key_bytes);
    case "grok_bot_connection":
      return within(operation.reference, limits.reference_bytes) && target !== null && target !== undefined && target.bundle_id === spec.grok_bot_bundle_id;
    default:
      return true;
  }
}

function hostPoint(operation, x, y) {
  return isNumber(operation[x]) && isNumber(operation[y]);
}

export function hostAccepts(operation) {
  if (!isObject(operation) || !isText(operation.kind) || !spec.operations.includes(operation.kind)) return false;
  const limits = spec.limits;
  if (spec.input_operations.includes(operation.kind) && !(isText(operation.observation) && within(operation.observation, limits.observation_bytes))) return false;
  switch (operation.kind) {
    case "windows":
    case "select": {
      if (!(isText(operation.bundle_id) && within(operation.bundle_id, limits.bundle_id_bytes))) return false;
      return absent(operation.window_id) || isInteger(operation.window_id, limits.window_id.min, limits.window_id.max);
    }
    case "screenshot":
      return absent(operation.max_dimension) || isInteger(operation.max_dimension, limits.screenshot_dimension.min, limits.screenshot_dimension.max);
    case "click": {
      const button = isText(operation.button) ? operation.button : "left";
      const count = typeof operation.count === "number" ? operation.count : 1;
      if (!spec.buttons.includes(button) || count < limits.click_count.min || count > limits.click_count.max || !Number.isInteger(count)) return false;
      if (isText(operation.reference)) return within(operation.reference, limits.reference_bytes);
      return hostPoint(operation, "x", "y");
    }
    case "hover":
      return hostPoint(operation, "x", "y");
    case "scroll":
      return hostPoint(operation, "x", "y") && isNumber(operation.dx) && isNumber(operation.dy) && Math.abs(operation.dx) <= limits.scroll_distance && Math.abs(operation.dy) <= limits.scroll_distance;
    case "drag":
      return hostPoint(operation, "from_x", "from_y") && hostPoint(operation, "to_x", "to_y");
    case "type":
      return isText(operation.text) && within(operation.text, limits.text_bytes) && !(isText(operation.reference) && !within(operation.reference, limits.reference_bytes));
    case "grok_bot_connection":
      return isText(operation.reference) && within(operation.reference, limits.reference_bytes);
    case "key":
      return isText(operation.key) && within(operation.key, limits.key_bytes);
    default:
      return true;
  }
}
