// Import all our modular managers
import ErrorHandler from './modules/core/ErrorHandler.js';
import EventBus from './modules/core/EventBus.js';
import StateManager from './modules/core/StateManager.js';
import AutoSave from './modules/core/AutoSave.js';

import ProjectManager from './modules/data/ProjectManager.js';
import TemplateManager from './modules/data/TemplateManager.js';
import PageManager from './modules/data/PageManager.js';
import ImageManager from './modules/data/ImageManager.js';

import UIManager from './modules/ui/UIManager.js';
import EventManager from './modules/ui/EventManager.js';
import ModalManager from './modules/ui/ModalManager.js';
import RenderManager from './modules/ui/RenderManager.js';
import LoadingManager from './modules/ui/LoadingManager.js';
import SidebarManager from './modules/ui/SidebarManager.js';
import SearchManager from './modules/ui/SearchManager.js';

import OverlayManager from './modules/editing/OverlayManager.js';
import TextEditor from './modules/editing/TextEditor.js';

import UploadModalManager from './modules/upload/UploadModalManager.js';

import { EVENTS } from './modules/ui/constants.js';

class BrochureRenderer {
    constructor() {
        this.isInitialized = false;
        this.init();
    }

    async init() {
        try {
            await this.initializeCore();
            await this.initializeData();
            this.initializeUI();
            this.setupApplicationEvents();

            this.isInitialized = true;
            EventBus.emit(EVENTS.APP_READY);

        } catch (error) {
            ErrorHandler.logError(error, 'BrochureRenderer.init', 'Failed to initialize application');
        }
    }

    async initializeCore() {
        console.log('BrochureRenderer.initializeCore() starting...');

        // Initialize core systems
        console.log('Initializing ErrorHandler...');
        ErrorHandler.init();

        console.log('Initializing StateManager...');
        StateManager.setState({ basePath: await window.electronAPI.getBasePath() });

        console.log('Initializing AutoSave...');
        AutoSave.init();

        // Initialize managers
        console.log('Initializing EventManager...');
        EventManager.init();

        console.log('Initializing ModalManager...');
        ModalManager.init();

        console.log('Initializing RenderManager...');
        RenderManager.init();

        console.log('Initializing UploadModalManager...');
        UploadModalManager.init();

        console.log('Initializing SidebarManager...');
        SidebarManager.init();

        console.log('Initializing SearchManager...');
        SearchManager.init();

        console.log('Initializing OverlayManager...');
        OverlayManager.init();

        console.log('Initializing TextEditor...');
        TextEditor.init();

        console.log('Setting up file change listeners...');
        this.setupFileChangeListeners();

        console.log('BrochureRenderer.initializeCore() completed');
    }

    async initializeData() {
        // Check OneDrive connection
        const result = await window.electronAPI.checkOneDriveAccess();
        UIManager.updateConnectionStatus(result.success,
            result.success ? 'OneDrive Connected' : 'OneDrive Disconnected');

        // Load application data
        await this.loadApplicationData();
    }

    async loadApplicationData() {
        const loadingPromises = [
            TemplateManager.loadTemplates(),
            ImageManager.loadImages()
        ];

        try {
            const [templates, images] = await Promise.all(loadingPromises);

            // Hide loading states and render UI
            const loadingEl = document.getElementById('templatesLoading');
            const categoriesEl = document.getElementById('templateCategories');

            if (loadingEl) loadingEl.style.display = 'none';
            if (categoriesEl) categoriesEl.style.display = 'block';

            UIManager.renderTemplateLibrary();
            UIManager.renderImageLibrary(images);

        } catch (error) {
            ErrorHandler.logError(error, 'BrochureRenderer.loadApplicationData', 'Failed to load application data');
        }
    }

    initializeUI() {
        // Setup template drag and drop
        TemplateManager.setupTemplateDragAndDrop();

        // Setup image click handlers
        ImageManager.setupImageClickHandlers();

        // Initialize Feather icons
        feather.replace();

        // Test basic event handling
        console.log('Adding test click listener to document...');
        document.addEventListener('click', (e) => {
            console.log('DOCUMENT CLICK RECEIVED:', e.target, e.target.id, e.target.dataset);
        });
        console.log('Test click listener added');
    }

    setupApplicationEvents() {
        // Listen for state changes and update UI accordingly
        EventBus.on(EVENTS.STATE_DIRTY_CHANGED, (isDirty) => {
            UIManager.updateSaveButton(isDirty);
        });

        EventBus.on(EVENTS.STATE_PROJECT_CHANGED, (project) => {
            if (project) {
                UIManager.showProjectWorkspace();
                UIManager.updateProjectHeader();
                UIManager.updateProjectProperties();
                UIManager.enableProjectControls(true);
                UIManager.renderPageList();
            } else {
                UIManager.hideProjectWorkspace();
                UIManager.enableProjectControls(false);
            }
        });

        // Auto-save on window beforeunload
        window.addEventListener('beforeunload', (event) => {
            const state = StateManager.getState();
            if (state.isDirty && state.currentProject) {
                AutoSave.forceAutoSave();
            }
        });

        // Handle window errors
        window.addEventListener('error', (event) => {
            ErrorHandler.logError(event.error, 'window.error', 'Unexpected application error');
        });

        window.addEventListener('unhandledrejection', (event) => {
            ErrorHandler.logError(event.reason, 'unhandledrejection', 'Unhandled promise rejection');
        });
    }

    // Public API methods (replacing window.brochure)
    static API = {
        // Project operations
        async createProject(metadata) {
            return await ProjectManager.createProject(metadata, TemplateManager);
        },

        async saveProject() {
            return await ProjectManager.saveProject();
        },

        async loadProject(filename) {
            return await ProjectManager.loadProject(filename);
        },

        // Page operations
        movePageUp(pageId) {
            PageManager.movePageUp(pageId);
        },

        movePageDown(pageId) {
            PageManager.movePageDown(pageId);
        },

        duplicatePage(pageId) {
            return PageManager.duplicatePage(pageId);
        },

        deletePage(pageId) {
            return PageManager.deletePage(pageId);
        },

        zoomPage(pageId) {
            EventBus.emit(EVENTS.MODAL_OPENED, { modalId: 'pageZoomModal', data: { pageId } });
        },

        // Template operations
        addPageToProject(templateId) {
            return TemplateManager.addPageToProject(templateId);
        },

        // Modal operations
        showModal(modalId, data) {
            ModalManager.show(modalId, data);
        },

        hideModal(modalId) {
            ModalManager.hide(modalId);
        },

        // State access
        getCurrentProject() {
            return StateManager.getState().currentProject;
        },

        getApplicationState() {
            return StateManager.getState();
        }
    };

    // Cleanup method
    cleanup() {
        AutoSave.cleanup();
        EventManager.cleanup();
        ModalManager.cleanup();
        RenderManager.cleanup();
        LoadingManager.cleanup();
        EventBus.clear();
    }

    setupFileChangeListeners() {
        // Listen for file changes from main process
        window.electronAPI.onFileChange((data) => {
            this.handleFileChange(data);
        });
    }

    async handleFileChange(data) {
        console.log('📁 File change received:', data);

        try {
            if (data.type === 'templates') {
                console.log('🔄 Reloading templates...');

                // Reload templates from main process
                const templates = await window.electronAPI.loadTemplates();
                StateManager.setState({ templates });

                // Re-render template library
                EventBus.emit(EVENTS.UI_UPDATE, { type: 'templates-updated' });

                // Show notification
                ErrorHandler.showSuccess(`Templates updated: ${data.event} template detected`);

            } else if (data.type === 'images') {
                console.log('🔄 Reloading image library...');

                // Reload images from main process
                const images = await window.electronAPI.loadImages();
                StateManager.setState({ imageLibrary: images });

                // Re-render image library
                EventBus.emit(EVENTS.UI_UPDATE, { type: 'images-updated' });

                // Show notification
                ErrorHandler.showSuccess('Image library updated automatically');
            }
        } catch (error) {
            console.error('Error handling file change:', error);
            ErrorHandler.showUserError('Failed to reload updated files', 'error');
        }
    }
}

// Initialize the application
const brochure = new BrochureRenderer();

// Expose clean API instead of entire class
window.brochure = BrochureRenderer.API;

// Expose SearchManager for UIManager access
window.SearchManager = SearchManager;

// Expose ModalManager for ElementEditor access
window.ModalManager = ModalManager;

export default BrochureRenderer;