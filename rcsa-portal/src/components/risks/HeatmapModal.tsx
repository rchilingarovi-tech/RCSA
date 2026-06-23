import { Modal } from '../common/Modal';
import { useStore } from '../../state/AppStore';
import { useModals } from '../../state/ModalsProvider';
import { riskLevel } from '../../domain/scoring';
import { getFilteredRisks } from '../../state/filters';

function cellBg(score: number): string {
  if (score <= 4) return '#dcfce7';
  if (score <= 9) return '#fef9c3';
  if (score <= 14) return '#fed7aa';
  return '#fee2e2';
}

const LEGEND: { label: string; color: string }[] = [
  { label: 'Low', color: '#dcfce7' },
  { label: 'Medium', color: '#fef9c3' },
  { label: 'High', color: '#fed7aa' },
  { label: 'Critical', color: '#fee2e2' },
];

/** Residual-risk heat-map grid for the currently visible risks (ported from showRiskHeatMapModal). */
export function HeatmapModal() {
  const store = useStore();
  const modals = useModals();

  const arr = getFilteredRisks({
    assets: store.assets,
    risks: store.risks,
    selectedAssetId: store.selectedAssetId,
    globalFilter: store.globalFilter,
    assetFilters: store.assetFilters,
    riskFilters: store.riskFilters,
  });

  const likelihoods = [5, 4, 3, 2, 1];
  const impacts = [1, 2, 3, 4, 5];

  return (
    <Modal
      open
      onClose={() => modals.closeHeatmap()}
      onBack={() => modals.closeHeatmap()}
      title="Risk Heat Map — Residual Risks"
      maxWidth="max-w-2xl"
    >
      <div className="p-6">
        {arr.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No risks match current criteria.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="text-xs mx-auto">
                <tbody>
                  <tr>
                    <td className="w-16" />
                    {impacts.map((imp) => (
                      <td key={imp} className="text-center font-semibold text-gray-500 px-1 pb-2">Impact {imp}</td>
                    ))}
                  </tr>
                  {likelihoods.map((lik) => (
                    <tr key={lik}>
                      <td className="text-xs text-gray-500 font-semibold pr-2 text-right w-20">L {lik}</td>
                      {impacts.map((imp) => {
                        const score = imp * lik;
                        const [lvl] = riskLevel(score);
                        const count = arr.filter((r) => r.resImpact === imp && r.resLikelihood === lik).length;
                        return (
                          <td key={imp} className="p-0.5">
                            <div className="heat-cell" style={{ background: cellBg(score), width: 60, height: 48 }} title={`${lvl} (${score})`}>
                              {count ? <span className="text-gray-800 font-bold">{count}</span> : ''}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3 justify-center mt-4 text-xs">
              {LEGEND.map((l) => (
                <span key={l.label} className="flex items-center gap-1">
                  <span style={{ background: l.color }} className="inline-block w-4 h-4 rounded" />
                  {l.label}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center mt-3">Numbers = count of residual risks in that cell</p>
          </>
        )}
      </div>
    </Modal>
  );
}
