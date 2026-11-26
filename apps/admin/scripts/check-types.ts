#!/usr/bin/env tsx
/**
 * TypeScript Type Checking Script
 *
 * With no arguments, this checks the application tsconfig.json. Positional
 * files are checked in standalone tsc mode with TypeScript's default options
 * and --noEmit. Use check:types:test-scripts for the strict test/script project.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message: string) {
  log('\n' + '='.repeat(60), 'cyan');
  log(message, 'cyan');
  log('='.repeat(60), 'cyan');
}

async function checkTypes() {
  header('TypeScript Type Checking');

  const startTime = Date.now();

  try {
    // Check if tsconfig.json exists
    const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
    if (!fs.existsSync(tsconfigPath)) {
      log('❌ Error: tsconfig.json not found', 'red');
      process.exit(1);
    }

    log('\n📝 Running TypeScript compiler (tsc --noEmit)...', 'blue');
    log('This may take a moment...\n', 'yellow');

    // Run TypeScript compiler in noEmit mode
    execSync('npx tsc --noEmit --pretty', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    // If we get here, no errors were found
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log('\n✅ Type checking passed!', 'green');
    log(`✨ No TypeScript errors found`, 'green');
    log(`⏱️  Duration: ${duration}s`, 'cyan');
  } catch (error: unknown) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (error && typeof error === 'object' && 'stdout' in error) {
      const typedError = error as {
        stdout: Buffer | string;
        stderr: Buffer | string;
      };
      const errorOutput =
        typedError.stdout?.toString() || typedError.stderr?.toString() || '';

      log('\n❌ Type checking failed!', 'red');
      log('\nTypeScript Errors:', 'red');
      log('─'.repeat(60), 'red');
      console.log(errorOutput);
      log('─'.repeat(60), 'red');

      // Count errors
      const errorLines = errorOutput
        .split('\n')
        .filter(line => line.includes('error TS'));
      const errorCount = errorLines.length;

      if (errorCount > 0) {
        log(
          `\n📊 Found ${errorCount} TypeScript error${errorCount > 1 ? 's' : ''}`,
          'red'
        );
      }

      log(`⏱️  Duration: ${duration}s`, 'cyan');
      process.exit(1);
    } else {
      log('\n❌ Unexpected error during type checking:', 'red');
      console.error(error);
      process.exit(1);
    }
  }
}

// Additional function to check specific files
async function checkSpecificFiles(files: string[]) {
  header('TypeScript Type Checking (Standalone Files)');

  if (files.length === 0) {
    log('❌ No files specified', 'red');
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    log(
      `\n📝 Checking ${files.length} file(s) with TypeScript defaults...`,
      'blue'
    );
    log('Files:', 'cyan');
    files.forEach(file => log(`  - ${file}`, 'cyan'));
    log('');

    const filesArg = files.join(' ');
    execSync(`npx tsc --noEmit --pretty ${filesArg}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    log('\n✅ Type checking passed!', 'green');
    log(`✨ No TypeScript errors found in specified files`, 'green');
    log(`⏱️  Duration: ${duration}s`, 'cyan');
  } catch (error: unknown) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (error && typeof error === 'object' && 'stdout' in error) {
      const typedError = error as {
        stdout: Buffer | string;
        stderr: Buffer | string;
      };
      const errorOutput =
        typedError.stdout?.toString() || typedError.stderr?.toString() || '';

      log('\n❌ Type checking failed!', 'red');
      log('\nTypeScript Errors:', 'red');
      log('─'.repeat(60), 'red');
      console.log(errorOutput);
      log('─'.repeat(60), 'red');

      log(`⏱️  Duration: ${duration}s`, 'cyan');
      process.exit(1);
    } else {
      log('\n❌ Unexpected error during type checking:', 'red');
      console.error(error);
      process.exit(1);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length > 0 && !args[0].startsWith('-')) {
  // Check specific files
  checkSpecificFiles(args);
} else if (args.includes('--help') || args.includes('-h')) {
  log('\nUsage:', 'cyan');
  log(
    '  pnpm check:types                  - Check the application project',
    'yellow'
  );
  log(
    '  pnpm check:types file1.ts file2.ts - Check standalone files with TypeScript defaults',
    'yellow'
  );
  log(
    '  pnpm check:types:test-scripts     - Check tests and scripts with project options',
    'yellow'
  );
  log('  pnpm check:types --help           - Show this help\n', 'yellow');
} else {
  // Check the application project.
  checkTypes();
}
