/** ANSI: magenta/pink (similar to Commitah style) */
const PINK = "\x1b[35m";
const RESET = "\x1b[0m";

/** ASCII banner: clearly reads "REVIUAH" (no block letters to avoid misread). */
const BANNER = `
${PINK}  +-------------+
  |  REVIUAH   |
  +-------------+${RESET}
`;

export function printBanner(): void {
  if (process.stderr.isTTY) {
    process.stderr.write(BANNER);
  }
}
