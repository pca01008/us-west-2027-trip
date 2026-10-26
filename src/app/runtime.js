  const SUPABASE_URL = CONFIG.supabase?.url||'';
  const SUPABASE_PUBLISHABLE_KEY = CONFIG.supabase?.publishableKey||'';
  const EDITOR_EMAIL = CONFIG.editorEmail||'';
  const TRIP_ID = CONFIG.tripId;
  const MEDIA_BUCKET = CONFIG.supabase?.mediaBucket||'trip-media';
  const SCHEMA_VERSION = Number(CONFIG.schemaVersion)||4;
  const CACHE_NAMESPACE = String(CONFIG.cacheNamespace||TRIP_ID).replace(/[^a-zA-Z0-9_-]/g,'_');
  const LEGACY_CACHE_KEY = CACHE_NAMESPACE+'_public_cache_v'+SCHEMA_VERSION;
  const SESSION_ACTIVITY_KEY = CACHE_NAMESPACE+'_editor_activity_v1';
  const SESSION_CHANNEL_NAME = CACHE_NAMESPACE+'_editor_session_v1';
  const OFFLINE_MODE = document.documentElement.dataset.offline === 'true';
  const OFFLINE_ID = document.documentElement.dataset.offlineId || 'live';
  const DRAFT_DB_NAME = CACHE_NAMESPACE+'_trip_drafts';
  const LEGACY_DRAFT_RECORD_KEY = OFFLINE_MODE ? 'offline:'+OFFLINE_ID : 'online:'+TRIP_ID;
  const DRAFT_RECORD_KEY = LEGACY_DRAFT_RECORD_KEY+':'+uid('tab');
  const DRAFT_SESSION_KEY = DRAFT_DB_NAME+':'+LEGACY_DRAFT_RECORD_KEY;
  const PUBLIC_CACHE_RECORD_KEY = 'public:'+TRIP_ID;
  const SESSION_MS = 30 * 60 * 1000;
  const WARNING_MS = 29 * 60 * 1000;
  const TRIP_START = Date.parse(CONFIG.tripStart);
  const TRIP_END = Date.parse(CONFIG.tripEnd);
  const HOME_TIME_ZONE = CONFIG.clocks?.home?.timeZone||'Asia/Seoul';
  const DESTINATION_TIME_ZONE = CONFIG.clocks?.destination?.timeZone||HOME_TIME_ZONE;
  const VISITOR_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone||HOME_TIME_ZONE;
  const HOME_REFERENCE_LABEL = CONFIG.clocks?.homeReferenceLabel||CONFIG.clocks?.home?.label||'HOME';
  const DESTINATION_REFERENCE_LABEL = CONFIG.clocks?.differenceLabel||CONFIG.clocks?.destination?.label||'DESTINATION';
  const TRIP_FIRST_DATE = TRIP_DAYS[0].date;
  const TRIP_LAST_DATE = TRIP_DAYS.at(-1).date;
  const DEFAULT_EXCHANGE_RATE = Number(CONFIG.ledger.defaultExchangeRate);
  const DEFAULT_BUDGET_KRW = Math.max(0,Number(CONFIG.ledger.defaultBudgetKrw)||0);
  const EXPORT_BASE_NAME = String(CONFIG.exportBaseName||TRIP_ID).replace(/[^a-zA-Z0-9_-]/g,'_');
  const MEDIA_PATH_PATTERN = new RegExp('^'+TRIP_ID.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'/[a-zA-Z0-9._/-]+$');
  const PREVIEW_DATE_PARAM = new URLSearchParams(location.search).get('previewDate');
  const PREVIEW_NOW = PREVIEW_DATE_PARAM ? Date.parse(PREVIEW_DATE_PARAM) : NaN;
  const DELETED_CATEGORY_ID = 'deleted';
  const REQUIRED_CATEGORY_IDS = new Set(['misc',DELETED_CATEGORY_ID]);
  const IMPORT_ALLOWED_MONEY_IDS = new Set(['expenseDate','expenseCategory','expenseName','expenseKrw','expenseUsd','expenseKrwHint','expenseUsdHint','addExpense','exchangeRate','exchangeRateUpdated','totalKrw','totalUsd','categorySummary','addCategoryBtn','categoryManagerList','expenseCsvExport','expenses']);
  const ICON_CANDIDATES = ['✈️','🏨','🍽️','☕','🚗','🚕','⛽','🅿️','🎟️','🎭','🏞️','🛍️','💆','🍸','🎁','💊','📱','💵','📦','🗑️'];
  const DEFAULT_CATEGORIES = (CONFIG.ledger?.categories||[]).map(item=>({...item}));
  const ICONS = {
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2"/>',
    wallet:'<path d="M20 8V5H5a2 2 0 0 0 0 4h16v11H5a2 2 0 0 1-2-2V7"/><path d="M21 12h-6v5h6M18 14.5h.01"/>',
    edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    undo:'<path d="m9 14-4-4 4-4"/><path d="M5 10h8a6 6 0 0 1 6 6v1"/>',
    redo:'<path d="m15 14 4-4-4-4"/><path d="M19 10h-8a6 6 0 0 0-6 6v1"/>',
    plus:'<path d="M12 5v14M5 12h14"/>', check:'<path d="m5 12 4 4L19 6"/>',
    reset:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    save:'<path d="M5 4h12l2 2v14H5Z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/>',
    upload:'<path d="M3 8h7l2 2h9v10H3Z"/><path d="M12 17V7"/><path d="m8 11 4-4 4 4"/>',
    export:'<path d="M5 12v8h14v-8"/><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/>',
    work:'<rect x="3" y="5" width="18" height="13" rx="2"/><path d="M8 22h8M12 18v4"/><path d="m14 8 2 2-5 5H9v-2Z"/>',
    readonly:'<path d="M6 2h8l4 4v16H6Z"/><path d="M14 2v5h5"/><rect x="9" y="14" width="6" height="5" rx="1"/><path d="M10.5 14v-1a1.5 1.5 0 0 1 3 0v1"/>',
    history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    logout:'<path d="M10 5H5v14h5"/><path d="M14 8l4 4-4 4M9 12h9"/>',
    photo:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 15-5-5L5 20"/>',
    map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    alert:'<path d="M10.3 3.7 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    up:'<path d="m6 15 6-6 6 6"/>', down:'<path d="m6 9 6 6 6-6"/>'
  };
  const client = OFFLINE_MODE||!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY||!window.supabase ? null : window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const body = document.body;
  const BASELINE_MAIN_HTML = $('main').innerHTML;
  const PUBLISHED_MIGRATION_SELECTORS = ['.prepday',...TRIP_DAYS.map((_,index)=>'.day'+(index+1))];

  let expenses = [];
  let categories = DEFAULT_CATEGORIES.map(item => ({...item}));
  let exchangeRate = DEFAULT_EXCHANGE_RATE;
  let exchangeRateUpdated = '';
  let budgetKrw = DEFAULT_BUDGET_KRW;
  let lastScheduleDay = 'd1';
  let editorSession = null;
  let lastSavedState = null;
  let pendingDraft = false;
  const pendingChecks = new Map();
  const checkFeedback = new Map();
  let checklistQueue = Promise.resolve();
  let checklistSaving = false;
  let checklistAuthPending = false;
  let checklistEditorBase = [];
  let checklistEditorItems = [];
  const newChecklistItemIds = new Set();
  let checklistEditorSaving = false;
  let history = [];
  let historyIndex = -1;
  let applyingHistory = false;
  let historyTimer = null;
  let warningTimer = null;
  let logoutTimer = null;
  let countdownTimer = null;
  let noticeResolver = null;
  let noticeInputValue = '';
  let authPurpose = 'edit';
  let pendingAuthAction = null;
  let pendingAuthCancel = null;
  let previewReturnState = null;
  let moneyTemplateHtml = '';
  let activeScheduleRow = null;
  let scheduleTimeTarget = null;
  let editingCategoryId = null;
  let editingExpenseId = null;
  let selectedCategoryIcon = '📦';
  let pendingImport = null;
  let tabScrollReleaseTimer = null;
  let tabScrollReleaseHandler = null;
  let publishedRevision = 0;
  let publishedUpdatedAt = '';
  let pendingRemoteState = null;
  let draftBaselineUnknown = false;
  let deferredDraftRecovery = false;
  let draftWriteTimer = null;
  let draftDatabasePromise = null;
  let memoryDraftRecord = null;
  let draftWriteGeneration = 0;
  let draftStoragePromise = null;
  let draftStorageReady = false;
  let draftLockPromise = null;
  let memoryPublicCache = null;
  let saveInFlight = false;
  let signingOut = false;
  let lastActivityBroadcast = 0;
  let activePhotoFigure = null;
  let operationBusy = false;
  let operationCancelled = false;
  let operationController = null;
  let selectedVersion = null;
  let versionRequest = null;
  let timetableActive = false;
  let timetableStart = 0;
  let timetableRange = window.matchMedia('(max-width:620px)').matches ? '1' : 'all';
  let timetableDays = [];
  let timetableOverviewResizeFrame = 0;
  let timetableDayScrollTop = 0;
  const versionContentCache = new Map();
  const dialogFocusOrigins = new WeakMap();
  const openDialogStack = [];
  const sessionChannel = !OFFLINE_MODE&&'BroadcastChannel' in window ? new BroadcastChannel(SESSION_CHANNEL_NAME) : null;
