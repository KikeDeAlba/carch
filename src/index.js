#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get package.json using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

// Import command modules
import initCommand from './commands/init.js';

const program = new Command();

// CLI setup
program
  .name('carch')
  .description(packageJson.description)
  .version(packageJson.version, '-v, --version', 'display version number');

// Global options
program
  .option('-d, --debug', 'enable debug mode')
  .option('--no-color', 'disable colored output')
  .hook('preAction', (thisCommand, actionCommand) => {
    if (thisCommand.opts().debug) {
      console.log(chalk.yellow('Debug mode enabled'));
    }
  });

// Register commands
program.addCommand(initCommand);

// Handle unknown commands
program.on('command:*', function (operands) {
  console.error(chalk.red(`Unknown command: ${operands[0]}`));
  console.log('Run "carch --help" for available commands.');
  process.exit(1);
});

// Parse command line arguments
program.parse();

// If no command was provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
