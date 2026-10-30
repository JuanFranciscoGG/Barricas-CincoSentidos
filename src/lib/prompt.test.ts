// Run with: npm test
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { createPrompter } from "./prompt";

function setup() {
  const input = new PassThrough();
  let out = "";
  const prompter = createPrompter(input, { write: (t) => void (out += t) });
  return { input, prompter, output: () => out };
}

describe("terminal prompter", () => {
  it("reads consecutive answers, even when several lines arrive at once", async () => {
    const { input, prompter } = setup();
    input.write("prueba\rAna Pérez\r");
    assert.equal(await prompter.ask("Usuario: "), "prueba");
    assert.equal(await prompter.ask("Nombre: "), "Ana Pérez");
    prompter.close();
  });

  it("keeps an exact role value, trims spaces and accepts both line endings", async () => {
    const { input, prompter } = setup();
    input.write("  owner_admin  \r\n");
    assert.equal(await prompter.ask("Rol: "), "owner_admin");
    prompter.close();
  });

  it("waits for typing that arrives later and honours backspace", async () => {
    const { input, prompter } = setup();
    const answer = prompter.ask("Rol: ");
    setTimeout(() => input.write("owner_adminX\u007f\r"), 10);
    assert.equal(await answer, "owner_admin");
    prompter.close();
  });

  it("never echoes a hidden answer and ignores arrow-key sequences", async () => {
    const { input, prompter, output } = setup();
    input.write("s3cret-pass\u001b[D\u001b[C\r");
    assert.equal(await prompter.askHidden("Clave: "), "s3cret-pass");
    assert.ok(!output().includes("s3cret"));
    prompter.close();
  });

  it("stops on Ctrl+C", async () => {
    const { input, prompter } = setup();
    input.write("ab\u0003");
    await assert.rejects(() => prompter.ask("Usuario: "), /Cancelado/);
    prompter.close();
  });
});
