import { Command } from 'commander';
import chalk from 'chalk';
import { generateControllerResource } from '../../../generators/controller.generator.js';

export function buildCreateControllerCommand() {
  return new Command('controller')
    .description('Create controller files and folder structure')
    .argument('<name>', 'controller name')
    .option('-b, --base-path <path>', 'base path for api resources', 'src/api')
    .option('--src-root <path>', 'source root for shared files', 'src')
    .option('--test-path <path>', 'base path for mirrored tests', 'test')
    .option('--no-spec', 'skip controller spec file generation')
    .action(async (name, options) => {
      try {
        const outputDir = await generateControllerResource(name, options);
        console.log(chalk.green(`Controller generated at ${outputDir}`));
      } catch (error) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });
}
