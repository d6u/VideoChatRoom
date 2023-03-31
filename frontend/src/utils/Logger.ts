import chalk, { BackgroundColorName, ChalkInstance } from "chalk";
import { customAlphabet } from "nanoid";

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

const bgColor = bgColors[
  Math.floor(Math.random() * bgColors.length)
] as BackgroundColorName;

export default class Logger {
  private static maxLabelLength = 0;
  private bgColor: BackgroundColorName;
  private idColor: ChalkInstance;
  private labelColor: ChalkInstance;
  private id: string;
  private label: string;

  constructor(label: string) {
    Logger.maxLabelLength = Math.max(Logger.maxLabelLength, label.length);

    this.bgColor = bgColors[
      Math.floor(Math.random() * bgColors.length)
    ] as BackgroundColorName;
    this.idColor = chalk.whiteBright[bgColor];
    this.labelColor = chalk.whiteBright[this.bgColor];
    this.label = label;
    this.id = nanoid();
  }

  getLabel() {
    return this.label.padEnd(Logger.maxLabelLength, " ");
  }

  debug(...args: any[]) {
    const id = this.idColor(`[${this.id}]`);
    const label = this.labelColor(` ${this.getLabel()} `);
    console.debug(`${id} ${label}\t`, ...args);
  }
  log(...args: any[]) {
    const id = this.idColor.bold(`[${this.id}]`);
    const label = this.labelColor.bold(` ${this.getLabel()} `);
    console.log(`${id} ${label}\t`, ...args);
  }
  info(...args: any[]) {
    const id = this.idColor.bold.underline(`[${this.id}]`);
    const label = this.labelColor.bold.underline(` ${this.getLabel()} `);
    console.info(`${id} ${label}\t`, ...args);
  }
  warn(...args: any[]) {
    console.warn(`[${this.id}] ${this.getLabel()}\t`, ...args);
  }
  error(...args: any[]) {
    console.error(`[${this.id}] ${this.getLabel()}\t`, ...args);
  }

  trace(...args: any[]) {
    const id = this.idColor.bold(`[${this.id}]`);
    const label = this.labelColor.bold(` ${this.getLabel()} `);
    console.trace(`${id} ${label}\t`, ...args);
  }
}
