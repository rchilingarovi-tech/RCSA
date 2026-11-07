import type { Asset, Risk, Treatment } from './models';
import type { ImportOutcome, ReadForImport } from './importCommit';

/** The RCSA collections a CSV import can create records in. */
export interface RcsaImportCollections {
  assets: Asset;
  risks: Risk;
  treatments: Treatment;
}

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
  /**
   * ID integrity S2 — CREATE-ONLY CSV import (import path only; saves are
   * unchanged). Audit pre-flight, raw-storage checks (IDs still free, B-3 parent
   * revalidation), one checked append-only write, one checked audit batch.
   * Returns one of the five §4.5 outcomes; never seeds, migrates or retries.
   */
  importNew<K extends keyof RcsaImportCollections>(collection: K, rows: RcsaImportCollections[K][]): Promise<ImportOutcome>;
  /** Read-only refresh source for one collection (raw read; risks shown via in-memory migrateRisk; no writes). */
  readForImport<K extends keyof RcsaImportCollections>(collection: K): Promise<ReadForImport>;
}
