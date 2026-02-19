const chalk = require('chalk');

const ts = () => new Date().toISOString().slice(11, 23);

const logger = {
  info:  (msg) => console.log(chalk.cyan(`[${ts()}] INFO  `) + msg),
  ok:    (msg) => console.log(chalk.green(`[${ts()}] OK    `) + msg),
  warn:  (msg) => console.log(chalk.yellow(`[${ts()}] WARN  `) + msg),
  error: (msg) => console.log(chalk.red(`[${ts()}] ERROR `) + msg),
  cmd:   (player, cmd) =>
    console.log(
      chalk.bold(`[${ts()}] CMD   `) +
      (player === 1 ? chalk.cyan(`P1`) : chalk.red(`P2`)) +
      ` → ${chalk.white(cmd)}`
    ),
};

module.exports = logger;
