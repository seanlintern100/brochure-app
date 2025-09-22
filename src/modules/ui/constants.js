export const CSS_CLASSES = {
    LOADING: 'loading',
    ERROR: 'error',
    SUCCESS: 'success',
    INFO: 'info',
    WARNING: 'warning',

    PAGE_ITEM: 'page-item',
    PAGE_HEADER: 'page-header',
    PAGE_PREVIEW: 'page-preview',
    PAGE_ACTIONS: 'page-actions',
    PAGE_BTN: 'page-btn',

    TEMPLATE_ITEM: 'template-item',
    TEMPLATE_CATEGORY: 'template-category',
    TEMPLATE_LIST: 'template-list',

    PROJECT_ITEM: 'project-item',

    MODAL_ACTIVE: 'active',
    MODAL_CONTENT: 'modal-content',

    BTN: 'btn',
    BTN_PRIMARY: 'btn-primary',
    BTN_SECONDARY: 'btn-secondary',
    BTN_DELETE: 'delete',

    STATUS_MESSAGE: 'status-message',
    STATUS_SHOW: 'show',

    CONNECTION_STATUS: 'connection-status',
    CONNECTION_CONNECTED: 'connected',

    DRAG_OVER: 'drag-over',
    DRAGGING: 'dragging',
    COLLAPSED: 'collapsed',

    ADD_PAGE_BTN: 'add-page-btn',
    IMAGE_THUMB: 'image-thumb'
};

export const TIMING = {
    AUTO_SAVE_DELAY: 30000,
    DEBOUNCE_DELAY: 300,
    ANIMATION_DURATION: 300,
    STATUS_MESSAGE_TIMEOUT: 4000,
    LOADING_DELAY: 100
};

export const EVENTS = {
    APP_READY: 'app:ready',
    APP_ERROR: 'app:error',

    PROJECT_CREATED: 'project:created',
    PROJECT_LOADED: 'project:loaded',
    PROJECT_SAVED: 'project:saved',
    PROJECT_DIRTY: 'project:dirty',

    PAGE_ADDED: 'page:added',
    PAGE_REMOVED: 'page:removed',
    PAGE_UPDATED: 'page:updated',
    PAGE_MOVED: 'page:moved',
    PAGE_DUPLICATED: 'page:duplicated',

    TEMPLATE_SELECTED: 'template:selected',
    TEMPLATES_LOADED: 'templates:loaded',
    TEMPLATES_REFRESH_NEEDED: 'templates:refresh-needed',

    MODAL_OPENED: 'modal:opened',
    MODAL_CLOSED: 'modal:closed',

    UI_RENDER: 'ui:render',
    UI_UPDATE: 'ui:update',

    SIDEBAR_TOGGLE_SECTION: 'sidebar:toggle-section',

    STATE_CHANGED: 'state:changed',
    STATE_DIRTY_CHANGED: 'state:dirty-changed',
    STATE_PROJECT_CHANGED: 'state:project-changed',
    STATE_TEMPLATES_CHANGED: 'state:templates-changed',

    // Template Upload Events
    UPLOAD_MODAL_OPEN: 'upload:modal-open',
    UPLOAD_STARTED: 'upload:started',
    UPLOAD_FILE_PROCESSED: 'upload:file-processed',
    UPLOAD_VALIDATION_COMPLETE: 'upload:validation-complete',
    UPLOAD_PAGE_ORDER_CHANGED: 'upload:page-order-changed',
    UPLOAD_PAGE_ORDER_CHANGE_REQUESTED: 'upload:page-order-change-requested',
    UPLOAD_PAGE_NAME_CHANGED: 'upload:page-name-changed',
    UPLOAD_METADATA_COLLECTED: 'upload:metadata-collected',
    UPLOAD_STRUCTURE_GENERATED: 'upload:structure-generated',
    UPLOAD_SAVE_STARTED: 'upload:save-started',
    UPLOAD_SAVE_COMPLETED: 'upload:save-completed',
    UPLOAD_SAVE_ERROR: 'upload:save-error',
    UPLOAD_SESSION_RESET: 'upload:session-reset',
    UPLOAD_PREVIEW_RENDERED: 'upload:preview-rendered',
    UPLOAD_PREVIEW_CLICKED: 'upload:preview-clicked',
    UPLOAD_PREVIEW_REORDERED: 'upload:preview-reordered',
    UPLOAD_ERROR: 'upload:error',

    // Overlay System Events
    OVERLAY_CHANGED: 'overlay:changed',
    OVERLAY_CLEARED: 'overlay:cleared',
    OVERLAY_APPLIED: 'overlay:applied'
};

export const SELECTORS = {
    STATUS_MESSAGE: '#statusMessage',
    CONNECTION_STATUS: '#connectionStatus',
    TEMPLATES_LOADING: '#templatesLoading',
    TEMPLATE_CATEGORIES: '#templateCategories',
    PROJECT_LIST: '#projectList',
    PAGE_LIST: '#pageList',
    PROJECT_WORKSPACE: '#projectWorkspace',
    DOCUMENT_TITLE: '#documentTitle',
    DOCUMENT_INFO: '#documentInfo',
    PROJECT_NAME: '#projectName',
    PROJECT_CLIENT: '#projectClient',
    PROJECT_STATUS: '#projectStatus',
    PREVIEW_FRAME: '#previewFrame',
    ZOOM_FRAME: '#zoomFrame',
    ZOOM_PAGE_TITLE: '#zoomPageTitle',
    IMAGE_GALLERY: '#imageGallery',
    SAVE_PROJECT_BTN: '#saveProjectBtn',
    ADD_PAGE_BTN: '#addPageBtn'
};

export const ACTIONS = {
    MOVE_PAGE_UP: 'move-page-up',
    MOVE_PAGE_DOWN: 'move-page-down',
    DUPLICATE_PAGE: 'duplicate-page',
    DELETE_PAGE: 'delete-page',
    ZOOM_PAGE: 'zoom-page',
    OPEN_PROJECT: 'open-project',
    TOGGLE_CATEGORY: 'toggle-category',
    TOGGLE_TEMPLATE: 'toggle-template',
    SHOW_ADD_PAGE: 'show-add-page',
    ADD_TEMPLATE_PAGE: 'add-template-page',
    ADD_FULL_TEMPLATE: 'add-full-template',
    OPEN_UPLOAD_MODAL: 'open-upload-modal',
    START_UPLOAD: 'start-upload'
};

export const MODAL_IDS = {
    NEW_PROJECT: 'newProjectModal',
    OPEN_PROJECT: 'openProjectModal',
    PREVIEW: 'previewModal',
    PAGE_ZOOM: 'pageZoomModal',
    UPLOAD_TEMPLATES: 'uploadTemplatesModal'
};

export const FILE_EXTENSIONS = {
    PROJECT: '.3bt',
    TEMPLATE: '.html',
    LOCK: '.lock'
};

export const VALIDATION = {
    MAX_PROJECT_NAME_LENGTH: 100,
    MAX_CLIENT_NAME_LENGTH: 100,
    MIN_PROJECT_NAME_LENGTH: 1,
    SAFE_FILENAME_REGEX: /^[a-zA-Z0-9-_\s]+$/
};