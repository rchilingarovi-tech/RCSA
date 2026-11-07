import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type { Asset, Risk, Treatment } from '../data/models';
import { repo } from '../data';
import type { RcsaImportCollections } from '../data/repository';
import type { ImportOutcome } from '../data/importCommit';
import {
  EMPTY_ASSET_FILTERS,
  EMPTY_RISK_FILTERS,
  type AssetFilters,
  type GlobalFilter,
  type RiskFilters,
} from './filters';

interface State {
  loaded: boolean;
  assets: Asset[];
  risks: Risk[];
  treatments: Treatment[];
  selectedAssetId: string | null;
  globalFilter: GlobalFilter | null;
  assetFilters: AssetFilters;
  riskFilters: RiskFilters;
}

type Action =
  | { kind: 'init'; assets: Asset[]; risks: Risk[]; treatments: Treatment[] }
  | { kind: 'setAssets'; assets: Asset[] }
  | { kind: 'setRisks'; risks: Risk[] }
  | { kind: 'setTreatments'; treatments: Treatment[] }
  | { kind: 'setData'; assets: Asset[]; risks: Risk[]; treatments: Treatment[] }
  | { kind: 'selectAsset'; id: string }
  | { kind: 'setGlobalFilter'; filter: GlobalFilter }
  | { kind: 'clearGlobalFilter' }
  | { kind: 'dismissGlobalFilter' }
  | { kind: 'clearSelection' }
  | { kind: 'patchAssetFilters'; patch: Partial<AssetFilters> }
  | { kind: 'clearAssetFilters' }
  | { kind: 'patchRiskFilters'; patch: Partial<RiskFilters> }
  | { kind: 'resetRiskFilters' };

const initialState: State = {
  loaded: false,
  assets: [],
  risks: [],
  treatments: [],
  selectedAssetId: null,
  globalFilter: null,
  assetFilters: { ...EMPTY_ASSET_FILTERS },
  riskFilters: { ...EMPTY_RISK_FILTERS },
};

function reducer(state: State, action: Action): State {
  switch (action.kind) {
    case 'init':
      return { ...state, loaded: true, assets: action.assets, risks: action.risks, treatments: action.treatments };
    case 'setAssets':
      return { ...state, assets: action.assets };
    case 'setRisks':
      return { ...state, risks: action.risks };
    case 'setTreatments':
      return { ...state, treatments: action.treatments };
    case 'setData':
      return { ...state, assets: action.assets, risks: action.risks, treatments: action.treatments };
    case 'selectAsset':
      // selecting an asset clears the global filter and resets local risk filters
      return {
        ...state,
        selectedAssetId: action.id,
        globalFilter: null,
        riskFilters: { ...EMPTY_RISK_FILTERS },
      };
    case 'setGlobalFilter':
      // a global filter unselects the single asset
      return { ...state, globalFilter: action.filter, selectedAssetId: null };
    case 'clearGlobalFilter':
      return {
        ...state,
        globalFilter: null,
        selectedAssetId: null,
        assetFilters: { ...EMPTY_ASSET_FILTERS },
      };
    case 'dismissGlobalFilter':
      // Remove only the chart facet, keep the slicer selections.
      return { ...state, globalFilter: null };
    case 'clearSelection':
      return { ...state, selectedAssetId: null };
    case 'patchAssetFilters':
      return { ...state, assetFilters: { ...state.assetFilters, ...action.patch } };
    case 'clearAssetFilters':
      return { ...state, assetFilters: { ...EMPTY_ASSET_FILTERS } };
    case 'patchRiskFilters':
      return { ...state, riskFilters: { ...state.riskFilters, ...action.patch } };
    case 'resetRiskFilters':
      return { ...state, riskFilters: { ...EMPTY_RISK_FILTERS } };
    default:
      return state;
  }
}

interface StoreApi extends State {
  // data ops (write through repo, then update state)
  saveAsset(asset: Asset): Promise<void>;
  deleteAsset(id: string): Promise<void>;
  saveRisk(risk: Risk): Promise<void>;
  deleteRisk(id: string): Promise<void>;
  saveTreatment(treatment: Treatment): Promise<void>;
  deleteTreatment(id: string): Promise<void>;
  resetDemoData(): Promise<void>;
  /**
   * ID integrity S2 — create-only CSV import (the only import path; used by
   * ImportModal). State is refreshed ONLY from the outcome's storage read-back (verified
   * write, or the read-only re-read after an uncertain write); a rejected or
   * unreadable outcome leaves the state as it was. Never calls listX().
   */
  importNew<K extends keyof RcsaImportCollections>(collection: K, rows: RcsaImportCollections[K][]): Promise<ImportOutcome>;
  // navigation / filter ops
  selectAsset(id: string): void;
  clearSelection(): void;
  setGlobalFilter(filter: GlobalFilter): void;
  clearGlobalFilter(): void;
  dismissGlobalFilter(): void;
  patchAssetFilters(patch: Partial<AssetFilters>): void;
  clearAssetFilters(): void;
  patchRiskFilters(patch: Partial<RiskFilters>): void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let active = true;
    void Promise.all([repo.listAssets(), repo.listRisks(), repo.listTreatments()]).then(
      ([assets, risks, treatments]) => {
        if (active) dispatch({ kind: 'init', assets, risks, treatments });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const [assets, risks, treatments] = await Promise.all([
      repo.listAssets(),
      repo.listRisks(),
      repo.listTreatments(),
    ]);
    dispatch({ kind: 'setData', assets, risks, treatments });
  }, []);

  const saveAsset = useCallback(
    async (asset: Asset) => {
      await repo.saveAsset(asset);
      dispatch({ kind: 'setAssets', assets: await repo.listAssets() });
    },
    [],
  );

  const deleteAsset = useCallback(async (id: string) => {
    await repo.deleteAsset(id);
    await reload();
  }, [reload]);

  const saveRisk = useCallback(async (risk: Risk) => {
    await repo.saveRisk(risk);
    dispatch({ kind: 'setRisks', risks: await repo.listRisks() });
  }, []);

  const deleteRisk = useCallback(async (id: string) => {
    await repo.deleteRisk(id);
    // deleting a risk can orphan treatments — refresh both.
    const [risks, treatments] = await Promise.all([repo.listRisks(), repo.listTreatments()]);
    dispatch({ kind: 'setRisks', risks });
    dispatch({ kind: 'setTreatments', treatments });
  }, []);

  const saveTreatment = useCallback(async (treatment: Treatment) => {
    await repo.saveTreatment(treatment);
    dispatch({ kind: 'setTreatments', treatments: await repo.listTreatments() });
  }, []);

  const deleteTreatment = useCallback(async (id: string) => {
    await repo.deleteTreatment(id);
    dispatch({ kind: 'setTreatments', treatments: await repo.listTreatments() });
  }, []);

  const resetDemoData = useCallback(async () => {
    const { assets, risks, treatments } = await repo.resetToSeed();
    dispatch({ kind: 'setData', assets, risks, treatments });
  }, []);

  const importNew = useCallback(async <K extends keyof RcsaImportCollections>(collection: K, rows: RcsaImportCollections[K][]) => {
    const outcome = await repo.importNew(collection, rows);
    const records =
      outcome.kind === 'rejected' ? null
        : outcome.kind === 'uncertain' ? (outcome.refresh.status === 'ok' ? outcome.refresh.records : null)
          : outcome.records;
    if (records) {
      if (collection === 'assets') dispatch({ kind: 'setAssets', assets: records as Asset[] });
      else if (collection === 'risks') dispatch({ kind: 'setRisks', risks: records as Risk[] });
      else dispatch({ kind: 'setTreatments', treatments: records as Treatment[] });
    }
    return outcome;
  }, []);

  const api = useMemo<StoreApi>(
    () => ({
      ...state,
      saveAsset,
      deleteAsset,
      saveRisk,
      deleteRisk,
      saveTreatment,
      deleteTreatment,
      resetDemoData,
      importNew,
      selectAsset: (id) => dispatch({ kind: 'selectAsset', id }),
      clearSelection: () => dispatch({ kind: 'clearSelection' }),
      setGlobalFilter: (filter) => dispatch({ kind: 'setGlobalFilter', filter }),
      clearGlobalFilter: () => dispatch({ kind: 'clearGlobalFilter' }),
      dismissGlobalFilter: () => dispatch({ kind: 'dismissGlobalFilter' }),
      patchAssetFilters: (patch) => dispatch({ kind: 'patchAssetFilters', patch }),
      clearAssetFilters: () => dispatch({ kind: 'clearAssetFilters' }),
      patchRiskFilters: (patch) => dispatch({ kind: 'patchRiskFilters', patch }),
    }),
    [state, saveAsset, deleteAsset, saveRisk, deleteRisk, saveTreatment, deleteTreatment, resetDemoData, importNew],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within AppStoreProvider');
  return ctx;
}
