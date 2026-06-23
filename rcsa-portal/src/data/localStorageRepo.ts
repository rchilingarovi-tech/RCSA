import type { Asset, Risk } from './models';
import type { RcsaRepository } from './repository';
import { SEED_ASSETS, SEED_RISKS } from './seed';

const ASSETS_KEY = 'rcsa.assets.v1';
const RISKS_KEY = 'rcsa.risks.v1';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Persists assets and risks to localStorage. Seeds from the demo data set on
 * first run (or when storage is empty / unreadable).
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
    return this.read<Risk>(RISKS_KEY, SEED_RISKS);
  }

  async saveAsset(asset: Asset): Promise<Asset> {
    const assets = await this.listAssets();
    const idx = assets.findIndex((a) => a.id === asset.id);
    if (idx === -1) assets.push(asset);
    else assets[idx] = asset;
    this.write(ASSETS_KEY, assets);
    return asset;
  }

  async saveRisk(risk: Risk): Promise<Risk> {
    const risks = await this.listRisks();
    const idx = risks.findIndex((r) => r.id === risk.id);
    if (idx === -1) risks.push(risk);
    else risks[idx] = risk;
    this.write(RISKS_KEY, risks);
    return risk;
  }

  async deleteAsset(id: string): Promise<void> {
    const assets = (await this.listAssets()).filter((a) => a.id !== id);
    const risks = (await this.listRisks()).filter((r) => r.assetId !== id);
    this.write(ASSETS_KEY, assets);
    this.write(RISKS_KEY, risks);
  }

  async deleteRisk(id: string): Promise<void> {
    const risks = (await this.listRisks()).filter((r) => r.id !== id);
    this.write(RISKS_KEY, risks);
  }

  async resetToSeed(): Promise<{ assets: Asset[]; risks: Risk[] }> {
    const assets = clone(SEED_ASSETS);
    const risks = clone(SEED_RISKS);
    this.write(ASSETS_KEY, assets);
    this.write(RISKS_KEY, risks);
    return { assets, risks };
  }
}
