import { existsSync, mkdirSync } from 'fs';
import { isAbsolute, join, relative, resolve } from 'path';
import { toKebabCase, toPascalCase } from '../utils/case.js';
import { writeFileSafely, writeFormattedFile } from '../utils/fs.js';
import { ensureAtAlias } from '../utils/tsconfig.js';
import {
  buildControllerTemplate,
  buildGenericServerResponseModelTemplate,
  buildModuleTemplate,
  buildSpecTemplate,
} from '../templates/controller.template.js';

async function ensureGenericServerResponse(srcRoot) {
  const modelDir = join(srcRoot, 'common', 'dto', 'http', 'models');
  const modelFile = join(modelDir, 'server-response.model.ts');

  if (existsSync(modelFile)) {
    return;
  }

  mkdirSync(modelDir, { recursive: true });
  await writeFormattedFile(modelFile, buildGenericServerResponseModelTemplate());
}

function resolveMirroredSpecDir({ srcRoot, targetDir, testPath, resourceName }) {
  const mirroredPath = relative(srcRoot, targetDir);
  const testRoot = resolve(process.cwd(), testPath);

  if (
    mirroredPath &&
    !mirroredPath.startsWith('..') &&
    !isAbsolute(mirroredPath)
  ) {
    return join(testRoot, mirroredPath);
  }

  return join(testRoot, resourceName);
}

export async function generateControllerResource(name, options) {
  const resourceName = toKebabCase(name);

  if (!resourceName) {
    throw new Error('Invalid controller name.');
  }

  const className = toPascalCase(resourceName);
  const targetDir = resolve(process.cwd(), options.basePath, resourceName);
  const srcRoot = resolve(process.cwd(), options.srcRoot);
  const specDir = resolveMirroredSpecDir({
    srcRoot,
    targetDir,
    testPath: options.testPath,
    resourceName,
  });

  mkdirSync(targetDir, { recursive: true });
  ensureAtAlias({ srcRoot });
  await ensureGenericServerResponse(srcRoot);

  const controllerFile = join(targetDir, `${resourceName}.controller.ts`);
  const moduleFile = join(targetDir, `${resourceName}.module.ts`);
  const specFile = join(specDir, `${resourceName}.controller.spec.ts`);

  await writeFileSafely(
    controllerFile,
    buildControllerTemplate({
      className,
      routeName: resourceName,
    }),
  );
  await writeFileSafely(
    moduleFile,
    buildModuleTemplate({
      className,
      resourceName,
    }),
  );

  if (options.spec) {
    mkdirSync(specDir, { recursive: true });
    await writeFileSafely(
      specFile,
      buildSpecTemplate({
        className,
        routeName: resourceName,
      }),
    );
  }

  return targetDir;
}
