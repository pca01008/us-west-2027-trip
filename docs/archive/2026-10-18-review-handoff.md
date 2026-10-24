# Project Review and Handoff — 2026-10-18

Historical code/document review for subsequent work, not a claim of current fixes. Recheck functions/current source. Requested scope: find bugs/potential issues/docs improvements without overengineering for two users. Workspace: `D:\Workspace\travel\website`.

Found three reproduced bugs, one inspection-only risk, two policy proposals. Review/reproduction only: no app/production DB/deployment/commit/push. Saving this handoff did not approve proposals/implementation. Existing untracked attachments/directory-plan document were user work to preserve. Follow AGENTS/metadata approval; never change ownership/ACL arbitrarily.

Recommended order: deferred draft/PREP, external logout/reentry, remote input preservation, photo timeout/cancel, then user-directed policy decisions. Retain static app/Supabase/revisions and existing helpers; no framework, DB decomposition, automatic merge, queue, or multitrip platform needed.

## 1. High: PREP list save deletes deferred draft

Reproduced: edit title/wait for IndexedDB → refresh → Esc recovery → PREP Edit list/change/save → `readDraftRecord()` returns null. `saveChecklistEditor()` near index.html: 1851 clears drafts for `!pendingDraft && !OFFLINE_MODE`; deferred content is unapplied, so pending can be false. `queueCheck()` near1807 already checks `!deferredDraftRecovery`. Reuse protection; list must save while draft survives/reloads for recovery.

## 2. High: new editing after external sign-out overwrites preserved draft

Reproduced external-sign-out path: edit/persist → call `handleExternalSignOut()` → verify record remains → start editing without refresh/reauthenticate as needed → no recovery prompt → new draft overwrites old. Near2006, sign-out uses `setEditingUI(false,{preserveDraft:true})` but never establishes deferred recovery. `runPurpose()` only prompts for deferred state. Connect preserved drafts to recover/explicit-delete before itinerary/ledger/import and other mutating entry points. Existing tests stopped at immediate retention; new tests must continue into editing. Reproduction invoked handler/auth stub locally, not production Auth.

## 3. Medium: shared refresh clears unadded expense input

Reproduced: type Taxi/USD37 without Add → change mock content/revision → `refreshPublishedState('visible')` → name/amount become empty. Resume/Realtime are relevant real paths, not loss of added entries. Direct `applyState()` near2501/Realtime2539 replaces inputs; unadded values do not set pendingDraft. Reuse existing `applyStatePreservingInputs()` from full/checklist save. Preserve name/amount/date/currency/category/focus/selection; deleted categories need a valid fallback. Realtime risk also confirmed by matching code pattern.

## 4. Medium: photo requests lack deadlines/cancellation

Inspection-only; long stalls not reproduced. HEAD `immutableBlobExists()` near2228 has no app limit; `uploadImmutableBlob()`2229 lacks cancellation; export `fetchAsDataUrl()`2271 lacks limit; `cancelCurrentOperation()`1338 only sets a flag. Full-save12s starts after `materializeStagedPhotos()`, not photo preparation. Add suitable per-request deadlines/abort signals, cleanup, and draft retention. No complex retry/queue needed.

## 5. Proposal: clarify itinerary source of truth

Not a bug/approved policy. Then-untracked [directory proposal](../DIRECTORY_PLAN.md), around84, preferred planning originals first; [README](../../README.md), around73, said save active changes in app/shared data overrides defaults. Duplicate ownership creates confusion. Recommend planning for research/alternatives/booking evidence/reasons; app for current itinerary/PREP/spending. If user prefers document originals, honor that instead. Automatic sync is not the default solution; proposed directory layout was not already approved/completed.

## 6. Proposal: separate idle logout from draft deletion

Then-documented behavior, not a bug; no unilateral change. Warning29min/logout30min also discarded drafts via scheduleSessionTimers/discardAndLogout. For private two-person use, recommend ending auth while retaining drafts for reauthentication. Preserve explicit Discard and sign out. If adopted, update usage/internals/tests together.

## Historical validation and limits

October 18 local tree: 110 units; project 11 days/36 events/12 checks; six browser suites drafts/inputs/prep/photos/theme/pwa passed. Separate cases1–3 reproduced with no page JS errors. Passing existing tests did not cover these combinations. Local draft-test mocks/auth stubs/exposed functions blocked outbound traffic; temporary repro scripts were deleted, so add permanent regressions from the steps above.

Windows Node 24.19.0, npm absent; ran `node --test tests/*.test.mjs`, `node scripts/check-project.mjs`; browser runner with `PWA_BROWSER_CHANNEL=chrome` because default Chromium absent. Initial sandbox blocked two HTTP units/browser localhost (`ERR_NETWORK_ACCESS_DENIED`); authorized elevated execution passed, not counted as app defects. Installed Chrome is not iPhone/Samsung evidence. Recheck current runtime paths rather than reuse old temporary state. Production Supabase/real phones were untested.

Update [usage](../USER_GUIDE.md) for recovery/input/logout/photos, [internals](../PROJECT_GUIDE.md) for draft/save/cancel, [operations](../OPERATIONS.md) for tests/troubleshooting, README for navigation. Retain this record as dated evidence, not the behavior specification.
