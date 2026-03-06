import { dirname, join, relative } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import ts from 'typescript';

function normalizeSlashes(value) {
  return value.replace(/\\/g, '/');
}

function toAliasTarget(projectRoot, srcRoot) {
  const relativePath = normalizeSlashes(relative(projectRoot, srcRoot));
  if (!relativePath || relativePath === '.') {
    return '*';
  }
  return `${relativePath}/*`;
}

function parseJsonFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    const parsed = ts.parseConfigFileTextToJson(filePath, raw);
    if (parsed.error) {
      throw new Error(`Invalid tsconfig at ${filePath}`);
    }
    return parsed.config ?? {};
  }
}

function writeJsonFile(filePath, value) {
  const content = JSON.stringify(value, null, 2) + '\n';
  writeFileSync(filePath, content, 'utf8');
}

function ensureTsConfigFile(tsConfigPath) {
  if (existsSync(tsConfigPath)) {
    return parseJsonFile(tsConfigPath);
  }

  mkdirSync(dirname(tsConfigPath), { recursive: true });
  return {};
}

export function ensureAtAlias({ srcRoot }) {
  const projectRoot = dirname(srcRoot);
  const tsConfigPath = join(projectRoot, 'tsconfig.json');
  const aliasTarget = toAliasTarget(projectRoot, srcRoot);
  const config = ensureTsConfigFile(tsConfigPath);

  if (!config.compilerOptions) {
    config.compilerOptions = {};
  }

  if (!config.compilerOptions.baseUrl) {
    config.compilerOptions.baseUrl = './';
  }

  if (!config.compilerOptions.paths) {
    config.compilerOptions.paths = {};
  }

  const desired = [aliasTarget];
  const current = config.compilerOptions.paths['@/*'];

  if (!Array.isArray(current) || current.length !== 1 || current[0] !== desired[0]) {
    config.compilerOptions.paths['@/*'] = desired;
  }

  writeJsonFile(tsConfigPath, config);

  return tsConfigPath;
}
