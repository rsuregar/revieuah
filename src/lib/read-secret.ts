import * as readline from "node:readline/promises";
import { createInterface } from "node:readline";

/**
 * Reads a line without echoing characters (TTY). Falls back to visible input if raw mode fails.
 */
export async function readSecretLine(prompt: string): Promise<string> {
  const stdin = process.stdin;
  const stdout = process.stdout;

  if (!stdin.isTTY) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    try {
      stdout.write(`${prompt}(piped input — key will be visible)\n`);
      return (await rl.question("API key: ")).trim();
    } finally {
      rl.close();
    }
  }

  return new Promise((resolve, reject) => {
    stdout.write(prompt);
    try {
      stdin.setRawMode(true);
    } catch {
      stdin.setRawMode(false);
      const rl = createInterface({ input: stdin, output: stdout });
      rl.question("API key (visible): ", (answer: string) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    stdin.resume();
    stdin.setEncoding("utf8");
    let secret = "";

    const onData = (ch: string) => {
      if (ch === "\n" || ch === "\r" || ch === "\u0004") {
        cleanup();
        stdout.write("\n");
        resolve(secret);
        return;
      }
      if (ch === "\u0003") {
        cleanup();
        process.exit(0);
      }
      if (ch === "\u007f" || ch === "\b") {
        if (secret.length) {
          secret = secret.slice(0, -1);
          stdout.write("\b \b");
        }
        return;
      }
      secret += ch;
      stdout.write("*");
    };

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
    };

    stdin.on("data", onData);
    stdin.on("error", (err) => {
      cleanup();
      reject(err);
    });
  });
}
