import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStore } from './AppStore';
import { useUi } from '../components/common/UiProvider';
import { AssetModal } from '../components/assets/AssetModal';
import { AssetSummaryModal } from '../components/assets/AssetSummaryModal';
import { RiskModal } from '../components/risks/RiskModal';
import { HeatmapModal } from '../components/risks/HeatmapModal';

interface AssetModalState {
  editId: string | null;
}
interface RiskModalState {
  editId: string | null;
  assetId: string | null;
}

interface ModalsApi {
  assetModal: AssetModalState | null;
  riskModal: RiskModalState | null;
  summaryAssetId: string | null;
  heatmapOpen: boolean;

  // openers from the main page
  newAsset(): void;
  editAsset(id: string): void;
  openSummary(assetId: string): void;
  openRiskForSelected(): void;
  editRisk(id: string): void;
  openHeatmap(): void;

  // openers from the asset summary modal
  editAssetFromSummary(assetId: string): void;
  logRiskForAsset(assetId: string): void;
  editRiskFromSummary(riskId: string): void;
  viewAssetRiskTable(assetId: string): void;

  // closers (back = return to summary if there is return context)
  closeAsset(returnToSummary?: boolean): void;
  closeRisk(returnToSummary?: boolean): void;
  closeSummary(): void;
  closeHeatmap(): void;

  // delete + post-save orchestration
  deleteAssetFlow(id: string): void;
  deleteRiskFlow(id: string): void;
  afterAssetSaved(savedId: string, editId: string): void;
  afterRiskSaved(): void;
}

const ModalsContext = createContext<ModalsApi | null>(null);

export function ModalsProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const ui = useUi();
  const [assetModal, setAssetModal] = useState<AssetModalState | null>(null);
  const [riskModal, setRiskModal] = useState<RiskModalState | null>(null);
  const [summaryAssetId, setSummaryAssetId] = useState<string | null>(null);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const summaryReturn = useRef<string | null>(null);

  const assetExists = useCallback((id: string) => store.assets.some((a) => a.id === id), [store.assets]);

  const api = useMemo<ModalsApi>(() => {
    return {
      assetModal,
      riskModal,
      summaryAssetId,
      heatmapOpen,

      newAsset() {
        summaryReturn.current = null;
        setAssetModal({ editId: null });
      },
      editAsset(id) {
        summaryReturn.current = null;
        setAssetModal({ editId: id });
      },
      openSummary(assetId) {
        summaryReturn.current = null;
        setSummaryAssetId(assetId);
      },
      openRiskForSelected() {
        if (!store.selectedAssetId) {
          ui.toast('Select an asset first.', 'bg-orange-600');
          return;
        }
        summaryReturn.current = null;
        setRiskModal({ editId: null, assetId: store.selectedAssetId });
      },
      editRisk(id) {
        const r = store.risks.find((x) => x.id === id);
        summaryReturn.current = null;
        setRiskModal({ editId: id, assetId: r ? r.assetId : null });
      },
      openHeatmap() {
        setHeatmapOpen(true);
      },

      editAssetFromSummary(assetId) {
        summaryReturn.current = assetId;
        setSummaryAssetId(null);
        setAssetModal({ editId: assetId });
      },
      logRiskForAsset(assetId) {
        summaryReturn.current = assetId;
        setSummaryAssetId(null);
        setRiskModal({ editId: null, assetId });
      },
      editRiskFromSummary(riskId) {
        const r = store.risks.find((x) => x.id === riskId);
        summaryReturn.current = r ? r.assetId : summaryAssetId;
        setSummaryAssetId(null);
        setRiskModal({ editId: riskId, assetId: r ? r.assetId : null });
      },
      viewAssetRiskTable(assetId) {
        summaryReturn.current = null;
        setSummaryAssetId(null);
        store.selectAsset(assetId);
      },

      closeAsset(returnToSummary = false) {
        setAssetModal(null);
        if (returnToSummary && summaryReturn.current) {
          const id = summaryReturn.current;
          summaryReturn.current = null;
          if (assetExists(id)) setSummaryAssetId(id);
        }
      },
      closeRisk(returnToSummary = false) {
        setRiskModal(null);
        if (returnToSummary && summaryReturn.current) {
          const id = summaryReturn.current;
          summaryReturn.current = null;
          if (assetExists(id)) setSummaryAssetId(id);
        }
      },
      closeSummary() {
        summaryReturn.current = null;
        setSummaryAssetId(null);
      },
      closeHeatmap() {
        setHeatmapOpen(false);
      },

      deleteAssetFlow(id) {
        const a = store.assets.find((x) => x.id === id);
        if (!a) return;
        const linked = store.risks.filter((r) => r.assetId === id).length;
        ui.confirm(
          `Delete "${a.name}"?`,
          `This will also delete all ${linked} risk(s) linked to this asset. This cannot be undone.`,
          () => {
            void store.deleteAsset(id);
            if (store.selectedAssetId === id) store.clearSelection();
            summaryReturn.current = null;
            setAssetModal(null);
            setSummaryAssetId(null);
            ui.toast('Asset deleted', 'bg-red-700');
          },
        );
      },
      deleteRiskFlow(id) {
        const r = store.risks.find((x) => x.id === id);
        if (!r) return;
        ui.confirm(`Delete risk "${r.id}"?`, `Threat: "${r.threat}". This cannot be undone.`, () => {
          const returnId = summaryReturn.current || summaryAssetId || r.assetId;
          void store.deleteRisk(id);
          summaryReturn.current = null;
          setRiskModal(null);
          if (returnId && assetExists(returnId)) setSummaryAssetId(returnId);
          ui.toast('Risk deleted', 'bg-red-700');
        });
      },
      afterAssetSaved(savedId, editId) {
        const returnId = summaryReturn.current ? savedId : null;
        summaryReturn.current = null;
        setAssetModal(null);
        if (returnId) {
          setSummaryAssetId(returnId);
          return;
        }
        if (store.selectedAssetId === editId || !editId) store.selectAsset(savedId);
      },
      afterRiskSaved() {
        const returnId = summaryReturn.current || summaryAssetId;
        summaryReturn.current = null;
        setRiskModal(null);
        if (returnId && assetExists(returnId)) setSummaryAssetId(returnId);
      },
    };
  }, [assetModal, riskModal, summaryAssetId, heatmapOpen, store, ui, assetExists]);

  return (
    <ModalsContext.Provider value={api}>
      {children}
      {assetModal && <AssetModal editId={assetModal.editId} />}
      {riskModal && <RiskModal editId={riskModal.editId} assetId={riskModal.assetId} />}
      {summaryAssetId && <AssetSummaryModal assetId={summaryAssetId} />}
      {heatmapOpen && <HeatmapModal />}
    </ModalsContext.Provider>
  );
}

export function useModals(): ModalsApi {
  const ctx = useContext(ModalsContext);
  if (!ctx) throw new Error('useModals must be used within ModalsProvider');
  return ctx;
}
