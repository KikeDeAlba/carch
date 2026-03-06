import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const DEFAULT_CONFIG = {
  asyncMode: 'observable',
  orm: 'typeorm',
};

function normalizeAsyncMode(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');

  if (normalized === 'observable' || normalized === 'observables') {
    return 'observable';
  }

  if (normalized === 'promise' || normalized === 'promises') {
    return 'promise';
  }

  throw new Error(
    `Invalid async mode "${value}". Allowed values: observable, promise.`,
  );
}

function normalizeOrm(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '')
    .replace(/-/g, '');

  if (normalized === 'typeorm') {
    return 'typeorm';
  }

  if (normalized === 'mongoose' || normalized === 'moongoose') {
    return 'mongoose';
  }

  throw new Error(
    `Invalid orm "${value}". Allowed values: typeorm, mongoose.`,
  );
}

function parseConfig(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid .carch file. Expected valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid .carch file. Root must be an object.');
  }

  const config = { ...DEFAULT_CONFIG };
  if (parsed.asyncMode !== undefined) {
    config.asyncMode = normalizeAsyncMode(parsed.asyncMode);
  }
  if (parsed.orm !== undefined) {
    config.orm = normalizeOrm(parsed.orm);
  }

  return config;
}

function serializeConfig(config) {
  return JSON.stringify(config, null, 2) + '\n';
}

export function getDefaultCarchConfig() {
  return { ...DEFAULT_CONFIG };
}

export function resolveCarchFilePath(projectRoot = process.cwd()) {
  return join(resolve(projectRoot), '.carch');
}

export function readCarchConfig(projectRoot = process.cwd()) {
  const filePath = resolveCarchFilePath(projectRoot);
  if (!existsSync(filePath)) {
    return {
      filePath,
      config: getDefaultCarchConfig(),
      exists: false,
    };
  }

  const raw = readFileSync(filePath, 'utf8');
  return {
    filePath,
    config: parseConfig(raw),
    exists: true,
  };
}

export function writeCarchConfig(config, projectRoot = process.cwd()) {
  const filePath = resolveCarchFilePath(projectRoot);
  mkdirSync(resolve(projectRoot), { recursive: true });
  writeFileSync(filePath, serializeConfig(config), 'utf8');
  return filePath;
}

export function setCarchAsyncMode(mode, projectRoot = process.cwd()) {
  const current = readCarchConfig(projectRoot).config;
  const next = {
    ...current,
    asyncMode: normalizeAsyncMode(mode),
  };
  const filePath = writeCarchConfig(next, projectRoot);
  return {
    filePath,
    config: next,
  };
}

export function setCarchOrm(orm, projectRoot = process.cwd()) {
  const current = readCarchConfig(projectRoot).config;
  const next = {
    ...current,
    orm: normalizeOrm(orm),
  };
  const filePath = writeCarchConfig(next, projectRoot);
  return {
    filePath,
    config: next,
  };
}
