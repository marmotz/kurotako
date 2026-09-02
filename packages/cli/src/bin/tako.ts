#!/usr/bin/env node
import { version } from '../index.js';

const arg = process.argv[2];

if (arg === '--version' || arg === '-v') {
  process.stdout.write(`${version}\n`);
  process.exit(0);
}

process.stdout.write('tako: no command yet. Try --version.\n');
