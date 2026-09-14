import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSyntheticRgbSeries } from '../rppg/src/evaluation/synthetic-dataset';
import { BenchmarkHarness, type BenchmarkDatasetItem } from '../rppg/src/evaluation/benchmark-harness';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function runScientificEvaluation() {
  console.log('============================================================');
  console.log('  AEGISPULSE SCIENTIFIC VALIDATION BENCHMARK RUNNER');
  console.log('============================================================\n');

  const harness = new BenchmarkHarness();

  // Define experimental partitions
  const partitions = [
    {
      name: 'Stationary Baseline (Still)',
      motionIntensity: 0.0,
      snrNoise: 0.01,
      skinTones: ['LIGHT', 'MEDIUM', 'DARK'] as const,
      heartRates: [60, 72, 85, 95, 110, 125],
    },
    {
      name: 'Conversational Motion (Talking/Head Gestures)',
      motionIntensity: 0.20,
      snrNoise: 0.03,
      skinTones: ['LIGHT', 'MEDIUM', 'DARK'] as const,
      heartRates: [65, 78, 92, 108, 120],
    },
    {
      name: 'Postural Movement & Bed Turning (Moderate Motion)',
      motionIntensity: 0.40,
      snrNoise: 0.05,
      skinTones: ['LIGHT', 'MEDIUM', 'DARK'] as const,
      heartRates: [70, 84, 100, 115],
    },
    {
      name: 'Fitzpatrick Phototypes I-II (Light Skin Tone)',
      motionIntensity: 0.05,
      snrNoise: 0.02,
      skinTones: ['LIGHT'] as const,
      heartRates: [60, 75, 90, 105, 120],
    },
    {
      name: 'Fitzpatrick Phototypes III-IV (Medium Skin Tone)',
      motionIntensity: 0.05,
      snrNoise: 0.02,
      skinTones: ['MEDIUM'] as const,
      heartRates: [60, 75, 90, 105, 120],
    },
    {
      name: 'Fitzpatrick Phototypes V-VI (Darker Skin Tone)',
      motionIntensity: 0.05,
      snrNoise: 0.03,
      skinTones: ['DARK'] as const,
      heartRates: [60, 75, 90, 105, 120],
    },
  ];

  const fullReport: Record<string, any> = {
    timestamp: new Date().toISOString(),
    benchmarkSuite: 'AegisPulse-Scientific-Validation-v1',
    algorithms: ['GREEN', 'CHROM', 'POS'],
    partitions: {},
    summary: {},
  };

  for (const p of partitions) {
    console.log(`Evaluating Partition: ${p.name}...`);
    const dataset: BenchmarkDatasetItem[] = [];

    let sampleId = 1;
    for (const hr of p.heartRates) {
      for (const tone of p.skinTones) {
        const synthetic = generateSyntheticRgbSeries({
          fps: 30,
          durationSeconds: 10.0,
          targetHeartRateBpm: hr,
          targetRespRateBpm: 16,
          motionIntensity: p.motionIntensity,
          snrAdditiveNoise: p.snrNoise,
          skinTone: tone,
          randomSeed: sampleId * 1001,
        });

        dataset.push({
          id: `sample-${p.name.substring(0, 4)}-${sampleId++}`,
          series: synthetic.series,
          groundTruthHeartRate: synthetic.groundTruthHr,
          groundTruthRespRate: synthetic.groundTruthRr,
          motionIntensity: p.motionIntensity,
        });
      }
    }

    const comparative = harness.compareAllAlgorithms(dataset, p.name);
    fullReport.partitions[p.name] = comparative;

    console.log(`   -> GREEN: MAE=${comparative.GREEN.meanAbsoluteErrorBpm} BPM | r=${comparative.GREEN.pearsonCorrelation} | Yield=${comparative.GREEN.yieldPercentage}%`);
    console.log(`   -> CHROM: MAE=${comparative.CHROM.meanAbsoluteErrorBpm} BPM | r=${comparative.CHROM.pearsonCorrelation} | Yield=${comparative.CHROM.yieldPercentage}%`);
    console.log(`   -> POS:   MAE=${comparative.POS.meanAbsoluteErrorBpm} BPM | r=${comparative.POS.pearsonCorrelation} | Yield=${comparative.POS.yieldPercentage}%\n`);
  }

  // Save report to /research/results/
  const outDir = resolve(__dirname, '../results');
  mkdirSync(outDir, { recursive: true });
  const outFile = resolve(outDir, 'scientific-evaluation-report.json');
  writeFileSync(outFile, JSON.stringify(fullReport, null, 2), 'utf8');

  console.log(`Report successfully written to ${outFile}`);
  console.log('============================================================');
  return fullReport;
}

if (process.argv[1]?.includes('run-scientific-evaluation')) {
  runScientificEvaluation();
}
