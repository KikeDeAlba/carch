import { Command } from 'commander';
import chalk from 'chalk';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

function walkFiles(dirPath, visitor) {
  const entries = readdirSync(dirPath);
  for (const entry of entries) {
    const absolutePath = join(dirPath, entry);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      walkFiles(absolutePath, visitor);
      continue;
    }
    visitor(absolutePath);
  }
}

function collectEntities(srcRoot) {
  const domainRoot = join(srcRoot, 'domain');
  if (!existsSync(domainRoot)) {
    return [];
  }

  const entities = [];

  walkFiles(domainRoot, (filePath) => {
    if (!filePath.endsWith('.entity.ts')) {
      return;
    }

    const rel = relative(domainRoot, filePath).replace(/\\/g, '/');
    const parts = rel.split('/');

    if (
      parts.length < 4 ||
      parts[1] !== 'interfaces' ||
      parts[2] !== 'entities'
    ) {
      return;
    }

    entities.push({
      context: parts[0],
      entity: parts[3].replace('.entity.ts', ''),
      path: filePath,
    });
  });

  return entities.sort((a, b) => {
    const keyA = `${a.context}/${a.entity}`;
    const keyB = `${b.context}/${b.entity}`;
    return keyA.localeCompare(keyB);
  });
}

export function buildListEntitiesCommand() {
  return new Command('entities')
    .description('List entities found in src/domain/*/interfaces/entities')
    .option('--src-root <path>', 'source root for project files', 'src')
    .option('--json', 'print output as JSON')
    .action((options) => {
      try {
        const srcRoot = resolve(process.cwd(), options.srcRoot);
        const entities = collectEntities(srcRoot);

        if (options.json) {
          console.log(JSON.stringify(entities, null, 2));
          return;
        }

        if (entities.length === 0) {
          console.log(chalk.yellow('No entities found.'));
          return;
        }

        for (const item of entities) {
          console.log(`${item.context}/${item.entity} -> ${item.path}`);
        }
      } catch (error) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });
}
