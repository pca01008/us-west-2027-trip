(() => {
  'use strict';

// @include app/config.js

// @include app/runtime.js

// @include app/utilities.js
// @include app/timetable-core.js
const {parseTimetableTime,scheduleTimeValue,scheduleClockMask,scheduleClockValue,editScheduleClock,scheduleKindMode,timetableKind,layoutTimetableEvents,timetableWindow} = createTimetableCore();
// @include app/timetable.js
// @include app/ui-helpers.js

// @include app/draft-storage.js
const draftStorage=createDraftStorage({DRAFT_DB_NAME:DRAFT_DB_NAME,DRAFT_RECORD_KEY:DRAFT_RECORD_KEY,DRAFT_SESSION_KEY:DRAFT_SESSION_KEY,LEGACY_CACHE_KEY:LEGACY_CACHE_KEY,LEGACY_DRAFT_RECORD_KEY:LEGACY_DRAFT_RECORD_KEY,PUBLIC_CACHE_RECORD_KEY:PUBLIC_CACHE_RECORD_KEY,TRIP_ID:TRIP_ID,clone:clone,showDraftStorageWarning:(...args)=>showDraftStorageWarning(...args)});
const {draftCheckpointKey,readDraftCheckpoint,removeDraftCheckpoint,openDraftDatabase,acquireDraftLock,prepareDraftStorage,readDraftRecord,readPublicCache,invalidateWrites,retainDraft}=draftStorage;
// @include app/drafts.js

// @include app/trip-clock.js

// @include app/categories.js
// @include app/ledger-domain.js
const {decimalParts,roundRatio,safeMinor,parseLedgerInput,parseLedgerRate,convertLedgerAmount,ledgerSumParts,sumLedgerAmounts,formatLedgerSum,expenseMoney,emptyExpenseInput,calculateExpenseInput,normalizeExpense,normalizeExpenses,formatCurrencyAmount} = createLedgerDomain({LEDGER_CURRENCIES,currencyLabel,formatCurrencyMinor,safeDataId,hashText,findCategoryId});
// @include app/ledger.js
// @include app/document-session.js
const documentSession=createDocumentSession({clone,normalize:(...args)=>normalizeState(...args),fingerprint:(...args)=>fingerprint(...args)});
// @include app/document.js
const documentAdapter=createDocumentAdapter({$:$,
$$:$$,
DEFAULT_BUDGET_KRW:DEFAULT_BUDGET_KRW,
DEFAULT_EXCHANGE_RATE:DEFAULT_EXCHANGE_RATE,
IMPORT_ALLOWED_MONEY_IDS:IMPORT_ALLOWED_MONEY_IDS,
MEDIA_PATH_PATTERN:MEDIA_PATH_PATTERN,
SCHEMA_VERSION:SCHEMA_VERSION,
SUPABASE_URL:SUPABASE_URL,
TRIP_ID:TRIP_ID,
afterApply:()=>{setEditable(body.classList.contains('editing'));updateContextControls();},
assertCurrencyPair:(...args)=>assertCurrencyPair(...args),
assertSupportedSchema:(...args)=>assertSupportedSchema(...args),
beforeApply:()=>{$('#timetableDetail').hidden=true;closeScheduleTimeDialog();},
clone:(...args)=>clone(...args),
currencyMetadata:(...args)=>currencyMetadata(...args),
drawExpenseInput:(...args)=>drawExpenseInput(...args),
entryPending:()=>expenseAddPending,
hashText:(...args)=>hashText(...args),
normalizeCategories:(...args)=>normalizeCategories(...args),
normalizeExpenses:(...args)=>normalizeExpenses(...args),
pendingCheckBefore:id=>pendingChecks.get(id)?.before,
readEntryBuffer:()=>clone(expenseInput),
readLedger:()=>({expenses,categories,exchangeRate,exchangeRateUpdated,budgetKrw}),
renderCheckFeedback:(...args)=>renderCheckFeedback(...args),
renderDocument:()=>{decorateDates();decorateChecklist();decorateScheduleRows();renderLedger();},
replaceLedger:state=>{expenses=clone(state.expenses);categories=clone(state.categories);exchangeRate=state.exchangeRate;exchangeRateUpdated=state.exchangeRateUpdated;budgetKrw=state.budgetKrw;},
restoreEntryBuffer:value=>{expenseInput=value;},
scheduleKindMode:(...args)=>scheduleKindMode(...args),
sumLedgerAmounts:(...args)=>sumLedgerAmounts(...args)});
const {sanitizeMarkup,checkLabelText,preserveLegacyLedger,migratePublishedState,captureState,applyState,applyStatePreservingInputs,setMoneyTemplate,isApplying,migrationNotice}=documentAdapter;
const normalizeState=(raw,imported=false)=>documentAdapter.normalizeState(raw,{imported,fallback:raw?.html?null:captureState()});

// @include app/checklist-schedule.js
// @include app/ledger-view.js
// @include app/state-ui.js

// @include app/trip-repository.js
const tripRepository = createTripRepository({client,tripId:TRIP_ID,offline:OFFLINE_MODE,publishedReadMs:()=>runtimeOptions.publishedReadMs});
const {fetchPublishedState} = tripRepository;
// @include app/dialogs.js
const dialogs=createDialogs({$, $$, body});
const {closeNotice,showChoice,focusableIn,setFieldError,rememberDialogOrigin,showDialog,closeTopDialog,registerDialogState,initializeDialogAccessibility}=dialogs;
// @include app/session.js
const sessionService=createSession({client,offline:OFFLINE_MODE,editorEmail:EDITOR_EMAIL,activityKey:SESSION_ACTIVITY_KEY,channelName:SESSION_CHANNEL_NAME,sessionMs:SESSION_MS,warningMs:WARNING_MS,
  onChange:session=>{body.classList.toggle('authenticated',Boolean(session)&&!OFFLINE_MODE);if(!session)invalidateVersionRequest();},
  onInvalidate:()=>invalidateVersionRequest(),onWarning:()=>showInactivityWarning(),onExpire:message=>logoutPreservingDraft(message),onExternalSignOut:message=>handleExternalSignOut(message),
  canTrackActivity:()=>$('#noticeDialog').hidden,onSharedActivity:()=>{if(!$('#noticeDialog').hidden&&!$('#sessionCountdown').hidden)closeNotice('continue');},onClearTimers:()=>dialogs.clearCountdown()});
const {clearSessionTimers,scheduleSessionTimers,editorEmailMatches,setEditorSession,acceptSharedActivity,resetInactivityTimer,getEditorSession,signOutEditor}=sessionService;
// @include app/editing.js
// @include app/saving.js

// @include app/schedule-editor.js
// @include app/ledger-editor.js

// @include app/photos.js

// @include app/exports.js

// @include app/versions.js
// @include app/navigation.js

// @include app/startup.js
})();
