import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestNextOperation } from "./operation-catalog";

const catalog = [
  { id: "sel", category: "initial" },
  { id: "fill", category: "initial" },
  { id: "tasting", category: "recurring" },
  { id: "topup", category: "recurring" },
  { id: "racking", category: "conditional" },
  { id: "end", category: "final" },
  { id: "bottling", category: "final" },
];

test("empty history suggests the first type", () => {
  assert.equal(suggestNextOperation(catalog, []), "sel");
});

test("moves to the next step, skipping conditional types", () => {
  assert.equal(suggestNextOperation(catalog, ["fill", "sel"]), "tasting");
  assert.equal(suggestNextOperation(catalog, ["tasting", "fill"]), "topup");
});

test("recurring loop restarts after the last recurring step", () => {
  assert.equal(suggestNextOperation(catalog, ["topup", "tasting", "fill"]), "tasting");
  assert.equal(suggestNextOperation(catalog, ["racking", "topup"]), "tasting");
});

test("skipped stages are fine: suggestion follows the last operation", () => {
  assert.equal(suggestNextOperation(catalog, ["fill"]), "tasting");
});

test("no suggestion after a final operation or for a retired type", () => {
  assert.equal(suggestNextOperation(catalog, ["end"]), null);
  assert.equal(suggestNextOperation(catalog, ["gone"]), null);
});
