// REGRESSION — confirmed data-loss defect #2: custom controls lost on risk edit.
//
// RiskModal (components/risks/RiskModal.tsx) loads only controls that appear in
// CONTROL_CATALOGUE into its checkbox set, and on save writes the checked boxes
// plus the single (empty-on-edit) "custom control" field. Any non-catalogue
// control already stored on the risk is therefore dropped by an edit, even one
// that changes nothing.
//
// The scenario renders the REAL modal inside the real providers, opens an
// existing risk for editing, presses "Save Risk" without touching anything, and
// reads back what was persisted. Scenario failures (render errors, the modal
// never opening, the save never completing) throw non-assertion errors and are
// never mistaken for the defect.
import { useEffect, useRef } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { UiProvider } from '../../components/common/UiProvider';
import { AuthProvider } from '../../auth/AuthProvider';
import { AppStoreProvider, useStore } from '../../state/AppStore';
import { ModalsProvider, useModals } from '../../state/ModalsProvider';
import { repo } from '../../data';
import { CONTROL_CATALOGUE } from '../../domain/constants';
import type { Risk } from '../../data/models';
import { knownDefect } from '../helpers';

const CATALOGUE_CONTROLS = ['MFA enabled', 'Encryption enabled'];
const CUSTOM_CONTROLS = ['Quarterly firewall rule review', 'Dual control on SWIFT release'];

/** Opens the edit modal for `riskId` once the store has loaded. */
function OpenRiskForEdit({ riskId }: { riskId: string }) {
  const store = useStore();
  const modals = useModals();
  const opened = useRef(false);
  useEffect(() => {
    if (store.loaded && !opened.current) {
      opened.current = true;
      modals.editRisk(riskId);
    }
  }, [store.loaded, modals, riskId]);
  return null;
}

/** Store a risk with catalogue + custom controls, edit it, save unchanged, return what was persisted. */
async function editAndSaveUnchanged(): Promise<{ before: Risk; after: Risk }> {
  localStorage.setItem('infosec.auth.session', 'u-admin'); // signed in as the seeded admin
  const seeded = (await repo.listRisks())[0];
  if (!seeded) throw new Error('fixture: seed has no risks');
  const before: Risk = { ...seeded, controls: [...CATALOGUE_CONTROLS, ...CUSTOM_CONTROLS] };
  await repo.saveRisk(before);

  render(
    <UiProvider>
      <AuthProvider>
        <AppStoreProvider>
          <ModalsProvider>
            <OpenRiskForEdit riskId={before.id} />
          </ModalsProvider>
        </AppStoreProvider>
      </AuthProvider>
    </UiProvider>,
  );

  fireEvent.click(await screen.findByRole('button', { name: 'Save Risk' }));
  await screen.findByText('Risk updated'); // success toast → save has completed

  const after = (await repo.listRisks()).find((r) => r.id === before.id);
  if (!after) throw new Error('scenario: risk missing after save');
  return { before, after };
}

const withoutControls = ({ controls: _c, ...rest }: Risk) => { void _c; return rest; };

// ── Fixture facts and behaviour that is correct today ───────────────────────
describe('Risk edit — fixture', () => {
  it('the catalogue controls are in CONTROL_CATALOGUE and the custom ones are not', () => {
    for (const c of CATALOGUE_CONTROLS) expect(CONTROL_CATALOGUE).toContain(c);
    for (const c of CUSTOM_CONTROLS) expect(CONTROL_CATALOGUE).not.toContain(c);
  });

  it('an unchanged edit keeps every catalogue control and every other risk field', async () => {
    const { before, after } = await editAndSaveUnchanged();
    expect(after.controls).toEqual(expect.arrayContaining(CATALOGUE_CONTROLS));
    expect(withoutControls(after)).toEqual(withoutControls(before));
  });
});

// ── Known defect ─────────────────────────────────────────────────────────────
describe('Risk edit preserves controls', () => {
  knownDefect('an unchanged edit keeps every custom (non-catalogue) control', {
    observe: editAndSaveUnchanged,
    // True before AND after a fix: the save happened to the same risk, nothing
    // else on it changed, and the catalogue controls survived.
    invariants: ({ before, after }) => {
      expect(after.id).toBe(before.id);
      expect(withoutControls(after)).toEqual(withoutControls(before));
      expect(after.controls).toEqual(expect.arrayContaining(CATALOGUE_CONTROLS));
    },
    correct: ({ before, after }) => expect(after.controls).toEqual(before.controls),
    symptom: ({ after }) => after.controls,
    // Exactly today's result: both custom controls dropped, catalogue ones kept in order.
    documented: ['MFA enabled', 'Encryption enabled'],
  });
});
