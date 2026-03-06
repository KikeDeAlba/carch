import { Command } from 'commander';
import chalk from 'chalk';
import {
  getDefaultCarchConfig,
  readCarchConfig,
  setCarchAsyncMode,
  setCarchOrm,
  writeCarchConfig,
} from '../../utils/carch-config.js';

function printConfig(config) {
  console.log(JSON.stringify(config, null, 2));
}

export function buildConfigCommand() {
  const command = new Command('config').description('Manage carch project config');

  command
    .command('init')
    .description('Create a .carch config file with defaults')
    .option('--project-root <path>', 'project root path', process.cwd())
    .action((options) => {
      const filePath = writeCarchConfig(
        getDefaultCarchConfig(),
        options.projectRoot,
      );
      console.log(chalk.green(`Config written at ${filePath}`));
    });

  command
    .command('set')
    .description('Set a config key')
    .argument(
      '<key>',
      'config key (supported: asyncMode, async-mode, async, orm)',
    )
    .argument('<value>', 'config value')
    .option('--project-root <path>', 'project root path', process.cwd())
    .action((key, value, options) => {
      const normalizedKey = String(key).trim().toLowerCase();
      if (
        normalizedKey === 'asyncmode' ||
        normalizedKey === 'async-mode' ||
        normalizedKey === 'async'
      ) {
        try {
          const result = setCarchAsyncMode(value, options.projectRoot);
          console.log(chalk.green(`Config updated at ${result.filePath}`));
          printConfig(result.config);
          return;
        } catch (error) {
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      }

      if (normalizedKey === 'orm') {
        try {
          const result = setCarchOrm(value, options.projectRoot);
          console.log(chalk.green(`Config updated at ${result.filePath}`));
          printConfig(result.config);
          return;
        } catch (error) {
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      }

      console.error(chalk.red(`Unsupported config key: ${key}`));
      process.exit(1);
    });

  command
    .command('get')
    .description('Read config or a single key')
    .argument('[key]', 'optional config key')
    .option('--project-root <path>', 'project root path', process.cwd())
    .action((key, options) => {
      try {
        const { config, exists, filePath } = readCarchConfig(options.projectRoot);
        if (!exists) {
          console.log(chalk.yellow(`No .carch found at ${filePath}. Using defaults.`));
        }

        if (!key) {
          printConfig(config);
          return;
        }

        const normalizedKey = String(key).trim().toLowerCase();
        if (
          normalizedKey === 'asyncmode' ||
          normalizedKey === 'async-mode' ||
          normalizedKey === 'async'
        ) {
          console.log(config.asyncMode);
          return;
        }

        if (normalizedKey === 'orm') {
          console.log(config.orm);
          return;
        }

        console.error(chalk.red(`Unsupported config key: ${key}`));
        process.exit(1);
      } catch (error) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  return command;
}
