(() => {
  'use strict';

// @include app/config.js

// @include app/runtime.js

// @include app/utilities.js
// @include app/timetable-core.js
const {parseTimetableTime,scheduleTimeValue,scheduleClockMask,scheduleClockValue,editScheduleClock,scheduleKindMode,timetableKind,layoutTimetableEvents,timetableWindow} = createTimetableCore();
// @include app/timetable.js
// @include app/ui-helpers.js

// @include app/drafts.js

// @include app/trip-clock.js

// @include app/categories.js
// @include app/ledger-domain.js
const {decimalParts,roundRatio,safeMinor,parseLedgerInput,parseLedgerRate,convertLedgerAmount,ledgerSumParts,sumLedgerAmounts,formatLedgerSum,expenseMoney,emptyExpenseInput,calculateExpenseInput,normalizeExpense,normalizeExpenses,formatCurrencyAmount} = createLedgerDomain({LEDGER_CURRENCIES,currencyLabel,formatCurrencyMinor,safeDataId,hashText,findCategoryId});
// @include app/ledger.js
// @include app/state.js

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
