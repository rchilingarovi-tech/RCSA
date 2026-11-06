// Characterization tests for Compliance coverage (modules/compliance/types.ts).
// Coverage % = implemented ÷ applicable (Not Applicable excluded), rounded.
import { describe, expect, it } from 'vitest';
import { coverage, statusColor, type ComplianceControl, type ControlStatus } from './types';
import { SEED_CONTROLS } from './seed';

let n = 0;
const ctl = (status: ControlStatus, framework: ComplianceControl['framework'] = 'ISO 27001'): ComplianceControl => ({
  id: `CTL-${String(++n).padStart(3, '0')}`, framework, ref: 'A.1', title: 't', domain: 'd',
  status, evidence: false, owner: '', assessed: '',
});
const many = (k: number, s: ControlStatus) => Array.from({ length: k }, () => ctl(s));

describe('coverage(controls)', () => {
  it('is 0 for an empty set', () => {
    expect(coverage([])).toBe(0);
  });

  it('is 0 when every control is Not Applicable (no applicable controls)', () => {
    expect(coverage(many(3, 'Not Applicable'))).toBe(0);
  });

  it('is 100 when every applicable control is Implemented', () => {
    expect(coverage(many(4, 'Implemented'))).toBe(100);
  });

  it('excludes Not Applicable from the denominator', () => {
    // 2 implemented of 2 applicable (+3 N/A) → 100, not 40.
    expect(coverage([...many(2, 'Implemented'), ...many(3, 'Not Applicable')])).toBe(100);
  });

  it('counts In Progress and Not Started as NOT implemented', () => {
    expect(coverage([ctl('Implemented'), ctl('In Progress'), ctl('Not Started'), ctl('Not Started')])).toBe(25);
  });

  it('rounds to the nearest whole percent', () => {
    expect(coverage([ctl('Implemented'), ctl('Not Started'), ctl('Not Started')])).toBe(33); // 33.3
    expect(coverage([ctl('Implemented'), ctl('Implemented'), ctl('Not Started')])).toBe(67); // 66.7
    expect(coverage([...many(1, 'Implemented'), ...many(7, 'Not Started')])).toBe(13); // 12.5 → 13
  });

  it('pools controls across frameworks when given a mixed set', () => {
    const mixed = [ctl('Implemented', 'ISO 27001'), ctl('Not Started', 'PCI-DSS')];
    expect(coverage(mixed)).toBe(50);
  });

  it('pins the per-framework coverage of the shipped demo data set', () => {
    const per = Object.fromEntries(
      ['ISO 27001', 'NIST CSF', 'PCI-DSS', 'SOC 2', 'GDPR'].map((f) => [
        f,
        coverage(SEED_CONTROLS.filter((c) => c.framework === f)),
      ]),
    );
    // Snapshot of current behaviour on the seed — any change to the formula or
    // the seed will surface here.
    expect(per).toMatchSnapshot();
  });
});

describe('statusColor', () => {
  it('maps each status to its tone token', () => {
    expect(statusColor('Implemented')).toBe('low');
    expect(statusColor('In Progress')).toBe('info');
    expect(statusColor('Not Started')).toBe('crit');
    expect(statusColor('Not Applicable')).toBe('mut');
  });
});
