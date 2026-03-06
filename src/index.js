#!/usr/bin/env node

import { buildProgram } from './program.js';

const program = buildProgram();
program.parse();

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
