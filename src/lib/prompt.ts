// Tiny terminal prompter for the maintenance scripts (prisma/users.ts). One shared reader keeps whatever
// was typed ahead (or pasted) for the next question, and a hidden prompt shows `*` instead of the characters.
interface Input {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => unknown;
  setEncoding(encoding: BufferEncoding): unknown;
  on(event: "data", listener: (chunk: string) => void): unknown;
  off(event: "data", listener: (chunk: string) => void): unknown;
  resume(): unknown;
  pause(): unknown;
}
interface Output {
  write(text: string): unknown;
}

export class PromptCancelled extends Error {}

export function createPrompter(input: Input, output: Output) {
  let buffer = "";
  let wake: (() => void) | null = null;
  const onData = (chunk: string) => {
    buffer += chunk;
    wake?.();
  };
  input.setEncoding("utf8");
  input.on("data", onData);
  input.setRawMode?.(true);
  input.resume();

  async function readLine(prompt: string, hidden = false): Promise<string> {
    output.write(prompt);
    let value = "";
    for (;;) {
      while (buffer.length > 0) {
        const ch = buffer[0];
        buffer = buffer.slice(1);
        if (ch === "\r" || ch === "\n") {
          if (ch === "\r" && buffer[0] === "\n") buffer = buffer.slice(1);
          output.write("\n");
          return value;
        }
        if (ch === "\u0003") throw new PromptCancelled("Cancelado.");
        if (ch === "\u007f" || ch === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            if (!hidden) output.write("\b \b");
          }
          continue;
        }
        if (ch === "\u001b") {
          buffer = buffer.replace(/^\[[0-9;]*[A-Za-z~]/, ""); // arrow keys and friends
          continue;
        }
        if (ch < " ") continue;
        value += ch;
        output.write(hidden ? "*" : ch);
      }
      await new Promise<void>((resolve) => (wake = resolve));
    }
  }

  return {
    ask: async (prompt: string) => (await readLine(prompt)).trim(),
    askHidden: (prompt: string) => readLine(prompt, true),
    close() {
      input.off("data", onData);
      input.setRawMode?.(false);
      input.pause();
    },
  };
}
