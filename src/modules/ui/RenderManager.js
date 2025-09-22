import EventBus from '../core/EventBus.js';
import StateManager from '../core/StateManager.js';
import ErrorHandler from '../core/ErrorHandler.js';
import UIManager from './UIManager.js';
import { EVENTS } from './constants.js';

class RenderManager {
    static lastRender = new Map();
    static renderQueue = new Set();
    static isRendering = false;

    static init() {
        this.setupEventListeners();
        this.startRenderLoop();
    }

    static setupEventListeners() {
        EventBus.on(EVENTS.UI_UPDATE, this.handleUIUpdate.bind(this));
        EventBus.on(EVENTS.STATE_CHANGED, this.handleStateChange.bind(this));
        EventBus.on(EVENTS.PROJECT_CREATED, () => this.scheduleRender('project-workspace'));
        EventBus.on(EVENTS.PROJECT_LOADED, () => this.scheduleRender('project-workspace'));
        EventBus.on(EVENTS.PAGE_ADDED, () => this.scheduleRender('page-list'));
        EventBus.on(EVENTS.PAGE_REMOVED, () => this.scheduleRender('page-list'));
        EventBus.on(EVENTS.PAGE_MOVED, () => this.scheduleRender('page-list'));
        EventBus.on(EVENTS.TEMPLATES_LOADED, () => this.scheduleRender('template-library'));
        EventBus.on(EVENTS.PROJECT_DIRTY, (isDirty) => this.scheduleRender('save-button', { isDirty }));
        EventBus.on(EVENTS.PROJECT_SAVED, (data) => {
            // Refresh page list when project is saved (especially auto-save)
            // This ensures main window previews show latest transforms
            this.scheduleRender('page-list');
            console.log('🔄 RenderManager: Scheduled page list refresh after project save', { autoSave: data?.autoSave });
        });
    }

    static handleUIUpdate(data) {
        const { type, data: updateData } = data;

        switch (type) {
            case 'project-created':
            case 'project-loaded':
                this.scheduleRender('project-workspace');
                this.scheduleRender('project-header');
                this.scheduleRender('project-properties');
                this.scheduleRender('project-controls', { enabled: true });
                break;

            case 'project-saved':
                this.scheduleRender('save-button', { isDirty: false });
                break;

            case 'project-dirty':
                this.scheduleRender('save-button', updateData);
                break;

            case 'page-added':
            case 'page-removed':
            case 'page-moved':
                this.scheduleRender('page-list');
                this.scheduleRender('project-header');
                break;

            case 'templates-loaded':
                this.scheduleRender('template-library');
                break;

            case 'images-loaded':
                this.scheduleRender('image-library', updateData);
                break;

            case 'connection-status':
                this.scheduleRender('connection-status', updateData);
                break;
        }
    }

    static handleStateChange(currentState, previousState) {
        // Compare state changes and schedule specific renders
        if (currentState.currentProject !== previousState.currentProject) {
            this.scheduleRender('project-workspace');
            this.scheduleRender('project-header');
            this.scheduleRender('project-properties');
        }

        if (currentState.isDirty !== previousState.isDirty) {
            this.scheduleRender('save-button', { isDirty: currentState.isDirty });
        }

        if (currentState.templates !== previousState.templates) {
            this.scheduleRender('template-library');
        }
    }

    static scheduleRender(component, data = null) {
        const renderItem = { component, data, timestamp: Date.now() };
        const wasEmpty = this.renderQueue.size === 0;
        this.renderQueue.add(renderItem);

        // Only start render loop if queue was empty and we're not already rendering
        if (wasEmpty && !this.isRendering && this.processRenderQueue) {
            requestAnimationFrame(this.processRenderQueue);
        }
    }

    static shouldUpdate(component, data) {
        const currentHash = this.hash(data);
        const lastHash = this.lastRender.get(component);

        if (lastHash === currentHash) {
            return false;
        }

        this.lastRender.set(component, currentHash);
        return true;
    }

    static hash(data) {
        if (data === null || data === undefined) {
            return 'null';
        }

        if (typeof data === 'object') {
            try {
                return JSON.stringify(data);
            } catch (error) {
                return String(data);
            }
        }

        return String(data);
    }

    static startRenderLoop() {
        this.processRenderQueue = () => {
            if (this.renderQueue.size === 0 || this.isRendering) {
                return; // Don't schedule another frame if no work
            }

            this.isRendering = true;

            // Process all queued renders
            const renders = Array.from(this.renderQueue);
            this.renderQueue.clear();

            // Group renders by component to avoid duplicate work
            const grouped = new Map();
            renders.forEach(render => {
                grouped.set(render.component, render);
            });

            // Execute renders
            grouped.forEach((render) => {
                try {
                    this.executeRender(render.component, render.data);
                } catch (error) {
                    console.warn(`Render error for ${render.component}:`, error);
                    ErrorHandler.logError(error, `RenderManager.${render.component}`, `Failed to render ${render.component}`);
                }
            });

            this.isRendering = false;
            // Only schedule next frame if there's more work
            if (this.renderQueue.size > 0) {
                requestAnimationFrame(this.processRenderQueue);
            }
        };
    }

    static executeRender(component, data) {
        if (!this.shouldUpdate(component, data)) {
            return;
        }

        switch (component) {
            case 'page-list':
                UIManager.renderPageList();
                break;

            case 'template-library':
                UIManager.renderTemplateLibrary();
                break;

            case 'project-workspace':
                UIManager.showProjectWorkspace();
                UIManager.renderPageList();
                break;

            case 'project-header':
                UIManager.updateProjectHeader();
                break;

            case 'project-properties':
                UIManager.updateProjectProperties();
                break;

            case 'project-controls':
                UIManager.enableProjectControls(data?.enabled);
                break;

            case 'save-button':
                UIManager.updateSaveButton(data?.isDirty);
                break;

            case 'image-library':
                UIManager.renderImageLibrary(data);
                break;

            case 'connection-status':
                UIManager.updateConnectionStatus(data?.isConnected, data?.message);
                break;

            case 'project-list':
                UIManager.renderProjectList(data);
                break;

            default:
                console.warn(`Unknown render component: ${component}`);
        }
    }

    static updatePageCard(pageId) {
        // Smart update for individual page card
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) return;

        const page = currentProject.pages.find(p => p.id === pageId);
        if (!page) return;

        const pageData = { pageId, page };

        if (this.shouldUpdate(`page-card-${pageId}`, pageData)) {
            UIManager.updatePageCard(pageId);
        }
    }

    static forceRender(component, data = null) {
        // Force render without checking if update is needed
        this.lastRender.delete(component);
        this.scheduleRender(component, data);
    }

    static clearRenderCache(component = null) {
        if (component) {
            this.lastRender.delete(component);
        } else {
            this.lastRender.clear();
        }
    }

    static getRenderStats() {
        return {
            queueSize: this.renderQueue.size,
            cacheSize: this.lastRender.size,
            isRendering: this.isRendering,
            cachedComponents: Array.from(this.lastRender.keys())
        };
    }

    static optimizeIframeUpdate(pageId, newContent) {
        // Optimize iframe updates instead of recreation
        const iframe = document.querySelector(`[data-page-id="${pageId}"] iframe`);

        if (iframe && iframe.contentDocument) {
            try {
                // Try to update content directly
                iframe.contentDocument.body.innerHTML = newContent;
                return true;
            } catch (error) {
                console.warn('Direct iframe update failed, falling back to recreation:', error);
                return false;
            }
        }

        return false;
    }

    static debounceRender(component, data, delay = 100) {
        clearTimeout(this._debounceTimers?.[component]);

        if (!this._debounceTimers) {
            this._debounceTimers = {};
        }

        this._debounceTimers[component] = setTimeout(() => {
            this.scheduleRender(component, data);
            delete this._debounceTimers[component];
        }, delay);
    }

    static cleanup() {
        this.renderQueue.clear();
        this.lastRender.clear();
        this.isRendering = false;

        if (this._debounceTimers) {
            Object.values(this._debounceTimers).forEach(timer => clearTimeout(timer));
            this._debounceTimers = {};
        }
    }
}

export default RenderManager;