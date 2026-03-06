import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { isAbsolute, join, relative, resolve } from 'path';
import { toKebabCase, toPascalCase } from '../utils/case.js';
import { writeFileSafely, writeFormattedFile } from '../utils/fs.js';
import { ensureAtAlias } from '../utils/tsconfig.js';
import { readCarchConfig } from '../utils/carch-config.js';
import {
  buildApplicationUseCaseInputClassTemplate,
  buildApplicationUseCaseOutputClassTemplate,
  buildApplicationUseCaseTemplate,
  buildDomainUseCaseTemplate,
  buildUseCaseCoreTemplate,
  buildUseCaseImplProviderTemplate,
  buildUseCaseInputTemplate,
  buildUseCaseOutputTemplate,
  buildUseCaseSpecTemplate,
  buildUseCasesIndexTemplate,
} from '../templates/use-case.template.js';

function toConstantCase(value) {
  return toKebabCase(value).replace(/-/g, '_').toUpperCase();
}

async function ensureUseCaseCore(srcRoot) {
  const coreDir = join(srcRoot, 'common', 'core');
  const coreFile = join(coreDir, 'use-case.ts');

  if (existsSync(coreFile)) {
    return;
  }

  mkdirSync(coreDir, { recursive: true });
  await writeFormattedFile(coreFile, buildUseCaseCoreTemplate());
}

function resolveMirroredSpecDir({ srcRoot, targetDir, testPath, useCaseName }) {
  const mirroredPath = relative(srcRoot, targetDir);
  const testRoot = resolve(process.cwd(), testPath);

  if (
    mirroredPath &&
    !mirroredPath.startsWith('..') &&
    !isAbsolute(mirroredPath)
  ) {
    return join(testRoot, mirroredPath);
  }

  return join(testRoot, useCaseName);
}

async function ensureUseCasesContextIndex({
  indexFile,
  contextDiToken,
  useCaseImplProviderName,
  useCaseName,
}) {
  if (!existsSync(indexFile)) {
    await writeFormattedFile(
      indexFile,
      buildUseCasesIndexTemplate({
        contextDiToken,
        useCaseImplProviderName,
        useCaseName,
      }),
    );
    return;
  }

  let content = readFileSync(indexFile, 'utf8');
  const importLine = `import { ${useCaseImplProviderName} } from './${useCaseName}-impl';`;

  if (!content.includes(importLine)) {
    const importMatches = [...content.matchAll(/^import .+;$/gm)];
    if (importMatches.length > 0) {
      const lastImport = importMatches[importMatches.length - 1];
      const insertAt = lastImport.index + lastImport[0].length;
      content =
        content.slice(0, insertAt) + `\n${importLine}` + content.slice(insertAt);
    } else {
      content = `${importLine}\n${content}`;
    }
  }

  const tokenRegex = new RegExp(
    `export const\\s+${contextDiToken}\\s*:\\s*Provider\\[]\\s*=\\s*\\[([\\s\\S]*?)\\];`,
    'm',
  );
  const match = content.match(tokenRegex);

  if (!match) {
    throw new Error(
      `Unable to update ${indexFile}. Expected export const ${contextDiToken}: Provider[] = [...];`,
    );
  }

  const providersBlock = match[1];
  if (!providersBlock.includes(useCaseImplProviderName)) {
    const trimmedBlock = providersBlock.trim();
    let updatedBlock;

    if (trimmedBlock.length === 0) {
      updatedBlock = `\n    ${useCaseImplProviderName},\n`;
    } else if (trimmedBlock.includes('\n')) {
      const normalized = trimmedBlock.endsWith(',')
        ? trimmedBlock
        : `${trimmedBlock},`;
      updatedBlock = `\n    ${normalized
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join('\n    ')}\n    ${useCaseImplProviderName},\n`;
    } else {
      const items = trimmedBlock
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      items.push(useCaseImplProviderName);
      updatedBlock = `\n    ${items.join(',\n    ')},\n`;
    }

    content = content.replace(tokenRegex, (full) =>
      full.replace(providersBlock, updatedBlock),
    );
  }

  await writeFormattedFile(indexFile, content);
}

export async function generateUseCaseResource(context, name, options) {
  const contextName = toKebabCase(context);
  const useCaseName = toKebabCase(name);

  if (!contextName) {
    throw new Error('Invalid context name.');
  }

  if (!useCaseName) {
    throw new Error('Invalid use-case name.');
  }

  const useCaseClassName = `${toPascalCase(useCaseName)}UseCase`;
  const useCaseImplClassName = `${toPascalCase(useCaseName)}ImplUseCase`;
  const useCaseImplProviderName = `${toPascalCase(useCaseName)}ImplProvider`;
  const contextDiToken = `${toConstantCase(contextName)}_DI_USE_CASES`;

  const srcRoot = resolve(process.cwd(), options.srcRoot);
  const projectRoot = resolve(srcRoot, '..');
  const { config } = readCarchConfig(projectRoot);
  const asyncMode = config.asyncMode;
  const definition = options.definition ?? {};
  const domainUseCasesDir = join(srcRoot, 'domain', contextName, 'use-cases');
  const domainInterfacesInputsDir = join(
    srcRoot,
    'domain',
    contextName,
    'interfaces',
    'inputs',
  );
  const domainInterfacesOutputsDir = join(
    srcRoot,
    'domain',
    contextName,
    'interfaces',
    'outputs',
  );
  const appUseCasesDir = join(srcRoot, 'application', contextName, 'use-cases');
  const appUseCaseImplDir = join(appUseCasesDir, `${useCaseName}-impl`);
  const appInterfacesInputsDir = join(
    srcRoot,
    'application',
    contextName,
    'interfaces',
    'inputs',
  );
  const appInterfacesOutputsDir = join(
    srcRoot,
    'application',
    contextName,
    'interfaces',
    'outputs',
  );
  const useCaseIndexFile = join(appUseCasesDir, 'index.ts');
  const specDir = resolveMirroredSpecDir({
    srcRoot,
    targetDir: appUseCaseImplDir,
    testPath: options.testPath,
    useCaseName,
  });

  mkdirSync(domainUseCasesDir, { recursive: true });
  mkdirSync(domainInterfacesInputsDir, { recursive: true });
  mkdirSync(domainInterfacesOutputsDir, { recursive: true });
  mkdirSync(appUseCaseImplDir, { recursive: true });
  mkdirSync(appInterfacesInputsDir, { recursive: true });
  mkdirSync(appInterfacesOutputsDir, { recursive: true });

  ensureAtAlias({ srcRoot });
  await ensureUseCaseCore(srcRoot);

  const domainUseCaseFile = join(domainUseCasesDir, `${useCaseName}.usecase.ts`);
  const appUseCaseFile = join(
    appUseCaseImplDir,
    `${useCaseName}-impl.usecase.ts`,
  );
  const appUseCaseProviderFile = join(appUseCaseImplDir, 'index.ts');
  const domainUseCaseInputFile = join(
    domainInterfacesInputsDir,
    `${useCaseName}.input.ts`,
  );
  const domainUseCaseOutputFile = join(
    domainInterfacesOutputsDir,
    `${useCaseName}.output.ts`,
  );
  const appUseCaseInputFile = join(
    appInterfacesInputsDir,
    `${useCaseName}.input.ts`,
  );
  const appUseCaseOutputFile = join(
    appInterfacesOutputsDir,
    `${useCaseName}.output.ts`,
  );
  const specFile = join(specDir, `${useCaseName}-impl.usecase.spec.ts`);

  await writeFileSafely(
    domainUseCaseFile,
    buildDomainUseCaseTemplate({
      useCaseClassName,
      contextName,
      useCaseName,
      asyncMode,
    }),
  );
  await writeFileSafely(
    domainUseCaseInputFile,
    buildUseCaseInputTemplate({
      useCaseClassName,
      fields: definition.inputFields,
      importLines: definition.inputImportLines,
    }),
  );
  await writeFileSafely(
    domainUseCaseOutputFile,
    buildUseCaseOutputTemplate({
      useCaseClassName,
      fields: definition.outputFields,
      importLines: definition.outputImportLines,
    }),
  );
  await writeFileSafely(
    appUseCaseInputFile,
    buildApplicationUseCaseInputClassTemplate({
      useCaseClassName,
      contextName,
      useCaseName,
      fields: definition.inputFields,
      importLines: definition.appInputImportLines,
    }),
  );
  await writeFileSafely(
    appUseCaseOutputFile,
    buildApplicationUseCaseOutputClassTemplate({
      useCaseClassName,
      contextName,
      useCaseName,
      fields: definition.outputFields,
      importLines: definition.appOutputImportLines,
    }),
  );
  await writeFileSafely(
    appUseCaseFile,
    buildApplicationUseCaseTemplate({
      useCaseClassName,
      useCaseImplClassName,
      contextName,
      useCaseName,
      asyncMode,
      repository: definition.repository,
      execution: definition.execution,
    }),
  );
  await writeFileSafely(
    appUseCaseProviderFile,
    buildUseCaseImplProviderTemplate({
      useCaseClassName,
      useCaseImplClassName,
      useCaseImplProviderName,
      useCaseName,
      contextName,
    }),
  );

  await ensureUseCasesContextIndex({
    indexFile: useCaseIndexFile,
    contextDiToken,
    useCaseImplProviderName,
    useCaseName,
  });

  if (options.spec) {
    mkdirSync(specDir, { recursive: true });
    await writeFileSafely(
      specFile,
      buildUseCaseSpecTemplate({
        useCaseImplClassName,
        contextName,
        useCaseName,
      }),
    );
  }

  return appUseCaseImplDir;
}
