import { describe, it, expect } from 'vitest';
import { calculateMEWSStub, calculateAPSStub, clinicalModuleInfo } from '../src/index';

describe('@aegispulse/clinical scaffold', () => {
  it('exposes valid module info', () => {
    expect(clinicalModuleInfo.version).toBe('0.1.0');
    expect(clinicalModuleInfo.status).toBe('scaffold');
  });

  it('calculates baseline MEWS stub safely', () => {
    const normal = calculateMEWSStub({ heartRate: 72, respiratoryRate: 16 });
    expect(normal.score).toBe(0);
    expect(normal.triageLevel).toBe('green');

    const tachy = calculateMEWSStub({ heartRate: 110, respiratoryRate: 24 });
    expect(tachy.score).toBe(4);
    expect(tachy.triageLevel).toBe('yellow');
  });

  it('provides APS stub ready for Milestone 1', () => {
    const result = calculateAPSStub([], 0);
    expect(result.score).toBe(0);
    expect(result.category).toBe('LOW');
  });
});
