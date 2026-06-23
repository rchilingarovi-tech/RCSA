import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import type { Asset, Risk } from '../data/models';
import { repo } from '../data';
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
  selectedAssetId: string | null;
  globalFilter: GlobalFilter | null;
  assetFilters: AssetFilters;
  riskFilters: RiskFilters;
}

type Action =
  | { kind: 'init'; assets: Asset[]; risks: Risk[] }
  | { kind: 'setAssets'; assets: Asset[] }
  | { kind: 'setRisks'; risks: Risk[] }
  | { kind: 'setData'; assets: Asset[]; risks: Risk[] }
  | { kind: 'selectAsset'; id: string }
  | { kind: 'setGlobalFilter'; filter: GlobalFilter }
  | { kind: 'clearGlobalFilter' }
  | { kind: 'clearSelection' }
  | { kind: 'patchAssetFilters'; patch: Partial<AssetFilters> }
  | { kind: 'clearAssetFilters' }
  | { kind: 'patchRiskFilters'; patch: Partial<RiskFilters> }
  | { kind: 'resetRiskFilters' };

const initialState: State = {
  loaded: false,
  assets: [],
  risks: [],
  selectedAssetId: null,
  globalFilter: null,
  assetFilters: { ...EMPTY_ASSET_FILTERS },
  riskFilters: { ...EMPTY_RISK_FILTERS },
};

function reducer(state: State, action: Action): State {
  switch (action.kind) {
    case 'init':
      return { ...state, loaded: true, assets: action.assets, risks: action.risks };
    case 'setAssets':
      return { ...state, assets: action.assets };
    case 'setRisks':
      return { ...state, risks: action.risks };
    case 'setData':
      return { ...state, assets: action.assets, risks: action.risks };
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
  resetDemoData(): Promise<void>;
  // navigation / filter ops
  selectAsset(id: string): void;
  clearSelection(): void;
  setGlobalFilter(filter: GlobalFilter): void;
  clearGlobalFilter(): void;
  patchAssetFilters(patch: Partial<AssetFilters>): void;
  clearAssetFilters(): void;
  patchRiskFilters(patch: Partial<RiskFilters>): void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    let active = true;
    void Promise.all([repo.listAssets(), repo.listRisks()]).then(([assets, risks]) => {
      if (active) dispatch({ kind: 'init', assets, risks });
    });
    return () => {
      active = false;
    };
  }, []);

  const reload = useCallback(async () => {
    const [assets, risks] = await Promise.all([repo.listAssets(), repo.listRisks()]);
    dispatch({ kind: 'setData', assets, risks });
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
    dispatch({ kind: 'setRisks', risks: await repo.listRisks() });
  }, []);

  const resetDemoData = useCallback(async () => {
    const { assets, risks } = await repo.resetToSeed();
    dispatch({ kind: 'setData', assets, risks });
  }, []);

  const api = useMemo<StoreApi>(
    () => ({
      ...state,
      saveAsset,
      deleteAsset,
      saveRisk,
      deleteRisk,
      resetDemoData,
      selectAsset: (id) => dispatch({ kind: 'selectAsset', id }),
      clearSelection: () => dispatch({ kind: 'clearSelection' }),
      setGlobalFilter: (filter) => dispatch({ kind: 'setGlobalFilter', filter }),
      clearGlobalFilter: () => dispatch({ kind: 'clearGlobalFilter' }),
      patchAssetFilters: (patch) => dispatch({ kind: 'patchAssetFilters', patch }),
      clearAssetFilters: () => dispatch({ kind: 'clearAssetFilters' }),
      patchRiskFilters: (patch) => dispatch({ kind: 'patchRiskFilters', patch }),
    }),
    [state, saveAsset, deleteAsset, saveRisk, deleteRisk, resetDemoData],
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within AppStoreProvider');
  return ctx;
}
