// ID integrity S2 — unit tests for the pure identity rules (data/importIds.ts).
// Design: docs/ID_INTEGRITY_S2_DESIGN.md §3.3 (revision 6.1) and §3.4.
import { describe, expect, it } from 'vitest';
import {
  ARMORED, buildParentIndex, checkResolvedReference, collisionKey, createVariantSafeAllocator, parseReferenceCell,
} from './importIds';
import { MAX_ID_NUMBER } from './ids';

const ASSET = { parent: 'asset', column: 'Asset ID' };
const ids = (raw: string, stored: string[]) => parseReferenceCell(raw, buildParentIndex(stored), ASSET);

describe('collisionKey (detection only)', () => {
  it('folds case, surrounding whitespace and zero-padding, for any prefix', () => {
    expect(collisionKey('ast-7')).toBe(collisionKey('AST-007'));
    expect(collisionKey(' AST-7 ')).toBe(collisionKey('AST-0007'));
    expect(collisionKey('AST-000')).toBe('AST#0');
    expect(collisionKey('RSK-12')).not.toBe(collisionKey('AST-12'));
  });

  it('works on strings, so 20-digit suffixes are safe', () => {
    expect(collisionKey('VEN-00012345678901234567890')).toBe('VEN#12345678901234567890');
  });

  it('non-canonical IDs keep their (trimmed, upper-cased) text', () => {
    expect(collisionKey(' foo ')).toBe('FOO');
    expect(collisionKey('AST-2026-01')).toBe('AST-2026-01');
  });
});

describe('ARMORED is exactly the exporter armor (apostrophe before = + - @ tab CR)', () => {
  it.each(["'=x", "'+x", "'-x", "'@x", "'\tx", "'\rx", "'\t", "'\r"])('armored: %j', (s) => expect(ARMORED.test(s)).toBe(true));
  it.each(["'", "'a", "x'=", "=x", ''])('not armored: %j', (s) => expect(ARMORED.test(s)).toBe(false));
});

describe('parseReferenceCell — exact, fail-closed (§3.3)', () => {
  it('accepts exact IDs, written exactly; drops exact duplicates and blank items', () => {
    expect(ids('AST-001; AST-002, AST-001;', ['AST-001', 'AST-002'])).toEqual({ ids: ['AST-001', 'AST-002'], problems: [] });
  });

  it('rejects a case-only or padding variant (never redirected)', () => {
    expect(ids('ast-001', ['AST-001']).problems).toEqual(['"ast-001" does not exist. An asset "AST-001" exists; IDs must match exactly.']);
    expect(ids('AST-1', ['AST-001']).ids).toEqual([]);
  });

  it('rejects every member of an ambiguous stored group, even the exact spelling', () => {
    for (const ref of ['AST-500', 'ast-500']) {
      const r = ids(ref, ['AST-500', 'ast-500']);
      expect(r.ids).toEqual([]);
      expect(r.problems[0]).toMatch(/is ambiguous: stored assets "AST-500" and "ast-500"/);
    }
  });

  it('rejects a reference overlapping a token of a delimiter-bearing stored ID (both separators, CR, LF)', () => {
    for (const holder of ['AST-1;AST-2', 'AST-1,AST-2', 'AST-1\rAST-2', 'AST-1\nAST-2']) {
      const r = ids('AST-1', ['AST-1', 'AST-2', holder]);
      expect(r.ids, holder).toEqual([]);
      expect(r.problems[0]).toMatch(/contains a list separator, so this cell may refer to it/);
    }
  });

  it('rejects two different spellings of one key in the same cell', () => {
    expect(ids('AST-1; AST-001', ['AST-1']).problems.join(' ')).toMatch(/differ only in case, spacing or zero-padding/);
  });

  it('reports a missing parent with the pre-S2 message', () => {
    expect(ids('AST-404', ['AST-001']).problems).toEqual(['No asset "AST-404" exists — import the asset first']);
  });

  it('a stored ID made of a trimmable non-breaking space is never matched by its trimmed form', () => {
    const r = ids('AST-1', ['AST-1 ']);
    expect(r.ids).toEqual([]);
    expect(r.problems[0]).toMatch(/does not exist/);
  });
});

describe('parseReferenceCell — armor before trailing trim (revision 6.1, R6-1)', () => {
  // Competing parents: "\t" (tab) and "'" (apostrophe); and "\r" and "'".
  const TAB_PARENTS = ['\t', "'", 'AST-001'];
  const CR_PARENTS = ['\r', "'", 'AST-001'];

  it.each([
    ["'\t", TAB_PARENTS],
    ["'\r", CR_PARENTS],
    ["  '\t", TAB_PARENTS],
    ["'\t; AST-001", TAB_PARENTS],
  ] as const)('%j is armored and rejected — never linked to the apostrophe parent', (cell, stored) => {
    const r = ids(cell, [...stored]);
    expect(r.ids).not.toContain("'");
    expect(r.problems.some((p) => /apostrophe added by CSV export/.test(p))).toBe(true);
  });

  it('the armor check sees the untrimmed item: trim() alone would have produced the apostrophe parent', () => {
    expect("'\t".trim()).toBe("'"); // the Revision 6 bug
    expect(ids("'\t", TAB_PARENTS).ids).toEqual([]);
  });

  it('a blank-like stored parent makes an empty list entry an error instead of silently dropping it', () => {
    const r = ids('AST-001; \t', TAB_PARENTS);
    expect(r.ids).toEqual(['AST-001']);
    expect(r.problems).toEqual(['An empty list entry may refer to a stored asset whose ID is only spaces or control characters. Link it in the form.']);
  });

  it('controls: "\'" alone (no tab/CR parent) is an exact link; a trailing "; " is still dropped', () => {
    expect(ids("'", ["'", 'AST-001'])).toEqual({ ids: ["'"], problems: [] });
    expect(ids('AST-001; ', ["'", 'AST-001'])).toEqual({ ids: ['AST-001'], problems: [] });
  });
});

describe('buildParentIndex counts every raw record (Codex S2 step 2 review)', () => {
  it('two records with exactly the same ID form an ambiguous group; nothing is deduplicated', () => {
    const index = buildParentIndex(['AST-010', 'AST-010', 'AST-001']);
    expect(index.groups.get(collisionKey('AST-010'))).toEqual(['AST-010', 'AST-010']);
    expect(checkResolvedReference('AST-010', index, ASSET)).toBe('"AST-010" is ambiguous: 2 stored assets have exactly this ID. Link it in the form.');
    expect(checkResolvedReference('AST-001', index, ASSET)).toBeNull(); // unique parents unaffected
  });

  it('identical duplicates mixed with a case/padding variant are ambiguous for every spelling', () => {
    const index = buildParentIndex(['AST-010', 'AST-010', 'ast-0010']);
    expect(index.groups.get(collisionKey('AST-010'))).toHaveLength(3);
    for (const ref of ['AST-010', 'ast-0010']) {
      expect(checkResolvedReference(ref, index, ASSET)).toMatch(/is ambiguous: stored assets .* differ only in case, spacing or zero-padding/);
    }
  });

  it('parseReferenceCell rejects a reference to a duplicated ID (preview path)', () => {
    expect(ids('AST-010', ['AST-010', 'AST-010'])).toEqual({
      ids: [],
      problems: ['"AST-010" is ambiguous: 2 stored assets have exactly this ID. Link it in the form.'],
    });
    expect(ids('AST-011', ['AST-010', 'AST-010', 'AST-011'])).toEqual({ ids: ['AST-011'], problems: [] });
  });
});

describe('checkResolvedReference — the four step 5 checks (reused by B-3 in step 2)', () => {
  it('passes only for an exact, non-delimiter, single-member, non-overlapping ID', () => {
    const index = buildParentIndex(['AST-001', 'AST-500', 'ast-500', 'X;AST-009', 'AST-009']);
    expect(checkResolvedReference('AST-001', index, ASSET)).toBeNull();
    expect(checkResolvedReference('AST-404', index, ASSET)).toMatch(/No asset/);
    expect(checkResolvedReference('X;AST-009', index, ASSET)).toMatch(/contains a list separator and cannot be referenced/);
    expect(checkResolvedReference('AST-500', index, ASSET)).toMatch(/ambiguous/);
    expect(checkResolvedReference('AST-009', index, ASSET)).toMatch(/may refer to it/);
  });
});

describe('createVariantSafeAllocator (§3.4)', () => {
  it('skips a candidate whose collision key matches a stored variant', () => {
    const a = createVariantSafeAllocator('AST', ['AST-101', 'ast-0102', ' AST-103'], 3);
    expect([a.next(), a.next()]).toEqual(['AST-104', 'AST-105']);
  });

  it('numbering is unchanged for canonical data', () => {
    const a = createVariantSafeAllocator('AST', ['AST-001', 'AST-100'], 3);
    expect([a.next(), a.next()]).toEqual(['AST-101', 'AST-102']);
  });

  it('still fails at the numbering limit (S1)', () => {
    const a = createVariantSafeAllocator('VEN', [`VEN-${MAX_ID_NUMBER}`], 2);
    expect(() => a.next()).toThrow(/numbering limit/);
  });
});
