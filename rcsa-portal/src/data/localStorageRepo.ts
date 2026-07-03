import type { Asset, Risk, Treatment, TreatmentStatus } from './models';
import type { RcsaRepository } from './repository';
import { SEED_ASSETS, SEED_RISKS, SEED_TREATMENTS } from './seed';
import { today } from '../domain/scoring';
import { auditLog, diffFields } from '../audit/auditLog';

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
  let n = 0;
  legacy.forEach((r) => {
    const hasPlan =
      !!r.actionPlan || !!r.deadline || !!r.responsible || (!!r.treatmentStatus && r.treatmentStatus !== 'Open');
    if (!hasPlan) return;
    n += 1;
    const title = (r.actionPlan && r.actionPlan.trim()) || 'Treatment plan';
    out.push({
      id: `TRT-${String(n).padStart(3, '0')}`,
      riskIds: [r.id],
      title: title.length > 60 ? `${title.slice(0, 57)}…` : title,
      description: r.actionPlan || '',
      owner: r.responsible || '',
      dueDate: r.deadline || '',
      status: r.treatmentStatus || 'Open',
      evidence: [],
      comments: [],
      submittedAt: today,
    });
  });
  return out;
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
    return this.read<LegacyRisk>(RISKS_KEY, SEED_RISKS as LegacyRisk[]).map(migrateRisk);
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
