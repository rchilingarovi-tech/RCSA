import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';
import { useStore } from '../../state/AppStore';
import { useModals } from '../../state/ModalsProvider';
import { usePermissions } from '../../auth/usePermissions';
import {
  assetValue, criticality, riskLevel, isOverdue, rollupStatus, treatmentStatus, statusBadgeClass,
  inherentScore, residualScore,
} from '../../domain/scoring';
import type { Asset, Risk, Treatment } from '../../data/models';

function RiskSummaryRow({ r, asset, treatments }: { r: Risk; asset: Asset | undefined; treatments: Treatment[] }) {
  const modals = useModals();
  const riskPerms = usePermissions('risk-catalogue');
  const treatmentPerms = usePermissions('treatment-catalogue');
  const inScore = inherentScore(r);
  const resScore = residualScore(r);
  const inLevel = riskLevel(inScore);
  const resLevel = resScore == null ? null : riskLevel(resScore);
  const status = rollupStatus(treatments);

  return (
    <div className="border rounded-xl p-4 section-card space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-blue-600 font-bold">{r.id}</span>
            <Badge className={statusBadgeClass(status)}>{status}</Badge>
            <Badge className={r.assessment === 'Accept' ? 'bg-orange-100 text-orange-800' : 'bg-purple-100 text-purple-800'}>{r.assessment}</Badge>
          </div>
          <h4 className="font-bold text-gray-800 mt-1">{r.threat}</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            {asset?.name || r.assetIds[0]} · Owner: {r.owner || 'Not assigned'}
            {r.assetIds.length > 1 && (
              <span className="ml-1 text-blue-600">· shared with {r.assetIds.length - 1} other asset{r.assetIds.length - 1 !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className={inLevel[1]}>Inherent {inScore} · {inLevel[0]}</Badge>
          {resScore == null || resLevel == null
            ? <Badge className="bg-gray-100 text-gray-700">Residual · Not assessed</Badge>
            : <Badge className={resLevel[1]}>Residual {resScore} · {resLevel[0]}</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div><div className="text-xs text-gray-500 font-semibold uppercase">Vulnerability</div><div>{r.vuln || 'Not provided'}</div></div>
        <div><div className="text-xs text-gray-500 font-semibold uppercase">Treatments</div><div>{treatments.length || 'None'}</div></div>
        <div><div className="text-xs text-gray-500 font-semibold uppercase">Acceptance Expiry</div><div>{r.acceptanceExpiry || 'N/A'}</div></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-gray-500 font-semibold uppercase mb-1">Controls</div>
          <div className="flex flex-wrap gap-1">
            {r.controls.length ? r.controls.map((c, i) => <Badge key={i} className="bg-gray-100 text-gray-700">{c}</Badge>)
              : <span className="text-xs text-red-500">No controls registered</span>}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 font-semibold uppercase mb-1">Evidence</div>
          <div className="flex flex-wrap gap-1">
            {r.evidence.length ? r.evidence.map((e, i) => <Badge key={i} className="bg-blue-100 text-blue-800">{e}</Badge>)
              : <span className="text-xs text-gray-400">No evidence</span>}
          </div>
        </div>
      </div>
      <div className="text-sm">
        <div className="text-xs text-gray-500 font-semibold uppercase mb-1">Treatments</div>
        {treatments.length ? (
          <div className="space-y-1.5">
            {treatments.map((t) => {
              const st = treatmentStatus(t);
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 border rounded px-3 py-1.5 bg-gray-50">
                  <span className="min-w-0">
                    <span className="font-mono text-xs text-blue-600 mr-2">{t.id}</span>
                    <span className="font-medium">{t.title || 'Untitled treatment'}</span>
                    <span className="text-gray-500"> · {t.owner || 'Unassigned'} · Due {t.dueDate || 'N/A'}</span>
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={statusBadgeClass(st)}>{st}</Badge>
                    {treatmentPerms.edit && <button onClick={() => modals.editTreatment(t.id)} className="text-blue-600 text-xs hover:underline">Edit</button>}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-gray-400">No treatments recorded for this risk.</div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-blue-600 font-semibold">Comments / review notes</summary>
        <div className="mt-2 space-y-2">
          {r.comments.length ? r.comments.map((c, i) => <div key={i} className="comment-bubble">{c}</div>)
            : <span className="text-xs text-gray-400">No comments</span>}
        </div>
      </details>
      {riskPerms.edit && (
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={() => modals.editRiskFromSummary(r.id)} className="btn-neutral border rounded px-3 py-1.5 text-xs hover:bg-gray-50">Edit Risk</button>
        </div>
      )}
    </div>
  );
}

export function AssetSummaryModal({ assetId }: { assetId: string }) {
  const store = useStore();
  const modals = useModals();
  const riskPerms = usePermissions('risk-catalogue');
  const assetPerms = usePermissions('asset-catalogue');
  const a = store.assets.find((x) => x.id === assetId);
  if (!a) return null;

  const relatedRisks = store.risks.filter((r) => r.assetIds.includes(assetId));
  const relatedRiskIds = new Set(relatedRisks.map((r) => r.id));
  const relatedTreatments = store.treatments.filter((t) => t.riskIds.some((id) => relatedRiskIds.has(id)));
  const treatmentsFor = (riskId: string) => store.treatments.filter((t) => t.riskIds.includes(riskId));
  const v = assetValue(a);
  const [critLabel, critClass] = criticality(v);
  const assessedResiduals = relatedRisks.map(residualScore).filter((s): s is number => s != null);
  const highOrCritical = assessedResiduals.filter((s) => ['High', 'Critical'].includes(riskLevel(s)[0])).length;
  const overdue = relatedTreatments.filter(isOverdue).length;
  const accepted = relatedRisks.filter((r) => r.assessment === 'Accept').length;
  const maxResidual = assessedResiduals.length ? Math.max(...assessedResiduals) : 0;
  const maxResidualLevel = assessedResiduals.length ? riskLevel(maxResidual) : ['N/A', 'bg-gray-100 text-gray-700'];

  return (
    <Modal
      open
      onClose={() => modals.closeSummary()}
      onBack={() => modals.closeSummary()}
      title={`${a.id} – ${a.name}`}
      subtitle="Complete asset profile · connected risks · treatment status · evidence"
      maxWidth="max-w-6xl"
    >
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="dashboard-card p-3"><div className="text-xs text-gray-500">Asset Value</div><div className="text-2xl font-bold">{v}</div><Badge className={critClass}>{critLabel}</Badge></div>
          <div className="dashboard-card p-3"><div className="text-xs text-gray-500">Connected Risks</div><div className="text-2xl font-bold">{relatedRisks.length}</div><span className="text-xs text-gray-500">registered</span></div>
          <div className="dashboard-card p-3"><div className="text-xs text-gray-500">High / Critical</div><div className="text-2xl font-bold text-red-600">{highOrCritical}</div><span className="text-xs text-gray-500">residual</span></div>
          <div className="dashboard-card p-3"><div className="text-xs text-gray-500">Overdue Plans</div><div className={`text-2xl font-bold ${overdue ? 'text-red-600' : 'text-gray-700'}`}>{overdue}</div><span className="text-xs text-gray-500">actions</span></div>
          <div className="dashboard-card p-3"><div className="text-xs text-gray-500">Max Residual</div><div className="text-2xl font-bold">{maxResidual || '-'}</div><Badge className={maxResidualLevel[1]}>{maxResidualLevel[0]}</Badge></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 border rounded-xl p-4 section-card">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3">
              <div>
                <h4 className="font-bold text-gray-800">Asset information</h4>
                <p className="text-xs text-gray-500">{a.process} · {a.department}</p>
              </div>
              <Badge className={a.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}>{a.status}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-sm">
              <div><div className="text-xs text-gray-500 font-semibold uppercase">Business Owner</div><div>{a.busOwner}</div></div>
              <div><div className="text-xs text-gray-500 font-semibold uppercase">IT Owner</div><div>{a.itOwner}</div></div>
              <div><div className="text-xs text-gray-500 font-semibold uppercase">Applicant</div><div>{a.applicantName}</div></div>
              <div><div className="text-xs text-gray-500 font-semibold uppercase">Data Class</div><div>{a.dataClass}</div></div>
              <div><div className="text-xs text-gray-500 font-semibold uppercase">Submitted</div><div>{a.submittedAt || 'N/A'}</div></div>
              <div><div className="text-xs text-gray-500 font-semibold uppercase">Next Review</div><div>{a.reviewDate || 'Not set'}</div></div>
              <div><div className="text-xs text-gray-500 font-semibold uppercase">CIA Score</div><div className="font-mono">{a.c}–{a.i}–{a.a}</div></div>
              <div><div className="text-xs text-gray-500 font-semibold uppercase">Accepted Risks</div><div>{accepted}</div></div>
              <div>
                <div className="text-xs text-gray-500 font-semibold uppercase">Evidence</div>
                <div className="flex flex-wrap gap-1">
                  {a.evidence.length ? a.evidence.map((e, i) => <Badge key={i} className="bg-blue-100 text-blue-800">{e}</Badge>)
                    : <span className="text-xs text-gray-400">No evidence uploaded</span>}
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm"><div className="text-xs text-gray-500 font-semibold uppercase">Notes</div><div>{a.notes ? a.notes : 'No notes provided.'}</div></div>
          </div>

          <div className="border rounded-xl p-4 section-card">
            <h4 className="font-bold text-gray-800">Scope tags</h4>
            <div className="mt-3 flex flex-wrap gap-1">
              <Badge className={a.pci === 'Yes' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700'}>{a.pci === 'Yes' ? 'PCI DSS' : 'Non-PCI'}</Badge>
              <Badge className={a.criticalProcess === 'Yes' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}>{a.criticalProcess === 'Yes' ? 'Critical Process' : 'Non-critical'}</Badge>
              <Badge className={a.internet === 'Yes' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'}>{a.internet === 'Yes' ? 'Internet-facing' : 'Internal-facing'}</Badge>
              <Badge className={a.thirdParty === 'Yes' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'}>{a.thirdParty === 'Yes' ? '3rd Party Dependency' : 'No 3rd Party'}</Badge>
              <Badge className={a.cloud === 'Yes' ? 'bg-sky-100 text-sky-800' : 'bg-gray-100 text-gray-700'}>{a.cloud === 'Yes' ? 'Cloud-hosted' : 'On-prem / internal'}</Badge>
            </div>
            <div className="mt-5 space-y-2">
              <button onClick={() => modals.viewAssetRiskTable(a.id)} className="btn-neutral w-full border rounded px-3 py-2 text-sm hover:bg-gray-50">Open Risk Register View</button>
              {riskPerms.create && <button onClick={() => modals.logRiskForAsset(a.id)} className="w-full bg-red-600 text-white rounded px-3 py-2 text-sm font-semibold">+ Log Risk for Asset</button>}
              {assetPerms.edit && <button onClick={() => modals.editAssetFromSummary(a.id)} className="btn-neutral w-full border rounded px-3 py-2 text-sm hover:bg-gray-50">Edit Asset</button>}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-gray-800">Risks connected to this asset</h4>
            <span className="text-xs text-gray-500">{relatedRisks.length} item{relatedRisks.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-3">
            {relatedRisks.length
              ? relatedRisks.map((r) => <RiskSummaryRow key={r.id} r={r} asset={a} treatments={treatmentsFor(r.id)} />)
              : <div className="border rounded-xl p-6 text-center text-gray-400 section-card">No risks are connected to this asset yet.</div>}
          </div>
        </div>
      </div>
    </Modal>
  );
}
