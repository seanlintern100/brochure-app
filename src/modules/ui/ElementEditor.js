import StateManager from '../core/StateManager.js';
import EventBus from '../core/EventBus.js';
import ErrorHandler from '../core/ErrorHandler.js';
import ImageManager from '../data/ImageManager.js';
// import ModalManager from './ModalManager.js'; // Temporarily remove to avoid circular import
import { EVENTS } from './constants.js';

// Expose imports globally for triggerSave function
window.StateManager = StateManager;
window.EventBus = EventBus;

class ElementEditor {
    static isActive = false;
    static currentElement = null;
    static currentElementType = null;
    static currentPageId = null;
    // Removed mode system - now uses simple component detection

    static init() {
        try {
            this.setupEventListeners();
            this.injectIframeCSS();
        } catch (error) {
            console.error('❌ ElementEditor initialization failed:', error);
        }
    }

    static injectIframeCSS() {
        // Wait for direct page content to be available and inject our CSS
        const checkPageContent = () => {
            const pageContainer = document.querySelector('#zoomFrame .direct-page-content');
            if (pageContainer) {
                this.addCSSToPageContainer(pageContainer);
            } else {
                setTimeout(checkPageContent, 500);
            }
        };
        setTimeout(checkPageContent, 1000);
    }

    static addCSSToPageContainer(pageContainer) {
        try {
            if (!pageContainer) return;

            // Check if our CSS is already injected
            if (pageContainer.querySelector('#element-editor-styles')) return;

            const style = document.createElement('style');
            style.id = 'element-editor-styles';
            style.textContent = `
                /* Container clipping for images */
                [data-editable="image"] {
                    overflow: hidden !important;
                }

                /* Image transforms - ALL images use relative positioning */
                [data-editable="image"] img,
                img[data-editable="image"] {
                    transition: transform 0.2s ease !important;
                    transform: translate(var(--img-x, 0), var(--img-y, 0)) scale(var(--img-scale, 1)) !important;
                    transform-origin: center center !important;
                }

                /* Section height adjustments for headers, footers, and sections */
                [data-editable="section"].height-adjustable {
                    transition: height 0.2s ease !important;
                    height: var(--section-height, auto) !important;
                    min-height: 20px !important;
                }

                /* Section reordering */
                [data-editable="section"].reorderable {
                    order: var(--section-order, 0) !important;
                }

                /* Element Highlighting Classes */
                .highlight-content {
                    outline: 3px solid #E68A2E !important;
                    outline-offset: 2px !important;
                    position: relative !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                }

                .highlight-container {
                    outline: 3px solid #0A6B7C !important;
                    outline-offset: 2px !important;
                    position: relative !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                }

                .highlight-header-footer {
                    outline: 3px solid #7C0A6B !important;
                    outline-offset: 2px !important;
                    position: relative !important;
                    cursor: pointer !important;
                    transition: all 0.2s ease !important;
                }

                .highlight-content:hover {
                    outline-width: 4px !important;
                    box-shadow: 0 0 15px rgba(230, 138, 46, 0.4) !important;
                }

                .highlight-container:hover {
                    outline-width: 4px !important;
                    box-shadow: 0 0 15px rgba(10, 107, 124, 0.4) !important;
                }

                .highlight-header-footer:hover {
                    outline-width: 4px !important;
                    box-shadow: 0 0 15px rgba(124, 10, 107, 0.4) !important;
                }

                /* Element type labels - removed for content mode */

                .highlight-container::before {
                    content: "CONTAINER";
                    position: absolute;
                    top: -22px;
                    left: 0;
                    background: #0A6B7C;
                    color: white;
                    padding: 2px 6px;
                    font-size: 9px;
                    font-weight: 600;
                    border-radius: 2px;
                    z-index: 1001;
                    pointer-events: none;
                }

                .highlight-header-footer::before {
                    content: attr(data-element-type);
                    position: absolute;
                    top: -22px;
                    left: 0;
                    background: #7C0A6B;
                    color: white;
                    padding: 2px 6px;
                    font-size: 9px;
                    font-weight: 600;
                    border-radius: 2px;
                    z-index: 1001;
                    pointer-events: none;
                }

                /* Selection feedback */
                [data-editable].selected {
                    outline: 2px solid #E68A2E !important;
                    box-shadow: 0 0 10px rgba(230, 138, 46, 0.3) !important;
                    position: relative !important;
                    z-index: 1000 !important;
                }

                /* Section type indicators */
                [data-editable="section"].selected::after {
                    content: "SECTION";
                    position: absolute;
                    top: -20px;
                    left: 0;
                    background: var(--color-teal, #0A6B7C);
                    color: white;
                    padding: 2px 8px;
                    font-size: 10px;
                    font-weight: 600;
                    border-radius: 2px;
                    z-index: 1001;
                }

                /* Header indicator */
                header[data-editable="section"].selected::after {
                    content: "HEADER";
                    background: #6B7C0A;
                }

                /* Footer indicator */
                footer[data-editable="section"].selected::after {
                    content: "FOOTER";
                    background: #7C0A6B;
                }
            `;

            pageContainer.appendChild(style);
        } catch (error) {
            console.error('❌ Failed to inject CSS into page container:', error);
        }
    }

    static setupEventListeners() {
        // Panel close button
        const closeBtn = document.getElementById('closeElementEditor');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hidePanel());
        }

        // Control button event delegation
        document.addEventListener('click', (event) => {
            const actionElement = event.target.closest('[data-action]');
            const action = actionElement?.dataset.action;

            // Check if this is an element editor action
            const isElementEditorAction = action && this.isActive && actionElement?.closest('#elementEditorPanel');

            if (isElementEditorAction) {
                event.preventDefault();
                event.stopPropagation();
                this.handleControlAction(action, event);
            }
        });

        // Listen for page zoom modal events
        EventBus.on(EVENTS.MODAL_OPENED, (data) => {
            if (data.modalId === 'pageZoomModal') {
                this.onZoomModalOpened();
            }
        });

        EventBus.on(EVENTS.MODAL_CLOSED, (data) => {
            if (data.modalId === 'pageZoomModal') {
                this.onZoomModalClosed();
            }
        });
    }

    static onZoomModalOpened() {
        // Show panel immediately for testing
        setTimeout(() => {
            this.showPanel('test');
            this.initializeComponentHighlighting();
        }, 500);

        // Setup direct DOM click detection after page loads
        setTimeout(() => {
            this.setupPageClickDetection();
        }, 1000);
    }

    static onZoomModalClosed() {
        this.hidePanel();
        this.clearSelection();

        // Clear highlights from direct DOM
        const pageContainer = document.querySelector('#zoomFrame .direct-page-content');
        if (pageContainer) {
            this.clearAllHighlights(pageContainer);
        }
    }

    static setupPageClickDetection() {
        const pageContainer = document.querySelector('#zoomFrame .direct-page-content');
        if (!pageContainer) return;

        console.log('🎯 Setting up direct DOM click detection');

        try {
            // Inject CSS into page container
            this.addCSSToPageContainer(pageContainer);

            // Add click listener to page container
            pageContainer.addEventListener('click', (event) => {
                this.handlePageClick(event, pageContainer);
            });

            // Initial highlighting after page is ready
            setTimeout(() => {
                this.highlightAllComponents();
            }, 500);

        } catch (error) {
            console.warn('Could not setup page click detection:', error);
        }
    }

    static handlePageClick(event, pageContainer) {
        event.preventDefault();
        event.stopPropagation();

        const target = event.target;

        // Simple component detection - no modes, just identify what was clicked
        const { element, elementType } = this.detectComponent(target);

        console.log(`🎯 Component detected: ${elementType}`, element);

        if (element && elementType) {
            this.selectElement(element, elementType, pageContainer);
        } else {
            this.clearSelection();
            console.log('🔍 No editable component found - keeping panel open');
        }
    }

    /**
     * Simple component detection - identifies one of 4 clear component types
     * No modes, no confusion - just clear identification
     */
    static detectComponent(target) {
        let element = null;
        let elementType = null;

        // 1. IMAGE CONTENT - Direct image manipulation
        if (target.tagName === 'IMG') {
            element = target;
            elementType = 'image';
        }

        // 2. TEXT CONTENT - Editable text elements
        else if (target.hasAttribute('contenteditable') ||
                 target.hasAttribute('data-editable') && target.getAttribute('data-editable') === 'text' ||
                 target.tagName.match(/^H[1-6]$/) ||
                 target.tagName === 'P' && target.textContent.trim()) {
            element = target;
            elementType = 'text';
        }

        // 3. HEADER/FOOTER SECTIONS - Page structure elements
        else if (target.closest('header, footer, [role="banner"], [role="contentinfo"]')) {
            element = target.closest('header, footer, [role="banner"], [role="contentinfo"]');
            elementType = 'section';
        }

        // 4. CONTAINERS - Layout and positioning elements
        else if (target.closest('[data-editable="image"], .image-container, .container, section, div[class*="container"], div[class*="wrapper"]')) {
            element = target.closest('[data-editable="image"], .image-container, .container, section, div[class*="container"], div[class*="wrapper"]');
            // Don't select containers that are actually headers/footers
            if (!element.closest('header, footer')) {
                elementType = 'container';
            }
        }

        // 5. FALLBACK - Look for closest editable element
        else {
            const editableElement = target.closest('[data-editable], [contenteditable="true"]');
            if (editableElement) {
                element = editableElement;
                elementType = editableElement.getAttribute('data-editable') || 'text';
            }
        }

        console.log(`🔍 Component detection: ${target.tagName} → ${elementType}`, element);
        return { element, elementType };
    }

    static selectElement(element, elementType, pageContainer) {
        // Clear previous selection
        this.clearSelection();

        // Generate unique element ID if needed
        const elementId = this.ensureElementId(element, elementType);

        // Add selection class
        element.classList.add('selected');
        element.setAttribute('data-editable', elementType);

        // Store current selection
        this.currentElement = element;
        this.currentElementType = elementType;

        // Analyze image context for smart editing
        if (elementType === 'image') {
            this.analyzeImageContext(element, pageContainer);
        }

        console.log(`🎯 Element selected: ${elementType}, ensuring panel stays visible`);

        // Ensure panel is active and visible
        const panel = document.getElementById('elementEditorPanel');
        if (panel) {
            panel.classList.add('active');
            this.isActive = true;
        }

        // Show panel with appropriate controls
        this.showPanel(elementType);
        this.populateControls(elementType, element);
    }

    static analyzeImageContext(element, pageContainer) {
        // Determine if image is in a container or free-standing
        let imageContainer = null;
        let isContained = false;

        if (element.tagName === 'IMG') {
            // Check if img is inside a container with specific characteristics
            const parent = element.parentElement;
            if (parent && (
                parent.classList.contains('image-container') ||
                parent.classList.contains('hero-image') ||
                parent.hasAttribute('data-image-container') ||
                (parent.offsetWidth < pageContainer.offsetWidth * 0.8) // Less than 80% of page width
            )) {
                imageContainer = parent;
                isContained = true;
            }
        } else {
            // Element itself is the container
            imageContainer = element;
            isContained = true;
        }

        // Store context information
        this.currentImageContext = {
            isContained: isContained,
            container: imageContainer,
            containerBounds: imageContainer ? {
                width: imageContainer.offsetWidth,
                height: imageContainer.offsetHeight
            } : null
        };
    }

    static ensureElementId(element, elementType) {
        let elementId = element.dataset.elementId;

        if (!elementId) {
            const pageId = this.getCurrentPageId();
            const typePrefix = elementType === 'image' ? 'img' : 'section';
            const timestamp = Date.now();
            elementId = `${pageId}-${typePrefix}-${timestamp}`;
            element.dataset.elementId = elementId;
        }

        return elementId;
    }

    static getCurrentPageId() {
        // Get current page ID from ModalManager if available - access via window
        if (window.ModalManager && window.ModalManager.currentZoomPage) {
            return window.ModalManager.currentZoomPage.id;
        }
        return 'page-' + Date.now();
    }

    static clearSelection() {
        if (this.currentElement) {
            this.currentElement.classList.remove('selected');
        }
        this.currentElement = null;
        this.currentElementType = null;

        // DON'T hide the panel here - only clear the selection visual feedback
        // The panel should stay open for new selections
    }

    static showPanel(elementType) {
        const panel = document.getElementById('elementEditorPanel');

        if (panel) {
            panel.classList.add('active');
            this.isActive = true;
        }

        // Update title
        const title = document.getElementById('elementEditorTitle');
        if (title) {
            title.textContent = elementType === 'image' ? 'Image Editor' : 'Section Editor';
        }

        // Adjust zoom container to make room for the sidebar
        this.adjustZoomContainer(true);
    }

    static hidePanel() {
        const panel = document.getElementById('elementEditorPanel');

        if (panel) {
            panel.classList.remove('active');
            this.isActive = false;
        }

        this.hideAllControls();

        // Restore zoom container to full width
        this.adjustZoomContainer(false);
    }

    static populateControls(elementType, element) {
        console.log(`🎯 populateControls called with elementType: ${elementType}, element:`, element);
        this.hideAllControls();

        if (elementType === 'image') {
            console.log(`🎯 Showing image controls`);
            this.showImageControls(element);
        } else if (elementType === 'section') {
            console.log(`🎯 Showing section controls`);
            this.showSectionControls(element);
        } else if (elementType === 'container') {
            console.log(`🎯 Showing container controls`);
            this.showContainerControls(element);
        } else {
            console.log(`🎯 Unknown elementType: ${elementType}`);
        }
    }

    static hideAllControls() {
        document.getElementById('noElementSelected').style.display = 'block';
        document.getElementById('imageControls').style.display = 'none';
        document.getElementById('sectionControls').style.display = 'none';
        document.getElementById('containerControls').style.display = 'none';
    }

    static showImageControls(imageElement) {
        document.getElementById('noElementSelected').style.display = 'none';
        document.getElementById('imageControls').style.display = 'block';

        // Update title based on context
        const title = document.getElementById('elementEditorTitle');
        if (title && this.currentImageContext) {
            const contextText = this.currentImageContext.isContained ? 'Contained Image' : 'Free Image';
            title.textContent = `${contextText} Editor`;
        }

        // Populate image library
        this.populateImageLibrary();
    }

    static showContainerControls(containerElement) {
        document.getElementById('noElementSelected').style.display = 'none';
        document.getElementById('containerControls').style.display = 'block';
    }

    static showSectionControls(sectionElement) {
        document.getElementById('noElementSelected').style.display = 'none';
        document.getElementById('sectionControls').style.display = 'block';
    }

    static populateImageLibrary() {
        const imageLibraryGrid = document.getElementById('elementImageLibrary');
        if (!imageLibraryGrid) return;

        const images = ImageManager.getImages();

        if (images.length === 0) {
            imageLibraryGrid.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No images available</p>';
            return;
        }

        imageLibraryGrid.innerHTML = images.map(image => `
            <div class="image-thumb" data-image-url="${image.url}">
                <img src="${image.url}" alt="${image.filename}" />
            </div>
        `).join('');

        // Add click handlers for image selection
        imageLibraryGrid.querySelectorAll('.image-thumb').forEach(thumb => {
            thumb.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const imageUrl = event.currentTarget.dataset.imageUrl;
                this.replaceSelectedImage(imageUrl);
            });
        });
    }

    static replaceSelectedImage(newImageUrl) {
        if (!this.currentElement || this.currentElementType !== 'image') {
            return;
        }

        // Check if the current element IS the img, or contains an img
        let img = null;
        if (this.currentElement.tagName === 'IMG') {
            img = this.currentElement;
        } else {
            img = this.currentElement.querySelector('img');
        }

        if (img) {

            img.src = newImageUrl;
            // CRITICAL: Also set the src attribute so it persists in innerHTML
            img.setAttribute('src', newImageUrl);


            ErrorHandler.showSuccess('Image replaced successfully');
            this.triggerSave();
        }
    }

    static handleControlAction(action, event) {
        const direction = event.target.closest('[data-direction]')?.dataset.direction;

        switch (action) {
            case 'set-selection-mode':
                this.setSelectionMode(event);
                break;
            case 'move-image':
                this.moveImage(direction);
                break;
            case 'resize-image':
                this.resizeImage(direction);
                break;
            case 'reset-image':
                this.resetImage();
                break;
            case 'move-container':
                this.moveContainer(direction);
                break;
            case 'resize-container':
                this.resizeContainer(direction);
                break;
            case 'reset-container':
                this.resetContainer();
                break;
            case 'extend-section':
                this.adjustSectionHeight(20);
                break;
            case 'shrink-section':
                this.adjustSectionHeight(-20);
                break;
            case 'reset-section-height':
                this.resetSectionHeight();
                break;
            case 'move-section-up':
                this.moveSectionUp();
                break;
            case 'move-section-down':
                this.moveSectionDown();
                break;
            case 'close-element-editor':
                this.hidePanel();
                break;
            default:
                console.warn('❌ Unknown action:', action);
        }
    }

    static moveImage(direction) {
        if (!this.currentElement || this.currentElementType !== 'image') {
            return;
        }

        // Check if the current element IS the img, or contains an img
        let img = null;
        if (this.currentElement.tagName === 'IMG') {
            img = this.currentElement;
        } else {
            img = this.currentElement.querySelector('img');
        }

        if (!img) {
            return;
        }

        const moveAmount = 10; // pixels
        const currentX = parseFloat(img.style.getPropertyValue('--img-x')) || 0;
        const currentY = parseFloat(img.style.getPropertyValue('--img-y')) || 0;

        let newX = currentX;
        let newY = currentY;

        switch (direction) {
            case 'up': newY = currentY - moveAmount; break;
            case 'down': newY = currentY + moveAmount; break;
            case 'left': newX = currentX - moveAmount; break;
            case 'right': newX = currentX + moveAmount; break;
            default:
                return;
        }

        img.style.setProperty('--img-x', `${newX}px`);
        img.style.setProperty('--img-y', `${newY}px`);

        this.triggerSave();
    }

    static resizeImage(direction) {
        if (!this.currentElement || this.currentElementType !== 'image') {
            return;
        }

        // Check if the current element IS the img, or contains an img
        let img = null;
        if (this.currentElement.tagName === 'IMG') {
            img = this.currentElement;
        } else {
            img = this.currentElement.querySelector('img');
        }

        if (!img) {
            return;
        }

        const currentScale = parseFloat(img.style.getPropertyValue('--img-scale')) || 1;
        const scaleStep = 0.1;

        let newScale = currentScale;
        if (direction === 'larger') {
            newScale = Math.min(currentScale + scaleStep, 3); // Max 3x
        } else if (direction === 'smaller') {
            newScale = Math.max(currentScale - scaleStep, 0.1); // Min 0.1x
        }

        img.style.setProperty('--img-scale', newScale);
        this.triggerSave();
    }

    static resetImage() {
        if (!this.currentElement || this.currentElementType !== 'image') return;

        // Check if the current element IS the img, or contains an img
        let img = null;
        if (this.currentElement.tagName === 'IMG') {
            img = this.currentElement;
        } else {
            img = this.currentElement.querySelector('img');
        }

        if (!img) return;

        img.style.removeProperty('--img-x');
        img.style.removeProperty('--img-y');
        img.style.removeProperty('--img-scale');

        this.triggerSave();
        ErrorHandler.showSuccess('Image reset to original position');
    }

    static moveContainer(direction) {
        if (!this.currentElement || this.currentElementType !== 'container') {
            return;
        }

        const moveAmount = 10; // pixels
        const currentStyle = window.getComputedStyle(this.currentElement);

        // Get current position
        let currentTop = parseFloat(this.currentElement.style.top) || 0;
        let currentLeft = parseFloat(this.currentElement.style.left) || 0;

        // Apply positioning if not already positioned
        if (currentStyle.position === 'static') {
            this.currentElement.style.position = 'relative';
        }

        switch (direction) {
            case 'up':
                currentTop -= moveAmount;
                this.currentElement.style.top = `${currentTop}px`;
                break;
            case 'down':
                currentTop += moveAmount;
                this.currentElement.style.top = `${currentTop}px`;
                break;
            case 'left':
                currentLeft -= moveAmount;
                this.currentElement.style.left = `${currentLeft}px`;
                break;
            case 'right':
                currentLeft += moveAmount;
                this.currentElement.style.left = `${currentLeft}px`;
                break;
            default:
                return;
        }

        this.triggerSave();
    }

    static resizeContainer(direction) {
        if (!this.currentElement || this.currentElementType !== 'container') {
            return;
        }

        const resizeAmount = 20; // pixels
        const currentWidth = this.currentElement.offsetWidth;
        const currentHeight = this.currentElement.offsetHeight;

        switch (direction) {
            case 'wider':
                this.currentElement.style.width = `${currentWidth + resizeAmount}px`;
                break;
            case 'narrower':
                this.currentElement.style.width = `${Math.max(currentWidth - resizeAmount, 50)}px`;
                break;
            case 'taller':
                this.currentElement.style.height = `${currentHeight + resizeAmount}px`;
                break;
            case 'shorter':
                this.currentElement.style.height = `${Math.max(currentHeight - resizeAmount, 50)}px`;
                break;
            default:
                return;
        }

        this.triggerSave();
        ErrorHandler.showSuccess(`Container resized ${direction}`);
    }

    static resetContainer() {
        if (!this.currentElement || this.currentElementType !== 'container') return;

        // Reset positioning and sizing
        this.currentElement.style.removeProperty('position');
        this.currentElement.style.removeProperty('top');
        this.currentElement.style.removeProperty('left');
        this.currentElement.style.removeProperty('width');
        this.currentElement.style.removeProperty('height');

        this.triggerSave();
        ErrorHandler.showSuccess('Container reset to original state');
    }

    static adjustSectionHeight(deltaPixels) {
        if (!this.currentElement || this.currentElementType !== 'section') return;

        const currentHeight = this.currentElement.offsetHeight;
        const newHeight = Math.max(currentHeight + deltaPixels, 50); // Min 50px

        this.currentElement.style.setProperty('height', `${newHeight}px`, 'important');
        this.currentElement.classList.add('height-adjustable');

        this.triggerSave();
        ErrorHandler.showSuccess(`Section height adjusted to ${newHeight}px`);
    }

    static resetSectionHeight() {
        if (!this.currentElement || this.currentElementType !== 'section') return;

        this.currentElement.style.removeProperty('height');
        this.currentElement.classList.remove('height-adjustable');

        this.triggerSave();
        ErrorHandler.showSuccess('Section height reset');
    }

    static moveSectionUp() {
        this.moveSectionOrder(-1);
    }

    static moveSectionDown() {
        this.moveSectionOrder(1);
    }

    static moveSectionOrder(direction) {
        if (!this.currentElement || this.currentElementType !== 'section') return;

        const currentOrder = parseInt(this.currentElement.style.order) || 0;
        const newOrder = currentOrder + direction;

        this.currentElement.style.order = newOrder;
        this.currentElement.classList.add('reorderable');

        // Ensure parent has flex display
        const parent = this.currentElement.parentElement;
        if (parent && !parent.classList.contains('page-container')) {
            parent.style.display = 'flex';
            parent.style.flexDirection = 'column';
        }

        this.triggerSave();
        ErrorHandler.showSuccess(`Section moved ${direction > 0 ? 'down' : 'up'}`);
    }

    static setSelectionMode(event) {
        const button = event.target.closest('.mode-btn');
        if (!button) return;

        const mode = button.dataset.mode;
        if (!mode) return;

        // Update current mode
        this.currentSelectionMode = mode;

        // Update button states
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        button.classList.add('active');

        // Update hint text
        const hintText = this.getModeHintText(mode);
        const hintElement = document.getElementById('modeHint');
        if (hintElement) {
            hintElement.textContent = hintText;
        }

        // Clear current selection and rehighlight
        this.clearSelection();
        this.highlightModeElements();

        console.log(`🎯 Selection mode changed to: ${mode}`);
    }

    static getModeHintText(mode) {
        switch (mode) {
            case 'content':
                return 'Click highlighted content elements (images, text) to edit them';
            case 'containers':
                return 'Click highlighted containers to resize, move, or modify layout';
            case 'headers-footers':
                return 'Click highlighted headers/footers to adjust height and positioning';
            default:
                return 'Click highlighted elements on the page to edit them';
        }
    }

    static initializeComponentHighlighting() {
        console.log('🎯 Initializing component highlighting');
        // No mode buttons needed - direct component highlighting
        setTimeout(() => {
            this.highlightAllComponents();
        }, 200);
    }

    static highlightAllComponents() {
        const pageContainer = document.querySelector('#zoomFrame .direct-page-content');
        if (!pageContainer) {
            console.warn('⚠️ No page container found for highlighting');
            return;
        }

        try {
            // Clear existing highlights
            this.clearAllHighlights(pageContainer);

            // Highlight all 4 component types with distinct colors
            this.highlightImages(pageContainer);
            this.highlightText(pageContainer);
            this.highlightHeadersFooters(pageContainer);
            this.highlightContainers(pageContainer);

            console.log('🔍 Highlighted all editable components');

        } catch (error) {
            console.error('❌ Error highlighting elements:', error);
        }
    }

    static clearAllHighlights(pageContainer) {
        // Remove all component highlight classes
        const highlightClasses = ['edit-image', 'edit-text', 'edit-section', 'edit-container'];
        highlightClasses.forEach(className => {
            const elements = pageContainer.querySelectorAll(`.${className}`);
            elements.forEach(el => {
                el.classList.remove(className);
                el.removeAttribute('data-component-type');
            });
        });
    }

    static highlightContentElements(iframeDoc) {
        // Find content elements: images, text areas, content sections
        const selectors = [
            'img',
            '[data-editable="text"]',
            'h1, h2, h3, h4, h5, h6',
            'p:not(:empty)',
            '[contenteditable="true"]',
            '.content',
            '.text-content'
        ];

        selectors.forEach(selector => {
            try {
                const elements = iframeDoc.querySelectorAll(selector);
                elements.forEach(element => {
                    // Skip if element is already highlighted or is inside a header/footer
                    if (element.classList.contains('highlight-content') ||
                        element.closest('header') ||
                        element.closest('footer')) {
                        return;
                    }

                    element.classList.add('highlight-content');

                    // For images, ensure the container gets the ID, not the image itself
                    if (element.tagName === 'IMG') {
                        const container = element.closest('[data-editable="image"]') || element.parentElement;
                        if (container && container !== element) {
                            this.ensureElementId(container, 'image');
                        } else {
                            this.ensureElementId(element, 'image');
                        }
                    } else {
                        this.ensureElementId(element, 'content');
                    }
                });
            } catch (error) {
                console.warn(`⚠️ Error highlighting content selector "${selector}":`, error);
            }
        });

        console.log(`✅ Highlighted ${iframeDoc.querySelectorAll('.highlight-content').length} content elements`);
    }

    static highlightContainerElements(iframeDoc) {
        // Find container elements: divs with layout purposes, image containers, sections
        const selectors = [
            '[data-editable="image"]',
            '.image-container',
            '.container',
            '.layout-container',
            'section:not(header):not(footer)',
            'div[class*="container"]',
            'div[class*="wrapper"]',
            'div[class*="box"]'
        ];

        selectors.forEach(selector => {
            try {
                const elements = iframeDoc.querySelectorAll(selector);
                elements.forEach(element => {
                    // Skip if element is already highlighted or is header/footer
                    if (element.classList.contains('highlight-container') ||
                        element.tagName === 'HEADER' ||
                        element.tagName === 'FOOTER') {
                        return;
                    }

                    element.classList.add('highlight-container');
                    this.ensureElementId(element, 'container');
                });
            } catch (error) {
                console.warn(`⚠️ Error highlighting container selector "${selector}":`, error);
            }
        });

        console.log(`✅ Highlighted ${iframeDoc.querySelectorAll('.highlight-container').length} container elements`);
    }

    static highlightHeaderFooterElements(iframeDoc) {
        // Find header and footer elements
        const selectors = [
            'header',
            'footer',
            '[role="banner"]',
            '[role="contentinfo"]',
            '.header',
            '.footer',
            '[class*="header"]',
            '[class*="footer"]'
        ];

        selectors.forEach(selector => {
            try {
                const elements = iframeDoc.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element.classList.contains('highlight-header-footer')) {
                        return;
                    }

                    element.classList.add('highlight-header-footer');

                    // Set element type for label
                    if (element.tagName === 'HEADER' || element.classList.contains('header') || element.hasAttribute('role') && element.getAttribute('role') === 'banner') {
                        element.setAttribute('data-element-type', 'HEADER');
                    } else {
                        element.setAttribute('data-element-type', 'FOOTER');
                    }

                    this.ensureElementId(element, 'header-footer');
                });
            } catch (error) {
                console.warn(`⚠️ Error highlighting header/footer selector "${selector}":`, error);
            }
        });

        console.log(`✅ Highlighted ${iframeDoc.querySelectorAll('.highlight-header-footer').length} header/footer elements`);
    }

    static triggerSave() {
        // Save element transforms without closing the modal
        try {
            // Get the direct DOM page container
            const zoomFrame = document.getElementById('zoomFrame');
            const pageContainer = zoomFrame?.querySelector('.direct-page-content');

            if (!pageContainer || !window.ModalManager.currentZoomPage) {
                return;
            }

            // Get the current project first
            const currentProject = window.StateManager.getState().currentProject;
            if (!currentProject || !currentProject.templateCopies[window.ModalManager.currentZoomPage.templateId]) {
                console.error(`❌ No project or template copy found for save`);
                return;
            }

            // Extract the modified HTML from the direct DOM - preserve original format
            let modifiedHTML;
            const originalHTML = currentProject.templateCopies[window.ModalManager.currentZoomPage.templateId].modifiedHtml;

            // For direct DOM, we always save the container's innerHTML
            modifiedHTML = pageContainer.innerHTML;
            console.log(`💾 Saving direct DOM HTML content`);

            // Debug: Check if image sources are in the HTML
            const imgSrcMatches = modifiedHTML.match(/src="[^"]*"/g);
            console.log(`🖼️ Found ${imgSrcMatches ? imgSrcMatches.length : 0} image src attributes in saved HTML`);

            console.log(`💾 Original HTML length: ${originalHTML.length}, Modified HTML length: ${modifiedHTML.length}`);

            // Capture element transforms from the direct DOM
            const elementTransforms = this.captureElementTransformsLocal(pageContainer, window.ModalManager.currentZoomPage.id);

            console.log(`💾 triggerSave() captured transforms for page ${window.ModalManager.currentZoomPage.id}:`, elementTransforms);

            // Update the project with the modified content
            currentProject.templateCopies[window.ModalManager.currentZoomPage.templateId].modifiedHtml = modifiedHTML;

            // Initialize elementTransforms if it doesn't exist
            if (!currentProject.elementTransforms) {
                currentProject.elementTransforms = {};
            }

            // Store element transforms for this page
            if (Object.keys(elementTransforms).length > 0) {
                currentProject.elementTransforms[window.ModalManager.currentZoomPage.id] = elementTransforms;
                console.log(`✅ Saved element transforms to project for page ${window.ModalManager.currentZoomPage.id}`);
            } else {
                console.log(`⚠️ No element transforms to save for page ${window.ModalManager.currentZoomPage.id}`);
            }

            // Mark project as dirty without closing modal
            window.StateManager.setState({
                currentProject: currentProject,
                isDirty: true
            });

            // Emit events to update UI
            window.EventBus.emit('project-dirty', true);

        } catch (error) {
            console.error('❌ Error in auto-save:', error);
        }
    }

    static captureElementTransformsLocal(pageContainer, pageId) {
        const transforms = {
            images: {},
            sections: {}
        };

        try {
            // Capture image transforms - check both containers and images directly
            const imageContainers = pageContainer.querySelectorAll('[data-editable="image"]');
            imageContainers.forEach(container => {
                const img = container.querySelector('img');
                const elementId = container.dataset.elementId;

                if (img && elementId) {
                    const imgX = img.style.getPropertyValue('--img-x');
                    const imgY = img.style.getPropertyValue('--img-y');
                    const imgScale = img.style.getPropertyValue('--img-scale');
                    const imgSrc = img.src;

                    // Only store if there are actual transforms or src changes
                    if (imgX || imgY || imgScale || imgSrc) {
                        transforms.images[elementId] = {
                            translateX: imgX || '0px',
                            translateY: imgY || '0px',
                            scale: imgScale || '1',
                            src: imgSrc
                        };
                        console.log(`📸 Captured container image transform for ${elementId}:`, transforms.images[elementId]);
                    }
                }
            });

            // Also check images that have been directly assigned element IDs
            const imagesWithIds = pageContainer.querySelectorAll('img[data-element-id]');
            imagesWithIds.forEach(img => {
                const elementId = img.dataset.elementId;
                if (elementId && !transforms.images[elementId]) {
                    const imgX = img.style.getPropertyValue('--img-x');
                    const imgY = img.style.getPropertyValue('--img-y');
                    const imgScale = img.style.getPropertyValue('--img-scale');

                    if (imgX || imgY || imgScale) {
                        transforms.images[elementId] = {
                            translateX: imgX || '0px',
                            translateY: imgY || '0px',
                            scale: imgScale || '1',
                            src: img.src
                        };
                        console.log(`📸 Captured direct image transform for ${elementId}:`, transforms.images[elementId]);
                    }
                }
            });

            // Capture section transforms
            const sections = pageContainer.querySelectorAll('[data-editable="section"]');
            sections.forEach(section => {
                const elementId = section.dataset.elementId;

                if (elementId) {
                    const hasHeight = section.classList.contains('height-adjustable');
                    const hasOrder = section.classList.contains('reorderable');
                    const height = section.style.height;
                    const order = section.style.order;

                    // Only store if there are actual modifications
                    if (hasHeight || hasOrder || height || order) {
                        transforms.sections[elementId] = {
                            height: height || 'auto',
                            order: order || '0',
                            heightAdjustable: hasHeight,
                            reorderable: hasOrder
                        };
                    }
                }
            });

            return transforms;

        } catch (error) {
            return transforms;
        }
    }

    static adjustZoomContainer(isEditorActive) {
        // Adjust the entire modal content, not just the zoom container
        const modalContent = document.querySelector('#pageZoomModal .modal-content');
        if (!modalContent) return;

        if (isEditorActive) {
            // Calculate the appropriate margin based on screen size
            const screenWidth = window.innerWidth;
            let marginRight;

            if (screenWidth <= 1200) {
                marginRight = '320px';
            } else if (screenWidth <= 1400) {
                marginRight = '370px';
            } else {
                marginRight = '420px';
            }

            modalContent.style.marginRight = marginRight;
            modalContent.style.transition = 'margin-right 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

            console.log('🎨 Adjusted modal content margin to make room for sidebar:', marginRight);
        } else {
            modalContent.style.marginRight = '0';
            console.log('🎨 Restored modal content to full width');
        }
    }

    // Simple highlighting methods for the 4 component types
    static highlightImages(pageContainer) {
        const images = pageContainer.querySelectorAll('img');
        images.forEach(img => {
            img.classList.add('highlight-content');
            img.setAttribute('data-component-type', 'image');
        });
    }

    static highlightText(pageContainer) {
        const textElements = pageContainer.querySelectorAll('h1, h2, h3, h4, h5, h6, p, [contenteditable], [data-editable="text"]');
        textElements.forEach(el => {
            if (el.textContent.trim()) {
                el.classList.add('highlight-content');
                el.setAttribute('data-component-type', 'text');
            }
        });
    }

    static highlightHeadersFooters(pageContainer) {
        const headerFooters = pageContainer.querySelectorAll('header, footer, [role="banner"], [role="contentinfo"]');
        headerFooters.forEach(el => {
            el.classList.add('highlight-header-footer');
            el.setAttribute('data-component-type', 'section');
        });
    }

    static highlightContainers(pageContainer) {
        const containers = pageContainer.querySelectorAll('.container, section, div[class*="container"], div[class*="wrapper"], .image-container');
        containers.forEach(el => {
            // Don't highlight if it's already highlighted as header/footer
            if (!el.closest('header, footer')) {
                el.classList.add('highlight-container');
                el.setAttribute('data-component-type', 'container');
            }
        });
    }
}

export default ElementEditor;