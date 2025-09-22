/**
 * TextEditor - Simple text content editing with overlay system
 *
 * Provides clean text editing functionality by storing changes as overlay data
 * instead of directly manipulating DOM. This preserves template integrity.
 */

import OverlayManager from './OverlayManager.js';
import EventBus from '../core/EventBus.js';
import { EVENTS } from '../ui/constants.js';

class TextEditor {
    static currentPageId = null;
    static selectedElement = null;
    static editingPanel = null;

    /**
     * Initialize text editing system
     */
    static init() {
        console.log('📝 TextEditor initialized');
        this.setupEventListeners();
        this.createEditingPanel();
    }

    static setupEventListeners() {
        // Listen for zoom modal opening
        EventBus.on(EVENTS.MODAL_OPENED, (data) => {
            if (data.modalId === 'pageZoomModal') {
                this.currentPageId = data.data?.pageId;
                this.setupElementSelection();
            }
        });

        // Listen for modal closing
        EventBus.on(EVENTS.MODAL_CLOSED, (data) => {
            if (data.modalId === 'pageZoomModal') {
                this.cleanup();
            }
        });

        // Listen for overlay changes to update UI
        EventBus.on(EVENTS.OVERLAY_CHANGED, (data) => {
            if (data.type === 'text' && data.pageId === this.currentPageId) {
                this.updateEditingPanel(data);
            }
        });
    }

    /**
     * Setup element selection in the zoom modal iframe
     */
    static setupElementSelection() {
        const zoomFrame = document.getElementById('zoomFrame');
        if (!zoomFrame) return;

        // Wait for iframe to load
        zoomFrame.onload = () => {
            const iframeDoc = zoomFrame.contentDocument;
            if (!iframeDoc) return;

            console.log('📝 Setting up text element selection');

            // Add click listener to iframe
            iframeDoc.addEventListener('click', (e) => {
                this.handleElementClick(e, iframeDoc);
            });

            // Add hover effects
            iframeDoc.addEventListener('mouseover', (e) => {
                this.handleElementHover(e, true);
            });

            iframeDoc.addEventListener('mouseout', (e) => {
                this.handleElementHover(e, false);
            });
        };
    }

    /**
     * Handle element clicks for text selection
     */
    static handleElementClick(event, iframeDoc) {
        event.preventDefault();
        event.stopPropagation();

        const element = event.target;

        // Check if element is editable text
        if (this.isTextElement(element)) {
            this.selectElement(element, iframeDoc);
        }
    }

    /**
     * Handle element hover for visual feedback
     */
    static handleElementHover(event, isHovering) {
        const element = event.target;

        if (this.isTextElement(element)) {
            if (isHovering) {
                element.style.outline = '2px dashed #0A6B7C';
                element.style.cursor = 'pointer';
                element.title = 'Click to edit text';
            } else {
                element.style.outline = '';
                element.style.cursor = '';
                element.title = '';
            }
        }
    }

    /**
     * Check if element is a text element we can edit
     */
    static isTextElement(element) {
        const textTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'DIV', 'A'];
        return textTags.includes(element.tagName) &&
               element.textContent.trim().length > 0 &&
               !element.querySelector('img'); // Exclude elements containing images
    }

    /**
     * Select an element for editing
     */
    static selectElement(element, iframeDoc) {
        // Clear previous selection
        this.clearSelection(iframeDoc);

        // Highlight selected element
        element.style.outline = '3px solid #E68A2E';
        element.style.backgroundColor = 'rgba(230, 138, 46, 0.1)';
        element.setAttribute('data-text-selected', 'true');

        this.selectedElement = element;

        // Generate selector for the element
        const selector = this.generateSelector(element);

        // Show editing panel
        this.showEditingPanel(element, selector);

        console.log('📝 Selected text element:', selector, element.textContent.trim());
    }

    /**
     * Clear all element selections
     */
    static clearSelection(iframeDoc) {
        const selected = iframeDoc.querySelectorAll('[data-text-selected]');
        selected.forEach(el => {
            el.style.outline = '';
            el.style.backgroundColor = '';
            el.removeAttribute('data-text-selected');
        });
        this.selectedElement = null;
    }

    /**
     * Generate a CSS selector for an element
     */
    static generateSelector(element) {
        // Try ID first
        if (element.id) {
            return `#${element.id}`;
        }

        // Try class names
        if (element.className && typeof element.className === 'string') {
            const classSelector = `.${element.className.split(' ').join('.')}`;
            const doc = element.ownerDocument;
            if (doc.querySelectorAll(classSelector).length === 1) {
                return classSelector;
            }
        }

        // Try data attributes
        for (const attr of element.attributes) {
            if (attr.name.startsWith('data-') && attr.value) {
                const attrSelector = `[${attr.name}="${attr.value}"]`;
                const doc = element.ownerDocument;
                if (doc.querySelectorAll(attrSelector).length === 1) {
                    return attrSelector;
                }
            }
        }

        // Fall back to nth-child
        const tagName = element.tagName.toLowerCase();
        const parent = element.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(child =>
                child.tagName.toLowerCase() === tagName
            );
            if (siblings.length > 1) {
                const index = siblings.indexOf(element) + 1;
                return `${tagName}:nth-child(${index})`;
            }
        }

        return tagName;
    }

    /**
     * Create the text editing panel
     */
    static createEditingPanel() {
        // Remove any existing panel first
        const existingPanel = document.getElementById('textEditingPanel');
        if (existingPanel) {
            existingPanel.remove();
        }

        this.editingPanel = document.createElement('div');
        this.editingPanel.id = 'textEditingPanel';
        this.editingPanel.className = 'text-editing-panel';
        this.editingPanel.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            width: 300px;
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 16px;
            z-index: 10000;
            display: none;
            font-family: 'Source Sans 3', sans-serif;
        `;

        this.editingPanel.innerHTML = `
            <h3 style="margin: 0 0 12px 0; color: #0A6B7C; font-size: 16px;">Edit Text</h3>
            <div id="textPreview" style="font-size: 12px; color: #666; margin-bottom: 8px; padding: 8px; background: #f9f9f9; border-radius: 4px; max-height: 60px; overflow-y: auto;"></div>
            <textarea id="textEditor" style="width: 100%; height: 120px; border: 1px solid #ddd; border-radius: 4px; padding: 8px; font-size: 14px; resize: vertical; font-family: inherit;"></textarea>
            <div style="margin-top: 12px; display: flex; gap: 8px;">
                <button id="applyTextBtn" style="flex: 1; background: #0A6B7C; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">Apply</button>
                <button id="cancelTextBtn" style="flex: 1; background: #ccc; color: #333; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
            </div>
        `;

        document.body.appendChild(this.editingPanel);

        // Hide panel initially
        this.editingPanel.style.display = 'none';

        // Add event listeners with proper cleanup
        const applyBtn = document.getElementById('applyTextBtn');
        const cancelBtn = document.getElementById('cancelTextBtn');

        applyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📝 Apply button clicked');
            this.applyTextEdit();
        });

        cancelBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📝 Cancel button clicked');
            this.hideEditingPanel();
        });

        // Auto-resize textarea
        const textarea = document.getElementById('textEditor');
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.max(120, textarea.scrollHeight) + 'px';
        });
    }

    /**
     * Show the editing panel for selected element
     */
    static showEditingPanel(element, selector) {
        console.log('📝 showEditingPanel called with:', { element, selector });

        const preview = document.getElementById('textPreview');
        const editor = document.getElementById('textEditor');

        const currentText = element.textContent.trim();
        console.log('📝 Current text extracted:', `"${currentText}"`);

        preview.textContent = `Element: ${selector}`;
        editor.value = currentText;

        console.log('📝 Editor value set to:', `"${editor.value}"`);

        this.editingPanel.style.display = 'block';
        editor.focus();
        editor.select();

        console.log('📝 Panel shown and editor focused');
    }

    /**
     * Hide the editing panel
     */
    static hideEditingPanel() {
        this.editingPanel.style.display = 'none';

        // Clear selection in iframe
        const zoomFrame = document.getElementById('zoomFrame');
        if (zoomFrame && zoomFrame.contentDocument) {
            this.clearSelection(zoomFrame.contentDocument);
        }
    }

    /**
     * Apply text edit using overlay system
     */
    static applyTextEdit() {
        console.log('📝 applyTextEdit called');
        console.log('📝 selectedElement:', this.selectedElement);
        console.log('📝 currentPageId:', this.currentPageId);

        if (!this.selectedElement || !this.currentPageId) {
            console.log('📝 Missing selectedElement or currentPageId, returning early');
            return;
        }

        const newText = document.getElementById('textEditor').value;
        const selector = this.generateSelector(this.selectedElement);

        console.log('📝 Applying text edit:', { pageId: this.currentPageId, selector, newText });

        // Save to overlay system
        OverlayManager.setTextOverlay(this.currentPageId, selector, newText);

        // Update the preview immediately
        this.selectedElement.textContent = newText;

        // Hide panel
        this.hideEditingPanel();

        console.log('📝 Applied text edit successfully');
    }

    /**
     * Update editing panel when overlay changes
     */
    static updateEditingPanel(overlayData) {
        // Future: Update panel if currently editing the same element
    }

    /**
     * Cleanup when leaving editing mode
     */
    static cleanup() {
        this.currentPageId = null;
        this.selectedElement = null;
        this.hideEditingPanel();
        console.log('📝 TextEditor cleanup complete');
    }
}

export default TextEditor;