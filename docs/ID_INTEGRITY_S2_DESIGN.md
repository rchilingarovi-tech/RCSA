# ID integrity stage S2: create-only CSV imports (design proposal)

**Status:** **revision 6.1, accepted by Codex** (final focused review: ACCEPT, no material findings). **Approved by the user for implementation planning (2026-11-07).** **Not implemented.** Each implementation step needs separate approval (D6-5 is still open). Revisions 1, 2 and 4 were rejected by Codex; revisions 5 and 6 got ACCEPT WITH CHANGES. Revision 6.1 corrected Revision 6's finding (§3.3) and then the B-3 wording found by its own review (§4.2).

- **Architecture approved by the user on 2026-11-06: Option B, create-only CSV imports in V1.** Bulk updates through CSV are deferred until the export/import data-loss defects are fixed. Existing records stay editable through the forms.
- Parent design: [`ID_INTEGRITY_DESIGN.md`](ID_INTEGRITY_DESIGN.md), revision 3 (accepted). Its platform policy (§3 there) is kept: per-collection namespaces, opaque case-sensitive stored IDs that never change, and the S1 allocator.
- Rules: [`../AGENTS.md`](../AGENTS.md). Every file S2 changes is in a protected area (rule 2). Implementation needs separate explicit approval.
- Baseline: `develop` at `0495385`. Paths are relative to `rcsa-portal/src/`.

## 0. History and approved decisions

| Revision | Review | Verdict |
|---|---|---|
| 1 | Codex thread `01a1b09b-fdce-77f3-8baa-166758b9fc4a` | REJECT (C1–C5) |
| 2 | Codex thread `01a1b0a6-b1f8-75e1-9b71-c5253e452b57` | REJECT (R2-1 to R2-5) |
| 3 | Codex (thread ID not recorded here) | findings accepted by the user |
| 4 | Codex adversarial review (plugin job ID not captured; run as Claude Code background task `bkdlmadtz`) | REJECT: (1) notification rendering seeds unrelated keys after the store refresh; (2) unquoted CR is dropped before the reference checks |
| 5 | Codex adversarial review (Claude Code background task `b0orzamrw`) | **ACCEPT WITH CHANGES**: 3 findings, R5-1 to R5-3 |
| 6 | Codex adversarial review (Claude Code background task `b835gi4oa`) | **ACCEPT WITH CHANGES**: R5-1 to R5-3 resolved; 1 finding, R6-1 (medium): the armor check ran after `trim()`, which could remove the trailing tab or CR marker, so `"'\t"` linked parent `'` |
| 6.1 | Focused Codex review of §3.3 and T-REF (Claude Code background task `bfdqqsw0i`) | **ACCEPT WITH CHANGES**: the armor-order correction closes the tab and CR counterexamples. 1 finding, R6.1-1 (medium): the B-3 row in §4.2 still said "re-run §3.3 rules 2–4", which after renumbering meant armor, blank-like and trimming, not the step 5 acceptance checks. Read literally, stale references to deleted or ambiguous parents would pass. |
| 6.1 + B-3 correction | Focused Codex review of the §4.2 B-3 row (Claude Code background task `b4ijm2k24`) | **ACCEPT, no material findings.** B-3 names all four §3.3 step 5 checks (exact current parent ID, not delimiter-bearing, single-member collision-key group, no `splitTokens` overlap), and T-S covers the failure paths with zero key changes. Codex ran a specification probe (26/26 cases); no application tests (S2 is not implemented). |

**Revision 6.1 (approved by the user on 2026-11-07, limited to R6-1):** §3.3 checks for armor on `trimStart()` before any trailing whitespace is removed, and adds the blank-like-parent rule so that `trim()` cannot silently drop a reference. New tests: T-REF-ARMOR. **User decisions:** D6-1 to D6-4 approved; **D6-5, implementation, not authorised.**

**B-3 correction (approved by the user on 2026-11-07):** the §4.2 B-3 row now lists the four step 5 checks by name instead of citing rule numbers. Only that table row changed.

**Final status (2026-11-07):** Codex ACCEPT with no material findings. The user approved the design for **implementation planning**. Implementation proceeds in separately approved steps.

**How revision 6 answers the revision 5 findings** (fixes approved by the user on 2026-11-07):

| # | Finding | Severity | Revision 6 |
|---|---|---|---|
| R5-1 | Reference values are read through the alias accessor, so a duplicate header or competing alias silently hides a value (`Asset ID,Asset ID` with `AST-404,AST-001` links only `AST-001`; a filled `Risk ID` hides `Risk IDs`) | high | §3.1: **every** row-ID and reference column is located on the raw header row. **More than one reference column is a file error.** Non-blank cells without a header are row errors. The accessor is never used for identity columns. Tests T-COL. |
| R5-2 | Both parsers open or close quotes in the middle of a field and accept unclosed quotes, so `AST-"001"` becomes `AST-001` | medium | §3.2: one **strict CSV grammar**, shared by both parsers; any malformed quoting is a file error. Tests T-Q. |
| R5-3 | The D5 redefinition kept `correct` comparing `scoreView`, which includes `id`, so preserved scores would read as a "changed symptom" | medium | §9.3: an **ID-free** `scoreFields` for D5; the generated ID (`RSK-002`) is asserted only in the invariant. Self-tests prove that preserved scores give "no longer reproduces". |

**Found in Claude's self-check (not a Codex finding):** cells beyond the header row are silently ignored by both parsers (`line[idx] ?? ''`). An unquoted comma in a hand-made reference cell (`AST-1, AST-2`) therefore splits the cell, links only `AST-1`, and pushes ` AST-2` into the next field. Addressed by §3.1 rule 4.

**User decisions on revision 5 §12 (2026-11-07):**
- **D5-1** approved: reject imports when the audit log is unreadable or invalid.
- **D5-2** approved: pin D9 as an unresolved known defect.
- **D5-3** approved: show the first 100 rows, the total row count and a validation summary; validate the whole file before Import is enabled.
- **D5-4** approved: change existing tests only as create-only requires, preserving defect coverage.
- **D5-5** approved: the reviewed file scope; additions must be identified (§10).
- **D5-6: implementation is not authorised.**

**User decisions (2026-11-06):**

| # | Decision | Where |
|---|---|---|
| B-1 | **Approved.** Any non-blank row-ID cell rejects the whole import, with an explanation. Blank ID columns stay supported. | §3.1 |
| B-2 | **Approved with conditions.** Rewrite existing tests for create-only, preserving regression coverage and the meaning of known-defect tests. Never mark a defect fixed because the update path is gone. | §9.2, §9.3 |
| B-3 | **Approved.** Revalidate parent references with side-effect-free reads immediately before the commit. No general S4 validation. | §4.2 |
| B-4 | **Deferred.** Notification-triggered seeding is documented as a separate persistence defect. No claim of zero unrelated writes during rendering. | §4.6, L4 |

**Additional user requirements 1–10** are mapped in §5.3.

## 1. Scope

**In S2** (the 13 CSV importers):
- create-only import: every record gets a new ID from the S1 allocator, and an ID supplied in the file is never used;
- strict CSV carriage-return handling;
- exact, fail-closed parent references (Risk → Asset, Treatment → Risk), checked at preview and **revalidated at commit**;
- all-or-nothing validation: any invalid row blocks the import;
- a commit-time check with **zero writes before it passes**, one checked append-only data write, and one checked audit write;
- a preview listing each record to be created, with its relationships.

**Not in S2:**
- CSV updates of existing records (deferred; see §7);
- **S3** create/update APIs for forms;
- **S4** reference validation on form saves (only the import-specific revalidation of B-3 is in S2);
- **S5** high-water mark and never reusing IDs;
- **S6** calendar keys.

**Not touched:**
- `data/ids.ts` (the S1 allocator);
- exports (`csv/export.ts`, `lib/csv.ts`, `exportRows` in `lib/tableIo.ts`);
- templates' output (`io/templates.ts`);
- forms and their `save()`/`saveX()`, plus `listX()`, `read()`, `bulkSave()`, seeding, initialisation and the legacy migration;
- `AppShell` and notifications (B-4);
- validation of non-ID fields (D3–D5 still reproduce);
- auth and permissions.

## 2. The two import paths today

| | RCSA importer | Standalone-module importer |
|---|---|---|
| Collections | `rcsa.assets.v1`, `rcsa.risks.v1`, `rcsa.treatments.v1` | 10 `infosec.<module>.vN` keys. Compliance has no import. |
| Parser | `io/import.ts` (`parseCsvCells` `:53`, `field()` `:107`) | `lib/tableIo.ts` (`parseCsvCells` `:64`, `importCsvText` `:101`) |
| Row-ID headers | Assets `Asset ID`/`ID`; Risks `Risk ID`/`ID`; Treatments `Treatment ID`/`ID`. `field()` returns the **first non-blank alias**, and a later duplicate header **overwrites** an earlier one (`:100`). | the spec column whose header is `ID`, plus its aliases (for example `Vendor ID`). Only the **first** matching header is used (`findIndex`, `:110`). |
| Reference headers | Risks: `Asset ID` (to assets); Treatments: `Risk ID`/`Risk IDs` (to risks). Split on `/[;,\n]/`, matched case-insensitively. | none |
| Header matching | `norm()` = lowercase, fold whitespace and `_` (`:47`) | `norm()` = lowercase, fold whitespace, `_` and `%` (`:47`) |
| CR outside quotes | **dropped** (`:79`) | **dropped** (`:80`) |
| Quotes | a `"` anywhere outside quotes opens a quoted section; an unclosed quote runs to the end of the file (`:62-71`) | same (`:72-77`) |
| Cells beyond the header | silently ignored (`:100`) | silently ignored (only indexed columns are read) |
| Preview | counts and errors only (`ImportModal.tsx:159-182`) | counts and errors only (`ImportExport.tsx:57-80`) |
| Commit | `saveX` loop (`AppStore.tsx:197-210`), N swallowed writes | `bulkSave` (`createLocalRepo.ts:89`), swallowed write; the page shows the in-memory array |

## 3. Preview: validation (pure; no storage access)

A new pure module, `data/importIds.ts`, holds the reference rules. Both the parser (preview) and the commit check (§4.2) call it, so the two cannot diverge.

### 3.1 Identity columns: row IDs and references (B-1, R5-1)

Identity columns are located on the **raw header row**, by index, with the parser's own `norm()`. They are **never** read through `field()` (RCSA) or `findIndex` (standalone), so no duplicate header or alias can hide or overwrite a value.

| Importer | Row-ID aliases | Reference aliases (parent) |
|---|---|---|
| Assets | `Asset ID`, `ID` | — |
| Risks | `Risk ID`, `ID` | `Asset ID` (assets) |
| Treatments | `Treatment ID`, `ID` | `Risk ID`, `Risk IDs` (risks) |
| 10 standalone modules | `ID` + the spec alias: `Campaign ID`, `Course ID`, `Meeting ID`, `Finding ID`, `Incident ID`, `KPI ID`, `Initiative ID`, `Document ID`, `Vendor ID`, `Vulnerability ID` | — |

The two alias sets do not overlap within any importer. Columns named `Asset` in Incidents and Vulnerabilities are free text, not ID references, and are unchanged.

**Rules:**
1. **Row IDs (B-1).** Every column matching a row-ID alias is checked, duplicates included. Any cell with `cell.trim() !== ''` (including armored or padded values) is a row error, and every such row is reported:
   > "Row 2 · Asset ID: CSV import creates new records only, and IDs are assigned automatically. This file has a value in the Asset ID column (`AST-002`). If it is an export, importing it would create duplicates. Clear the ID column to import the rows as new records, or edit existing records in their forms."

   The ID column may be absent, or present and blank (the templates).
2. **One reference column (R5-1).** A file with **more than one** column matching the reference aliases (for example two `Asset ID` columns, or both `Risk ID` and `Risk IDs`) is a **file error**, whatever the cells contain: "The file has more than one risk-reference column (`Risk ID` in column C, `Risk IDs` in column F). Keep exactly one." No value is ever selected over another.
3. **Reference cell.** The single reference column's raw cell is passed to `parseReferenceCell` (§3.3). If the column is absent, or the cell is blank, the existing error applies: "At least one Asset ID is required".
4. **No unheaded values.** A data row with a non-blank cell beyond the header row's width, or under a blank header, is a row error: "Row 4 has a value in column E, which has no heading. This is often an unquoted comma; put the cell in quotes." Today these cells are silently ignored. Blank extra cells (trailing commas) are still allowed. Named columns that the importer does not use (for example export-only `Asset Name` or `Treatments`) are still ignored as today; they never carry identity.

### 3.2 Strict CSV grammar (R5-2; includes revision 4 finding 2)

Both `parseCsvCells` functions implement the same grammar. Any violation is a **file error** that names the spreadsheet row (the CSV record number, header = 1) and column. A file error means no rows and Import disabled.

| Input | Rule |
|---|---|
| Field start | Optional spaces or tabs, then either `"` (a quoted field) or an unquoted field |
| Unquoted field | Any characters except `,`, LF and `"`. **A `"` anywhere in an unquoted field is an error:** "Row 3, column B: a quote character inside an unquoted value (`AST-"001"`). Quote the whole value and double the inner quotes." |
| Quoted field | Any characters, including `,`, LF and CR, are literal. `""` is one literal `"`. A single `"` closes the field. |
| After a closing quote | Only optional spaces or tabs, then `,`, LF, CRLF or end of file. **Anything else is an error:** "characters after a closing quote". |
| End of file inside a quoted field | **Error:** "unclosed quote starting in row N". |
| CR outside quotes | Allowed only as part of CRLF. **A bare CR is an error.** |
| BOM | Stripped at the start only (unchanged) |

- **Preserved:** escaped quotes (`""`), quoted commas, multi-line quoted fields, CRLF line endings, blank lines and the BOM.
- **Tolerated:** spaces or tabs around a quoted field (`a, "b"`). They are outside the value, and the cell is trimmed anyway, so no identifier can change.
- **Why the whole file:** a stray quote in *any* field, free text included (`5" monitor`), toggles the quote state and shifts the following commas and line breaks. That can move a reference into another column or row. Strictness therefore applies to every field, not only identity columns.
- Every fixture in the existing parser tests and both exporters' output (which quote every field) are valid under this grammar.

After §3.1 and §3.2, every identity cell reaches the checks exactly as written in the file, apart from the documented trim.

### 3.3 Parent references (Risk → Asset, Treatment → Risk)

**Collision key** (detection only; never used to select or rewrite a record):

```
collisionKey(id):
  u = id.trim().toUpperCase()
  if u matches ^([A-Z][A-Z0-9]*)-(\d+)$  return P + "#" + digitsWithoutLeadingZeros(n)   // string-based
  return u
```

**Parent index**, built from a list of parent IDs by `buildParentIndex(ids)`:
- `exact: Set<id>`;
- `groups: Map<collisionKey, id[]>`;
- `delimiterBearing`: IDs containing `;`, `,`, CR or LF;
- `splitTokens: Set<collisionKey>`: each delimiter-bearing ID is split on `/[;,\r\n]/`, and each trimmed, non-empty part's collision key is added.

**Reference cell** (`parseReferenceCell`; revision 6.1 fixes the order). The raw cell arrives **untrimmed** (§3.1 rule 3); nothing trims or normalises it before these steps:
1. **Split** the raw cell on `/[;,\n]/` (unchanged separators). No trimming yet.
2. **Armor check before any trailing whitespace is removed.** For each raw item, compute `lead = item.trimStart()`. If `lead` matches `^'[=+\-@\t\r]`, the item is **armored** and the row is an error. This is the exporter's armor pattern exactly (`csv/export.ts:12`, `lib/csv.ts:9`: an apostrophe before `=`, `+`, `-`, `@`, tab or CR). Removing only *leading* whitespace cannot remove the apostrophe or the character after it, so the evidence survives; the full `trim()` used to remove the trailing tab or CR that *is* the marker.
3. **Blank-like items.** An item whose `trim()` is empty is dropped (unchanged, for example a trailing `"AST-1; "`), **unless** the parent collection contains a *blank-like* ID: one whose `trim()` is empty, such as a single tab, CR or space. Then any cell containing a blank-like item is an error ("A stored asset has an ID made only of spaces or control characters, so an empty list entry may refer to it. Link it in the form."). This stops `trim()` from silently dropping a reference to such a parent, for example the unarmored export `"AST-001; \t"` when the tab parent is not first.
4. **Trim** each remaining item with `trim()`.
5. **Accept** the trimmed item only if all of these hold:
   - `exact` contains it, and it is not delimiter-bearing;
   - its group has exactly one member;
   - its collision key is not in `splitTokens`.
6. At least one accepted item is required (unchanged).

**Counterexamples closed (Codex revision 6 finding), with parents `\t` and `'` both stored (tampered or legacy; no seed or allocator produces them):**

| Raw cell (quoted, valid under §3.2) | Revision 6 (trim first) | Revision 6.1 |
|---|---|---|
| `"'\t"`: the export of parent `\t` | trimmed to `'`, linked to parent `'` (**wrong parent**) | `lead = "'\t"` is armored: **rejected** |
| `"'\r"`: the export of a CR-only parent | trimmed to `'`, wrong parent | armored: **rejected** |
| `"'\t; AST-001"`: tab parent first in a list (the whole cell is armored) | `'` and `AST-001` linked | first item armored: **rejected** |
| `"AST-001; \t"`: tab parent not first (no armor) | the tab item was silently dropped | blank-like parent stored: **rejected** |
| `"'"` with no tab or CR parent stored | — | exact match to `'`: accepted (legitimate) |

**Same order on every path:**
- `parseReferenceCell` is the **only** route from a reference cell to a parent ID. It serves every reference alias: `Asset ID` in risk files, and `Risk ID` or `Risk IDs` in treatment files. D6-2 permits only one such column per file.
- The standalone parser (`lib/tableIo.ts`) has **no** reference columns (§3.1 alias table). Its row-ID cells only need a blank or non-blank decision, and any armored export cell is non-blank.
- Both `parseCsvCells` implementations hand cells over untrimmed. Quoted tabs and CRs are kept literally (§3.2), so the marker reaches step 2.
- The B-3 commit revalidation (§4.2) re-checks only items already accepted at preview. It cannot detect a reference that preview rewrote, so this order at preview is the protection, and T-REF tests it on raw files.

Within one cell:
- exact duplicates are dropped, as today;
- two different items with the same collision key (`AST-1; AST-001`) are an error;
- every failing item is reported. Accepted items are stored **exactly as written**.

| Failure | Message (short form) |
|---|---|
| no exact match, no variant | "No asset `AST-404` exists; import the asset first." (as today) |
| variant only | "`ast-007` does not exist. Asset `AST-7` exists; IDs must match exactly." |
| ambiguous group | "`AST-500` is ambiguous: stored assets `AST-500` and `ast-500` differ only in case, spacing or zero-padding. Link it in the form." |
| token overlap | "`RSK-1` is ambiguous: stored risk `RSK-1,RSK-2` contains a list separator. Link it in the form." |
| armored | "`'=VEN` starts with an apostrophe added by CSV export; the intended ID cannot be determined." Control characters are shown escaped, for example `'\t`. |
| blank-like parent | "An empty list entry may refer to a stored asset whose ID is only spaces or control characters. Link it in the form." |

At preview, the index is built from the parent array in memory: `store.assets` or `store.risks`.

**Invisible characters.** `trim()` also removes the non-breaking space (U+00A0) and a stray BOM (U+FEFF). The collision key uses the same `trim()`, so a stored `AST-1`+U+00A0 and `AST-1` fall in one group (ambiguous, rejected), and an item `AST-1` with only `AST-1`+U+00A0 stored is a "variant only" error. Characters that `trim()` keeps, such as zero-width spaces, stay part of the ID and simply fail exact matching. No case redirects a reference.

### 3.4 ID allocation

- Unchanged S1 code: `createIdAllocator(prefix, existingIds, pad)`, in row order. Only valid rows allocate.
- Because no explicit IDs are accepted, the allocator reserves nothing from the file. Duplicate, case-variant, padded or non-canonical new IDs in a file are impossible by construction.
- **Variant skip (wrapper, `data/ids.ts` unchanged).** The parser keeps `storedKeys`, the set of collision keys of all stored target IDs. If a candidate from `allocator.next()` has a key in `storedKeys`, it is discarded and `next()` is called again. For example, stored `ast-0102` next to candidate `AST-102`. The loop is bounded by `|storedKeys|`, because each discarded candidate matches a distinct stored ID. Without this, the commit's collision check (§4.2) would refuse every import of that collection. For canonical data, no candidate is skipped, so numbering is unchanged.

### 3.5 Result

- `ImportResult` keeps its shape (`rows, created, updated, errors, skipped, totalDataRows`). `updated` is always `0`, kept for type compatibility.
- **Import is enabled only if** `errors.length === 0 && rows.length > 0`. With any error, the preview still lists the problems, and Import stays disabled.
- **File errors** (§3.1 rule 2, §3.2) are returned as `{ rows: [], created: 0, updated: 0, skipped: 0, totalDataRows: 0, errors: [{ row, field: 'File', message }] }`. The shape is unchanged; `errors` is non-empty. An empty or header-only file still returns `errors: []` (unchanged, `import.test.ts:52`, `tableIo.test.ts:91`).
- No `plan` object: rows already carry their allocated IDs, and a create has no "before" state to compare.

### 3.6 Preview content (requirement 6)

Both modals show a heading, "New records only. IDs are assigned automatically.", and a table of the records to be created:

| Column | Assets / standalone | Risks | Treatments |
|---|---|---|---|
| ID (assigned) | allocated ID | allocated ID | allocated ID |
| Record | name (standalone: the first non-ID column of the spec) | threat | title |
| Links to | — | each asset as `AST-001 — <asset name>` | each risk as `RSK-001 — <threat>` |

- **D5-3:** the first 100 rows are shown, then "…and N more". The **total row count** and a **validation summary** are always shown: N rows read, N valid, N errors, and a capped error list with row, column and message. File errors (§3.1 rule 2, §3.2) are shown in the same list, even when no data row was read. Today `ImportExport` returns early with "No data rows found" (`ImportExport.tsx:34`); that early return is limited to files with no errors.
- **The whole file is validated before Import is enabled.** Import is enabled only when parsing finished without file errors and with zero row errors.
- The preview states: "These IDs are final. If any of them is taken before you import, the import is refused, not renumbered."
- Showing parent names lets the user spot references that point to the wrong record. This matters for files from another environment (L2).

## 4. Commit

### 4.1 Keys read and written by the commit operation

| Import | Raw reads (`getItem` only) | Writes, in order, each at most once |
|---|---|---|
| Assets | `rcsa.assets.v1`, `infosec.audit.v1` | `rcsa.assets.v1`, then `infosec.audit.v1` |
| Risks | `rcsa.risks.v1`, **`rcsa.assets.v1`** (parents), `infosec.audit.v1` | `rcsa.risks.v1`, then `infosec.audit.v1` |
| Treatments | `rcsa.treatments.v1`, **`rcsa.risks.v1`** (parents), `infosec.audit.v1` | `rcsa.treatments.v1`, then `infosec.audit.v1` |
| Standalone | its key, `infosec.audit.v1` | its key, then `infosec.audit.v1` |

The commit operation (`data/importCommit.ts`) and its refresh call **no** `listX()`, `read()`, `list()`, seed or migration function. The scope of this guarantee is in §4.6.

### 4.2 Phase 1: read and check, with zero writes

Any finding gives **REJECTED**, "Nothing was imported", with the reasons.

| Check | Rejection reason |
|---|---|
| any `getItem` throws | browser storage unavailable |
| the target key is missing | "The stored *Assets* collection is missing." Treatments: "Treatments are not initialised in this browser." No seeding and no migration. |
| the target value is not JSON, not an array, or has an element that is not an object with a string `id` | unreadable; never overwritten |
| any row's allocated ID, exactly or by collision key, is now present in the target | "`AST-101` (or a variant of it) was created after the preview. Choose the file again to get new IDs." |
| rows' IDs are not distinct by collision key (internal consistency) | internal error |
| **B-3** (Risks and Treatments): the parent key is missing, unreadable, or has an element without a string `id` | "The stored assets cannot be read, so the links cannot be verified." |
| **B-3**: rebuild the parent index from the **raw parent IDs**. For every already-resolved reference of every row, require all four §3.3 step 5 checks: (1) the ID is an exact current parent ID; (2) it is not delimiter-bearing; (3) its collision-key group has exactly one member; (4) its collision key is not in `splitTokens`. Any failure rejects the import before any write (T-S). | "Row 3: asset `AST-010` was deleted after the preview", "…became ambiguous", "…now overlaps a stored ID containing a list separator" |
| audit pre-flight (D5-1): `infosec.audit.v1` is present but not a JSON array | "The audit log is unreadable, so this import could not be recorded." |

- B-3 is **import-specific**: it reads only the parent collection of the rows being imported, writes nothing, and does not normalise. It does not validate forms or other saves (S4).
- **Legacy data:** no normalisation is applied to stored records, so no legacy shape is changed. Risk records with embedded plan fields or a single `assetId` need no refusal, because they are never rewritten (§4.3). Their IDs are all that B-3 reads.

### 4.3 Phase 2: append-only data write (requirement 3)

Existing records are preserved **byte for byte** by splicing text, not re-serialising:

```
if parsed.length === 0:  next = JSON.stringify(rows)
else:                    j = raw.lastIndexOf(']')
                         next = raw.slice(0, j) + ',' + rows.map(JSON.stringify).join(',') + raw.slice(j)
guard (before writing):  JSON.parse(next) is an array of parsed.length + rows.length elements,
                         and its last rows.length elements serialise equal to rows; otherwise REJECTED (internal)
```

Then:
- `setItem(key, next)` **without swallowing** errors, followed by a read-back `getItem(key)`;
- **verified**: the read-back `=== next`;
- **not written**: `setItem` threw and the read-back `=== raw`, giving REJECTED;
- **uncertain**: anything else, or the read-back threw.

### 4.4 Checked audit recording

New `auditLog.recordBatchChecked(events)` in `audit/auditLog.ts`. The existing `record`, `list`, `reset` and `subscribe` are unchanged.

1. Read the raw value. If `getItem` throws, or the value is present but not a JSON array, the result is `not-recorded` with nothing written.
2. Build the events exactly as `record()` does. Store them in the order that N sequential `record()` calls would produce: `[evN, …, ev1, ...prev].slice(0, CAP)`.
3. One `setItem`, not swallowed, then a read-back:
   - `recorded`: equal;
   - `not-recorded`: threw and the value is unchanged;
   - `uncertain`: otherwise.
4. Listeners run only after `recorded` or `uncertain`. Each is wrapped in try/catch, and errors are logged and counted (`listenerErrors`) without changing the status.

**Events, identical to today's create events:**
- RCSA: one per record, with the same action, summary and `diffFields({}, record)` as `saveX` produces for a create;
- standalone: the one summary `bulkSave` writes today, "Imported N Vendors from CSV (N new, 0 updated)".

Data and audit are separate writes and are **never described as atomic**.

### 4.5 Outcomes

The audit write runs only after a **verified** data write.

| Outcome | When | Message |
|---|---|---|
| **REJECTED** | any Phase 1 finding, or data *not written* | "Nothing was imported." plus the reasons. The modal stays open. |
| **COMMITTED** | data verified, audit `recorded` | "Imported N new assets." |
| **COMMITTED, AUDIT WARNING: not recorded** | data verified, audit `not-recorded` | "N new assets were imported, but the audit log could not be updated. No audit events were recorded for this import." |
| **COMMITTED, AUDIT WARNING: uncertain** | data verified, audit `uncertain` | "N new assets were imported. The audit log may not have been updated; check the Audit Log." |
| **UNCERTAIN** | data *uncertain* | "The import may or may not have been saved. The list now shows what is stored; check it before importing again." No audit. |

- No outcome rolls back data. "Nothing was imported" appears only for REJECTED.
- After any outcome other than REJECTED, Import stays disabled until a file is chosen again.

### 4.6 Refresh, and the limit of the no-side-effect claim (B-4)

- **COMMITTED (any audit status):**
  - the store or page is set from the verified read-back value (`next`), parsed;
  - risks pass through `migrateRisk` **in memory only**, exactly as the display does today; nothing is written.
- **UNCERTAIN:** `readForImport(key)` (raw `getItem` and parse). The UI is set only if the result is `ok`. Otherwise it keeps its previous state, and the message adds: "The stored data could not be read back. Reloading the app would replace missing data with demo data."
- **REJECTED:** no state change.
- **Scope of the guarantee:**
  - **guaranteed:** the commit operation and its refresh write only the target key and the audit key, and call no seeding or migration function;
  - **not guaranteed:** after the store or page state changes, React re-renders `AppShell`, whose `buildNotifications` calls seven standalone `repo.list()` functions (`AppShell.tsx:104`, `components/layout/notifications.ts:39-61`). Those seed any **missing** standalone key (`createLocalRepo.ts:54-56`). This is pre-existing app-wide behaviour on every render, not specific to import. It is documented as a separate persistence defect (B-4, L4) and is not changed by S2.

## 5. Does create-only remove the blockers, or hide them?

### 5.1 Every confirmed behaviour from revisions 1–4

| # | Behaviour | Status under revision 5 | How |
|---|---|---|---|
| F1–F3 | same ID twice, new duplicates, case variants in a file | **Removed by construction** | file IDs are rejected; IDs are allocated |
| F4, F5, F8, F19 | case, padding or ambiguous-group matching of **row** IDs | **Removed** | no row matching exists |
| F6, F7 | case-only or ambiguous **references** | **Addressed** | §3.3 exact and group rules, at preview and commit |
| F9, F10 | non-canonical explicit IDs; blank-then-explicit | **Removed** | no explicit IDs |
| F11 | a new ID taken after the preview | **Addressed** | §4.2 collision check; residual cross-tab window (L1) |
| F12, F13 | update target deleted or edited after the preview | **Removed** | no updates |
| F14, F21 | partial commit | **Addressed** | all-or-nothing validation; one write |
| F15 | seeding or migration on the commit path | **Addressed** | raw reads only |
| F16, F17 | armored IDs | **Removed** for row IDs (non-blank means rejected); **addressed** for references (rule 1) | |
| F18 | legacy plan fields stripped | **Removed** | append splice; nothing is re-serialised |
| F20 | audit value `{}` | **Addressed** | pre-flight, then checked write |
| F22 | delimiter-bearing parent IDs | **Addressed** | `splitTokens`; both relationships |
| F23 | refresh through `listX()` | **Addressed** for the import's own refresh | §4.6 |
| F24 | shown as saved after a failed write | **Addressed** | read-back drives the UI |
| R4-1 | notification seeding during re-render | **Not fixed, not hidden** | documented (B-4, L4); the claim is narrowed in §4.6 |
| R4-2 | CR dropped before identity checks | **Addressed** | §3.2 |
| R5-1 | duplicate or competing reference columns hide values | **Addressed** | §3.1 rules 2–3: one reference column, read by index |
| R5-2 | malformed quotes rewrite identifiers | **Addressed** | §3.2 strict grammar |
| R5-3 | D5 `correct` compared generated IDs | **Addressed** | §9.3 ID-free comparison |
| self-check | unheaded cells silently dropped (an unquoted comma in a reference cell) | **Addressed** | §3.1 rule 4 |
| L3 (rev 4) | parent deleted between preview and commit | **Addressed** | B-3 |

### 5.2 Risks that create-only introduces or moves

| Risk | Silent? | Treatment |
|---|---|---|
| Importing the same rows twice creates duplicate business records with different IDs | No: visible, and deletable through the forms | documented (L5); no content-based detection in S2 |
| An export with its ID column cleared, imported into **another** browser: its references are interpreted against **that** browser's parents, which may be different records with the same ID | **Possibly silent** if the IDs exist there | documented (L2): CSV import is not backup/restore; the preview shows parent names (§3.6) for review. It cannot be detected automatically in V1. |
| Users can no longer bulk-edit through export, edit and re-import | No: refused with a clear message | deferred feature (§7) |

### 5.3 User requirements 1–10

| # | Requirement | Where |
|---|---|---|
| 1 | S1 allocator; a new unique ID for every record | §3.4, §4.2 |
| 2 | validate every row before writing; any invalid row blocks | §3.5, §4.2 |
| 3 | no modification or normalisation of stored records | §4.3 (byte splice), §4.2 (no legacy rewrite) |
| 4 | strict CR, exact references, fail-closed ambiguity | §3.2, §3.3, §4.2 |
| 5 | checked persistence and audit, with clear outcomes | §4.3–§4.5 |
| 6 | preview of records and relationships | §3.6 |
| 7 | duplicate business records documented | §5.2, L5 |
| 8 | not backup/restore | §5.2, L2 |
| 9 | exports unchanged | §1 |
| 10 | V1 limits and S3–S6 boundaries kept | §1, §6, §8 |

## 6. What V1 localStorage still cannot guarantee

| Property | V1 with S2 |
|---|---|
| Errors, staleness and unreadable state detected before any write; zero writes on refusal | **Yes** |
| A collection never partially written; existing records byte-identical | **Yes** |
| The commit operation writes only its target and audit keys | **Yes** (rendering side effects excluded, §4.6) |
| Outcomes reported accurately | **Yes** |
| No interference from another tab between the check and the write (R7) | **No**: there is no cross-tab lock |
| Data and audit atomic; rollback | **No** |
| Durable writes | best effort (read-back) |
| Tamper resistance | **No** |
| Duplicate business records prevented | **No** |
| IDs portable across environments | **No** |

## 7. Compatibility and workflow effects

- **Users:**
  - imports create records only. A file with any ID value is refused with an explanation;
  - bulk edits go through the forms;
  - exports can still be produced, but **cannot be re-imported as-is**;
  - **hand-made files that are accepted today and refused after S2** (each with a message naming the row and column):
    - a stray or unescaped quote in **any** field (`5" monitor`, `O"Brien`), an unclosed quote, or text after a closing quote. *Fix:* save from Excel as CSV UTF-8, which quotes correctly;
    - a bare CR (old Mac line endings);
    - a non-blank value in an unheaded column, typically an unquoted comma;
    - more than one reference column (`Risk ID` and `Risk IDs`, or a duplicated `Asset ID`), even when one is empty.
  - Files written by the app's exporters and by Excel "CSV UTF-8" are valid under the strict grammar.
- **Templates:** unchanged output (blank ID column). One stale code comment, `io/templates.ts:29` ("an existing ID updates that asset"), is corrected as a comment-only edit.
- **Exports:** unchanged.
- **Deferred bulk update** requires, at minimum, fixes for D5, the round-trip losses (`DEVELOPMENT_STATUS.md` §5) and D9, plus per-importer field-merge rules and staleness checks. It is a separate future stage needing its own approval.
- **Documentation at implementation:**
  - `DEVELOPMENT_STATUS.md` §3–§5: S2 status; D9; the notification-seeding defect (B-4); a note that the §5 round-trip losses remain open and block bulk update;
  - `ID_INTEGRITY_DESIGN.md` §0 and §4: the S2 row now reads create-only;
  - `rcsa-portal/docs/testing.md`: the known-defect count.

## 8. Separation from other stages

| Stage | Relationship to S2 |
|---|---|
| S3 | forms and the repositories' save, upsert and delete semantics are unchanged; `importNew` and `readForImport` are import-only |
| S4 | only the B-3 import revalidation; forms still save unchecked references (R13) |
| S5 | no counter; reuse of the highest deleted ID remains (R5, R15/D8) |
| S6 | calendar untouched |

## 9. Tests

### 9.0 Terms

- **Preview test:** calls `parseXFile` or `importCsvText` and asserts only the returned result.
- **Commit test:** calls `importNew` through the repository, store or UI, and asserts storage (every key, audit included, before and after), outcome, audit and UI.
- **Blocked:** `errors.length > 0`. In UI tests, the Import button is disabled.

### 9.1 New tests

Files:
- `data/importIds.test.ts`
- `audit/auditLog.test.ts`
- `test/regressions/import-create-only.test.ts`
- `test/regressions/import-commit-ui.test.tsx`

Core rules run as a table over **all 13 importers**.

| Group | Cases |
|---|---|
| **T-ID** (B-1) | a non-blank ID (existing, case variant, unknown, armored, whitespace-padded) in every row-ID alias column, including a filled column hidden by a blank duplicate header, blocks the file; a real export of each importer is blocked with zero writes; an absent or blank ID column (the templates) imports; reference columns (`Asset ID` in risks, `Risk ID` in treatments) are not treated as row IDs |
| **T-Q** (strict grammar, R5-2) | **Both parsers, the same table of raw files.** *Rejected* (file error, no rows, Import disabled, zero writes): `AST-"001"`; `"AST-001"x`; `AST-001"`; an unclosed `"AST-001`; a bare CR (`AST-1\rAST-2` unquoted). *Accepted, value exact:* `"He said ""hi"""`; `"Core, Banking"`; a multi-line quoted field; CRLF endings; BOM; blank lines; `a, "b"` (padding around quotes). **Wrong-parent cases, raw files, for Risk→Asset and Treatment→Risk:** with both `AST-"001"` (stored by tampering) and `AST-001` stored, and with both `AST-1\rAST-2` and `AST-1AST-2` stored, every malformed cell is a file error: the import never links either parent, and all keys are unchanged. The same malformed input in a row-ID cell is a file error too. |
| **T-COL** (columns, R5-1 + self-check) | Risks: two `Asset ID` columns (`AST-404`,`AST-001`; and one blank): file error, zero writes. Treatments: `Risk ID` + `Risk IDs` (both filled; one blank; identical values): file error. Header variants matched by `norm()` (`asset_id`, ` ASSET  ID `) count as the same column. A filled row-ID column hidden by a blank duplicate (`Asset ID` blank, `ID` filled, and the reverse order): blocked. An unquoted `AST-1, AST-2` in a risk's Asset ID cell gives an unheaded-cell row error (not a link to `AST-1` only). A non-blank cell under a blank header: row error. Trailing blank cells: accepted. Export-only columns (`Asset Name`, `Treatments`): ignored as today. |
| **T-REF** | both relationships: exact accepted; case-only, padding variant, ambiguous group (each member), armored item, and delimiter-token overlap (`AST-1;AST-2` stored with `AST-1`, `AST-2`; `RSK-1,RSK-2`; IDs containing LF or CR) rejected; `AST-1; AST-001` rejected; the exact duplicate kept once; stored references written exactly as typed |
| **T-REF-ARMOR** (revision 6.1) | **Raw-file cases, each run for Risk→Asset (risk file, `Asset ID` column) and for Treatment→Risk (treatment file, run once with a `Risk ID` and once with a `Risk IDs` column). Both competing parents are stored: `\t` and `'` (and `\r` and `'` for the CR cases).** Rejected, with a row error, Import disabled and **every `localStorage` key unchanged** (checked through the UI flow and by calling the store or repository commit with the preview result, which has no valid rows to commit): (1) quoted `"'\t"`; (2) quoted `"'\r"`; (3) `"  '\t"` (leading spaces); (4) `"'\t; AST-001"` / `"'\t; RSK-001"`; (5) `"AST-001; \t"` / `"RSK-001; \t"` with the blank-like parent stored. **The same cases built from the real exporter:** export a risk linked to assets `\t` and `AST-001`, and a treatment linked to risk `\t`, clear the ID column with `withIdColumnCleared`, and re-import: rejected, zero writes, never linked to `'`. **Controls:** `"'"` with only `'` stored is accepted as an exact link; `"AST-001; "` with no blank-like parent links `AST-001` only (trailing-separator behaviour unchanged). **Order assertions:** a unit test of `parseReferenceCell` shows the armor check sees the untrimmed item (input `"'\t"`, the tab preserved by the strict parser), and the B-3 commit check is not relied on (no accepted item reaches it). |
| **T-S** (stale preview) | after the preview: the allocated ID, or a variant of it, is created in the target; the target key is removed, made corrupt, or given an element without `id`; **B-3:** a referenced parent is **deleted**, **edited** (the ID is unchanged, so accepted, and the test asserts this), made ambiguous by a new variant, or overlapped by a delimiter-bearing ID; the parent key is removed or corrupted. Each rejection gives zero key changes. |
| **T-W** (storage failures) | `getItem` throws (any read): REJECTED. Data `setItem` throws (quota) with the value unchanged: REJECTED, no audit. `setItem` throws with the value changed, or the read-back differs or throws: UNCERTAIN, no audit, no rollback. The standalone page shows stored rows, not in-memory rows. |
| **T-A** (audit failures) | audit value `{}`/`"x"`: REJECTED at pre-flight. Audit `setItem` throws with the value unchanged: AUDIT WARNING (not recorded). It throws with the value changed, or the read-back differs: AUDIT WARNING (uncertain). A listener throws: COMMITTED, other listeners run. The RCSA batch equals N sequential `record()` calls (events, order, diffs). `record()` is unchanged. |
| **T-L** (legacy) | stored risks with plan fields and a legacy `assetId` are **byte-identical** after a risk import; treatment import with legacy risks as parents works without migration; no seed or migration call |
| **T-P** (preservation) | the allocator wrapper skips a candidate whose collision key matches a stored variant (`ast-0102`, `" AST-102"`) and numbering is unchanged for canonical seeds; existing records byte-identical, including hand-formatted JSON (whitespace, key order); append order; audit text identical to today's create events; 10,000 rows within the existing performance budget |
| **T-R** (refresh) | spies: commit and refresh call no `listX`/`read`/`list`/seed/migration; the UI shows exactly the stored records after COMMITTED and after UNCERTAIN; with the refresh not `ok`, the previous state and the message are shown; with **all keys present**, the full UI flow changes only the target key and the audit key |
| **T-UI** | both modals: the preview table (IDs, records, parent labels, the 100-row cap with "…and N more"); the total row count and validation summary; file errors shown even with zero data rows (no "No data rows found" toast); any error disables Import; the five outcome messages; REJECTED keeps the modal open; no message tells the user to reload |

### 9.2 Existing tests rewritten (B-2)

Each keeps its regression purpose where the behaviour still exists. Where the behaviour was the **update operation itself**, the test is converted to assert the rejection, and the update-only assertion is retired, as noted.

| # | Test | What it now demonstrates |
|---|---|---|
| 1 | `io/import.test.ts:114` existing ID (any case) is an update, keeps `submittedAt` | a non-blank Asset ID (existing, case variant) blocks the file. *Retired:* `submittedAt` preserved on update (no update operation). |
| 2 | `io/import.test.ts:126` unknown explicit ID kept; in-file duplicate renumbered | explicit IDs block (both rows reported); unique allocation stays covered by `:120` |
| 3 | `io/import.test.ts:139` risk spanning several assets (`ast-001` reference) | fixture `"AST-001; AST-002, AST-001"`: still accepted, exact duplicate dropped; a new case asserts the case-only reference error |
| 4 | `io/import.test.ts:196` updates a risk by ID; allocates after the highest | explicit `RSK-007` blocks; allocation after the highest kept with blank rows: `RSK-008`, `RSK-009` |
| 5 | `io/import.test.ts:209` treatment for several risks (`rsk-001`) | as #3 |
| 6 | `io/import.test.ts:230` updates a treatment by ID | a non-blank Treatment ID blocks. *Retired:* update content and `submittedAt`. |
| 7 | `io/import.test.ts:244` fixture: the export is a clean update | (a) the unmodified export is blocked with the ID message; (b) the export with its ID column cleared is a clean create: 1 row, `RSK-002`, same `assetIds` |
| 8 | `lib/tableIo.test.ts:47` Name required on new rows only | Name required on every row (all rows are new); the explicit `VEN-03` row is blocked |
| 9 | `lib/tableIo.test.ts:54` blank cells on an update keep values | a non-blank ID (exact or case variant) blocks. *Retired:* blank-keeps on update. |
| 10 | `lib/tableIo.test.ts:75` allocation after the highest (with explicit `VEN-20`) | blank rows after `VEN-01`/`VEN-09` give `VEN-10`, `VEN-11`; explicit `VEN-20` blocks (separate case) |
| 11 | `data/ids.test.tsx:226` at the limit, a blank-ID row is a row error | the allocation error stays a row error; the explicit `VEN-05` row now also reports the ID error; preview is blocked |
| 12–14 | `data/ids.test.tsx:240`, `:248`, `:255` a rejected row with an ID at the limit does not exhaust numbering (assets, risks, treatments) | the rejected row reports the ID error plus its original error; the valid row's preview ID is still `AST-001`/`RSK-001`/`TRT-001`, so a rejected explicit ID never influences numbering |
| 15 | `data/ids.test.tsx:262` a rejected row doesn't block a later valid row's explicit ID | both `AST-777` rows report the ID error. *Retired:* explicit-ID reservation (explicit IDs can no longer be used). |

**Known-defect mechanism self-tests** (`test/helpers.test.ts`). Fabricated observations change from `updated: 1`, `RSK-001` to `created: 1`, `RSK-002`. Each keeps its expected verdict:

| Test | Fabricated observation (after S2) | Expected verdict (unchanged meaning) |
|---|---|---|
| `:85` control | real observations | the real specs reproduce exactly (passes) |
| `:93` scenario 1 | `RSK-002`, created 1, scores 3/1/null/null | "changed symptom" |
| `:98` scenario 1b | `RSK-002`, created 1, scores 1/1/1/1 | "changed symptom" |
| `:109` scenario 2 | no rows | "invariant failed" (unchanged) |
| `:115` scenario 2b | (a) `RSK-999`, created 1; (b) `RSK-002` with `updated: 1, created: 0` | "invariant failed": a different risk, **or an update instead of a create** |
| **new** 2c | `RSK-001` (the original's ID), created 1, scores **preserved** 5/4/3/2 | "invariant failed": correct scores on the wrong identity must not read as a fix |
| `:139` correct outcome | `RSK-002`, created 1, scores **preserved** 5/4/3/2; `RSK-002` with threat `-Legacy VPN exposure` | "no longer reproduces" for both D5 specs |

Scenario 2c is one added test, needed because identity and scores are now asserted separately.

**Unchanged:** `io/import.test.ts:52`, `lib/tableIo.test.ts:91`, `test/helpers.test.ts:16` (no `plan` field), D3/D4 specs, and all other tests.

### 9.3 Known defects (B-2 conditions)

- **D5, both specs** (`test/defects/rcsaImport.ts:136`, `:149`; helper `expectCleanSingleUpdate` `:126`), redesigned for R5-3:
  - **Observation:** the real risk export of `RSK-001`, passed through a test helper `withIdColumnCleared(csv, 'Risk ID')`. The helper blanks every cell under that header using the strict parser, and re-quotes every field as the exporter does. It is parsed with `[original]` stored, so it is a new record next to the original.
  - **Identity, in the invariant only:** `expectCleanSingleCreate(r, 'RSK-002', original.assetIds)`: no errors, `rows.length === 1`, `created: 1`, `updated: 0`, `skipped: 0`, `rows[0].id === 'RSK-002'` (the S1 allocator after `RSK-001`), the same `assetIds`. It holds before and after a fix.
  - **Scores, ID-free (scores spec):** a new `scoreFields(x) = { impact, likelihood, resImpact ?? null, resLikelihood ?? null }`.
    - `correct`: `scoreFields(rows[0])` deep-equals `scoreFields(original)`, which is 5/4/3/2;
    - `symptom`: `rows.map(scoreFields)`;
    - `documented`: `[{ impact: 1, likelihood: 1, resImpact: null, resLikelihood: null }]`.
  - **Apostrophe spec:** `correct` (`threat === '-Legacy VPN exposure'`) and `symptom` (`rows.map(threat)`) are already ID-free and unchanged; only the invariant changes.
  - The existing `scoreView`, which includes `id`, is **kept unchanged** for the D4 specs (`:109-113`). Their files have no ID column and still allocate `RSK-001`.
  - **Detection, proven by the self-tests (§9.2):** preserved scores (5/4/3/2 on `RSK-002`) give "no longer reproduces"; different wrong scores give "changed symptom"; a wrong identity gives "invariant failed".
  - **What it now demonstrates:** a risk copied through export and CSV import **still loses its scores** and **keeps the export's apostrophe**. The defect is in the export/import transformation and is **not fixed**. Removing the update path removed one way to trigger it, not the defect. D5 is closed only when an implementation makes `correct` hold and the spec is converted to a regression test.
  - Expected under S2: the create path yields the documented values, because the export has no Impact/Likelihood columns. This is confirmed by running the specs (normal and defect mode) at implementation.
- **D9 (approved, D5-2; unresolved):** the treatment export of an overdue treatment, ID column cleared with `withIdColumnCleared`, gives a Status error, so the file is blocked. 1 scenario. It is documented in `DEVELOPMENT_STATUS.md` §4.
- **D2–D4, D6–D8:** unchanged.
- **Count:** `npm run test:defects` would show **18** (17 plus D9). Confirmed by running it at implementation.
- **Not given a test (B-4):** the notification-seeding defect, documented in `DEVELOPMENT_STATUS.md` §5 only.

## 10. Affected files

All are protected (AGENTS rule 2).

| File | Change |
|---|---|
| `data/importIds.ts` (new) | collision key, parent index, reference-cell parsing and rules (§3.3); pure |
| `data/importCommit.ts` (new) | raw reads, Phase 1 checks including B-3, byte-splice write, read-back, outcome assembly |
| `io/import.ts` | strict grammar in `parseCsvCells` (§3.2); identity columns by raw index, one reference column, unheaded-cell rule (§3.1); update branch removed; references through `importIds` |
| `lib/tableIo.ts` | strict grammar in `parseCsvCells`; row-ID columns by raw index; unheaded-cell rule; update branch (`prev`, blank-keeps) removed; `exportRows` unchanged |
| `data/repository.ts` | `RcsaRepository` gains `importNew(collection, rows)` and `readForImport(collection)` |
| `data/localStorageRepo.ts` | implements both through `importCommit`; existing methods unchanged |
| `data/createLocalRepo.ts` | `LocalRepo` gains `importNew(rows)` and `readForImport()`; existing methods unchanged |
| `audit/auditLog.ts` | adds `recordBatchChecked`; existing functions unchanged |
| `state/AppStore.tsx` | `importAssets`/`importRisks`/`importTreatments` replaced by `importNew` plus the §4.6 refresh |
| `components/ImportModal.tsx` | preview table (§3.6), create-only wording, outcomes |
| `components/common/ImportExport.tsx` | the same; `onImported(items)` replaced by `repo` + `onRefreshed(records)` |
| 10 module pages, one line each | `modules/{access/AccessPage, awareness/AwarenessPage, committee/CommitteePage, findings/FindingsPage, incidents/IncidentsPage, kpis/KpisPage, plan/PlanPage, policies/PoliciesPage, vendors/VendorsPage, vulns/VulnsPage}.tsx` |
| `io/templates.ts` | one code comment (`:29`); no output change |
| Tests | 4 new files (§9.1); rewritten: `io/import.test.ts`, `lib/tableIo.test.ts`, `data/ids.test.tsx`, `test/helpers.test.ts`, `test/defects/rcsaImport.ts`; new D9 spec in `test/defects/` |
| Docs (at implementation) | `docs/DEVELOPMENT_STATUS.md`, `docs/ID_INTEGRITY_DESIGN.md`, `rcsa-portal/docs/testing.md` |

**Not touched:** `data/ids.ts`, `data/seed.ts`, `data/models.ts`, `data/index.ts`, `modules/*/types.ts`, `modules/*/repo.ts`, `modules/*/io.ts`, `csv/export.ts`, `lib/csv.ts`, `components/layout/AppShell.tsx`, `components/layout/notifications.ts`, every form and modal except the two import UIs, `auth/`, `modules/settings/`, `package.json`.

**Additions compared with the reviewed revision 5 scope (D5-5):** **no new files.** Within listed files:
- the strict grammar and the unheaded-cell rule in both parsers;
- the validation-summary display in both import UIs;
- in `test/defects/rcsaImport.ts`, the `scoreFields` and `withIdColumnCleared` helpers;
- in `test/helpers.test.ts`, one added self-test (scenario 2c).

The two parsers keep separate `parseCsvCells` copies, as today. Sharing one module would add a file and is not proposed; both copies run the same T-Q table, so they cannot drift apart unnoticed.

**Compared with revision 4:**
- The file list is the same size; per-file protected logic is much smaller;
- **removed:** the `plan` object and `before` snapshots, update targets, the explicit-ID format rule, the in-file duplicate machinery, the legacy refusal, update audit diffs and field-merge semantics;
- **added:** the strict CSV grammar, identity columns by raw index, the B-3 parent revalidation, the byte splice, the preview table, and the template comment.

## 11. Limitations after S2

- **L1. Tabs (R7).** A write by another tab between the check and the write is undetectable; one between the write and the read-back is reported as UNCERTAIN.
- **L2. Not backup or restore.** Create-only import cannot preserve original IDs. References in a file are resolved against this browser's records, so a file from another environment can link to different records with the same ID. The preview shows parent names, but there is no automatic detection.
- **L3. No CSV bulk update.** Existing records are edited in the forms. Deferred until D5, the round-trip losses and D9 are fixed.
- **L4. Rendering side effects (B-4).** After any store or page update, notification rendering can seed a **missing** standalone key. This is pre-existing, not import-specific, and documented as a persistence defect.
- **L5. Duplicate business records.** Importing the same rows again creates new records with new IDs; there is no content-based detection.
- **L6. Data and audit not atomic.** Audit failures after a verified data write are reported, never rolled back.
- **L7. Ordinary saves and app start** keep the swallowed write, upsert, seeding and the legacy migration. A full page reload still runs them.
- **L8. ID reuse** of the highest deleted ID remains until S5 (R5, R15/D8).
- **L9. Historical IDs** that are delimiter-bearing, armored or ambiguous cannot be referenced from CSV; link them in the forms.
- **L10. RCSA error row numbers** are still counted after blank lines are removed (`import.ts:97`, existing defect), so an error can name the wrong spreadsheet row. File errors from §3.2 use the CSV record number, which is correct.
- **L11. Duplicate non-identity columns** (for example two `Threat` columns) keep today's selection (the RCSA accessor takes the first non-blank alias and the last duplicate wins; the standalone parser takes the first match). They do not affect identity or relationships. Extending the one-column rule to every field is a separate, unapproved change.

## 12. Decisions requiring approval

| # | Decision | Recommendation | Alternative and consequence |
|---|---|---|---|
**Already decided:** D5-1 to D5-5 approved, and D5-6 (implementation) not authorised. See §0.

| # | Decision | Recommendation | Alternative and consequence |
|---|---|---|---|
| **D6-1** | Approve the strict CSV grammar (§3.2) for **all** fields, with spaces or tabs tolerated around quoted fields | **Approve** | Apply strictness only to identity columns. Not safe: a stray quote elsewhere shifts columns into identity cells. Or reject padding around quotes too (stricter, RFC 4180 only), which refuses some hand-made files with no safety gain. |
| **D6-2** | More than one reference column is a **file** error, even if one is empty (§3.1 rule 2) | **Approve** | Allow several reference columns when at most one is filled per row; more complex, no value is lost either way |
| **D6-3** | Non-blank unheaded cells are row errors (§3.1 rule 4) | **Approve** | Keep ignoring them; an unquoted comma silently drops a link |
| **D6-4** | Test changes: §9.2 (15 parser tests, 6 self-test rows including new 2c), the D5 redesign (§9.3), the new groups T-Q and T-COL | **Approve** | — |
| **D6-5** | Implementation of S2 | Separate approval after this review | — |
