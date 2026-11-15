#!/usr/bin/env node
import { servePulseStdio } from './stdio';

try {
  servePulseStdio();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
