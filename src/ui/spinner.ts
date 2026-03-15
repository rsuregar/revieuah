const FRAMES = ["  ", ". ", "..", "..."];
const INTERVAL_MS = 400;

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Start an animated "Reviewing..." message on stderr. Returns a function to stop and clear.
 */
export function startSpinner(message: string): () => void {
  if (!process.stderr.isTTY) {
    process.stderr.write(`${message}\n`);
    return () => {};
  }

  let i = 0;
  const write = () => {
    const frame = FRAMES[i % FRAMES.length];
    process.stderr.write(`\r${message}${frame}   `);
    i++;
  };

  write();
  timer = setInterval(write, INTERVAL_MS);

  return () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    process.stderr.write("\r" + " ".repeat(message.length + 6) + "\r");
  };
}
