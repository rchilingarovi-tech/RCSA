# Record ID integrity: design (Milestone 4)

**Status:** design revision 3, **accepted by Codex** (`review-mw4r4axe-3lynff`). **Stage S1 is complete**: reviewed by Codex (ACCEPT) and merged into `develop` at `0793830` (PR #4, commit `061bb35`; see §0). Stages S2–S6 are **not implemented**; each needs separate approval. Rules: [`../AGENTS.md`](../AGENTS.md). Project state: [`DEVELOPMENT_STATUS.md`](DEVELOPMENT_STATUS.md).

## 0. Implementation status and decisions

| Stage | Status |
|---|---|
| **S1. One safe allocator** | **Completed.** Reviewed by Codex (final verdict ACCEPT, `review-mw4s0k34-cyg35x`) and merged into `develop` at `0793830` (PR #4, commit `061bb35`). A new shared allocator, `src/data/ids.ts`, is used by: `genId` (the Asset, Risk and Treatment forms); `createLocalRepo.nextId` (11 modules); both CSV importers (`io/import.ts`, `lib/tableIo.ts`); and the legacy treatment migration. All 14 create forms handle allocation errors. D1 is fixed and its 3 known-defect tests are now ordinary regression tests. R11 is fixed. **R15 stays open**, pinned as 2 known-defect tests. Regression tests: `src/data/ids.test.tsx` and `src/test/regressions/id-collision.test.ts`. |
| S2–S6 | Not started. Each needs separate approval. |

**User decisions recorded on 2026-11-06 for later stages (not implemented):**
- **D-1:** IDs should **never be reused, including after demo resets**. First resolve how the seeded IDs and a preserved counter coexist. For example, after a reset the seed brings back `AST-001…AST-100`, while the counter may already be beyond them.
- **D-2:** S2–S6 are implemented as **separate, individually approved stages**.
- **D-3:** Prefer **strict** validation of explicit IDs in imports, with a **documented compatibility mechanism for legitimate historical data**. For example, restoring an export of records whose IDs are below the high-water mark.

**Review history:**

| Review | Subject | Verdict |
|---|---|---|
| `review-mw4qlq4h-6u5kba` | Design revision 1 | REJECT: 6 findings (oversized IDs, existing case-variant IDs, imports bypassing the counter, counter recovery, relationship guarantees, cross-collection identity) |
| `review-mw4qvwva-qdi4x3` | Revision 2 | ACCEPT WITH CHANGES: 2 findings (R15 retargeting, form error handling) |
| `review-mw4r4axe-3lynff` | Revision 3 | **ACCEPT** |
| `review-mw4rjkcg-nnfgpo` | S1 implementation | ACCEPT WITH CHANGES: 2 import regressions, both fixed. (1) A rejected CSV row reserved its explicit ID and could use up numbering for later valid rows; now rows with validation errors reserve nothing. (2) Allocating each ID in a batch rebuilt state every time, so 10,000 rows took ~8 s; a per-import incremental `createIdAllocator` brings it to milliseconds. |
| `review-mw4rt7t8-8cvx2e` | S1 fixes | ACCEPT WITH CHANGES: both import fixes confirmed. One new finding, fixed: the legacy treatment migration also rebuilt allocator state for each row (10,000 records took ~7 s); it now uses one `createIdAllocator`, with a bulk-migration regression test that checks unchanged IDs and content. |
| `review-mw4s0k34-cyg35x` | migration fix | **ACCEPT**, no material findings. Codex ran the suite itself: 316/316, and exactly 17 known defects in defect mode. |

---

*The rest of this document is design revision 3 as accepted. Where it uses future tense about S1, that is now done (see §0).*

Paths are relative to `rcsa-portal/src/`.

Evidence labels:
- **[code]** confirmed by Claude reading the code;
- **[probe]** reproduced by Claude with a temporary probe test during the investigation. The probe file was deleted, and its results were kept only in the session working files;
- **[codex]** reproduced by Codex in review `review-mw4qlq4h-6u5kba`;
- **[test]** covered by existing automated tests.

**Revision 2** addresses the six findings from Codex review `review-mw4qlq4h-6u5kba` (Part A, REJECT): oversized IDs, existing IDs that collide when letter case is ignored, imports bypassing the counter, counter recovery, relationship guarantees, and consumers that need identity across collections.

**Revision 3** addresses the two findings from `review-mw4qvwva-qdi4x3` (ACCEPT WITH CHANGES). It narrows the relationship guarantee and adds R15, and makes S1 include allocation-error handling in all 14 create forms.

## 1. Inventory of ID mechanisms

| Collection (module) | Storage key | ID format | Who allocates the ID on create | Save semantics |
|---|---|---|---|---|
| Assets | `rcsa.assets.v1` | `AST-###` | `genId('AST', store.assets)`, `components/assets/AssetModal.tsx:83`, **based on the count of records** | `LocalStorageRepo.saveAsset`, **upsert** |
| Risks | `rcsa.risks.v1` | `RSK-###` | `genId('RSK', …)`, `components/risks/RiskModal.tsx:143`, **count-based** | `saveRisk`, upsert |
| Treatments | `rcsa.treatments.v1` | `TRT-###` | `genId('TRT', …)`, `components/treatments/TreatmentModal.tsx:66`, **count-based**. The legacy migration derives `TRT-001…`, but only when no treatments are stored. | `saveTreatment`, upsert |
| Compliance | `infosec.compliance.v1` | `CTL-###` | `complianceRepo.nextId()`, `CompliancePage.tsx:49` | `createLocalRepo.save`, upsert (no CSV import) |
| Audit Findings / Vendors / Incidents / Vulnerabilities / Policies / Committee / Access Reviews / KPIs / Yearly Plan / Awareness | `infosec.findings.v1`, `.vendors.v2`, `.incidents.v1`, `.vulns.v1`, `.policies.v2`, `.committee.v2`, `.access.v2`, `.kpis.v2`, `.plan.v2`, `.awareness.v2` | `FND-##`, `VEN-##`, `INC-###`, `VUL-##`, `POL-##`, `MTG-##`, `ACR-##`, `KPI-##`, `INI-##`, `TRN-##` | `<repo>.nextId()` on each module page | upsert; CSV import through `bulkSave`, also upsert |
| Users | `infosec.auth.users.v2` | `u-<time36><rand3>` | `userStore.nextId()` (`auth/userStore.ts:74`), time + random | upsert |
| Access grants | `infosec.auth.grants.v1` | keyed by user ID | — | replaced per user |
| Audit events | `infosec.audit.v1` | `EVT-<time36>-<rand5>` | `audit/auditLog.ts:84` | append-only; keeps the newest 1,000 |
| Dashboard snapshots | `infosec.overview.snapshots.v1` | keyed by date | `recordSnapshot` deliberately replaces that day's row | — |

**Allocators.** There are four, with three behaviours:
1. `genId` (`domain/scoring.ts:108`) takes the collection's **length + 1**.
2. `createLocalRepo.nextId()` (`data/createLocalRepo.ts:126`) takes the highest number + 1. It strips every non-digit from every ID and uses `Number` arithmetic.
3. The two CSV import allocators also take the highest number + 1 and skip IDs already used in the same file:
   - `makeIdAllocator` in `io/import.ts:155`;
   - `nextId` in `lib/tableIo.ts:124`.

**Create and update are not distinguished anywhere.** Every save is an upsert. The audit log labels a save "create" or "update" according to whether the ID already existed.

**Relationships:**
- `Risk.assetIds` points to Asset IDs, and `Treatment.riskIds` points to Risk IDs (`data/models.ts:49,77`).
- Deleting a record cascades: links to it are removed, and orphaned records are dropped.
- Imports check references, case-insensitively (`io/import.ts:297,412`).
- **Saving does not check references** (`saveRisk`, `saveTreatment`).

**Consumers that need identity across collections:**
- The Master Calendar uses the bare `e.id` as its React key (`MasterCalendarPage.tsx:230,330,359,376,392`).
- Navigation intents are scoped by module (`open:<module>:<id>`).
- Audit entries are scoped by entity type (`entity` + `entityId`).

## 2. Confirmed collision and overwrite risks

| # | Risk | Evidence | Scope |
|---|---|---|---|
| R1 | Count-based IDs **overwrite a live record** after any delete other than the last one (this is D1). | [test] [probe] P1, P1b | Assets, Risks, Treatments |
| R2 | After R1, **relationships move to the new record**: `TRT-195` attached itself to the new `RSK-204`, and 3 risks to the new `AST-100`. The audit log records an "update". | [probe] | RCSA |
| R3 | The **same existing ID twice in one import**: both rows count as updates, and the last silently wins. | [probe] P2, P4 | all 13 CSV-importing modules |
| R4 | **New IDs differing only in letter case** are both created (`ast-500`, `AST-500`). A later reference then resolves to whichever entry the lookup table kept. | [probe] P3; [code] | same |
| R5 | **ID reuse after deleting the highest record**: the old and new records' audit history merges under one ID. | [probe] P5 | 11 `createLocalRepo` modules (and RCSA once R1 is fixed) |
| R6 | An **upsert silently re-creates a deleted record** when an out-of-date edit form is submitted. | [probe] P6 | all repositories |
| R7 | **Allocation races between browser tabs** and lost updates. `localStorage` has no transactions. | [probe] P7, simulated; [code] | all |
| R8 | The **gap between import preview and commit**: RCSA commits row by row through upserts, so an import can be left half-done. | [code] `state/AppStore.tsx` `import*` | RCSA (the other modules write once, but against a snapshot taken at parse time) |
| R9 | **Demo reset reuses every seed ID** while the audit history is kept. | [code] | all |
| R10 | **IDs in a non-standard format are accepted.** Because every non-digit is stripped, `VEN-2026-01` counts as 202601 and numbering jumps. | [code] | `createLocalRepo` modules |
| **R11** | **Oversized numeric IDs.** Above `Number.MAX_SAFE_INTEGER`, `+1` no longer increases the number. `createLocalRepo.nextId()` hands back an *existing* ID, so the save **overwrites** that record. The `tableIo` allocator's `do…while` **never ends**, so the import hangs. | [codex] `VEN-9007199254740992`; [code] `createLocalRepo.ts:128-131`, `tableIo.ts:124-126`; `9007199254740992+1 === 9007199254740992` checked by Claude | 11 modules + 10 importers |
| **R12** | **IDs already stored that collide when letter case is ignored.** Once `ast-500` and `AST-500` both exist, an import of `ast-500` **updates `AST-500`**, because the lookup tables key on `toUpperCase()` and the later entry wins (`io/import.ts:185,296,411`; `tableIo` `byId`). | [codex]; [code] | all importers |
| **R13** | **Out-of-date edits restore deleted links.** Saving an old copy of a surviving risk brings back its link to an asset that has since been deleted. Saving doesn't check references. | [codex] | Risks→Assets, Treatments→Risks |
| **R15** | **An out-of-date reference attaches to a replacement record.** An old copy of a risk links `AST-100`; `AST-100` is deleted; its ID is later reissued (today by highest number + 1, and still under S1); saving the old copy links the risk to the **new, unrelated** asset. Neither S1 nor S4 detects this, and only S5 (never reuse) closes it. | [codex] counterexample against the real repository with S1/S4 modelled (`review-mw4qvwva-qdi4x3`) | Risks→Assets, Treatments→Risks |
| **R14** | **Raw IDs are not unique across collections.** Imports accept arbitrary IDs, so `SHARED` can exist in two modules. The calendar then gives two events the same React key. | [codex]; [code] `MasterCalendarPage.tsx` | Calendar (and any future cross-module view) |

Not a risk: users and audit events (time + random IDs, so a collision is very unlikely); dashboard snapshots (replaced by date on purpose); the legacy treatment migration (runs only when no treatments are stored).

## 3. Platform-wide ID policy (V1)

1. **Namespace = collection.** IDs must be unique within their collection. Generated IDs keep the existing prefixes, which don't overlap. **Cross-collection uniqueness is not guaranteed** for imported or legacy IDs. Any consumer that spans collections must use the composite key `(collection, id)`. There is no global sequence and no UUIDs; neither would fix upserts, ambiguous imports or stale references.
2. **Stored IDs never change.** They are treated as **opaque, case-sensitive strings**. They are never renumbered, normalised or rewritten, odd ones included.
3. **Identity is the exact ID.** Lookups, updates and reference resolution match the ID exactly. Letter case is ignored only to **detect conflicts**, never to pick a record. A case-only match is an error, with nothing written.
4. **Safe, bounded allocation with guaranteed progress.** One shared allocator serves each collection.
   - Only **canonical** IDs `^<PREFIX>-(\d{1,9})$` (exact prefix) are parsed for numbering. Every other ID is ignored for numbering but still counts as taken.
   - Arithmetic stays below 10⁹, well inside safe integers.
   - The next number is the highest canonical number, or the high-water mark if larger (once S5 exists), plus 1. The candidate is checked against the set of IDs already taken.
   - Progress is guaranteed: each attempt increases strictly, and there are at most `|taken| + 1` attempts. If the candidate would exceed 999,999,999, allocation **fails with an error** instead of looping or reusing an ID.
5. **Create and update are explicit.** Create fails if the ID is already taken. Update fails if the record no longer exists, so a deleted record is never re-created.
6. **Imports:**
   - blank ID: allocated by the collection allocator;
   - an exact match to an existing record: update;
   - anything else is a **new explicit ID**, accepted only under the explicit-ID rule (decision D-3);
   - duplicates within the file, or IDs matching an existing record only when letter case is ignored: **row errors**;
   - everything is re-validated against current storage at commit time and written **all or nothing**.
7. **Relationships:**
   - Create, update and import commit must reference **existing records** (exact ID).
   - An out-of-date link to a deleted record is rejected, never silently restored.
   - Cascade unlinking on delete is kept.
   - **What each stage guarantees:**
     - **S1** only stops a new record from **overwriting a live record**, which removes R1 and the R2 retargeting path.
     - **Until S5 exists, an ID that was deleted can still be reissued** (the highest deleted ID, R5). An out-of-date reference to it then **attaches to the replacement record (R15)**, for example an open edit form, another tab, or an old CSV row.
     - **S4 cannot detect R15**, because it only checks that the referenced ID exists.
     - **S5** closes R15 for IDs deleted after it starts, within the limits in §6.
     - Nothing in V1 prevents R15 for an ID deleted *before* S5 started, or after its counter is lost.
8. **Never reuse an ID (stage S5).** A high-water mark per collection, **reserved before** the record is written; if the reservation fails, the create stops. Its limits are stated in §6.
9. **What V1 cannot guarantee.** Atomic operations across tabs, preventing lost updates, and resistance to tampering. These are documented and not claimed.

## 4. Implementation plan

Every stage touches protected areas (`AGENTS.md` rule 2), so each needs its own approval. No stage rewrites existing IDs.

| Stage | Change | Main files | Fixes |
|---|---|---|---|
| **S1. One safe allocator** (the smallest fix for the data loss) | A new `data/ids.ts` `allocateId(prefix, takenIds, pad)` implementing policy 4. `genId` delegates to it, with its signature changed from `{length}` to records that have an `id`. `createLocalRepo.nextId` and **both import allocators** use it too. For canonical data, the allocated IDs are the same as today's (checked by tests). **Allocation errors are handled in all 14 create forms:** the reason is shown, the values entered are kept, and nothing is saved. Importers report an allocation error as a row error. D1 tests convert to regression tests. | `data/ids.ts` (new), `domain/scoring.ts`, `data/createLocalRepo.ts`, `io/import.ts`, `lib/tableIo.ts`, the 3 RCSA modals (`AssetModal`, `RiskModal`, `TreatmentModal`), the 11 module create forms | R1, R11; the R2 path through overwriting. **Not R15** (it needs S5). |
| **S2. Exact identity in imports** | Exact-ID lookups. Row errors for IDs that collide when letter case is ignored (within the file and against storage) and for duplicate IDs in the file. A re-check at commit time. RCSA commits as one write, all or nothing. | `io/import.ts`, `lib/tableIo.ts`, `state/AppStore.tsx`, `data/localStorageRepo.ts`, `components/ImportModal.tsx`, `components/common/ImportExport.tsx` | R3, R4, R8, R12 |
| **S3. Explicit create vs update** | Repositories get `create` (fails if the ID is taken) and `update` (fails if the record is missing). Modals and pages call the right one and show conflicts to the user. | `data/localStorageRepo.ts`, `data/createLocalRepo.ts`, `data/repository.ts`, `state/AppStore.tsx`, 3 RCSA modals, 11 pages | R6; R7 damage within one tab |
| **S4. Check references when saving** | Create, update and import commit reject links to records that don't exist (`assetIds`, `riskIds`). | `data/localStorageRepo.ts`, `state/AppStore.tsx` | R13 |
| **S5. Never-reuse high-water mark** (*decision D-1*) | A `<key>.seq` value per collection, used by the S1 allocator **on every path**. It is reserved first (write and read back); a failed reservation stops the create. The explicit-ID rule (D-3) is enforced against it. Recovery: a missing or corrupt counter is rebuilt from the highest canonical live ID and the event is logged; the guarantee weakens and that is documented. | `data/ids.ts`, `data/createLocalRepo.ts`, `data/localStorageRepo.ts`, both importers | R5, R9, **R15** (for IDs deleted after S5 starts, within §6 limits) |
| **S6. Composite keys across collections** | The calendar (and any cross-collection view) keys on `${module}:${id}`. Stored IDs don't change. | `modules/calendar/events.ts`, `MasterCalendarPage.tsx` | R14 |

**Recommended order:**
1. **S1:** it fixes the data loss, and Codex judged it safe as a first, separate step once safe arithmetic is specified (now done in policy 4).
2. **S2.**
3. **S3.**
4. **S4.**
5. **S6:** small, and independent of the rest.
6. **S5:** only after decisions D-1 to D-3.

S1 is **not** platform-wide ID integrity on its own. It stops live records being overwritten (R1, and the R2 retargeting path) and fixes R11. Out-of-date references can still attach to a reissued ID (R15) until S5.

## 5. Regression-test strategy

- **Allocator unit tests (S1):**
  - canonical IDs; gaps; deleting the first, middle or last record;
  - lowercase, non-prefixed and malformed IDs (counted as taken, ignored for numbering);
  - `VEN-2026-01`;
  - **unsafe integers** (`VEN-9007199254740992`, 20-digit suffixes): no reuse, and **termination is guaranteed**;
  - the error when the bound is reached;
  - "the same IDs as before" for every module's seed.
- **Allocation errors in forms (S1):** with an accepted explicit ID such as `AST-999999999` (or `VEN-999999999`), a create through a representative RCSA modal and a representative standalone form shows the reason, keeps the values entered, and saves nothing. All 14 forms are wired the same way. Importers turn the error into a row error.
- **Out-of-date reference retargeting (R15), for both Risk→Asset and Treatment→Risk:** keep an old copy referencing the parent, delete the parent, create a new parent, then save the old copy. Before S5 this is pinned as a **known defect**. After S5, the new parent gets a fresh ID and the old reference is rejected by S4.
- **Creation across all 14 collections:** delete any record, then create; the new ID is fresh, every survivor is unchanged, and the new record is saved exactly once. This extends the D1 specifications.
- **Relationships:**
  - after deleting and creating, `riskIds` and `assetIds` still point at the same content (S1);
  - an out-of-date edit after its parent was deleted is rejected (S4);
  - covered for both Risk→Asset and Treatment→Risk.
- **Imports (S2):**
  - the same existing ID twice; the same new ID twice; IDs differing only in case within a file;
  - an ID that matches an existing record only when case is ignored;
  - **case-variant IDs already in storage, in both storage orders**: the update is rejected and nothing is written;
  - a reference that matches an existing record only when case is ignored: rejected;
  - a commit-time conflict (a record created between preview and commit);
  - a failure partway through (nothing written);
  - an oversized ID in a file: no hang.
- **Create vs update (S3):** create with an ID that is taken fails and changes nothing; update of a missing ID fails and doesn't re-create it; the audit action is correct.
- **Never reuse (S5):**
  - create after deleting the highest record;
  - reload with a new repository instance;
  - demo reset;
  - **imports after deletion, reload and reset** (blank and explicit IDs);
  - counter-only write failure (the create stops);
  - an interrupted write (counter reserved but the record not written: a gap, no reuse);
  - a missing or corrupt counter (recovery behaves as documented);
  - an older build writing without the counter (behaves as documented).
- **Cross-collection (S6):** the same raw ID in two modules gives distinct calendar keys and events.
- **Preservation:** every existing ID and record is byte-identical after each stage, across all seeds and legacy fixtures.
- **Concurrency:** a deterministic two-instance interleaving test. With S3 a conflict is **detected**; across real tabs it is documented as **not prevented**.

## 6. Migration, backward compatibility and limits of the counter

- **Existing data:** IDs are never rewritten. Existing IDs that collide when letter case is ignored stay in place and can still be reached by their exact ID. Operations that would be ambiguous are refused rather than guessed.
- **Lost data:** records already overwritten by D1 **cannot be recovered**.
- **S5 starts protecting only from first use.** Deletions made before then can't be known, so IDs deleted earlier may still be reissued.
- **If the counter is lost** (storage cleared, or the key deleted or corrupted), the guarantee falls back to "highest live canonical ID + 1", so the highest deleted IDs can be reissued. This is recorded in the audit log and documented.
- **Downgrade:** an older build ignores `.seq` and can reuse IDs. For a V1 demo, the documented rule is: don't run older builds against storage that has been upgraded.
- **Write order:** the counter is reserved, then the record is written. If the record write fails, the result is a gap, never a reuse. If the reservation fails, the create stops. Because `localStorage` writes elsewhere fail silently (a known persistence defect), the reservation is read back to verify it.

## 7. Security and data-integrity limits (V1 vs V2)

V1 (`localStorage`) **cannot** guarantee:
- atomicity across keys or tabs;
- protection against lost updates;
- that writes durably succeed;
- resistance to tampering: IDs, counters and the audit log can all be edited by the user.

V1 safeguards prevent **accidental** overwrites in a single tab and make conflicts **visible**.

**V2 (proposed):**
- a surrogate primary key (for example a UUID) plus a readable `code` from a database sequence that is never reused, with a unique constraint;
- foreign keys or link tables for asset and risk relationships;
- POST to create, PUT/PATCH with optimistic locking (version or `If-Match`) to update;
- transactional, idempotent imports;
- IDs allocated only by the server;
- an append-only audit table.

The V1 policy (stable per-collection codes, exact identity, explicit create/update, never reuse) maps directly onto this design.

## 8. Decisions as originally posed (see §0 for the user's answers)

- **D-0.** Approve **S1**: the safe allocator plus allocation-error handling in all 14 create forms. It stops live-record overwrites (R1, R2 path) and fixes R11, but **not** R15.
- **D-1.** Should IDs never be reused (S5)? Should the counter survive "Reset demo data"? (Recommended: yes and yes.)
- **D-2.** Approve the scope and order of S2, S3, S4 and S6.
- **D-3.** The rule for explicit new IDs in imports. The recommended strict rule accepts **only canonical IDs above the high-water mark** and rejects any other new explicit ID with a row error. The alternative accepts any ID that isn't currently taken, and narrows the never-reuse promise to IDs the system allocates itself.
