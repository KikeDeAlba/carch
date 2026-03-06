import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildCreateCommand } from './commands/create/index.js';
import { buildConfigCommand } from './commands/config/index.js';
import { buildListCommand } from './commands/list/index.js';

function loadPackageJson() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageJsonPath = join(__dirname, '../package.json');
  return JSON.parse(readFileSync(packageJsonPath, 'utf8'));
}

export function buildProgram() {
  const packageJson = loadPackageJson();
  const program = new Command();

  program
    .name('carch')
    .description(packageJson.description)
    .version(packageJson.version, '-v, --version', 'display version number')
    .option('-d, --debug', 'enable debug mode')
    .option('--no-color', 'disable colored output')
    .hook('preAction', (thisCommand) => {
      if (thisCommand.opts().debug) {
        console.log(chalk.yellow('Debug mode enabled'));
      }
    });

  program.addCommand(buildCreateCommand());
  program.addCommand(buildConfigCommand());
  program.addCommand(buildListCommand());

  program.on('command:*', (operands) => {
    console.error(chalk.red(`Unknown command: ${operands[0]}`));
    console.log('Run "carch --help" for available commands.');
    process.exit(1);
  });

  return program;
}
