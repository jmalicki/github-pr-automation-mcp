#!/usr/bin/env node

// Check coverage thresholds
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const coveragePath = join(__dirname, '..', 'coverage', 'coverage-summary.json');

try {
  const coverage = JSON.parse(readFileSync(coveragePath, 'utf-8'));
  const { lines, functions, branches, statements } = coverage.total;
  
  console.log('\n📊 Coverage Summary:');
  console.log(`  Lines:      ${lines.pct}%`);
  console.log(`  Functions:  ${functions.pct}%`);
  console.log(`  Branches:   ${branches.pct}%`);
  console.log(`  Statements: ${statements.pct}%`);
  
  const thresholds = {
    lines: 69,
    functions: 69,
    branches: 69,
    statements: 69
  };
  
  const failures = [];
  
  if (lines.pct < thresholds.lines) {
    failures.push(`Lines coverage ${lines.pct}% < ${thresholds.lines}%`);
  }
  if (functions.pct < thresholds.functions) {
    failures.push(`Functions coverage ${functions.pct}% < ${thresholds.functions}%`);
  }
  if (branches.pct < thresholds.branches) {
    failures.push(`Branches coverage ${branches.pct}% < ${thresholds.branches}%`);
  }
  if (statements.pct < thresholds.statements) {
    failures.push(`Statements coverage ${statements.pct}% < ${thresholds.statements}%`);
  }
  
  if (failures.length > 0) {
    console.error('\n❌ Coverage thresholds not met:');
    failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  }
  
  console.log('\n✅ All coverage thresholds met!');
  process.exit(0);
} catch (error) {
  console.error('Error reading coverage:', error.message);
  process.exit(1);
}

