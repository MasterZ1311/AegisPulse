import * as crypto from 'crypto';
import type {
  CopilotQueryType,
  CopilotRefusalReason,
  CopilotSourceReference,
  StructuredEvidencePackage,
  CopilotResponse,
  CopilotAuditRecord,
  UserRole,
} from '@aegispulse/types';
import { CopilotResponseSchema } from '@aegispulse/types';
import {
  detectPromptInjection,
  detectForbiddenIntent,
  validateEvidenceGrounding,
  validateIndirectPromptInjection,
  validateLLMOutput,
} from './guardrails';
import { CopilotAuditLogger, defaultCopilotAuditLogger } from './audit-logger';

export const COPILOT_ADVISORY_DISCLAIMER =
  'ADVISORY ONLY: AegisPulse AI Clinical Copilot provides decision support based strictly on verified patient data. It does not diagnose, prescribe, change scores, or replace licensed clinical judgment.';

export interface CopilotRequest {
  patientId: string;
  actorId: string;
  actorRole?: UserRole;
  queryType: CopilotQueryType;
  query: string;
  evidence: StructuredEvidencePackage;
}

export interface CopilotLLMProvider {
  generateResponse(
    queryType: CopilotQueryType,
    query: string,
    evidence: StructuredEvidencePackage
  ): Promise<{
    answer: string;
    sourceReferences: CopilotSourceReference[];
    missingDataIdentified?: string[];
  }>;
}

/**
 * Deterministic Fallback Engine
 * Provides 100% grounded, rule-based answers without external network dependencies.
 */
class DeterministicInferenceEngine {
  public execute(
    queryType: CopilotQueryType,
    query: string,
    evidence: StructuredEvidencePackage
  ): {
    answer: string;
    sourceReferences: CopilotSourceReference[];
    missingDataIdentified: string[];
  } {
    switch (queryType) {
      case 'SUMMARIZE_TIMELINE':
        return this.summarizeTimeline(evidence);
      case 'EXPLAIN_APS_CHANGE':
        return this.explainApsChange(evidence);
      case 'DRAFT_SBAR':
        return this.draftSbar(evidence);
      case 'IDENTIFY_MISSING_INFO':
        return this.identifyMissingInfo(evidence);
      case 'EXPLAIN_CALCULATION':
        return this.explainCalculation(evidence);
      case 'QUESTION_ANSWER':
      default:
        return this.answerQuestion(query, evidence);
    }
  }

  private summarizeTimeline(evidence: StructuredEvidencePackage) {
    const references: CopilotSourceReference[] = [];
    const lines: string[] = [];

    lines.push(`Timeline Summary for Patient ${evidence.patientId} (Bed ${evidence.bedNumber}):`);

    if (evidence.timelineSummary.length === 0) {
      lines.push('• No historical timeline events recorded in the current observation window.');
    } else {
      for (const evt of evidence.timelineSummary) {
        const timeStr = new Date(evt.timestamp).toISOString();
        lines.push(`• [${timeStr}] ${evt.eventType}: ${evt.title} - ${evt.description} (Ref: ${evt.eventId})`);
        references.push({
          label: `Timeline Event: ${evt.title}`,
          timestamp: evt.timestamp,
          sourceChannel: evt.eventType,
        });
      }
    }

    // Add vital references as timeline anchors
    for (const [vType, vData] of Object.entries(evidence.verifiedVitals)) {
      references.push({
        observationId: vData.observationId,
        vitalType: vData.vitalType,
        value: vData.value,
        label: `${vType}: ${vData.value} ${vData.unit}`,
        timestamp: vData.timestamp,
        sourceChannel: vData.source,
      });
    }

    return {
      answer: lines.join('\n'),
      sourceReferences: references,
      missingDataIdentified: evidence.missingVitals.map((v) => String(v)),
    };
  }

  private explainApsChange(evidence: StructuredEvidencePackage) {
    const references: CopilotSourceReference[] = [];
    const lines: string[] = [];

    lines.push(
      `Attention Priority Score (APS) Explanation: Current Score = ${evidence.apsScore} (${evidence.priorityCategory} Priority, Ward Rank #${evidence.wardRank}).`
    );

    lines.push('\nKey Deterministic Drivers:');
    if (evidence.dominantReasons.length > 0) {
      for (const reason of evidence.dominantReasons) {
        lines.push(`• ${reason}`);
      }
    } else {
      lines.push('• Baseline physiological stability with no abnormal escalations.');
    }

    lines.push(`\nPhysiological Indicators:`);
    lines.push(`• MEWS Contribution: ${evidence.mewsScore} points.`);
    if (evidence.shockIndex !== undefined) {
      lines.push(`• Shock Index: ${evidence.shockIndex.toFixed(2)}.`);
    }

    for (const [vType, vData] of Object.entries(evidence.verifiedVitals)) {
      lines.push(
        `• Verified ${vType}: ${vData.value} ${vData.unit} [ObsID: ${vData.observationId}, Quality: ${vData.qualityStatus}]`
      );
      references.push({
        observationId: vData.observationId,
        vitalType: vData.vitalType,
        value: vData.value,
        label: `${vType}: ${vData.value} ${vData.unit}`,
        timestamp: vData.timestamp,
        sourceChannel: vData.source,
      });
    }

    if (evidence.missingVitals.length > 0) {
      lines.push(`\nUncertainty Impact:`);
      lines.push(
        `• Information decay / missing vitals: ${evidence.missingVitals.join(', ')}. Epistemic uncertainty contributes to the attention requirement.`
      );
    }

    return {
      answer: lines.join('\n'),
      sourceReferences: references,
      missingDataIdentified: evidence.missingVitals.map((v) => String(v)),
    };
  }

  private draftSbar(evidence: StructuredEvidencePackage) {
    const references: CopilotSourceReference[] = [];
    const lines: string[] = [];

    // S - Situation
    lines.push('S (Situation):');
    lines.push(
      `Patient ${evidence.patientName ?? evidence.patientId} in Bed ${evidence.bedNumber} is categorized as ${evidence.priorityCategory} Priority with an Attention Priority Score of ${evidence.apsScore}.`
    );

    // B - Background
    lines.push('\nB (Background):');
    const ageGender = [
      evidence.age ? `${evidence.age}yo` : undefined,
      evidence.gender,
      evidence.codeStatus ? `Code: ${evidence.codeStatus}` : undefined,
    ]
      .filter(Boolean)
      .join(', ');
    lines.push(`Demographics: ${ageGender || 'Not documented'}.`);
    if (evidence.admissionReason) {
      lines.push(`Admission Reason: ${evidence.admissionReason}.`);
    }
    if (evidence.comorbidities.length > 0) {
      lines.push(`Comorbidities: ${evidence.comorbidities.join(', ')}.`);
    }

    // A - Assessment
    lines.push('\nA (Assessment):');
    lines.push(`MEWS: ${evidence.mewsScore}. Dominant Triggers: ${evidence.dominantReasons.join('; ') || 'None'}.`);
    lines.push('Current Verified Telemetry:');
    for (const [vType, vData] of Object.entries(evidence.verifiedVitals)) {
      lines.push(`• ${vType}: ${vData.value} ${vData.unit} (Obs: ${vData.observationId})`);
      references.push({
        observationId: vData.observationId,
        vitalType: vData.vitalType,
        value: vData.value,
        label: `${vType}: ${vData.value} ${vData.unit}`,
        timestamp: vData.timestamp,
        sourceChannel: vData.source,
      });
    }

    if (evidence.recentLabs.length > 0) {
      lines.push('Recent Lab Results:');
      for (const lab of evidence.recentLabs) {
        lines.push(`• ${lab.testName} (${lab.testCode}): ${lab.value} ${lab.unit}${lab.isCritical ? ' [CRITICAL]' : ''}`);
        references.push({
          label: `Lab: ${lab.testName}`,
          value: lab.value,
          timestamp: lab.timestamp,
        });
      }
    }

    // R - Recommendation
    lines.push('\nR (Recommendation):');
    lines.push('• Perform bedside verification of telemetry signals and manual vital check.');
    if (evidence.missingVitals.length > 0) {
      lines.push(`• Collect missing vital modalities: ${evidence.missingVitals.join(', ')} to resolve monitoring blindspots.`);
    }
    lines.push('• Re-evaluate patient trajectory following verification.');

    return {
      answer: lines.join('\n'),
      sourceReferences: references,
      missingDataIdentified: evidence.missingVitals.map((v) => String(v)),
    };
  }

  private identifyMissingInfo(evidence: StructuredEvidencePackage) {
    const lines: string[] = [];
    const missing = evidence.missingVitals.map((v) => String(v));

    lines.push(`Information Gap & Monitoring Blindspot Analysis for Bed ${evidence.bedNumber}:`);

    if (missing.length === 0) {
      lines.push('• Comprehensive Telemetry: All core vital modalities are actively monitored and verified.');
    } else {
      lines.push(`• Missing Vital Sign Modalities (${missing.length}): ${missing.join(', ')}.`);
      lines.push('• Epistemic Risk: Absence of these parameters elevates uncertainty and prevents complete physiological scoring.');
      lines.push('• Recommendation: Obtain manual or secondary measurements for missing channels.');
    }

    if (evidence.recentLabs.length === 0) {
      lines.push('• Laboratory Evidence: No recent verified laboratory results found in the active context window.');
    }

    return {
      answer: lines.join('\n'),
      sourceReferences: [],
      missingDataIdentified: missing,
    };
  }

  private explainCalculation(evidence: StructuredEvidencePackage) {
    const references: CopilotSourceReference[] = [];
    const lines: string[] = [];

    lines.push('AegisPulse Deterministic Calculation Breakdown:');
    lines.push(`1. Modified Early Warning Score (MEWS):`);
    lines.push(`   Current MEWS: ${evidence.mewsScore}. Calculated strictly from validated Subbe et al. (2001) lookup tables.`);

    if (evidence.shockIndex !== undefined) {
      lines.push(`2. Shock Index (SI):`);
      lines.push(
        `   Current SI: ${evidence.shockIndex.toFixed(2)} (Calculated as Heart Rate / Systolic BP). Values > 0.9 indicate elevated risk of occult hypoperfusion.`
      );
    }

    lines.push(`3. Attention Priority Score (APS):`);
    lines.push(`   Current Score: ${evidence.apsScore} (${evidence.priorityCategory}).`);
    lines.push('   Composite deterministic formulation combining:');
    lines.push('   - Acuity Base (MEWS + Critical Vital Floor Overrides)');
    lines.push('   - Trend Velocity Vector (Rate of physiological change over time)');
    lines.push('   - Information Decay Penalty (Increasing attention weight as observations age)');
    lines.push('   - Laboratory Concomitant Risk Adjusters');

    for (const [vType, vData] of Object.entries(evidence.verifiedVitals)) {
      references.push({
        observationId: vData.observationId,
        vitalType: vData.vitalType,
        value: vData.value,
        label: `${vType}: ${vData.value} ${vData.unit}`,
        timestamp: vData.timestamp,
        sourceChannel: vData.source,
      });
    }

    return {
      answer: lines.join('\n'),
      sourceReferences: references,
      missingDataIdentified: evidence.missingVitals.map((v) => String(v)),
    };
  }

  private answerQuestion(query: string, evidence: StructuredEvidencePackage) {
    const references: CopilotSourceReference[] = [];
    const lines: string[] = [];
    const queryLower = query.toLowerCase();

    lines.push(`Response regarding Patient in Bed ${evidence.bedNumber} (Patient ID: ${evidence.patientId}):`);

    let addressed = false;

    // Check vitals inquiry
    for (const [vType, vData] of Object.entries(evidence.verifiedVitals)) {
      const typeStr = vType.toLowerCase().replace('_', ' ');
      if (
        queryLower.includes(typeStr) ||
        (vType === 'HEART_RATE' && (queryLower.includes('heart') || queryLower.includes('pulse') || queryLower.includes('hr'))) ||
        (vType === 'RESPIRATORY_RATE' && (queryLower.includes('respiratory') || queryLower.includes('breathing') || queryLower.includes('rr'))) ||
        (vType === 'OXYGEN_SATURATION' && (queryLower.includes('spo2') || queryLower.includes('oxygen') || queryLower.includes('sat'))) ||
        (vType === 'SYSTOLIC_BP' && (queryLower.includes('bp') || queryLower.includes('blood pressure') || queryLower.includes('systolic'))) ||
        (vType === 'BODY_TEMPERATURE' && (queryLower.includes('temp') || queryLower.includes('temperature') || queryLower.includes('fever')))
      ) {
        lines.push(
          `• Verified ${vType}: ${vData.value} ${vData.unit} (ObsID: ${vData.observationId}, Source: ${vData.source ?? 'MONITOR'}, Quality: ${vData.qualityStatus}).`
        );
        references.push({
          observationId: vData.observationId,
          vitalType: vData.vitalType,
          value: vData.value,
          label: `${vType}: ${vData.value} ${vData.unit}`,
          timestamp: vData.timestamp,
          sourceChannel: vData.source,
        });
        addressed = true;
      }
    }

    // Check labs inquiry
    if (queryLower.includes('lab') || queryLower.includes('result') || queryLower.includes('test')) {
      if (evidence.recentLabs.length > 0) {
        lines.push('• Verified Laboratory Results:');
        for (const lab of evidence.recentLabs) {
          lines.push(`  - ${lab.testName} (${lab.testCode}): ${lab.value} ${lab.unit}${lab.isCritical ? ' [CRITICAL]' : ''}`);
          references.push({
            label: `Lab: ${lab.testName}`,
            value: lab.value,
            timestamp: lab.timestamp,
          });
        }
        addressed = true;
      }
    }

    // Check APS or Priority inquiry
    if (queryLower.includes('aps') || queryLower.includes('score') || queryLower.includes('priority') || queryLower.includes('status')) {
      lines.push(
        `• Current Status: APS ${evidence.apsScore} (${evidence.priorityCategory} Priority, Ward Rank #${evidence.wardRank}).`
      );
      if (evidence.dominantReasons.length > 0) {
        lines.push(`• Dominant Drivers: ${evidence.dominantReasons.join('; ')}.`);
      }
      addressed = true;
    }

    // General fallback if general question
    if (!addressed) {
      lines.push(
        `• The patient is currently at APS ${evidence.apsScore} (${evidence.priorityCategory}). Core verified vitals count: ${Object.keys(evidence.verifiedVitals).length}. Missing vitals count: ${evidence.missingVitals.length}.`
      );
      for (const [vType, vData] of Object.entries(evidence.verifiedVitals)) {
        references.push({
          observationId: vData.observationId,
          vitalType: vData.vitalType,
          value: vData.value,
          label: `${vType}: ${vData.value} ${vData.unit}`,
          timestamp: vData.timestamp,
          sourceChannel: vData.source,
        });
      }
    }

    return {
      answer: lines.join('\n'),
      sourceReferences: references,
      missingDataIdentified: evidence.missingVitals.map((v) => String(v)),
    };
  }
}

/**
 * AI Clinical Copilot Engine
 * Strictly advisory decision-support layer above deterministic AegisPulse engine.
 */
export class ClinicalCopilotEngine {
  private readonly deterministicEngine = new DeterministicInferenceEngine();
  private readonly auditLogger: CopilotAuditLogger;
  private readonly customLLMProvider?: CopilotLLMProvider;

  constructor(options?: {
    auditLogger?: CopilotAuditLogger;
    llmProvider?: CopilotLLMProvider;
  }) {
    this.auditLogger = options?.auditLogger ?? defaultCopilotAuditLogger;
    this.customLLMProvider = options?.llmProvider;
  }

  /**
   * Processes a copilot request synchronously (using deterministic inference).
   */
  public askSync(request: CopilotRequest): CopilotResponse {
    const startTime = Date.now();
    const responseId = `copilot-resp-${crypto.randomUUID()}`;
    const auditId = `copilot-audit-${crypto.randomUUID()}`;

    // 1. Direct Prompt Injection Defense
    const injectionCheck = detectPromptInjection(request.query);
    if (!injectionCheck.passed) {
      return this.recordRefusal(
        request,
        responseId,
        auditId,
        injectionCheck.refusalReason!,
        injectionCheck.refusalExplanation!,
        startTime
      );
    }

    // 1b. Indirect Prompt Injection & Context Poisoning Defense
    const indirectCheck = validateIndirectPromptInjection(request.evidence);
    if (!indirectCheck.passed) {
      return this.recordRefusal(
        request,
        responseId,
        auditId,
        indirectCheck.refusalReason!,
        indirectCheck.refusalExplanation!,
        startTime
      );
    }

    // 2. Forbidden Medical Action & Safety Override Check
    const forbiddenCheck = detectForbiddenIntent(request.query, request.queryType);
    if (!forbiddenCheck.passed) {
      return this.recordRefusal(
        request,
        responseId,
        auditId,
        forbiddenCheck.refusalReason!,
        forbiddenCheck.refusalExplanation!,
        startTime
      );
    }

    // 3. Grounding & Missing Data Check
    const groundingCheck = validateEvidenceGrounding(request.query, request.evidence);
    if (!groundingCheck.passed) {
      return this.recordRefusal(
        request,
        responseId,
        auditId,
        groundingCheck.refusalReason!,
        groundingCheck.refusalExplanation!,
        startTime
      );
    }

    // 4. Generate Deterministic Answer
    const execution = this.deterministicEngine.execute(
      request.queryType,
      request.query,
      request.evidence
    );

    const response: CopilotResponse = {
      id: responseId,
      patientId: request.evidence.patientId,
      bedNumber: request.evidence.bedNumber,
      queryType: request.queryType,
      query: request.query,
      status: 'SUCCESS',
      answer: execution.answer,
      sourceReferences: execution.sourceReferences,
      missingDataIdentified: execution.missingDataIdentified,
      disclaimer: COPILOT_ADVISORY_DISCLAIMER,
      timestamp: Date.now(),
      auditLogId: auditId,
    };

    // 5. Validate Output Schema
    CopilotResponseSchema.parse(response);

    // 6. Audit Logging
    const auditRecord: CopilotAuditRecord = {
      id: auditId,
      timestamp: Date.now(),
      actorId: request.actorId,
      actorRole: request.actorRole ?? 'WARD_NURSE',
      patientId: request.evidence.patientId,
      query: request.query,
      sanitizedQuery: request.query.trim(),
      queryType: request.queryType,
      status: 'SUCCESS',
      contextHash: request.evidence.contextHash,
      sourceReferenceCount: execution.sourceReferences.length,
      responseTimeMs: Math.max(0, Date.now() - startTime),
    };
    this.auditLogger.log(auditRecord);

    return response;
  }

  /**
   * Processes a copilot request asynchronously (supports custom LLM provider with fail-safe fallback).
   */
  public async ask(request: CopilotRequest): Promise<CopilotResponse> {
    const startTime = Date.now();
    const responseId = `copilot-resp-${crypto.randomUUID()}`;
    const auditId = `copilot-audit-${crypto.randomUUID()}`;

    // 1. Direct Prompt Injection Defense
    const injectionCheck = detectPromptInjection(request.query);
    if (!injectionCheck.passed) {
      return this.recordRefusal(
        request,
        responseId,
        auditId,
        injectionCheck.refusalReason!,
        injectionCheck.refusalExplanation!,
        startTime
      );
    }

    // 1b. Indirect Prompt Injection & Context Poisoning Defense
    const indirectCheck = validateIndirectPromptInjection(request.evidence);
    if (!indirectCheck.passed) {
      return this.recordRefusal(
        request,
        responseId,
        auditId,
        indirectCheck.refusalReason!,
        indirectCheck.refusalExplanation!,
        startTime
      );
    }

    // 2. Forbidden Medical Action & Safety Override Check
    const forbiddenCheck = detectForbiddenIntent(request.query, request.queryType);
    if (!forbiddenCheck.passed) {
      return this.recordRefusal(
        request,
        responseId,
        auditId,
        forbiddenCheck.refusalReason!,
        forbiddenCheck.refusalExplanation!,
        startTime
      );
    }

    // 3. Grounding & Missing Data Check
    const groundingCheck = validateEvidenceGrounding(request.query, request.evidence);
    if (!groundingCheck.passed) {
      return this.recordRefusal(
        request,
        responseId,
        auditId,
        groundingCheck.refusalReason!,
        groundingCheck.refusalExplanation!,
        startTime
      );
    }

    // 4. Generate Answer via Custom LLM or Deterministic Fallback Engine
    let execution: {
      answer: string;
      sourceReferences: CopilotSourceReference[];
      missingDataIdentified: string[];
    };

    if (this.customLLMProvider) {
      try {
        // Enforce 10s timeout on external untrusted LLM provider
        const timeoutMs = 10000;
        const llmResult = await Promise.race([
          this.customLLMProvider.generateResponse(
            request.queryType,
            request.query,
            request.evidence
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('LLM Provider Timeout')), timeoutMs)
          ),
        ]);

        // Output Guardrail & Provenance Verification
        const outputValidation = validateLLMOutput(llmResult, request.evidence);
        if (!outputValidation.passed) {
          console.warn(
            `[ClinicalCopilotEngine] Untrusted LLM output failed safety guardrails (${outputValidation.refusalReason}: ${outputValidation.refusalExplanation}). Falling back to deterministic engine.`
          );
          execution = this.deterministicEngine.execute(
            request.queryType,
            request.query,
            request.evidence
          );
        } else {
          execution = {
            answer: llmResult.answer,
            sourceReferences: llmResult.sourceReferences ?? [],
            missingDataIdentified:
              llmResult.missingDataIdentified ??
              request.evidence.missingVitals.map((v) => String(v)),
          };
        }
      } catch (err: any) {
        // Provider failure / rate limit / timeout fallback
        console.warn(
          `[ClinicalCopilotEngine] LLM Provider failure (${err.message}). Engaging deterministic fallback.`
        );
        execution = this.deterministicEngine.execute(
          request.queryType,
          request.query,
          request.evidence
        );
      }
    } else {
      execution = this.deterministicEngine.execute(
        request.queryType,
        request.query,
        request.evidence
      );
    }

    const response: CopilotResponse = {
      id: responseId,
      patientId: request.evidence.patientId,
      bedNumber: request.evidence.bedNumber,
      queryType: request.queryType,
      query: request.query,
      status: 'SUCCESS',
      answer: execution.answer,
      sourceReferences: execution.sourceReferences,
      missingDataIdentified: execution.missingDataIdentified,
      disclaimer: COPILOT_ADVISORY_DISCLAIMER,
      timestamp: Date.now(),
      auditLogId: auditId,
    };

    CopilotResponseSchema.parse(response);

    const auditRecord: CopilotAuditRecord = {
      id: auditId,
      timestamp: Date.now(),
      actorId: request.actorId,
      actorRole: request.actorRole ?? 'WARD_NURSE',
      patientId: request.evidence.patientId,
      query: request.query,
      sanitizedQuery: request.query.trim(),
      queryType: request.queryType,
      status: 'SUCCESS',
      contextHash: request.evidence.contextHash,
      sourceReferenceCount: execution.sourceReferences.length,
      responseTimeMs: Math.max(0, Date.now() - startTime),
    };
    this.auditLogger.log(auditRecord);

    return response;
  }

  private recordRefusal(
    request: CopilotRequest,
    responseId: string,
    auditId: string,
    reason: CopilotRefusalReason,
    explanation: string,
    startTime: number
  ): CopilotResponse {
    const response: CopilotResponse = {
      id: responseId,
      patientId: request.evidence.patientId,
      bedNumber: request.evidence.bedNumber,
      queryType: request.queryType,
      query: request.query,
      status: 'REFUSED',
      answer: `REFUSED: ${explanation}`,
      refusalReason: reason,
      refusalExplanation: explanation,
      sourceReferences: [],
      missingDataIdentified: request.evidence.missingVitals.map((v) => String(v)),
      disclaimer: COPILOT_ADVISORY_DISCLAIMER,
      timestamp: Date.now(),
      auditLogId: auditId,
    };

    CopilotResponseSchema.parse(response);

    const auditRecord: CopilotAuditRecord = {
      id: auditId,
      timestamp: Date.now(),
      actorId: request.actorId,
      actorRole: request.actorRole ?? 'WARD_NURSE',
      patientId: request.evidence.patientId,
      query: request.query,
      sanitizedQuery: request.query.trim(),
      queryType: request.queryType,
      status: 'REFUSED',
      refusalReason: reason,
      contextHash: request.evidence.contextHash,
      sourceReferenceCount: 0,
      responseTimeMs: Math.max(0, Date.now() - startTime),
    };
    this.auditLogger.log(auditRecord);

    return response;
  }

  public getLogger(): CopilotAuditLogger {
    return this.auditLogger;
  }
}
