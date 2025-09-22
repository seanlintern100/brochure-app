/**
 * ContainerEditor - Handle container resize and repositioning with overlay system
 *
 * Provides clean container manipulation functionality without DOM corruption.
 * Stores changes as overlay data for reliable persistence.
 */

import OverlayManager from './OverlayManager.js';
import EventBus from '../core/EventBus.js';
import { EVENTS } from '../ui/constants.js';

class ContainerEditor {
    /**
     * Initialize container editing system
     */
    static init() {
        console.log('📦 ContainerEditor initialized');
        this.setupEventListeners();
        this.currentSelection = null;
    }

    static setupEventListeners() {
        // Listen for zoom modal opening to enable container selection
        EventBus.on(EVENTS.MODAL_OPENED, (data) => {
            if (data.modalId === 'pageZoomModal') {
                this.setupContainerSelection(data.data?.pageId);
            }
        });

        EventBus.on(EVENTS.MODAL_CLOSED, (data) => {
            if (data.modalId === 'pageZoomModal') {
                this.clearContainerSelection();
            }
        });

        // Listen for container action buttons
        EventBus.on(EVENTS.ACTION, (data) => {
            if (data.action.startsWith('move-container') || data.action.startsWith('resize-container')) {
                this.handleContainerAction(data);
            }
        });
    }

    /**
     * Setup container selection in the zoom modal iframe
     */
    static setupContainerSelection(pageId) {
        if (!pageId) return;

        const zoomFrame = document.getElementById('zoomFrame');
        if (!zoomFrame) return;

        // Wait for iframe to load
        zoomFrame.onload = () => {
            const iframeDoc = zoomFrame.contentDocument;
            if (!iframeDoc) return;

            // Select potential containers (divs, sections, articles)
            const containers = iframeDoc.querySelectorAll('div, section, article, aside, main');

            containers.forEach((container, index) => {
                // Skip very small containers or those without significant content
                const rect = container.getBoundingClientRect();
                if (rect.width < 50 || rect.height < 50) return;

                // Skip header/footer (they have their own editor)
                if (container.tagName === 'HEADER' || container.tagName === 'FOOTER') return;

                container.style.cursor = 'pointer';
                container.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectContainer(container, pageId);
                });

                // Add hover effect
                container.addEventListener('mouseenter', () => {
                    if (!container.classList.contains('selected-container')) {
                        container.style.outline = '2px dashed var(--color-orange)';
                        container.style.outlineOffset = '2px';
                    }
                });

                container.addEventListener('mouseleave', () => {
                    if (!container.classList.contains('selected-container')) {
                        container.style.outline = '';
                        container.style.outlineOffset = '';
                    }
                });
            });

            console.log(`📦 Container selection enabled for ${containers.length} containers`);
        };
    }

    /**
     * Select a container for editing
     */
    static selectContainer(containerElement, pageId) {
        // Clear previous selections
        this.clearContainerSelection();

        // Mark as selected
        containerElement.classList.add('selected-container');
        containerElement.style.outline = '3px solid var(--color-teal)';
        containerElement.style.outlineOffset = '2px';

        // Generate selector for this container
        const selector = this.generateContainerSelector(containerElement);

        // Show container editing UI
        this.showContainerEditingUI(pageId, selector, containerElement);

        console.log('📦 Container selected:', selector);
    }

    /**
     * Generate CSS selector for a container element
     */
    static generateContainerSelector(containerElement) {
        // Try to find a unique identifier
        if (containerElement.id) {
            return `#${containerElement.id}`;
        }

        // Try class names
        if (containerElement.className) {
            const classes = containerElement.className.split(' ')
                .filter(c => c.trim() && !c.includes('selected'));
            if (classes.length > 0) {
                return `.${classes.join('.')}`;
            }
        }

        // Try data attributes
        for (const attr of containerElement.attributes) {
            if (attr.name.startsWith('data-') && attr.value) {
                return `[${attr.name}="${attr.value}"]`;
            }
        }

        // Try tag name with nth-child
        const tagName = containerElement.tagName.toLowerCase();
        const siblings = Array.from(containerElement.parentElement?.children || [])
            .filter(child => child.tagName.toLowerCase() === tagName);

        if (siblings.length > 1) {
            const index = siblings.indexOf(containerElement) + 1;
            return `${tagName}:nth-child(${index})`;
        }

        return tagName;
    }

    /**
     * Show container editing UI in the editor panel
     */
    static showContainerEditingUI(pageId, selector, containerElement) {
        // Show the container controls in the editor panel
        const containerControls = document.getElementById('containerControls');
        const noElementSelected = document.getElementById('noElementSelected');

        if (containerControls && noElementSelected) {
            noElementSelected.style.display = 'none';
            containerControls.style.display = 'block';
        }

        // Store current selection
        this.currentSelection = {
            pageId,
            selector,
            element: containerElement,
            originalStyles: {
                width: containerElement.style.width || 'auto',
                height: containerElement.style.height || 'auto',
                transform: containerElement.style.transform || 'none'
            }
        };
    }

    /**
     * Handle container action buttons (move, resize, reset)
     */
    static handleContainerAction(data) {
        if (!this.currentSelection) return;

        const { pageId, selector, element } = this.currentSelection;
        const { action, direction } = data;

        switch (action) {
            case 'move-container':
                this.moveContainer(pageId, selector, element, direction);
                break;
            case 'resize-container':
                this.resizeContainer(pageId, selector, element, direction);
                break;
            case 'reset-container':
                this.resetContainer(pageId, selector);
                break;
        }
    }

    /**
     * Move container in specified direction
     */
    static moveContainer(pageId, selector, element, direction) {
        const moveAmount = 10; // pixels

        // Get current transform
        const currentTransform = element.style.transform || 'translate(0px, 0px)';
        const transformMatch = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);

        let currentX = 0, currentY = 0;
        if (transformMatch) {
            currentX = parseFloat(transformMatch[1]) || 0;
            currentY = parseFloat(transformMatch[2]) || 0;
        }

        // Calculate new position
        let newX = currentX, newY = currentY;
        switch (direction) {
            case 'up':
                newY = currentY - moveAmount;
                break;
            case 'down':
                newY = currentY + moveAmount;
                break;
            case 'left':
                newX = currentX - moveAmount;
                break;
            case 'right':
                newX = currentX + moveAmount;
                break;
        }

        // Apply transform
        const newTransform = `translate(${newX}px, ${newY}px)`;
        element.style.transform = newTransform;

        // Store in overlay
        OverlayManager.setContainerOverlay(pageId, selector, { transform: newTransform });

        console.log(`📦 Moved container ${direction}:`, { selector, transform: newTransform });
    }

    /**
     * Resize container in specified direction
     */
    static resizeContainer(pageId, selector, element, direction) {
        const resizeAmount = 20; // pixels

        // Get current dimensions
        const currentWidth = parseFloat(element.style.width) || element.offsetWidth;
        const currentHeight = parseFloat(element.style.height) || element.offsetHeight;

        // Calculate new dimensions
        let newWidth = currentWidth, newHeight = currentHeight;
        switch (direction) {
            case 'wider':
                newWidth = currentWidth + resizeAmount;
                break;
            case 'narrower':
                newWidth = Math.max(50, currentWidth - resizeAmount);
                break;
            case 'taller':
                newHeight = currentHeight + resizeAmount;
                break;
            case 'shorter':
                newHeight = Math.max(20, currentHeight - resizeAmount);
                break;
        }

        // Apply new dimensions
        element.style.width = `${newWidth}px`;
        element.style.height = `${newHeight}px`;

        // Store in overlay
        OverlayManager.setContainerOverlay(pageId, selector, {
            width: `${newWidth}px`,
            height: `${newHeight}px`
        });

        console.log(`📦 Resized container ${direction}:`, { selector, width: newWidth, height: newHeight });
    }

    /**
     * Reset container to original state
     */
    static resetContainer(pageId, selector) {
        if (!this.currentSelection) return;

        const { element, originalStyles } = this.currentSelection;

        // Reset to original styles
        element.style.width = originalStyles.width;
        element.style.height = originalStyles.height;
        element.style.transform = originalStyles.transform;

        // Remove overlay data
        OverlayManager.removeOverlay(pageId, 'containers', selector);

        console.log('🔄 Container reset to original:', selector);
    }

    /**
     * Clear container selection
     */
    static clearContainerSelection() {
        const zoomFrame = document.getElementById('zoomFrame');
        if (zoomFrame && zoomFrame.contentDocument) {
            const selectedContainers = zoomFrame.contentDocument.querySelectorAll('.selected-container');
            selectedContainers.forEach(container => {
                container.classList.remove('selected-container');
                container.style.outline = '';
                container.style.outlineOffset = '';
            });
        }

        // Hide container controls
        const containerControls = document.getElementById('containerControls');
        const noElementSelected = document.getElementById('noElementSelected');

        if (containerControls && noElementSelected) {
            containerControls.style.display = 'none';
            noElementSelected.style.display = 'block';
        }

        this.currentSelection = null;
    }
}

export default ContainerEditor;