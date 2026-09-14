import { describe, it, expect } from 'vitest';
import { globalDatasetRegistry } from '../datasets/registry/catalog';
import { validateDatasetMetadata } from '../datasets/registry/schema';
import type { DatasetCategory } from '../datasets/registry/schema';

describe('Formal Research Dataset Registry', () => {
  const allDatasets = globalDatasetRegistry.listAll();

  it('registers all required datasets across the 8 target categories', () => {
    const requiredCategories: DatasetCategory[] = [
      'RPPG',
      'HEART_RATE',
      'RESPIRATORY_RATE',
      'MOTION_ROBUSTNESS',
      'LIGHTING_VARIATION',
      'SKIN_TONE_DIVERSITY',
      'PHYSIOLOGICAL_WAVEFORM',
      'HOSPITAL_DETERIORATION',
    ];

    const coverage = globalDatasetRegistry.getCoverageSummary();

    for (const cat of requiredCategories) {
      expect(coverage[cat].count).toBeGreaterThanOrEqual(1);
      expect(coverage[cat].datasetSlugs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('ensures every registered dataset conforms to the strict metadata schema', () => {
    expect(allDatasets.length).toBeGreaterThanOrEqual(8);

    for (const ds of allDatasets) {
      const validation = validateDatasetMetadata(ds);
      expect(validation.valid, `Dataset ${ds.slug} validation failed: ${validation.errors.join(', ')}`).toBe(true);

      // Core property checks
      expect(ds.slug).toBeDefined();
      expect(ds.name).toBeDefined();
      expect(ds.source.institution).toBeDefined();
      expect(ds.source.doiOrUrl).toBeDefined();
      expect(ds.license.name).toBeDefined();
      expect(ds.accessRequirements.accessType).toBeDefined();
      expect(ds.accessRequirements.dataUseAgreementSummary).toBeDefined();
    }
  });

  it('enforces mandatory demographic documentation and Fitzpatrick distribution', () => {
    for (const ds of allDatasets) {
      expect(ds.population.totalSubjects).toBeGreaterThan(0);
      expect(ds.population.cohortDescription.length).toBeGreaterThan(15);
      expect(ds.population.acuityLevel).toBeDefined();

      if (ds.population.fitzpatrickScale) {
        expect(ds.population.fitzpatrickScale).toHaveProperty('documented');
      }
    }
  });

  it('enforces mandatory known limitations and clinical claim boundaries on every dataset', () => {
    for (const ds of allDatasets) {
      // Must have explicit documented limitations
      expect(ds.knownLimitations.length).toBeGreaterThanOrEqual(1);
      for (const lim of ds.knownLimitations) {
        expect(lim.length).toBeGreaterThan(10);
      }

      // Must have rigorous clinical claim boundaries
      expect(ds.clinicalClaimBoundary.length).toBeGreaterThanOrEqual(20);
      expect(ds.clinicalClaimBoundary.toLowerCase()).toMatch(/cannot|never|does not/);
    }
  });

  it('retrieves datasets by specific research categories', () => {
    const skinToneDatasets = globalDatasetRegistry.findByCategory('SKIN_TONE_DIVERSITY');
    expect(skinToneDatasets.some((d) => d.slug === 'mmpd')).toBe(true);
    expect(skinToneDatasets.some((d) => d.slug === 'scamps')).toBe(true);

    const detDatasets = globalDatasetRegistry.findByCategory('HOSPITAL_DETERIORATION');
    expect(detDatasets.some((d) => d.slug === 'mimic-iv')).toBe(true);
    expect(detDatasets.some((d) => d.slug === 'eicu-crd')).toBe(true);
  });
});
