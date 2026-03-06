import { Command } from 'commander';
import { buildListEntitiesCommand } from './subcommands/entities.js';

export function buildListCommand() {
  const command = new Command('list');
  command.description('List existing resources in the project');
  command.addCommand(buildListEntitiesCommand());
  return command;
}
