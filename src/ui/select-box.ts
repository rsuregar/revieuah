const CYAN = "\x1b[36m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

const FOOTER = `${DIM}↑↓: Navigate | Enter: Confirm | Esc: Cancel${RESET}`;

function drawBox(
  out: NodeJS.WriteStream,
  title: string,
  choices: string[],
  selectedIndex: number,
  width: number,
): number {
  const line = "─".repeat(width);
  out.write(`│ ${BOLD}${title}${RESET}${" ".repeat(Math.max(0, width - title.length - 2))}│\n`);
  out.write(`│${" ".repeat(width)}│\n`);

  choices.forEach((choice, i) => {
    const isSelected = i === selectedIndex;
    const prefix = isSelected ? `${CYAN}●${RESET} ` : "○ ";
    const pad = " ".repeat(Math.max(0, width - choice.length - 4));
    out.write(`│ ${prefix}${choice}${pad}│\n`);
  });

  out.write(`│${" ".repeat(width)}│\n`);
  out.write(`└${line}┘\n`);
  out.write(`\n${FOOTER}`);
  return 4 + choices.length + 2;
}

/**
 * Bordered select list (like "Select Commit Message").
 * Returns selected value or defaultValue on Esc.
 */
export function selectBox(
  title: string,
  choices: string[],
  defaultValue: string,
): Promise<string> {
  const stdin = process.stdin;
  const stderr = process.stderr;

  if (!stdin.isTTY || !stderr.isTTY) {
    return Promise.resolve(defaultValue);
  }

  const defaultIndex = Math.max(
    0,
    choices.findIndex((c) => c === defaultValue),
  );
  let selectedIndex = defaultIndex >= 0 ? defaultIndex : 0;
  const width = Math.min(
    52,
    Math.max(title.length + 4, ...choices.map((c) => c.length + 6)),
  );

  return new Promise((resolve) => {
    let totalLines = 0;
    let buffer = "";

    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onKey);
      stderr.write("\x1b[?25h");
    };

    const finish = (value: string) => {
      cleanup();
      stderr.write("\n");
      resolve(value);
    };

    const render = () => {
      stderr.write("\x1b[?25l");
      if (totalLines > 0) {
        stderr.moveCursor(0, -totalLines);
        stderr.write("\x1b[J");
      }
      stderr.write("┌" + "─".repeat(width) + "┐\n");
      totalLines = drawBox(stderr, title, choices, selectedIndex, width) + 1;
      stderr.write("\x1b[?25h");
    };

    const onKey = (ch: string) => {
      buffer += ch;
      const done = () => {
        buffer = "";
      };

      if (buffer === "\r" || buffer === "\n") {
        finish(choices[selectedIndex] ?? defaultValue);
        return;
      }
      if (buffer === "\u001b") {
        return;
      }
      if (buffer.startsWith("\u001b[")) {
        if (buffer.endsWith("A")) {
          selectedIndex = selectedIndex <= 0 ? choices.length - 1 : selectedIndex - 1;
          render();
          done();
        } else if (buffer.endsWith("B")) {
          selectedIndex = selectedIndex >= choices.length - 1 ? 0 : selectedIndex + 1;
          render();
          done();
        } else if (buffer.length > 4) {
          done();
        }
        return;
      }
      if (buffer === "\u001b" && ch !== "[" && ch !== "\\") {
        finish(choices[selectedIndex] ?? defaultValue);
        return;
      }
      if (buffer.length > 1 && !buffer.startsWith("\u001b")) buffer = ch;
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    stdin.on("data", onKey);

    render();
  });
}
