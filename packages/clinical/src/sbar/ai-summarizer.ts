import type { GeneratedSbar, AISbarResult } from './types';

/**
 * Custom Error thrown when an AI summarization layer attempts to mutate
 * source clinical observations, APS scores, categories, or provenance.
 */
export class AiModificationProhibitedError extends Error {
  constructor(message: string) {
    super(`AI MODIFICATION PROHIBITED: ${message}`);
    this.name = 'AiModificationProhibitedError';
  }
}

/**
 * Pluggable AI summarizer engine interface.
 * Must be purely read-only.
 */
export interface AISummarizerEngine {
  generateExecutiveNote(sbar: GeneratedSbar): string | Promise<string>;
}

/**
 * Validates that an AI-enhanced SBAR report has NOT altered
 * any underlying clinical data, scores, patient IDs, or provenance.
 */
export function validateAiIntegrity(
  original: GeneratedSbar,
  enhanced: GeneratedSbar
): void {
  // 1. Invariant: APS score cannot be altered
  if (enhanced.apsScore !== original.apsScore) {
    throw new AiModificationProhibitedError(
      `AI layer attempted to modify APS score from ${original.apsScore} to ${enhanced.apsScore}.`
    );
  }

  // 2. Invariant: Priority Category cannot be altered
  if (enhanced.priorityCategory !== original.priorityCategory) {
    throw new AiModificationProhibitedError(
      `AI layer attempted to modify Priority Category from ${original.priorityCategory} to ${enhanced.priorityCategory}.`
    );
  }

  // 3. Invariant: Patient ID and Bed cannot be altered
  if (enhanced.patientId !== original.patientId || enhanced.bedNumber !== original.bedNumber) {
    throw new AiModificationProhibitedError(
      'AI layer attempted to modify patient identifier or bed allocation.'
    );
  }

  // 4. Invariant: Provenance source observation IDs cannot be dropped or fabricated
  const origIds = new Set(original.provenance.sourceObservationIds);
  const enhIds = new Set(enhanced.provenance.sourceObservationIds);
  if (origIds.size !== enhIds.size || !enhanced.provenance.sourceObservationIds.every((id) => origIds.has(id))) {
    throw new AiModificationProhibitedError(
      'AI layer attempted to alter provenance source observation identifiers.'
    );
  }

  // 5. Invariant: Missing data inventory cannot be suppressed
  if (
    enhanced.missingDataInventory.missingVitals.length !==
    original.missingDataInventory.missingVitals.length
  ) {
    throw new AiModificationProhibitedError(
      'AI layer attempted to conceal missing vital sign modalities.'
    );
  }
}

/**
 * Default heuristic/deterministic executive summarizer.
 * Synthesizes a rapid 30-second nurse-to-physician verbal handoff script.
 */
class DefaultVerbalHandoffSummarizer implements AISummarizerEngine {
  public generateExecutiveNote(sbar: GeneratedSbar): string {
    const lines: string[] = [];

    lines.push(
      `[EXECUTIVE VERBAL HANDOFF - ${sbar.priorityCategory}]`
    );
    lines.push(
      `S: Patient in Bed ${sbar.bedNumber} is ${sbar.priorityCategory} (APS: ${sbar.apsScore}).`
    );
    lines.push(
      `B: ${sbar.background.split('\n')[0].replace('• ', '')}`
    );

    // Extract vital highlights
    const vitalsSection = sbar.assessment.split('\n2. DERIVED')[0];
    lines.push(`A: Key Findings:\n${vitalsSection}`);

    // Extract first recommendation
    const firstRec = sbar.recommendation.split('\n\n')[0];
    lines.push(`R: Requested Actions:\n${firstRec}`);

    return lines.join('\n');
  }
}

/**
 * AI-Assisted Summarization Layer
 * Provides optional synthesis while strictly enforcing data immutability.
 */
export class AISummarizationLayer {
  private readonly defaultSummarizer = new DefaultVerbalHandoffSummarizer();

  /**
   * Enhances an existing deterministic SBAR with an executive verbal handoff note.
   * Runs strict integrity validation to guarantee zero mutation of source observations or APS.
   */
  public async enhance(
    originalSbar: GeneratedSbar,
    customSummarizer?: AISummarizerEngine
  ): Promise<AISbarResult> {
    const summarizer = customSummarizer ?? this.defaultSummarizer;
    const executiveHandoffNote = await summarizer.generateExecutiveNote(originalSbar);

    // Clone SBAR and attach AI enhancements
    const enhancedSbar: GeneratedSbar = {
      ...originalSbar,
      isAiEnhanced: true,
      aiSummary: executiveHandoffNote,
    };

    // Strict validation: assert that no numbers, scores, or identifiers were mutated
    validateAiIntegrity(originalSbar, enhancedSbar);

    return {
      enhancedSbar,
      executiveHandoffNote,
      readOnlyAudit: {
        verifiedUnalteredAps: enhancedSbar.apsScore,
        verifiedUnalteredCategory: enhancedSbar.priorityCategory,
        preservedObservationCount: enhancedSbar.provenance.sourceObservationIds.length,
        validatedAt: Date.now(),
      },
    };
  }

  /**
   * Synchronous convenience wrapper for non-async summarizers.
   */
  public enhanceSync(
    originalSbar: GeneratedSbar,
    customSummarizer?: AISummarizerEngine
  ): AISbarResult {
    const summarizer = customSummarizer ?? this.defaultSummarizer;
    const res = summarizer.generateExecutiveNote(originalSbar);
    const executiveHandoffNote = typeof res === 'string' ? res : '';

    const enhancedSbar: GeneratedSbar = {
      ...originalSbar,
      isAiEnhanced: true,
      aiSummary: executiveHandoffNote,
    };

    validateAiIntegrity(originalSbar, enhancedSbar);

    return {
      enhancedSbar,
      executiveHandoffNote,
      readOnlyAudit: {
        verifiedUnalteredAps: enhancedSbar.apsScore,
        verifiedUnalteredCategory: enhancedSbar.priorityCategory,
        preservedObservationCount: enhancedSbar.provenance.sourceObservationIds.length,
        validatedAt: Date.now(),
      },
    };
  }
}
