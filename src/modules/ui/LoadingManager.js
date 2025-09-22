import { Templates } from './templates.js';
import { CSS_CLASSES, TIMING } from './constants.js';

class LoadingManager {
    static activeLoaders = new Map();
    static globalLoader = null;

    static show(element, message = 'Loading...', options = {}) {
        const target = this.getElement(element);
        if (!target) return null;

        const config = {
            message,
            spinner: true,
            overlay: false,
            ...options
        };

        // Create unique loader ID
        const loaderId = this.generateId();

        // Store original content if not already stored
        if (!target.dataset.originalContent) {
            target.dataset.originalContent = target.innerHTML;
        }

        // Create loading content
        const loadingHTML = this.createLoadingHTML(config);

        // Apply loading state
        if (config.overlay) {
            this.showOverlayLoader(target, loadingHTML, loaderId);
        } else {
            target.innerHTML = loadingHTML;
            target.classList.add(CSS_CLASSES.LOADING);
        }

        // Store loader info
        this.activeLoaders.set(loaderId, {
            element: target,
            config,
            startTime: Date.now()
        });

        return loaderId;
    }

    static hide(elementOrId) {
        if (typeof elementOrId === 'string') {
            // It's a loader ID
            return this.hideById(elementOrId);
        } else {
            // It's an element
            return this.hideByElement(elementOrId);
        }
    }

    static hideById(loaderId) {
        const loader = this.activeLoaders.get(loaderId);
        if (!loader) return false;

        this.restoreElement(loader.element);
        this.activeLoaders.delete(loaderId);
        return true;
    }

    static hideByElement(element) {
        const target = this.getElement(element);
        if (!target) return false;

        // Find loader by element
        let foundLoaderId = null;
        for (const [loaderId, loader] of this.activeLoaders) {
            if (loader.element === target) {
                foundLoaderId = loaderId;
                break;
            }
        }

        if (foundLoaderId) {
            return this.hideById(foundLoaderId);
        }

        // Fallback: restore element directly
        this.restoreElement(target);
        return true;
    }

    static hideAll() {
        const loaderIds = Array.from(this.activeLoaders.keys());
        loaderIds.forEach(id => this.hideById(id));

        if (this.globalLoader) {
            this.hideGlobalLoader();
        }
    }

    static showGlobalLoader(message = 'Loading...') {
        if (this.globalLoader) {
            this.hideGlobalLoader();
        }

        const overlay = document.createElement('div');
        overlay.className = 'global-loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            color: white;
            font-family: 'Source Sans 3', sans-serif;
        `;

        const content = document.createElement('div');
        content.innerHTML = this.createLoadingHTML({ message, spinner: true });
        content.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            padding: 40px;
            border-radius: 8px;
            text-align: center;
            backdrop-filter: blur(10px);
        `;

        overlay.appendChild(content);
        document.body.appendChild(overlay);

        this.globalLoader = overlay;
        return 'global-loader';
    }

    static hideGlobalLoader() {
        if (this.globalLoader && this.globalLoader.parentNode) {
            this.globalLoader.parentNode.removeChild(this.globalLoader);
            this.globalLoader = null;
        }
    }

    static showProgress(element, percent, message = '') {
        const target = this.getElement(element);
        if (!target) return null;

        const progressHTML = this.createProgressHTML(percent, message);
        target.innerHTML = progressHTML;
        target.classList.add(CSS_CLASSES.LOADING);

        return this.generateId();
    }

    static updateProgress(elementOrId, percent, message = '') {
        const target = typeof elementOrId === 'string' ?
            this.activeLoaders.get(elementOrId)?.element :
            this.getElement(elementOrId);

        if (!target) return false;

        const progressBar = target.querySelector('.progress-bar-fill');
        const progressText = target.querySelector('.progress-text');
        const progressPercent = target.querySelector('.progress-percent');

        if (progressBar) {
            progressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
        }

        if (progressText && message) {
            progressText.textContent = message;
        }

        if (progressPercent) {
            progressPercent.textContent = `${Math.round(percent)}%`;
        }

        return true;
    }

    static showOverlayLoader(target, loadingHTML, loaderId) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        `;

        overlay.innerHTML = loadingHTML;
        overlay.dataset.loaderId = loaderId;

        // Make target relative if not already positioned
        const targetStyle = window.getComputedStyle(target);
        if (targetStyle.position === 'static') {
            target.style.position = 'relative';
            target.dataset.positionChanged = 'true';
        }

        target.appendChild(overlay);
    }

    static createLoadingHTML(config) {
        if (config.spinner) {
            return Templates.loadingSpinner(config.message);
        } else {
            return `<div class="${CSS_CLASSES.LOADING}"><p>${config.message}</p></div>`;
        }
    }

    static createProgressHTML(percent, message) {
        return `
            <div class="progress-container" style="width: 100%; text-align: center;">
                <div class="progress-bar" style="width: 200px; height: 6px; background: #eee; border-radius: 3px; margin: 10px auto; overflow: hidden;">
                    <div class="progress-bar-fill" style="height: 100%; background: var(--color-teal); width: ${percent}%; transition: width 0.3s ease;"></div>
                </div>
                <div class="progress-text" style="font-size: 14px; color: var(--color-charcoal); margin-bottom: 5px;">${message}</div>
                <div class="progress-percent" style="font-size: 12px; color: var(--color-cool-gray);">${Math.round(percent)}%</div>
            </div>
        `;
    }

    static restoreElement(element) {
        if (!element) return;

        // Remove loading overlay if present
        const overlay = element.querySelector('.loading-overlay');
        if (overlay) {
            overlay.remove();
        }

        // Restore original content
        if (element.dataset.originalContent) {
            element.innerHTML = element.dataset.originalContent;
            delete element.dataset.originalContent;
        }

        // Restore position if changed
        if (element.dataset.positionChanged === 'true') {
            element.style.position = '';
            delete element.dataset.positionChanged;
        }

        element.classList.remove(CSS_CLASSES.LOADING);
    }

    static getElement(elementOrSelector) {
        if (typeof elementOrSelector === 'string') {
            return document.querySelector(elementOrSelector);
        }
        return elementOrSelector;
    }

    static generateId() {
        return `loader-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    static isLoading(elementOrId) {
        if (typeof elementOrId === 'string') {
            return this.activeLoaders.has(elementOrId);
        } else {
            const target = this.getElement(elementOrId);
            for (const loader of this.activeLoaders.values()) {
                if (loader.element === target) {
                    return true;
                }
            }
            return false;
        }
    }

    static getLoadingStats() {
        return {
            activeLoaders: this.activeLoaders.size,
            globalLoader: !!this.globalLoader,
            loaderDetails: Array.from(this.activeLoaders.entries()).map(([id, loader]) => ({
                id,
                message: loader.config.message,
                duration: Date.now() - loader.startTime,
                element: loader.element.tagName + (loader.element.id ? `#${loader.element.id}` : '')
            }))
        };
    }

    static cleanup() {
        this.hideAll();
        this.activeLoaders.clear();
        this.globalLoader = null;
    }

    // Utility methods for common loading scenarios
    static showTemplateLoading() {
        return this.show('#templateCategories', 'Loading templates...');
    }

    static showProjectLoading() {
        return this.show('#projectList', 'Loading projects...');
    }

    static showImageLoading() {
        return this.show('#imageGallery', 'Loading images...');
    }

    static showSaveProgress() {
        return this.showProgress(document.body, 0, 'Saving project...');
    }
}

export default LoadingManager;