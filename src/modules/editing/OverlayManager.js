/**
 * OverlayManager - Clean data storage for template modifications
 *
 * Replaces the broken DOM manipulation approach with structured data overlays.
 * Overlays are JSON data that describe changes to apply to templates at render time.
 * This preserves template integrity while enabling editing functionality.
 */

import EventBus from '../core/EventBus.js';
import { EVENTS } from '../ui/constants.js';

class OverlayManager {
    static overlays = new Map(); // pageId -> overlay data
    static currentPageId = null;

    /**
     * Initialize overlay system
     */
    static init() {
        console.log('🎨 OverlayManager initialized');
        this.setupEventListeners();
    }

    static setupEventListeners() {
        EventBus.on(EVENTS.MODAL_OPENED, (data) => {
            if (data.modalId === 'pageZoomModal') {
                this.setCurrentPage(data.data?.pageId);
            }
        });

        EventBus.on(EVENTS.MODAL_CLOSED, (data) => {
            if (data.modalId === 'pageZoomModal') {
                this.clearCurrentPage();
            }
        });
    }

    /**
     * Set the currently active page for editing
     */
    static setCurrentPage(pageId) {
        this.currentPageId = pageId;
        if (!this.overlays.has(pageId)) {
            this.overlays.set(pageId, this.createEmptyOverlay());
        }
    }

    static clearCurrentPage() {
        this.currentPageId = null;
        console.log('🎨 Cleared current page');
    }

    /**
     * Create empty overlay structure
     */
    static createEmptyOverlay() {
        return {
            text: {},        // selector -> content
            images: {},      // selector -> src
            containers: {}, // selector -> {width, height, etc}
            sections: {}    // selector -> {height, etc}
        };
    }

    /**
     * Get overlay data for a specific page
     */
    static getOverlay(pageId) {
        if (!this.overlays.has(pageId)) {
            this.overlays.set(pageId, this.createEmptyOverlay());
        }
        return this.overlays.get(pageId);
    }

    /**
     * Get current page overlay (for active editing)
     */
    static getCurrentOverlay() {
        if (!this.currentPageId) {
            console.warn('⚠️ No current page set for overlay editing');
            return this.createEmptyOverlay();
        }
        return this.getOverlay(this.currentPageId);
    }

    /**
     * TEXT EDITING - Update text content for an element
     */
    static setTextOverlay(pageId, selector, content) {
        const overlay = this.getOverlay(pageId);
        overlay.text[selector] = content;
        console.log('📝 Text overlay set:', { pageId, selector, content });
        this.notifyChange(pageId, 'text', selector, content);
    }

    /**
     * IMAGE EDITING - Replace image source
     */
    static setImageOverlay(pageId, selector, src) {
        const overlay = this.getOverlay(pageId);
        overlay.images[selector] = src;
        this.notifyChange(pageId, 'images', selector, src);
    }

    /**
     * CONTAINER EDITING - Resize/reposition containers
     */
    static setContainerOverlay(pageId, selector, properties) {
        const overlay = this.getOverlay(pageId);
        overlay.containers[selector] = { ...overlay.containers[selector], ...properties };
        this.notifyChange(pageId, 'containers', selector, properties);
    }

    /**
     * SECTION EDITING - Adjust header/footer heights
     */
    static setSectionOverlay(pageId, selector, properties) {
        const overlay = this.getOverlay(pageId);
        overlay.sections[selector] = { ...overlay.sections[selector], ...properties };
        this.notifyChange(pageId, 'sections', selector, properties);
    }

    /**
     * Remove specific overlay
     */
    static removeOverlay(pageId, type, selector) {
        const overlay = this.getOverlay(pageId);
        if (overlay[type] && overlay[type][selector]) {
            delete overlay[type][selector];
            console.log('🗑️ Overlay removed:', { pageId, type, selector });
            this.notifyChange(pageId, type, selector, null);
        }
    }

    /**
     * Clear all overlays for a page
     */
    static clearPageOverlays(pageId) {
        this.overlays.set(pageId, this.createEmptyOverlay());
        console.log('🧹 All overlays cleared for page:', pageId);
        EventBus.emit(EVENTS.OVERLAY_CLEARED, { pageId });
    }

    /**
     * Get all overlay data (for project saving)
     */
    static getAllOverlays() {
        const result = {};
        this.overlays.forEach((overlay, pageId) => {
            result[pageId] = overlay;
        });
        return result;
    }

    /**
     * Load overlay data (from project loading)
     */
    static loadOverlays(overlayData) {
        this.overlays.clear();
        if (overlayData) {
            Object.entries(overlayData).forEach(([pageId, overlay]) => {
                this.overlays.set(pageId, overlay);
            });
        }
        console.log('📂 Loaded overlays for', this.overlays.size, 'pages');
    }

    /**
     * Check if page has any overlays
     */
    static hasOverlays(pageId) {
        const overlay = this.getOverlay(pageId);
        return Object.keys(overlay.text).length > 0 ||
               Object.keys(overlay.images).length > 0 ||
               Object.keys(overlay.containers).length > 0 ||
               Object.keys(overlay.sections).length > 0;
    }

    /**
     * Notify other components of overlay changes
     */
    static notifyChange(pageId, type, selector, value) {
        EventBus.emit(EVENTS.OVERLAY_CHANGED, {
            pageId,
            type,
            selector,
            value,
            overlay: this.getOverlay(pageId)
        });
    }

    /**
     * Debug: Log current overlay state
     */
    static debugOverlays() {
        console.log('🎨 Current overlay state:', {
            currentPageId: this.currentPageId,
            overlays: Object.fromEntries(this.overlays)
        });
    }
}

export default OverlayManager;