import type { Asset, Risk, Treatment, TreatmentStatus } from './models';
import type { RcsaImportCollections, RcsaRepository } from './repository';
import { SEED_ASSETS, SEED_RISKS, SEED_TREATMENTS } from './seed';
import { today } from '../domain/scoring';
import { auditLog, diffFields, type AuditInput } from '../audit/auditLog';
import { createIdAllocator } from './ids';
import { importNewRecords, readForImport, type ImportOutcome, type ImportParent, type ImportTarget, type ReadForImport } from './importCommit';

const ASSETS_KEY = 'rcsa.assets.v1';
const RISKS_KEY = 'rcsa.risks.v1';
const TREATMENTS_KEY = 'rcsa.treatments.v1';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Legacy risk shape (pre-Phase 2/3): single assetId + embedded treatment fields. */
type LegacyRisk = Risk & {
  assetId?: string;
  actionPlan?: string;
  responsible?: string;
  deadline?: string;
  treatmentStatus?: TreatmentStatus;
};

/**
 * Brings a stored risk up to the current shape:
 *  - legacy single `assetId` → `assetIds: [assetId]`
 *  - strips the embedded treatment fields (now their own Treatment entities).
 */
function migrateRisk(raw: LegacyRisk): Risk {
  const { assetId, actionPlan, responsible, deadline, treatmentStatus, ...rest } = raw;
  void actionPlan; void responsible; void deadline; void treatmentStatus;
  const assetIds = Array.isArray(raw.assetIds) ? raw.assetIds : assetId ? [assetId] : [];
  return { ...(rest as Risk), assetIds };
}

/** Derive Treatment entities from legacy risks that carried embedded plan fields. */
function deriveTreatments(legacy: LegacyRisk[]): Treatment[] {
  const out: Treatment[] = [];
  // Shared safe allocator, built once (linear). With no treatments stored yet
  // this yields TRT-001, TRT-002, … exactly as before.
  const ids = createIdAllocator('TRT', [], 3);
  legacy.forEach((r) => {
    const hasPlan =
      !!r.actionPlan || !!r.deadline || !!r.responsible || (!!r.treatmentStatus && r.treatmentStatus !== 'Open');
    if (!hasPlan) return;
    const title = (r.actionPlan && r.actionPlan.trim()) || 'Treatment plan';
    out.push({
      id: ids.next(),
      riskIds: [r.id],
      title: title.length > 60 ? `${title.slice(0, 57)}…` : title,
      description: r.actionPlan || '',
      owner: r.responsible || '',
      dueDate: r.deadline || '',
      status: r.treatmentStatus || 'Open',
      evidence: [],
      comments: [],
      submittedAt: today(),
    });
  });
  return out;
}

// ── ID integrity S2 import wiring (targets, parents for B-3) ─────────────────
const IMPORT_TARGETS: Record<keyof RcsaImportCollections, ImportTarget> = {
  assets: { key: ASSETS_KEY, label: 'Assets' },
  risks: { key: RISKS_KEY, label: 'Risks' },
  treatments: { key: TREATMENTS_KEY, label: 'Treatments', missingMessage: 'Treatments are not initialised in this browser. Nothing was imported.' },
};
const RISK_PARENT: ImportParent<Risk> = {
  key: ASSETS_KEY, label: 'assets', labels: { parent: 'asset', column: 'Asset ID' }, refsOf: (r) => r.assetIds,
};
const TREATMENT_PARENT: ImportParent<Treatment> = {
  key: RISKS_KEY, label: 'risks', labels: { parent: 'risk', column: 'Risk ID' }, refsOf: (t) => t.riskIds,
};

/** Risk read-backs are presented through migrateRisk IN MEMORY (as listRisks does); nothing is written. */
function displayRisks(outcome: ImportOutcome): ImportOutcome {
  if (outcome.kind === 'rejected') return outcome;
  if (outcome.kind === 'uncertain') {
    return outcome.refresh.status === 'ok'
      ? { ...outcome, refresh: { status: 'ok', records: (outcome.refresh.records as LegacyRisk[]).map(migrateRisk) } }
      : outcome;
  }
  return { ...outcome, records: (outcome.records as LegacyRisk[]).map(migrateRisk) };
}

/** Remove the given risk ids from every treatment; drop treatments left orphaned. */
function unlinkRisksFromTreatments(treatments: Treatment[], removed: Set<string>): Treatment[] {
  return treatments
    .map((t) => ({ ...t, riskIds: t.riskIds.filter((id) => !removed.has(id)) }))
    .filter((t) => t.riskIds.length > 0);
}

/**
 * Persists assets, risks and treatments to localStorage. Seeds from the demo data
 * set on first run, and migrates legacy data (single assetId + embedded treatment
 * fields) on read — so existing demo data keeps working without a reset.
 */
export class LocalStorageRepo implements RcsaRepository {
  private read<T>(key: string, seed: T[]): T[] {
    try {
      const raw = localStorage.getItem(key);
      if (raw == null) {
        this.write(key, seed);
        return clone(seed);
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : clone(seed);
    } catch {
      return clone(seed);
    }
  }

  private write<T>(key: string, value: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage may be unavailable (private mode); fail silently */
    }
  }

  async listAssets(): Promise<Asset[]> {
    return this.read<Asset>(ASSETS_KEY, SEED_ASSETS);
  }

  async listRisks(): Promise<Risk[]> {
    this.seedTreatmentsOnFreshInstall();
    return this.read<LegacyRisk>(RISKS_KEY, SEED_RISKS as LegacyRisk[]).map(migrateRisk);
  }

  /**
   * On a fresh install (neither risks nor treatments stored yet) seed the
   * treatments together with the risks. Otherwise listTreatments() would see
   * the just-seeded risks as legacy data and persist an empty treatment set.
   * Any existing data — including legacy risks awaiting migration — is untouched.
   */
  private seedTreatmentsOnFreshInstall(): void {
    try {
      if (localStorage.getItem(RISKS_KEY) == null && localStorage.getItem(TREATMENTS_KEY) == null) {
        this.write(TREATMENTS_KEY, SEED_TREATMENTS);
      }
    } catch {
      /* storage unavailable — listTreatments() falls back to the seed */
    }
  }

  async listTreatments(): Promise<Treatment[]> {
    try {
      const raw = localStorage.getItem(TREATMENTS_KEY);
      if (raw != null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as Treatment[];
      }
    } catch {
      return clone(SEED_TREATMENTS);
    }

    // Treatments not initialised yet. Fresh install → seed. Existing risks present
    // → one-time migration: derive treatments from their embedded fields and
    // rewrite the risks in their cleaned shape.
    const risksRaw = (() => {
      try {
        return localStorage.getItem(RISKS_KEY);
      } catch {
        return null;
      }
    })();

    if (risksRaw == null) {
      this.write(TREATMENTS_KEY, SEED_TREATMENTS);
      return clone(SEED_TREATMENTS);
    }

    let legacy: LegacyRisk[] = [];
    try {
      const parsed = JSON.parse(risksRaw);
      if (Array.isArray(parsed)) legacy = parsed as LegacyRisk[];
    } catch {
      legacy = [];
    }
    const treatments = deriveTreatments(legacy);
    this.write(TREATMENTS_KEY, treatments);
    this.write(RISKS_KEY, legacy.map(migrateRisk));
    return treatments;
  }

  async saveAsset(asset: Asset): Promise<Asset> {
    const assets = await this.listAssets();
    const idx = assets.findIndex((a) => a.id === asset.id);
    const isNew = idx === -1;
    const before = isNew ? null : assets[idx];
    if (isNew) assets.push(asset);
    else assets[idx] = asset;
    this.write(ASSETS_KEY, assets);
    auditLog.record({ action: isNew ? 'create' : 'update', entity: 'Asset', entityId: asset.id, summary: `${isNew ? 'Created' : 'Updated'} Asset ${asset.id} — ${asset.name}`, changes: diffFields((before ?? {}) as Record<string, unknown>, asset as unknown as Record<string, unknown>) });
    return asset;
  }

  async saveRisk(risk: Risk): Promise<Risk> {
    const risks = await this.listRisks();
    const idx = risks.findIndex((r) => r.id === risk.id);
    const isNew = idx === -1;
    const before = isNew ? null : risks[idx];
    if (isNew) risks.push(risk);
    else risks[idx] = risk;
    this.write(RISKS_KEY, risks);
    auditLog.record({ action: isNew ? 'create' : 'update', entity: 'Risk', entityId: risk.id, summary: `${isNew ? 'Created' : 'Updated'} Risk ${risk.id} — ${risk.threat}`, changes: diffFields((before ?? {}) as Record<string, unknown>, risk as unknown as Record<string, unknown>) });
    return risk;
  }

  async saveTreatment(treatment: Treatment): Promise<Treatment> {
    const treatments = await this.listTreatments();
    const idx = treatments.findIndex((t) => t.id === treatment.id);
    const isNew = idx === -1;
    const before = isNew ? null : treatments[idx];
    if (isNew) treatments.push(treatment);
    else treatments[idx] = treatment;
    this.write(TREATMENTS_KEY, treatments);
    auditLog.record({ action: isNew ? 'create' : 'update', entity: 'Treatment', entityId: treatment.id, summary: `${isNew ? 'Created' : 'Updated'} Treatment ${treatment.id} — ${treatment.title || 'Untitled'}`, changes: diffFields((before ?? {}) as Record<string, unknown>, treatment as unknown as Record<string, unknown>) });
    return treatment;
  }

  async deleteAsset(id: string): Promise<void> {
    const removed = (await this.listAssets()).find((a) => a.id === id);
    const assets = (await this.listAssets()).filter((a) => a.id !== id);
    // Unlink this asset from every risk; a risk with no assets left is orphaned.
    const before = await this.listRisks();
    const risks = before
      .map((r) => ({ ...r, assetIds: r.assetIds.filter((aid) => aid !== id) }))
      .filter((r) => r.assetIds.length > 0);
    const removedRiskIds = new Set(
      before.filter((r) => !risks.some((k) => k.id === r.id)).map((r) => r.id),
    );
    this.write(ASSETS_KEY, assets);
    this.write(RISKS_KEY, risks);
    if (removedRiskIds.size) {
      const treatments = unlinkRisksFromTreatments(await this.listTreatments(), removedRiskIds);
      this.write(TREATMENTS_KEY, treatments);
    }
    auditLog.record({ action: 'delete', entity: 'Asset', entityId: id, summary: `Deleted Asset ${id}${removed ? ` — ${removed.name}` : ''}`, changes: removed ? diffFields(removed as unknown as Record<string, unknown>, {}) : undefined });
  }

  async deleteRisk(id: string): Promise<void> {
    const removed = (await this.listRisks()).find((r) => r.id === id);
    const risks = (await this.listRisks()).filter((r) => r.id !== id);
    this.write(RISKS_KEY, risks);
    const treatments = unlinkRisksFromTreatments(await this.listTreatments(), new Set([id]));
    this.write(TREATMENTS_KEY, treatments);
    auditLog.record({ action: 'delete', entity: 'Risk', entityId: id, summary: `Deleted Risk ${id}${removed ? ` — ${removed.threat}` : ''}`, changes: removed ? diffFields(removed as unknown as Record<string, unknown>, {}) : undefined });
  }

  async deleteTreatment(id: string): Promise<void> {
    const removed = (await this.listTreatments()).find((t) => t.id === id);
    const treatments = (await this.listTreatments()).filter((t) => t.id !== id);
    this.write(TREATMENTS_KEY, treatments);
    auditLog.record({ action: 'delete', entity: 'Treatment', entityId: id, summary: `Deleted Treatment ${id}${removed ? ` — ${removed.title || 'Untitled'}` : ''}`, changes: removed ? diffFields(removed as unknown as Record<string, unknown>, {}) : undefined });
  }

  // ── ID integrity S2: create-only CSV import (import path only) ─────────────
  // Uses data/importCommit.ts: raw reads only — never listX(), read(), the seed
  // or the legacy migration — so no other key is written. Existing methods
  // above are unchanged.

  async importNew<K extends keyof RcsaImportCollections>(collection: K, rows: RcsaImportCollections[K][]): Promise<ImportOutcome> {
    if (collection === 'assets') {
      return importNewRecords<Asset>({
        target: IMPORT_TARGETS.assets,
        rows: rows as Asset[],
        // Same events saveAsset records for a create (one per record).
        auditEvents: (rs) => rs.map((a): AuditInput => ({
          action: 'create', entity: 'Asset', entityId: a.id, summary: `Created Asset ${a.id} — ${a.name}`,
          changes: diffFields({}, a as unknown as Record<string, unknown>),
        })),
      });
    }
    if (collection === 'risks') {
      const outcome = importNewRecords<Risk>({
        target: IMPORT_TARGETS.risks,
        rows: rows as Risk[],
        parent: RISK_PARENT,
        auditEvents: (rs) => rs.map((r): AuditInput => ({
          action: 'create', entity: 'Risk', entityId: r.id, summary: `Created Risk ${r.id} — ${r.threat}`,
          changes: diffFields({}, r as unknown as Record<string, unknown>),
        })),
      });
      return displayRisks(outcome);
    }
    return importNewRecords<Treatment>({
      target: IMPORT_TARGETS.treatments,
      rows: rows as Treatment[],
      parent: TREATMENT_PARENT,
      auditEvents: (rs) => rs.map((t): AuditInput => ({
        action: 'create', entity: 'Treatment', entityId: t.id, summary: `Created Treatment ${t.id} — ${t.title || 'Untitled'}`,
        changes: diffFields({}, t as unknown as Record<string, unknown>),
      })),
    });
  }

  async readForImport<K extends keyof RcsaImportCollections>(collection: K): Promise<ReadForImport> {
    const r = readForImport(IMPORT_TARGETS[collection].key);
    // Risks are displayed through migrateRisk IN MEMORY, exactly as listRisks()
    // presents them today; nothing is written.
    if (r.status === 'ok' && collection === 'risks') return { status: 'ok', records: (r.records as LegacyRisk[]).map(migrateRisk) };
    return r;
  }

  async resetToSeed(): Promise<{ assets: Asset[]; risks: Risk[]; treatments: Treatment[] }> {
    const assets = clone(SEED_ASSETS);
    const risks = clone(SEED_RISKS);
    const treatments = clone(SEED_TREATMENTS);
    this.write(ASSETS_KEY, assets);
    this.write(RISKS_KEY, risks);
    this.write(TREATMENTS_KEY, treatments);
    auditLog.record({ action: 'reset', entity: 'RCSA', summary: 'Reset RCSA demo data (assets, risks, treatments)' });
    return { assets, risks, treatments };
  }
}
