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

// @include app/auth-dialogs.js
// @include app/saving.js

// @include app/schedule-editor.js
// @include app/ledger-editor.js

// @include app/photos.js

// @include app/exports.js

// @include app/versions.js
// @include app/navigation.js

// @include app/startup.js
})();
