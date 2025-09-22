import EventBus from './EventBus.js';
import ErrorHandler from './ErrorHandler.js';
import StateManager from './StateManager.js';
import ProjectManager from '../data/ProjectManager.js';
import { EVENTS, TIMING } from '../ui/constants.js';

class AutoSave {
    static timeout = null;
    static isEnabled = true;
    static lastSaveTime = null;
    static saveCount = 0;

    static init() {
        this.setupEventListeners();
    }

    static setupEventListeners() {
        EventBus.on(EVENTS.PROJECT_DIRTY, this.handleProjectDirty.bind(this));
        EventBus.on(EVENTS.PROJECT_SAVED, this.handleProjectSaved.bind(this));
        EventBus.on(EVENTS.PROJECT_LOADED, this.handleProjectLoaded.bind(this));
        EventBus.on(EVENTS.PROJECT_CREATED, this.handleProjectCreated.bind(this));

        // Listen for state changes that should trigger auto-save
        EventBus.on(EVENTS.PAGE_ADDED, () => this.schedule());
        EventBus.on(EVENTS.PAGE_REMOVED, () => this.schedule());
        EventBus.on(EVENTS.PAGE_MOVED, () => this.schedule());
        EventBus.on(EVENTS.PAGE_UPDATED, () => this.schedule());
    }

    static schedule(delay = TIMING.AUTO_SAVE_DELAY) {
        if (!this.isEnabled) return;

        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) return;

        // Clear existing timeout
        this.cancel();

        // Schedule new auto-save
        this.timeout = setTimeout(async () => {
            try {
                await this.executeAutoSave();
            } catch (error) {
                ErrorHandler.logError(error, 'AutoSave.schedule', 'Auto-save failed');
            }
        }, delay);
    }

    static cancel() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }

    static async executeAutoSave() {
        const state = StateManager.getState();

        if (!state.currentProject || !state.isDirty) {
            return;
        }

        try {
            const result = await ProjectManager.saveProject();

            if (result.success) {
                this.lastSaveTime = new Date();
                this.saveCount++;

                // Show subtle auto-save indicator
                this.showAutoSaveIndicator();

                EventBus.emit(EVENTS.PROJECT_SAVED, {
                    project: state.currentProject,
                    result,
                    autoSave: true
                });
            }
        } catch (error) {
            // Don't show error to user for auto-save failures
            // Just log it and let manual save handle user feedback
            ErrorHandler.logError(error, 'AutoSave.executeAutoSave', null);
        }
    }

    static showAutoSaveIndicator() {
        // Create a subtle indicator that auto-save occurred
        const indicator = document.createElement('div');
        indicator.textContent = '✓ Auto-saved';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(46, 125, 50, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 10000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        `;

        document.body.appendChild(indicator);

        // Animate in
        requestAnimationFrame(() => {
            indicator.style.opacity = '1';
        });

        // Remove after delay
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => {
                if (indicator.parentNode) {
                    indicator.parentNode.removeChild(indicator);
                }
            }, 300);
        }, 2000);
    }

    static handleProjectDirty(isDirty) {
        if (isDirty) {
            this.schedule();
        } else {
            this.cancel();
        }
    }

    static handleProjectSaved(data) {
        // Cancel auto-save if manual save occurred
        this.cancel();

        if (!data.autoSave) {
            this.lastSaveTime = new Date();
        }
    }

    static handleProjectLoaded(project) {
        // Reset auto-save state for new project
        this.cancel();
        this.lastSaveTime = null;
    }

    static handleProjectCreated(project) {
        // Start auto-save for new project
        this.schedule();
    }

    static enable() {
        this.isEnabled = true;

        // Schedule auto-save if project is dirty
        const state = StateManager.getState();
        if (state.currentProject && state.isDirty) {
            this.schedule();
        }
    }

    static disable() {
        this.isEnabled = false;
        this.cancel();
    }

    static isActive() {
        return this.timeout !== null;
    }

    static getTimeUntilNextSave() {
        if (!this.timeout) return null;

        const scheduled = this.timeout._idleStart + this.timeout._idleTimeout;
        const now = Date.now();
        return Math.max(0, scheduled - now);
    }

    static getLastSaveTime() {
        return this.lastSaveTime;
    }

    static getSaveCount() {
        return this.saveCount;
    }

    static getStatus() {
        return {
            enabled: this.isEnabled,
            active: this.isActive(),
            lastSaveTime: this.lastSaveTime,
            saveCount: this.saveCount,
            timeUntilNextSave: this.getTimeUntilNextSave()
        };
    }

    static setDelay(delay) {
        if (delay < 1000 || delay > 300000) { // 1 second to 5 minutes
            throw new Error('Auto-save delay must be between 1 second and 5 minutes');
        }

        // If auto-save is scheduled, reschedule with new delay
        if (this.isActive()) {
            this.schedule(delay);
        }
    }

    static forceAutoSave() {
        if (!this.isEnabled) return;

        this.cancel();
        return this.executeAutoSave();
    }

    static reset() {
        this.cancel();
        this.lastSaveTime = null;
        this.saveCount = 0;
    }

    static cleanup() {
        this.cancel();
        this.reset();
    }
}

export default AutoSave;