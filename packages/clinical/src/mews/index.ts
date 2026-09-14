import { calculateMEWS, CalculateMEWSOptions } from './calculator';
import { explainMEWS } from './explainer';
import { validateMEWSInput } from './validator';
import { getMEWSThresholds, MEWS_THRESHOLDS } from './thresholds';
import type {
  MEWSInput,
  MEWSResult,
  MEWSSubscore,
  MEWSContributingVariable,
  MEWSValidationResult,
  MEWSExplanation,
  MEWSThresholds,
  MEWSThresholdBand,
} from './types';

export {
  calculateMEWS as calculate,
  explainMEWS as explain,
  validateMEWSInput as validate,
  getMEWSThresholds as getThresholds,
  calculateMEWS,
  explainMEWS,
  validateMEWSInput,
  getMEWSThresholds,
  MEWS_THRESHOLDS,
};

export type {
  MEWSInput,
  MEWSResult,
  MEWSSubscore,
  MEWSContributingVariable,
  MEWSValidationResult,
  MEWSExplanation,
  MEWSThresholds,
  MEWSThresholdBand,
  CalculateMEWSOptions,
};
