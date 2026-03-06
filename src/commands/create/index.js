import { Command } from 'commander';
import { buildCreateControllerCommand } from './subcommands/controller.js';
import { buildCreateUseCaseCommand } from './subcommands/use-case.js';
import { buildCreateEntityCommand } from './subcommands/entity.js';

export function buildCreateCommand() {
  const command = new Command('create');
  command.description('Generate clean architecture resources');
  command.addCommand(buildCreateControllerCommand());
  command.addCommand(buildCreateUseCaseCommand());
  command.addCommand(buildCreateEntityCommand());
  return command;
}
