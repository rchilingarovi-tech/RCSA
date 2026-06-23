import { useStore } from './state/AppStore';
import { Header } from './components/Header';
import { KpiCards } from './components/KpiCards';
import { DashboardCharts } from './components/charts/DashboardCharts';
import { GlobalFilterBanner } from './components/GlobalFilterBanner';
import { AssetTable } from './components/assets/AssetTable';
import { AssetDetail } from './components/assets/AssetDetail';
import { RiskSection } from './components/risks/RiskSection';
import { isRiskSectionVisible } from './state/filters';

export default function App() {
  const store = useStore();

  if (!store.loaded) {
    return (
      <div className="max-w-7xl mx-auto p-4">
        <div className="section-card p-8 text-center text-gray-500">Loading RCSA Portal…</div>
      </div>
    );
  }

  const riskVisible = isRiskSectionVisible(store);

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <Header />
      <KpiCards />
      <DashboardCharts />
      <GlobalFilterBanner />

      <AssetTable />
      {store.selectedAssetId && <AssetDetail />}

      {riskVisible ? (
        <RiskSection />
      ) : (
        <div className="empty-risk-message bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-5 py-4 text-sm mt-4">
          Select an asset from the catalog or click a dashboard metric to view risks.
        </div>
      )}
    </div>
  );
}
