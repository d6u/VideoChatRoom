import { customAlphabet } from "nanoid";
import chalk from "chalk";
const nanoid = customAlphabet("1234567890abcdef", 5);

const bgColors = [
  "bgBlack",
  "bgRed",
  "bgGreen",
  "bgYellow",
  "bgBlue",
  "bgMagenta",
  "bgCyan",
  // "bgBlackBright",
  // "bgRedBright",
  // "bgGreenBright",
  // "bgYellowBright",
  // "bgBlueBright",
  // "bgMagentaBright",
  // "bgCyanBright",
];

const bgColor = bgColors[Math.floor(Math.random() * bgColors.length)];

export default class Logger {
  constructor(label) {
    this.bgColor = bgColors[Math.floor(Math.random() * bgColors.length)];
    this.idColor = chalk.whiteBright[bgColor];
    this.labelColor = chalk.whiteBright[this.bgColor];
    this.label = label;
    this.id = nanoid();
  }

  debug(...args) {
    const id = this.idColor(`[${this.id}]`);
    const label = this.labelColor(` ${this.label} `);
    console.debug(`${id} ${label}\t`, ...args);
  }
  log(...args) {
    const id = this.idColor.bold(`[${this.id}]`);
    const label = this.labelColor.bold(` ${this.label} `);
    console.log(`${id} ${label}\t`, ...args);
  }
  info(...args) {
    const id = this.idColor.bold.underline(`[${this.id}]`);
    const label = this.labelColor.bold.underline(` ${this.label} `);
    console.info(`${id} ${label}\t`, ...args);
  }
  warn(...args) {
    console.warn(`[${this.id}] ${this.label}\t`, ...args);
  }
  error(...args) {
    console.error(`[${this.id}] ${this.label}\t`, ...args);
  }

  trace(...args) {
    const id = this.idColor.bold(`[${this.id}]`);
    const label = this.labelColor.bold(` ${this.label} `);
    console.trace(`${id} ${label}\t`, ...args);
  }
}
