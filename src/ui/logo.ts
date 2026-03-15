/** ANSI: magenta/pink (similar to Commitah style) */
const PINK = "\x1b[35m";
const RESET = "\x1b[0m";

/** ASCII art banner — ReviuAh in block style. */
const BANNER = `
${PINK}  ____  ______  _   _ _    _    _   _ 
 |  _ \\|  ____|| | | | |  / \\  | | | |
 | |_) | |__   | | | | | / _ \\ | | | |
 |  _ <|  __|  | | | | |/ ___ \\| | | |__
 | |_) | |____ | |_| | |  \\/   \\  \\ \\  /
 |____/|______| \\___/|_|\\_/ \\_/ \\___/ ${RESET}
`;

export function printBanner(): void {
  if (process.stderr.isTTY) {
    process.stderr.write(BANNER);
  }
}
