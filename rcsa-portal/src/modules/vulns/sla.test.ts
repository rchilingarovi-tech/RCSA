// Characterization tests for vulnerability remediation SLAs (modules/vulns/types.ts).
// The deadline is DERIVED: discovered + SLA_DAYS[severity], in local time.
import { describe, expect, it } from 'vitest';
import { SLA_DAYS, isOpenVuln, slaBreached, slaDaysLeft, slaDeadline, type VulnSeverity, type VulnStatus } from './types';
import { freezeLocalTime } from '../../test/helpers';

const v = (severity: VulnSeverity, discovered: string, status: VulnStatus = 'Open') => ({ severity, discovered, status });

describe('SLA policy', () => {
  it('is 14 / 30 / 90 / 180 days by severity', () => {
    expect(SLA_DAYS).toEqual({ Critical: 14, High: 30, Medium: 90, Low: 180 });
  });
});

describe('slaDeadline', () => {
  it.each([
    ['Critical', '2026-10-01', '2026-10-15'],
    ['High', '2026-10-01', '2026-10-31'],
    ['Medium', '2026-10-01', '2026-12-30'],
    ['Low', '2026-10-01', '2027-03-30'],
  ] as const)('%s discovered %s → due %s', (sev, disc, due) => {
    expect(slaDeadline(v(sev, disc))).toBe(due);
  });

  it('crosses month ends and leap days correctly', () => {
    expect(slaDeadline(v('Critical', '2028-02-20'))).toBe('2028-03-05'); // 2028 is a leap year
    expect(slaDeadline(v('High', '2026-12-15'))).toBe('2027-01-14');
  });

  it('is empty when the discovery date is missing', () => {
    expect(slaDeadline(v('Critical', ''))).toBe('');
  });
});

describe('slaDaysLeft', () => {
  it('counts whole days from local today to the deadline (negative = past due)', () => {
    freezeLocalTime(2026, 11, 5);
    expect(slaDaysLeft(v('Critical', '2026-11-05'))).toBe(14);
    expect(slaDaysLeft(v('Critical', '2026-10-22'))).toBe(0); // due today
    expect(slaDaysLeft(v('Critical', '2026-10-21'))).toBe(-1);
  });

  it('is the same at 01:00 local as at noon (no UTC day shift)', () => {
    freezeLocalTime(2026, 11, 5, 1, 0);
    expect(slaDaysLeft(v('Critical', '2026-10-22'))).toBe(0);
  });

  it('is null when undated', () => {
    expect(slaDaysLeft(v('High', ''))).toBeNull();
  });
});

describe('isOpenVuln / slaBreached', () => {
  it('Open and In Remediation are open; Risk Accepted and Resolved stop the clock', () => {
    expect(isOpenVuln({ status: 'Open' })).toBe(true);
    expect(isOpenVuln({ status: 'In Remediation' })).toBe(true);
    expect(isOpenVuln({ status: 'Risk Accepted' })).toBe(false);
    expect(isOpenVuln({ status: 'Resolved' })).toBe(false);
  });

  it('breached = still open AND past the derived deadline', () => {
    freezeLocalTime(2026, 11, 5);
    expect(slaBreached(v('Critical', '2026-10-21', 'Open'))).toBe(true);
    expect(slaBreached(v('Critical', '2026-10-21', 'In Remediation'))).toBe(true);
  });

  it('is not breached on the deadline day itself', () => {
    freezeLocalTime(2026, 11, 5);
    expect(slaBreached(v('Critical', '2026-10-22'))).toBe(false);
  });

  it('closed vulnerabilities are never breached, however old', () => {
    freezeLocalTime(2026, 11, 5);
    expect(slaBreached(v('Critical', '2020-01-01', 'Resolved'))).toBe(false);
    expect(slaBreached(v('Critical', '2020-01-01', 'Risk Accepted'))).toBe(false);
  });

  it('undated vulnerabilities are never breached', () => {
    expect(slaBreached(v('Critical', ''))).toBe(false);
  });
});
