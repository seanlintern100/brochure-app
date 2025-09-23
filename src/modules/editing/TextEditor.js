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
    static currentMode = 'text'; // Track current editing mode

    /**
     * Initialize text editing system
     */
    static init() {
        console.log('📝 TextEditor initialized');
        this.currentMode = 'text'; // text | images | containers
        this.currentPageId = null;
        this.selectedElement = null;
        this.setupEventListeners();
        this.createEditingPanel();
    }

    /**
     * Set the current editing mode
     */
    static setMode(mode) {
        console.log('📝 TextEditor mode changing from', this.currentMode, 'to', mode);

        // Only clear selection if actually changing to a different mode
        if (this.currentMode !== mode) {
            this.currentMode = mode;

            // Clear selection only if the element type doesn't match the new mode
            if (this.selectedElement) {
                const isTextElement = this.isTextElement(this.selectedElement);
                const isImageElement = this.selectedElement.tagName === 'IMG';

                // Clear if mode doesn't match element type
                if ((mode === 'text' && !isTextElement) ||
                    (mode === 'images' && !isImageElement) ||
                    (mode === 'containers')) {
                    this.hideEditingPanel();
                    this.selectedElement = null;
                }
            }
        }
    }

    static setupEventListeners() {
        // Listen for zoom modal opening
        EventBus.on(EVENTS.MODAL_OPENED, (data) => {
            if (data.modalId === 'pageZoomModal') {
                this.currentPageId = data.data?.pageId;
                this.setupElementSelection();
                this.setupModeToggle();

                // Show the sidebar panel
                const sidebarPanel = document.getElementById('elementEditorPanel');
                const modal = document.getElementById('pageZoomModal');
                if (sidebarPanel) {
                    sidebarPanel.classList.add('active');
                    // Add class to modal to adjust layout
                    if (modal) modal.classList.add('sidebar-active');
                }
            }
        });

        // Listen for modal closing
        EventBus.on(EVENTS.MODAL_CLOSED, (data) => {
            if (data.modalId === 'pageZoomModal') {
                this.cleanup();

                // Hide the sidebar panel
                const sidebarPanel = document.getElementById('elementEditorPanel');
                if (sidebarPanel) {
                    sidebarPanel.classList.remove('active');
                }
            }
        });

        // Listen for overlay changes to update UI
        EventBus.on(EVENTS.OVERLAY_CHANGED, (data) => {
            if (data.type === 'text' && data.pageId === this.currentPageId) {
                this.updateEditingPanel(data);
            }
        });

        // Listen for image editing actions
        EventBus.on(EVENTS.ACTION, (data) => {
            if (this.currentMode === 'images' && this.selectedElement) {
                switch (data.action) {
                    case 'move-image':
                        this.moveImage(data.direction);
                        break;
                    case 'resize-image':
                        this.resizeImage(data.direction);
                        break;
                    case 'reset-image':
                        this.resetImage();
                        break;
                }
            }
        });
    }

    /**
     * Setup mode toggle buttons
     */
    static setupModeToggle() {
        const modeButtons = document.querySelectorAll('[data-mode][data-action="set-selection-mode"]');

        modeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const mode = button.dataset.mode;
                this.setMode(mode);
            });
        });

        // Enable the Images button
        const imagesButton = document.querySelector('[data-mode="images"]');
        if (imagesButton) {
            imagesButton.removeAttribute('disabled');
        }
    }

    /**
     * Switch between Text and Image editing modes
     */
    static setMode(mode) {
        console.log(`📝 Switching to ${mode} mode`);
        this.currentMode = mode;

        // Update button states
        const modeButtons = document.querySelectorAll('[data-mode]');
        modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Update hint text
        const modeHint = document.getElementById('modeHint');
        if (modeHint) {
            modeHint.textContent = mode === 'text'
                ? 'Click any text on the page to edit it'
                : 'Click any image on the page to edit it';
        }

        // Show/hide appropriate controls
        const textControls = document.getElementById('textEditingControls');
        const imageControls = document.getElementById('imageControls');
        const noSelection = document.getElementById('noElementSelected');

        // Reset all controls
        if (textControls) textControls.style.display = 'none';
        if (imageControls) imageControls.style.display = 'none';
        if (noSelection) noSelection.style.display = 'block';

        // Update no selection message
        const noSelectionText = noSelection?.querySelector('p');
        const noSelectionHint = noSelection?.querySelector('span');
        if (noSelectionText) {
            noSelectionText.textContent = mode === 'text' ? 'Click text to edit' : 'Click image to edit';
        }
        if (noSelectionHint) {
            noSelectionHint.textContent = mode === 'text'
                ? 'Select any text element on the page'
                : 'Select any image on the page';
        }

        // Clear any existing selections
        const zoomFrame = document.getElementById('zoomFrame');
        if (zoomFrame && zoomFrame.contentDocument) {
            this.clearSelection(zoomFrame.contentDocument);
        }

        // Re-setup element selection for the new mode
        this.setupElementSelection();
    }

    /**
     * Setup element selection in the zoom modal iframe
     */
    static setupElementSelection() {
        const zoomFrame = document.getElementById('zoomFrame');
        if (!zoomFrame) return;

        // Function to attach listeners
        const attachListeners = () => {
            const iframeDoc = zoomFrame.contentDocument;
            if (!iframeDoc) {
                // Try again after a short delay if document not ready
                setTimeout(attachListeners, 100);
                return;
            }

            // Check if listeners already attached to avoid duplicates
            if (iframeDoc._textEditorListenersAttached) {
                console.log('📝 TextEditor: Listeners already attached');
                return;
            }

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

            // Mark that listeners are attached
            iframeDoc._textEditorListenersAttached = true;
        };

        // For srcdoc, we don't get onload reliably, so just try immediately
        attachListeners();
    }

    /**
     * Handle element clicks for text or image selection
     */
    static handleElementClick(event, iframeDoc) {
        event.preventDefault();
        event.stopPropagation();

        const element = event.target;

        // Check based on current mode
        if (this.currentMode === 'text' && this.isTextElement(element)) {
            this.selectTextElement(element, iframeDoc);
        } else if (this.currentMode === 'images' && element.tagName === 'IMG') {
            this.selectImageElement(element, iframeDoc);
        }
    }

    /**
     * Handle element hover for visual feedback
     */
    static handleElementHover(event, isHovering) {
        const element = event.target;
        const isValidElement = (this.currentMode === 'text' && this.isTextElement(element)) ||
                               (this.currentMode === 'images' && element.tagName === 'IMG');

        if (isValidElement) {
            if (isHovering) {
                element.style.outline = '2px dashed #0A6B7C';
                element.style.cursor = 'pointer';
                element.title = this.currentMode === 'text' ? 'Click to edit text' : 'Click to edit image';
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
     * Select a text element for editing
     */
    static selectTextElement(element, iframeDoc) {
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
     * Select an image element for editing
     */
    static selectImageElement(element, iframeDoc) {
        // Clear previous selection
        this.clearSelection(iframeDoc);

        // IMPORTANT: Generate selector BEFORE any DOM modifications
        const selector = this.generateSelector(element);
        console.log('🎯 Generated selector for image:', selector);

        // Store the page ID from iframe for later use
        const iframe = document.getElementById('zoomFrame');
        if (iframe && iframe.contentDocument === iframeDoc) {
            const page = iframeDoc.body.querySelector('[data-page-id]');
            if (page) {
                this.currentPageId = page.dataset.pageId;
                console.log('🖼️ Stored pageId for image editing:', this.currentPageId);
            }
        }

        // Check for container
        const container = element.closest('footer, header, section, div');
        if (container) {

            // Store original states for restoration
            if (!container.dataset.originalState) {
                container.dataset.originalState = JSON.stringify({
                    overflow: getComputedStyle(container).overflow,
                    position: getComputedStyle(container).position,
                    height: container.offsetHeight + 'px'
                });
            }

            if (!element.dataset.originalStyles) {
                element.dataset.originalStyles = JSON.stringify({
                    width: element.style.width || getComputedStyle(element).width,
                    height: element.style.height || getComputedStyle(element).height,
                    maxWidth: element.style.maxWidth || getComputedStyle(element).maxWidth,
                    maxHeight: element.style.maxHeight || getComputedStyle(element).maxHeight,
                    objectFit: element.style.objectFit || getComputedStyle(element).objectFit,
                    position: element.style.position || getComputedStyle(element).position
                });
            }

            // Setup container as fixed viewport
            container.style.overflow = 'hidden';
            container.style.position = 'relative';
            container.style.height = JSON.parse(container.dataset.originalState).height;

            // Setup image for free movement at natural size
            element.style.position = 'absolute';
            element.style.left = '50%';
            element.style.top = '50%';
            element.style.width = 'auto';
            element.style.height = 'auto';
            element.style.maxWidth = 'none';
            element.style.maxHeight = 'none';
            element.style.objectFit = 'none';

            // Center the image initially
            const currentTransform = element.style.transform || '';
            if (!currentTransform.includes('translate')) {
                element.style.transform = 'translate(-50%, -50%)';
            }

            // Save all necessary styles to overlay so image displays correctly
            if (this.currentPageId && selector) {
                OverlayManager.setContainerOverlay(this.currentPageId, selector, {
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: 'auto',
                    height: 'auto',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    objectFit: 'none',
                    transform: element.style.transform
                });
            }
        } else {
            console.log('  No container found');
        }

        // Store container reference
        this.imageContainer = container;

        // Highlight selected image
        element.style.outline = '3px solid #E68A2E';
        element.style.boxShadow = '0 0 10px rgba(230, 138, 46, 0.5)';
        element.setAttribute('data-image-selected', 'true');

        this.selectedElement = element;

        // Store the selector generated BEFORE modifications
        this.selectedElementSelector = selector;

        // Show image editing panel
        this.showImageEditingPanel(element, selector);

        // Load image library
        this.loadImageLibrary();

        console.log('📝 Selected image element');
    }

    /**
     * Clear all element selections
     */
    static clearSelection(iframeDoc) {
        // Clear text selections
        const textSelected = iframeDoc.querySelectorAll('[data-text-selected]');
        textSelected.forEach(el => {
            el.style.outline = '';
            el.style.backgroundColor = '';
            el.removeAttribute('data-text-selected');
        });

        // Clear image selections and restore original styles
        const imageSelected = iframeDoc.querySelectorAll('[data-image-selected]');
        imageSelected.forEach(el => {
            el.style.outline = '';
            el.style.boxShadow = '';
            el.removeAttribute('data-image-selected');

            // Restore original image styles if stored
            if (el.dataset.originalStyles) {
                const styles = JSON.parse(el.dataset.originalStyles);
                Object.assign(el.style, styles);
                delete el.dataset.originalStyles;
            }
        });

        // Restore container state if modified
        const containers = iframeDoc.querySelectorAll('[data-original-state]');
        containers.forEach(container => {
            const state = JSON.parse(container.dataset.originalState);
            container.style.overflow = state.overflow;
            container.style.position = state.position;
            // Keep height to prevent layout jumps
            delete container.dataset.originalState;
        });

        this.selectedElement = null;
        this.imageContainer = null;
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
     * Setup text editing panel event listeners (panel now in sidebar)
     */
    static createEditingPanel() {
        // The panel is now in the sidebar HTML, just add event listeners
        const applyBtn = document.getElementById('applyTextBtn');
        const cancelBtn = document.getElementById('cancelTextBtn');

        if (!applyBtn || !cancelBtn) {
            console.warn('📝 Text editing buttons not found in sidebar');
            return;
        }

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
        if (textarea) {
            textarea.addEventListener('input', () => {
                textarea.style.height = 'auto';
                textarea.style.height = Math.max(120, textarea.scrollHeight) + 'px';
            });
        }
    }

    /**
     * Show the editing panel for selected element
     */
    static showEditingPanel(element, selector) {
        console.log('📝 showEditingPanel called with:', { element, selector });

        // Show the sidebar panel if not already visible
        const sidebarPanel = document.getElementById('elementEditorPanel');
        if (sidebarPanel && !sidebarPanel.classList.contains('active')) {
            sidebarPanel.classList.add('active');
        }

        // Hide "no selection" state, show text editing controls
        const noSelection = document.getElementById('noElementSelected');
        const textControls = document.getElementById('textEditingControls');

        if (noSelection) noSelection.style.display = 'none';
        if (textControls) textControls.style.display = 'block';

        const preview = document.getElementById('textPreview');
        const editor = document.getElementById('textEditor');

        const currentText = element.textContent.trim();
        console.log('📝 Current text extracted:', `"${currentText}"`);

        if (preview) preview.textContent = `Element: ${selector}`;
        if (editor) {
            editor.value = currentText;
            editor.focus();
            editor.select();
        }

        console.log('📝 Sidebar panel shown and editor focused');
    }

    /**
     * Hide the editing panel
     */
    static hideEditingPanel() {
        // Show "no selection" state, hide text editing controls
        const noSelection = document.getElementById('noElementSelected');
        const textControls = document.getElementById('textEditingControls');

        if (noSelection) noSelection.style.display = 'block';
        if (textControls) textControls.style.display = 'none';

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
     * Show the image editing panel
     */
    static showImageEditingPanel(element, selector) {
        console.log('📝 showImageEditingPanel called with:', { element, selector });

        // Show the sidebar panel if not already visible
        const sidebarPanel = document.getElementById('elementEditorPanel');
        if (sidebarPanel && !sidebarPanel.classList.contains('active')) {
            sidebarPanel.classList.add('active');
        }

        // Hide text controls and no selection, show image controls
        const noSelection = document.getElementById('noElementSelected');
        const textControls = document.getElementById('textEditingControls');
        const imageControls = document.getElementById('imageControls');

        if (noSelection) noSelection.style.display = 'none';
        if (textControls) textControls.style.display = 'none';
        if (imageControls) imageControls.style.display = 'block';

        console.log('📝 Image editing panel shown');
    }

    /**
     * Load image library into the sidebar
     */
    static async loadImageLibrary() {
        const libraryContainer = document.getElementById('elementImageLibrary');
        if (!libraryContainer) return;

        try {
            // Get image library from state
            const StateManager = await import('../core/StateManager.js');
            const state = StateManager.default.getState();
            const images = state.imageLibrary || [];

            // Clear existing content
            libraryContainer.innerHTML = '';

            // Add thumbnails
            images.forEach(image => {
                const thumb = document.createElement('div');
                thumb.className = 'image-thumb';
                thumb.dataset.imagePath = image.url;
                thumb.innerHTML = `<img src="${image.url}" alt="${image.filename || image.description || 'Image'}">`;

                // Add click handler to swap image
                thumb.addEventListener('click', () => this.replaceImage(image.url));

                libraryContainer.appendChild(thumb);
            });

            console.log(`📝 Loaded ${images.length} images into library`);
        } catch (error) {
            console.error('📝 Failed to load image library:', error);
        }
    }

    /**
     * Replace selected image with new one from library
     */
    static replaceImage(newImagePath) {
        if (!this.selectedElement || this.selectedElement.tagName !== 'IMG') return;

        console.log('📝 Replacing image with:', newImagePath);
        console.log('📝 Using selector:', this.selectedElementSelector);
        console.log('📝 For pageId:', this.currentPageId);

        // Update the image source
        this.selectedElement.src = newImagePath;

        // Save to overlay system using the PRE-GENERATED selector
        const selector = this.selectedElementSelector || this.generateSelector(this.selectedElement);
        OverlayManager.setImageOverlay(this.currentPageId, selector, newImagePath);

        console.log('📝 Image overlay saved');
    }

    /**
     * Move image within container
     */
    static moveImage(direction) {
        if (!this.selectedElement || this.selectedElement.tagName !== 'IMG') return;

        const moveAmount = 10; // pixels

        // Parse current transform - handle centering transform plus movement
        const currentTransform = this.selectedElement.style.transform || 'translate(-50%, -50%)';

        // Extract movement offsets (separate from centering)
        let moveX = 0, moveY = 0;
        const moveXMatch = currentTransform.match(/translateX\(([^)]+)\)/);
        const moveYMatch = currentTransform.match(/translateY\(([^)]+)\)/);
        if (moveXMatch) moveX = parseFloat(moveXMatch[1]) || 0;
        if (moveYMatch) moveY = parseFloat(moveYMatch[1]) || 0;

        // Extract scale
        const scaleMatch = currentTransform.match(/scale\(([^)]+)\)/);
        const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

        // Calculate new position
        switch (direction) {
            case 'up':
                moveY -= moveAmount;
                break;
            case 'down':
                moveY += moveAmount;
                break;
            case 'left':
                moveX -= moveAmount;
                break;
            case 'right':
                moveX += moveAmount;
                break;
        }

        // Apply combined transform: centering + movement + scale
        this.selectedElement.style.transform =
            `translate(-50%, -50%) ` +  // Keep centered
            `translateX(${moveX}px) ` +  // Apply X movement
            `translateY(${moveY}px) ` +  // Apply Y movement
            `scale(${scale})`;           // Apply scale

        // Save to overlay (including all styles needed for correct display)
        const selector = this.generateSelector(this.selectedElement);
        OverlayManager.setContainerOverlay(this.currentPageId, selector, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 'auto',
            height: 'auto',
            maxWidth: 'none',
            maxHeight: 'none',
            objectFit: 'none',
            transform: this.selectedElement.style.transform
        });
    }

    /**
     * Resize image
     */
    static resizeImage(direction) {
        if (!this.selectedElement || this.selectedElement.tagName !== 'IMG') return;

        const scaleStep = 0.02; // Smaller increments for smoother zooming

        // Get current transform values
        const currentTransform = this.selectedElement.style.transform || '';
        const scaleMatch = currentTransform.match(/scale\(([^)]+)\)/);
        let currentScale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

        // Calculate new scale
        let newScale = currentScale;
        if (direction === 'larger') {
            newScale = Math.min(currentScale + scaleStep, 5); // Max 5x zoom
        } else if (direction === 'smaller') {
            newScale = Math.max(currentScale - scaleStep, 0.05); // Min 0.05x zoom - allows much smaller sizes
        }

        // Get movement values from the current transform
        const translateXMatch = currentTransform.match(/translateX\(([^)]+)\)/);
        const translateYMatch = currentTransform.match(/translateY\(([^)]+)\)/);
        const moveX = translateXMatch ? translateXMatch[1] : '0px';
        const moveY = translateYMatch ? translateYMatch[1] : '0px';

        // Apply transform for editing (with centering)
        this.selectedElement.style.transform =
            `translate(-50%, -50%) ` +
            `translateX(${moveX}) ` +
            `translateY(${moveY}) ` +
            `scale(${newScale})`;

        // Save to overlay (including all styles needed for correct display)
        const selector = this.generateSelector(this.selectedElement);
        OverlayManager.setContainerOverlay(this.currentPageId, selector, {
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 'auto',
            height: 'auto',
            maxWidth: 'none',
            maxHeight: 'none',
            objectFit: 'none',
            transform: this.selectedElement.style.transform
        });
    }

    /**
     * Reset image transform
     */
    static resetImage() {
        if (!this.selectedElement || this.selectedElement.tagName !== 'IMG') return;

        // Clear all transforms and styles
        this.selectedElement.style.transform = '';
        this.selectedElement.style.width = '';
        this.selectedElement.style.height = '';
        this.selectedElement.style.maxWidth = '';
        this.selectedElement.style.objectFit = '';
        this.selectedElement.style.objectPosition = '';

        // Remove from overlay
        const selector = this.generateSelector(this.selectedElement);
        OverlayManager.removeOverlay(this.currentPageId, 'containers', selector);

        console.log('📝 Reset image transform');
    }

    /**
     * Cleanup when leaving editing mode
     */
    static cleanup() {
        this.currentPageId = null;
        this.selectedElement = null;
        this.currentMode = 'text'; // Reset to text mode
        this.hideEditingPanel();
        console.log('📝 TextEditor cleanup complete');
    }
}

export default TextEditor;