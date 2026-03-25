// Simple ANSI color codes (no external dependency needed)
const colors = {
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
};

let verbose = false;

export function setVerbose(v: boolean): void {
  verbose = v;
}

export function info(msg: string): void {
  console.log(colors.blue('ℹ'), msg);
}

export function success(msg: string): void {
  console.log(colors.green('✔'), msg);
}

export function warn(msg: string): void {
  console.log(colors.yellow('⚠'), msg);
}

export function error(msg: string): void {
  console.error(colors.red('✖'), msg);
}

export function progress(msg: string): void {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(`${colors.blue('ℹ')} ${msg}`);
}

export function progressEnd(msg: string): void {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  console.log(colors.blue('ℹ'), msg);
}

export function debug(msg: string): void {
  if (verbose) {
    console.log(colors.gray('  →'), colors.gray(msg));
  }
}
