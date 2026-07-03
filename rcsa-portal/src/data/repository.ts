import type { Asset, Risk, Treatment } from './models';

/**
 * Swappable persistence boundary. Components and the store talk only to this
 * interface — never to localStorage or the seed directly. To move to a real
 * backend, implement this against HTTP/DB and swap the export in `index.ts`.
 *
 * The mock implementation is synchronous, but the contract returns Promises so
 * a network-backed implementation can drop in without changing call sites.
 */
export interface RcsaRepository {
  listAssets(): Promise<Asset[]>;
  listRisks(): Promise<Risk[]>;
  listTreatments(): Promise<Treatment[]>;
  /** Upsert: replaces by id if present, otherwise appends. */
  saveAsset(asset: Asset): Promise<Asset>;
  saveRisk(risk: Risk): Promise<Risk>;
  saveTreatment(treatment: Treatment): Promise<Treatment>;
  /** Deleting an asset unlinks it from risks (dropping orphaned risks), which in
   *  turn unlinks those risks from treatments (dropping orphaned treatments). */
  deleteAsset(id: string): Promise<void>;
  /** Deleting a risk unlinks it from treatments (dropping orphaned treatments). */
  deleteRisk(id: string): Promise<void>;
  deleteTreatment(id: string): Promise<void>;
  /** Restore the original demo data set. */
  resetToSeed(): Promise<{ assets: Asset[]; risks: Risk[]; treatments: Treatment[] }>;
}
