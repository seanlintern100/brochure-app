/**
 * SectionEditor - Handle header/footer height adjustments with overlay system
 *
 * Provides clean section height modification without DOM corruption.
 * Stores changes as overlay data for reliable persistence.
 */

import OverlayManager from './OverlayManager.js';
import EventBus from '../core/EventBus.js';
import { EVENTS } from '../ui/constants.js';

class SectionEditor {
    /**
     * Initialize section editing system
     */
    static init() {
        console.log('📏 SectionEditor initialized');
        this.setupEventListeners();
        this.currentSelection = null;
    }

    static setupEventListeners() {
        // Listen for zoom modal opening to enable section selection
        EventBus.on(EVENTS.MODAL_OPENED, (data) => {
            if (data.modalId === 'pageZoomModal') {
                this.setupSectionSelection(data.data?.pageId);
            }
        });

        EventBus.on(EVENTS.MODAL_CLOSED, (data) => {
            if (data.modalId === 'pageZoomModal') {
                this.clearSectionSelection();
            }
        });

        // Listen for section action buttons
        EventBus.on(EVENTS.ACTION, (data) => {
            if (data.action.startsWith('extend-section') ||
                data.action.startsWith('shrink-section') ||
                data.action.startsWith('reset-section')) {
                this.handleSectionAction(data);
            }
        });
    }

    /**
     * Setup section selection in the zoom modal iframe
     */
    static setupSectionSelection(pageId) {
        if (!pageId) return;

        const zoomFrame = document.getElementById('zoomFrame');
        if (!zoomFrame) return;

        // Wait for iframe to load
        zoomFrame.onload = () => {
            const iframeDoc = zoomFrame.contentDocument;
            if (!iframeDoc) return;

            // Select headers and footers specifically
            const sections = iframeDoc.querySelectorAll('header, footer, .header, .footer, .page-header, .page-footer');

            sections.forEach((section, index) => {
                section.style.cursor = 'pointer';
                section.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.selectSection(section, pageId);
                });

                // Add hover effect
                section.addEventListener('mouseenter', () => {
                    if (!section.classList.contains('selected-section')) {
                        section.style.outline = '2px solid var(--color-orange)';
                        section.style.outlineOffset = '2px';
                    }
                });

                section.addEventListener('mouseleave', () => {
                    if (!section.classList.contains('selected-section')) {
                        section.style.outline = '';
                        section.style.outlineOffset = '';
                    }
                });
            });

            console.log(`📏 Section selection enabled for ${sections.length} sections`);
        };
    }

    /**
     * Select a section for editing
     */
    static selectSection(sectionElement, pageId) {
        // Clear previous selections
        this.clearSectionSelection();

        // Mark as selected
        sectionElement.classList.add('selected-section');
        sectionElement.style.outline = '3px solid var(--color-teal)';
        sectionElement.style.outlineOffset = '2px';

        // Generate selector for this section
        const selector = this.generateSectionSelector(sectionElement);

        // Show section editing UI
        this.showSectionEditingUI(pageId, selector, sectionElement);

        console.log('📏 Section selected:', selector);
    }

    /**
     * Generate CSS selector for a section element
     */
    static generateSectionSelector(sectionElement) {
        // Try to find a unique identifier
        if (sectionElement.id) {
            return `#${sectionElement.id}`;
        }

        // Try class names
        if (sectionElement.className) {
            const classes = sectionElement.className.split(' ')
                .filter(c => c.trim() && !c.includes('selected'));
            if (classes.length > 0) {
                return `.${classes.join('.')}`;
            }
        }

        // Try data attributes
        for (const attr of sectionElement.attributes) {
            if (attr.name.startsWith('data-') && attr.value) {
                return `[${attr.name}="${attr.value}"]`;
            }
        }

        // Use tag name with nth-child for headers/footers
        const tagName = sectionElement.tagName.toLowerCase();
        const siblings = Array.from(sectionElement.parentElement?.children || [])
            .filter(child => child.tagName.toLowerCase() === tagName);

        if (siblings.length > 1) {
            const index = siblings.indexOf(sectionElement) + 1;
            return `${tagName}:nth-child(${index})`;
        }

        return tagName;
    }

    /**
     * Show section editing UI in the editor panel
     */
    static showSectionEditingUI(pageId, selector, sectionElement) {
        // Show the section controls in the editor panel
        const sectionControls = document.getElementById('sectionControls');
        const noElementSelected = document.getElementById('noElementSelected');

        if (sectionControls && noElementSelected) {
            noElementSelected.style.display = 'none';
            sectionControls.style.display = 'block';
        }

        // Store current selection
        this.currentSelection = {
            pageId,
            selector,
            element: sectionElement,
            originalHeight: sectionElement.style.height || getComputedStyle(sectionElement).height,
            sectionType: this.getSectionType(sectionElement)
        };

        // Update UI to show current section info
        this.updateSectionInfo(sectionElement);
    }

    /**
     * Determine section type (header, footer, etc.)
     */
    static getSectionType(sectionElement) {
        const tagName = sectionElement.tagName.toLowerCase();
        const className = sectionElement.className.toLowerCase();

        if (tagName === 'header' || className.includes('header')) {
            return 'header';
        } else if (tagName === 'footer' || className.includes('footer')) {
            return 'footer';
        } else {
            return 'section';
        }
    }

    /**
     * Update section info in the UI
     */
    static updateSectionInfo(sectionElement) {
        const sectionControls = document.getElementById('sectionControls');
        if (!sectionControls) return;

        const currentHeight = parseFloat(getComputedStyle(sectionElement).height);
        const sectionType = this.getSectionType(sectionElement);

        // Update the section info display
        const infoElement = sectionControls.querySelector('.section-info');
        if (!infoElement) {
            // Create info display if it doesn't exist
            const infoDiv = document.createElement('div');
            infoDiv.className = 'section-info';
            infoDiv.innerHTML = `
                <p><strong>Selected:</strong> ${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)}</p>
                <p><strong>Current Height:</strong> <span class="current-height">${Math.round(currentHeight)}px</span></p>
            `;
            sectionControls.insertBefore(infoDiv, sectionControls.firstChild);
        } else {
            infoElement.querySelector('.current-height').textContent = `${Math.round(currentHeight)}px`;
        }
    }

    /**
     * Handle section action buttons (extend, shrink, reset)
     */
    static handleSectionAction(data) {
        if (!this.currentSelection) return;

        const { pageId, selector, element } = this.currentSelection;
        const { action } = data;

        switch (action) {
            case 'extend-section':
                this.adjustSectionHeight(pageId, selector, element, 20);
                break;
            case 'shrink-section':
                this.adjustSectionHeight(pageId, selector, element, -20);
                break;
            case 'reset-section-height':
                this.resetSectionHeight(pageId, selector);
                break;
        }
    }

    /**
     * Adjust section height by specified amount
     */
    static adjustSectionHeight(pageId, selector, element, heightChange) {
        // Get current height and computed styles
        const computedStyle = getComputedStyle(element);
        const currentHeight = parseFloat(computedStyle.height);
        const position = computedStyle.position;
        const bottom = computedStyle.bottom;

        // Get page container for max height constraint
        const pageContainer = element.closest('.unified-page, .page, [data-page-id]');
        const pageHeight = pageContainer ? pageContainer.offsetHeight : 800;

        // Set reasonable max height (40% of page for headers/footers)
        const maxAllowedHeight = pageHeight * 0.4;

        // Calculate new height with constraints
        const newHeight = Math.min(maxAllowedHeight, Math.max(20, currentHeight + heightChange));

        // Check if this is a footer (positioned at bottom)
        const isFooter = element.tagName === 'FOOTER' ||
                        (position === 'absolute' && bottom === '0px') ||
                        (position === 'fixed' && bottom === '0px');

        // Apply new height
        element.style.height = `${newHeight}px`;

        // For footers positioned at bottom, adjust positioning to prevent upward overflow
        if (isFooter && position === 'absolute' && newHeight > currentHeight) {
            // Keep footer anchored but ensure it doesn't overflow page top
            const elementTop = element.offsetTop;
            if (elementTop < 0 || (pageContainer && elementTop < pageContainer.offsetTop)) {
                // Footer is growing too tall, constrain it
                element.style.height = `${currentHeight}px`; // Revert height
                console.log('📏 Footer height limited to prevent overflow');
                return;
            }
        }

        // Store in overlay
        const overlayData = { height: `${newHeight}px` };
        OverlayManager.setSectionOverlay(pageId, selector, overlayData);

        // Update UI info
        this.updateSectionInfo(element);

        console.log(`📏 Adjusted section height:`, {
            selector,
            oldHeight: currentHeight,
            newHeight,
            isFooter,
            maxAllowed: maxAllowedHeight,
            change: heightChange
        });
    }

    /**
     * Reset section height to original
     */
    static resetSectionHeight(pageId, selector) {
        if (!this.currentSelection) return;

        const { element, originalHeight } = this.currentSelection;

        // Reset to original height
        element.style.height = originalHeight;

        // Remove overlay data
        OverlayManager.removeOverlay(pageId, 'sections', selector);

        // Update UI info
        this.updateSectionInfo(element);

        console.log('🔄 Section height reset to original:', { selector, originalHeight });
    }

    /**
     * Clear section selection
     */
    static clearSectionSelection() {
        const zoomFrame = document.getElementById('zoomFrame');
        if (zoomFrame && zoomFrame.contentDocument) {
            const selectedSections = zoomFrame.contentDocument.querySelectorAll('.selected-section');
            selectedSections.forEach(section => {
                section.classList.remove('selected-section');
                section.style.outline = '';
                section.style.outlineOffset = '';
            });
        }

        // Hide section controls
        const sectionControls = document.getElementById('sectionControls');
        const noElementSelected = document.getElementById('noElementSelected');

        if (sectionControls && noElementSelected) {
            sectionControls.style.display = 'none';
            noElementSelected.style.display = 'block';

            // Remove section info
            const infoElement = sectionControls.querySelector('.section-info');
            if (infoElement) {
                infoElement.remove();
            }
        }

        this.currentSelection = null;
    }

    /**
     * Get available sections for selection
     */
    static getAvailableSections(pageId) {
        const zoomFrame = document.getElementById('zoomFrame');
        if (!zoomFrame || !zoomFrame.contentDocument) return [];

        const iframeDoc = zoomFrame.contentDocument;
        const sections = iframeDoc.querySelectorAll('header, footer, .header, .footer, .page-header, .page-footer');

        return Array.from(sections).map(section => ({
            element: section,
            selector: this.generateSectionSelector(section),
            type: this.getSectionType(section),
            currentHeight: parseFloat(getComputedStyle(section).height)
        }));
    }
}

export default SectionEditor;