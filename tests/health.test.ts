import { describe, it, expect } from 'vitest';
import { clinicalModuleInfo } from '@aegispulse/clinical';
import { signalModuleInfo } from '@aegispulse/signal';
import { simulationModuleInfo } from '@aegispulse/simulation';
import type { Patient } from '@aegispulse/types';

describe('Monorepo Cross-Package Resolution', () => {
  it('resolves @aegispulse/types seamlessly', () => {
    const p: Patient = {
      id: 'test-1',
      name: 'Integration Test Patient',
      age: 50,
      gender: 'M',
      bedNumber: '101',
      admissionDiagnosis: 'Observation',
      admissionTimestamp: Date.now(),
      baselineMEWS: 0,
    };
    expect(p.id).toBe('test-1');
  });

  it('resolves all workspace packages correctly', () => {
    expect(clinicalModuleInfo.status).toBe('scaffold');
    expect(signalModuleInfo.algorithm).toBe('POS');
    expect(simulationModuleInfo.status).toBe('scaffold');
  });
});
