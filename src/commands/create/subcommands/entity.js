import { Command } from 'commander';
import chalk from 'chalk';
import { generateEntityResource } from '../../../generators/entity.generator.js';

export function buildCreateEntityCommand() {
  return new Command('entity')
    .description('Create a domain entity and persistence repository implementation')
    .argument('<context>', 'bounded context (e.g. user, auth)')
    .argument('<name>', 'entity name (e.g. customer, order-item)')
    .option('--src-root <path>', 'source root for generated files', 'src')
    .option('--test-path <path>', 'base path for mirrored tests', 'test')
    .option('--no-spec', 'skip use-case spec file generation')
    .option('-c, --with-controller', 'also create a CRUD controller for the entity')
    .option('--api-path <path>', 'base path for generated controllers', 'src/api')
    .action(async (context, name, options) => {
      try {
        const output = await generateEntityResource(context, name, options);
        console.log(chalk.green(`Entity generated at ${output}`));
      } catch (error) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });
}
