import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import inquirer from 'inquirer';

function getRequiredOrmDependencies(orm) {
  if (orm === 'typeorm') {
    return ['typeorm', '@nestjs/typeorm'];
  }

  if (orm === 'mongoose') {
    return ['mongoose', '@nestjs/mongoose'];
  }

  return [];
}

function detectPackageManager(projectRoot) {
  if (existsSync(join(projectRoot, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  if (existsSync(join(projectRoot, 'yarn.lock'))) {
    return 'yarn';
  }

  return 'npm';
}

function getInstallCommand(packageManager, packages) {
  if (packageManager === 'pnpm') {
    return {
      cmd: 'pnpm',
      args: ['add', ...packages],
    };
  }

  if (packageManager === 'yarn') {
    return {
      cmd: 'yarn',
      args: ['add', ...packages],
    };
  }

  return {
    cmd: 'npm',
    args: ['install', ...packages],
  };
}

function readProjectPackageJson(projectRoot) {
  const packageJsonPath = join(projectRoot, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  } catch {
    throw new Error(`Invalid package.json at ${packageJsonPath}`);
  }
}

function getMissingDependencies(packageJson, requiredDependencies) {
  const dependencies = packageJson.dependencies ?? {};
  const devDependencies = packageJson.devDependencies ?? {};

  return requiredDependencies.filter(
    (pkg) => !dependencies[pkg] && !devDependencies[pkg],
  );
}

export async function ensureOrmDependenciesInstalled({ orm, projectRoot }) {
  const packageJson = readProjectPackageJson(projectRoot);
  if (!packageJson) {
    return;
  }

  const requiredDependencies = getRequiredOrmDependencies(orm);
  const missingDependencies = getMissingDependencies(
    packageJson,
    requiredDependencies,
  );

  if (missingDependencies.length === 0) {
    return;
  }

  const promptMessage = `Missing dependencies for ${orm}: ${missingDependencies.join(
    ', ',
  )}. Do you want to install them now?`;

  if (!process.stdout.isTTY) {
    throw new Error(
      `${promptMessage} Run manually: npm install ${missingDependencies.join(' ')}`,
    );
  }

  const { installNow } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'installNow',
      message: promptMessage,
      default: true,
    },
  ]);

  if (!installNow) {
    throw new Error(
      `Missing required dependencies: ${missingDependencies.join(', ')}`,
    );
  }

  const packageManager = detectPackageManager(projectRoot);
  const { cmd, args } = getInstallCommand(packageManager, missingDependencies);
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(
      `Dependency installation failed (${cmd} ${args.join(' ')})`,
    );
  }
}
