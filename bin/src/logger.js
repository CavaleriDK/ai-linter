import chalk from 'chalk';

export class Logger {
  static #verbose = false;
  static #prefix = 'AI-Linter';

  static setVerbose(verbose) {
    this.#verbose = verbose;
  }

  static setPrefix(prefix) {
    this.#prefix = prefix;
  }

  static log(message, type = 'info') {
    if (!this.#verbose && type === 'debug') return;

    const colors = {
      info: chalk.blue,
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      debug: chalk.gray
    };

    console.log(colors[type](`[${this.#prefix}] ${message}`));
  }

  static info(message) {
    this.log(message, 'info');
  }

  static success(message) {
    this.log(message, 'success');
  }

  static warning(message) {
    this.log(message, 'warning');
  }

  static error(message) {
    this.log(message, 'error');
  }

  static debug(message) {
    this.log(message, 'debug');
  }
}
