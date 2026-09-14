/**
 * @aegispulse/research - Dataset Registry Catalog
 * Central query engine and verification catalog for all documented research datasets.
 */

import type { DatasetMetadata, DatasetCategory } from './schema';
import { validateDatasetMetadata } from './schema';
import { UBFC_RPPG_DATASET } from './entries/ubfc-rppg';
import { PURE_DATASET } from './entries/pure';
import { MMPD_DATASET } from './entries/mmpd';
import { COHFACE_DATASET } from './entries/cohface';
import { VIPL_HR_DATASET } from './entries/vipl-hr';
import { SCAMPS_DATASET } from './entries/scamps';
import { BIDMC_PPG_RR_DATASET } from './entries/bidmc-ppg-rr';
import { MIMIC_IV_DATASET } from './entries/mimic-iv';
import { EICU_CRD_DATASET } from './entries/eicu-crd';

export class DatasetRegistryCatalog {
  private readonly datasets: Map<string, DatasetMetadata> = new Map();

  constructor() {
    this.register(UBFC_RPPG_DATASET);
    this.register(PURE_DATASET);
    this.register(MMPD_DATASET);
    this.register(COHFACE_DATASET);
    this.register(VIPL_HR_DATASET);
    this.register(SCAMPS_DATASET);
    this.register(BIDMC_PPG_RR_DATASET);
    this.register(MIMIC_IV_DATASET);
    this.register(EICU_CRD_DATASET);
  }

  /**
   * Registers a dataset after validating its schema and required limitation fields
   */
  public register(metadata: DatasetMetadata): void {
    const validation = validateDatasetMetadata(metadata);
    if (!validation.valid) {
      throw new Error(
        `Failed to register dataset "${metadata.name}": ${validation.errors.join(', ')}`
      );
    }
    this.datasets.set(metadata.slug, metadata);
  }

  /**
   * Retrieves a dataset by its unique slug
   */
  public getBySlug(slug: string): DatasetMetadata | undefined {
    return this.datasets.get(slug);
  }

  /**
   * Lists all datasets registered in the catalog
   */
  public listAll(): DatasetMetadata[] {
    return Array.from(this.datasets.values());
  }

  /**
   * Filters datasets satisfying a specific research category
   */
  public findByCategory(category: DatasetCategory): DatasetMetadata[] {
    return this.listAll().filter((ds) => ds.categories.includes(category));
  }

  /**
   * Finds datasets matching multiple categories (AND logic)
   */
  public findByCategoriesAll(categories: DatasetCategory[]): DatasetMetadata[] {
    return this.listAll().filter((ds) =>
      categories.every((cat) => ds.categories.includes(cat))
    );
  }

  /**
   * Summary overview of catalog coverage across all 8 target research domains
   */
  public getCoverageSummary(): Record<DatasetCategory, { count: number; datasetSlugs: string[] }> {
    const categories: DatasetCategory[] = [
      'RPPG',
      'HEART_RATE',
      'RESPIRATORY_RATE',
      'MOTION_ROBUSTNESS',
      'LIGHTING_VARIATION',
      'SKIN_TONE_DIVERSITY',
      'PHYSIOLOGICAL_WAVEFORM',
      'HOSPITAL_DETERIORATION',
    ];

    const summary = {} as Record<DatasetCategory, { count: number; datasetSlugs: string[] }>;

    for (const cat of categories) {
      const matches = this.findByCategory(cat);
      summary[cat] = {
        count: matches.length,
        datasetSlugs: matches.map((m) => m.slug),
      };
    }

    return summary;
  }
}

export const globalDatasetRegistry = new DatasetRegistryCatalog();
