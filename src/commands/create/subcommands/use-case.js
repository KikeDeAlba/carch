import { Command } from 'commander';
import chalk from 'chalk';
import { generateUseCaseResource } from '../../../generators/use-case.generator.js';

export function buildCreateUseCaseCommand() {
  return new Command('use-case')
    .description('Create domain and application use-case structure')
    .argument('<context>', 'bounded context (e.g. user, auth)')
    .argument('<name>', 'use-case name (e.g. create-user)')
    .option('--src-root <path>', 'source root for generated files', 'src')
    .option('--test-path <path>', 'base path for mirrored tests', 'test')
    .option('--no-spec', 'skip use-case spec file generation')
    .action(async (context, name, options) => {
      try {
        const output = await generateUseCaseResource(context, name, options);
        console.log(chalk.green(`Use-case generated at ${output}`));
      } catch (error) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });
}
