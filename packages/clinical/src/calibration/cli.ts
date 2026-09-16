#!/usr/bin/env node
/**
 * @aegispulse/clinical - APS Calibration Laboratory CLI
 * Runs empirical validation on Attention Priority Scoring and prints formatted audit report.
 */

import process from 'node:process';
import { runCalibrationLab, formatCalibrationReport } from './calibration-lab';

function main() {
  console.log('\nStarting AegisPulse APS Calibration Laboratory...\n');
  const startTime = Date.now();

  const report = runCalibrationLab();
  const output = formatCalibrationReport(report);

  console.log(output);
  console.log(`\nExecution completed in ${Date.now() - startTime}ms.\n`);

  if (!report.summaryVerdict.passed) {
    process.exit(1);
  }
}

main();
