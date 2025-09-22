/**
 * PreviewRenderer - Combines templates with overlay data for live preview
 *
 * This replaces the broken DOM manipulation approach. Instead of directly editing
 * the template HTML, we apply overlay data to create preview versions without
 * corrupting the original template structure.
 */

import OverlayManager from './OverlayManager.js';
import EventBus from '../core/EventBus.js';
import { EVENTS } from '../ui/constants.js';

class PreviewRenderer {
    /**
     * Apply overlay data to template HTML for preview display
     * @param {string} templateHtml - Original template HTML (complete document)
     * @param {string} pageId - Page ID to get overlay data for
     * @returns {string} Modified HTML with overlays applied
     */
    static applyOverlays(templateHtml, pageId) {
        const overlay = OverlayManager.getOverlay(pageId);

        // Parse the template HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(templateHtml, 'text/html');

        if (!doc) {
            console.error('❌ Failed to parse template HTML');
            return templateHtml;
        }

        // Apply each type of overlay
        this.applyTextOverlays(doc, overlay.text);
        this.applyImageOverlays(doc, overlay.images);
        this.applyContainerOverlays(doc, overlay.containers);
        this.applySectionOverlays(doc, overlay.sections);

        // Add overlay data attributes for debugging
        doc.documentElement.setAttribute('data-overlay-applied', 'true');
        doc.documentElement.setAttribute('data-page-id', pageId);

        // Return the complete modified HTML using outerHTML to avoid XML encoding issues
        const result = doc.documentElement.outerHTML;

        EventBus.emit(EVENTS.OVERLAY_APPLIED, { pageId, overlayCount: this.countOverlays(overlay) });

        return `<!DOCTYPE html>\n${result}`;
    }

    /**
     * Apply text content overlays
     */
    static applyTextOverlays(doc, textOverlays) {
        Object.entries(textOverlays).forEach(([selector, content]) => {
            try {
                const elements = doc.querySelectorAll(selector);
                elements.forEach(element => {
                    element.textContent = content;
                    element.setAttribute('data-overlay-text', 'true');
                });
                console.log('📝 Applied text overlay:', selector, '→', content);
            } catch (error) {
                console.warn('⚠️ Failed to apply text overlay:', selector, error);
            }
        });
    }

    /**
     * Apply image source overlays
     */
    static applyImageOverlays(doc, imageOverlays) {
        Object.entries(imageOverlays).forEach(([selector, src]) => {
            try {
                const elements = doc.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element.tagName === 'IMG') {
                        element.src = src;
                        element.setAttribute('src', src); // Ensure attribute is set
                    } else {
                        // If selector is for a container, find img inside
                        const img = element.querySelector('img');
                        if (img) {
                            img.src = src;
                            img.setAttribute('src', src);
                        }
                    }
                    element.setAttribute('data-overlay-image', 'true');
                });
            } catch (error) {
                console.warn('⚠️ Failed to apply image overlay:', selector, error);
            }
        });
    }

    /**
     * Apply container style overlays (width, height, etc.)
     */
    static applyContainerOverlays(doc, containerOverlays) {
        Object.entries(containerOverlays).forEach(([selector, properties]) => {
            try {
                const elements = doc.querySelectorAll(selector);
                elements.forEach(element => {
                    Object.entries(properties).forEach(([prop, value]) => {
                        element.style[prop] = value;
                    });
                    element.setAttribute('data-overlay-container', 'true');
                });
            } catch (error) {
                console.warn('⚠️ Failed to apply container overlay:', selector, error);
            }
        });
    }

    /**
     * Apply section overlays (mainly height adjustments for headers/footers)
     */
    static applySectionOverlays(doc, sectionOverlays) {
        Object.entries(sectionOverlays).forEach(([selector, properties]) => {
            try {
                const elements = doc.querySelectorAll(selector);
                elements.forEach(element => {
                    Object.entries(properties).forEach(([prop, value]) => {
                        element.style[prop] = value;
                    });
                    element.setAttribute('data-overlay-section', 'true');
                });
            } catch (error) {
                console.warn('⚠️ Failed to apply section overlay:', selector, error);
            }
        });
    }

    /**
     * Render a page with overlays for the zoom modal
     * @param {Object} page - Page object
     * @param {Object} project - Project with template copies
     * @returns {string} HTML ready for iframe display
     */
    static renderPageWithOverlays(page, project) {
        // Get the original template
        const templateCopy = project.templateCopies[page.templateId];
        if (!templateCopy) {
            console.error('❌ Template copy not found for page:', page.id);
            return '<p>Template not found</p>';
        }

        let templateHtml = templateCopy.modifiedHtml || templateCopy.html;

        // Apply current overlays
        return this.applyOverlays(templateHtml, page.id);
    }

    /**
     * Generate a clean template selector list for editing UI
     * @param {string} templateHtml - Template HTML to analyze
     * @returns {Object} Categorized selectors for editing
     */
    static generateSelectorList(templateHtml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(templateHtml, 'text/html');

        const selectors = {
            text: [],
            images: [],
            containers: [],
            sections: []
        };

        // Find text elements
        const textElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div[contenteditable]');
        textElements.forEach((el, index) => {
            const selector = this.generateUniqueSelector(el, doc);
            if (selector && el.textContent.trim()) {
                selectors.text.push({
                    selector,
                    preview: el.textContent.trim().substring(0, 50),
                    type: el.tagName.toLowerCase()
                });
            }
        });

        // Find images
        const images = doc.querySelectorAll('img');
        images.forEach((img, index) => {
            const selector = this.generateUniqueSelector(img, doc);
            if (selector) {
                selectors.images.push({
                    selector,
                    preview: img.alt || img.src.split('/').pop() || 'Image',
                    currentSrc: img.src
                });
            }
        });

        // Find containers (divs, sections with layout significance)
        const containers = doc.querySelectorAll('div, section, article, aside');
        containers.forEach((container, index) => {
            const selector = this.generateUniqueSelector(container, doc);
            if (selector && !container.closest('header, footer')) {
                selectors.containers.push({
                    selector,
                    preview: container.className || container.tagName.toLowerCase(),
                    type: container.tagName.toLowerCase()
                });
            }
        });

        // Find sections (headers, footers)
        const sections = doc.querySelectorAll('header, footer');
        sections.forEach((section, index) => {
            const selector = this.generateUniqueSelector(section, doc);
            if (selector) {
                selectors.sections.push({
                    selector,
                    preview: section.tagName.toLowerCase(),
                    type: section.tagName.toLowerCase()
                });
            }
        });

        return selectors;
    }

    /**
     * Generate a unique CSS selector for an element
     */
    static generateUniqueSelector(element, doc) {
        // Try ID first
        if (element.id) {
            return `#${element.id}`;
        }

        // Try class names
        if (element.className && typeof element.className === 'string') {
            const classSelector = `.${element.className.split(' ').join('.')}`;
            if (doc.querySelectorAll(classSelector).length === 1) {
                return classSelector;
            }
        }

        // Try data attributes
        for (const attr of element.attributes) {
            if (attr.name.startsWith('data-') && attr.value) {
                const attrSelector = `[${attr.name}="${attr.value}"]`;
                if (doc.querySelectorAll(attrSelector).length === 1) {
                    return attrSelector;
                }
            }
        }

        // Fall back to nth-child
        const tagName = element.tagName.toLowerCase();
        const siblings = Array.from(element.parentElement?.children || [])
            .filter(child => child.tagName.toLowerCase() === tagName);

        if (siblings.length > 1) {
            const index = siblings.indexOf(element) + 1;
            return `${tagName}:nth-child(${index})`;
        }

        return tagName;
    }

    /**
     * Count total overlays for debugging
     */
    static countOverlays(overlay) {
        return Object.keys(overlay.text).length +
               Object.keys(overlay.images).length +
               Object.keys(overlay.containers).length +
               Object.keys(overlay.sections).length;
    }

    /**
     * Remove all overlay indicators from HTML (for clean export)
     */
    static cleanOverlayAttributes(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Remove overlay data attributes
        const overlayElements = doc.querySelectorAll('[data-overlay-text], [data-overlay-image], [data-overlay-container], [data-overlay-section]');
        overlayElements.forEach(element => {
            element.removeAttribute('data-overlay-text');
            element.removeAttribute('data-overlay-image');
            element.removeAttribute('data-overlay-container');
            element.removeAttribute('data-overlay-section');
        });

        doc.documentElement.removeAttribute('data-overlay-applied');
        doc.documentElement.removeAttribute('data-page-id');

        return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
    }
}

export default PreviewRenderer;