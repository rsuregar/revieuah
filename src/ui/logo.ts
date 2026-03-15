const PINK = "\x1b[35m";
const RESET = "\x1b[0m";

const BANNER = `
${PINK}  _____            _                  _     _
 |  __ \\          (_)           /\\   | |   | |
 | |__) |_____   ___ _   _     /  \\  | |__ | |
 |  _  // _ \\ \\ / / | | | |   / /\\ \\ | '_ \\| |
 | | \\ \\  __/\\ V /| | |_| |  / ____ \\| | | |_|
 |_|  \\_\\___| \\_/ |_|\\__,_| /_/    \\_\\_| |_(_)${RESET}
`;

export function printBanner(): void {
  if (process.stderr.isTTY) {
    process.stderr.write(BANNER);
  }
}
