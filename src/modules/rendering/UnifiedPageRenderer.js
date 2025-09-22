/**
 * Unified Page Renderer
 *
 * Creates truly self-contained page HTML that works identically in:
 * - App previews (UIManager)
 * - Export documents (ProjectManager)
 * - PDF generation
 *
 * Each page includes ALL necessary styles and fixes with no dependencies
 * on external CSS, ensuring visual consistency across all contexts.
 *
 * NEW: Supports overlay system for template-native editing without corruption.
 */

import PreviewRenderer from '../editing/PreviewRenderer.js';
import OverlayManager from '../editing/OverlayManager.js';

class UnifiedPageRenderer {
    /**
     * Generate a completely self-contained page
     * @param {Object} page - Page object with id, templateId
     * @param {Object} project - Current project with templateCopies and overlayData
     * @param {number} pageNumber - Page number for print/reference
     * @param {Object} options - Rendering options
     * @returns {string} Complete self-contained HTML
     */
    static generateSelfContainedPage(page, project, pageNumber = 1, options = {}) {
        const {
            includePageBreak = true,
            includePageNumber = true,
            applyTransforms = true,
            applyOverlays = true  // NEW: Apply overlay data for editing
        } = options;


        // Get template copy
        const templateCopy = project.templateCopies[page.templateId];
        if (!templateCopy) {
            console.error(`❌ Template copy not found for page ${page.id}, templateId: ${page.templateId}`);
            console.error('Available template copies:', Object.keys(project.templateCopies || {}));
            return this.generateErrorPage(page.id, pageNumber);
        }

        let html = templateCopy.modifiedHtml.trim();

        // Clean any nested HTML document structures that may have been saved
        html = this.cleanNestedHTML(html);

        // NEW: Apply overlay data for template-native editing
        if (applyOverlays && project.overlayData && project.overlayData[page.id]) {
            console.log('🎨 Applying overlays from project data for page:', page.id);
            // Load overlay data into OverlayManager if not already loaded
            OverlayManager.loadOverlays(project.overlayData);
            html = PreviewRenderer.applyOverlays(html, page.id);
        } else if (applyOverlays) {
            // Apply current overlay data from OverlayManager (for live editing)
            html = PreviewRenderer.applyOverlays(html, page.id);
        }

        // Apply legacy element transforms if enabled (backward compatibility)
        if (applyTransforms) {
            html = this.applyElementTransforms(html, page.id, project);
        }

        // Process HTML based on type
        if (html.includes('<!DOCTYPE html>')) {
            return this.processCompleteHTMLDocument(html, page, pageNumber, options);
        } else {
            return this.processHTMLFragment(html, page, pageNumber, options);
        }
    }

    /**
     * Process complete HTML document
     */
    static processCompleteHTMLDocument(html, page, pageNumber, options) {
        // Parse HTML using DOM parser for more reliable extraction
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract body content safely
        const bodyElement = doc.querySelector('body');
        const bodyContent = bodyElement ? bodyElement.innerHTML.trim() : '';

        // Extract ALL styles from document (both head and inline)
        const allStyleElements = doc.querySelectorAll('style');
        const originalStyles = [];
        allStyleElements.forEach(styleElement => {
            const styleContent = styleElement.textContent.trim();
            if (styleContent) {
                originalStyles.push(styleContent);
            }
        });

        return this.wrapInSelfContainedDiv(bodyContent, originalStyles, page, pageNumber, options);
    }

    /**
     * Process HTML fragment
     */
    static processHTMLFragment(html, page, pageNumber, options) {
        // Extract any inline styles
        const styleMatches = html.matchAll(/<style[^>]*>(.*?)<\/style>/gs);
        const styles = [];
        for (const styleMatch of styleMatches) {
            styles.push(styleMatch[1].trim());
        }

        // Remove style tags from content
        const contentWithoutStyles = html.replace(/<style[^>]*>.*?<\/style>/gs, '');

        return this.wrapInSelfContainedDiv(contentWithoutStyles, styles, page, pageNumber, options);
    }

    /**
     * Wrap content in completely self-contained div
     */
    static wrapInSelfContainedDiv(content, originalStyles, page, pageNumber, options) {
        const { includePageBreak, includePageNumber, isExport = false, isMultiPageDocument = false } = options;

        // Only apply CSS scoping in multi-page documents to prevent interference
        const allStyles = isMultiPageDocument
            ? [
                ...this.scopeStylesToPage(originalStyles, page.id),
                this.generateScopedUniversalFixes(page.id),
                this.generatePrintOptimizations(),
                this.generatePageNumberStyles(page.id)
              ].join('\n')
            : [
                ...originalStyles,
                this.generateUniversalFixes(),
                this.generatePrintOptimizations(),
                this.generateOverflowFixes(),
                this.generatePageNumberStyles(page.id)
              ].join('\n');

        const pageBreakStyle = includePageBreak ? 'page-break-after: always;' : '';
        // For exports, don't include page numbers as they cause PDF display issues
        const pageNumberElement = (includePageNumber && !isExport) ?
            `<div class="page-number-${page.id}">${pageNumber}</div>` : '';

        // Different styling for export vs preview
        const exportStyles = isExport ? `
            width: 210mm;
            height: 297mm;
            margin: 0;
            ${pageBreakStyle}
            position: relative;
            background: white;
            overflow: visible;
        ` : `
            width: 210mm;
            min-height: 297mm;
            margin: 20px auto;
            ${pageBreakStyle}
            position: relative;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            background: white;
            overflow: visible;
        `;

        return `
            <div class="unified-page page-${page.id}" data-page-id="${page.id}" style="${exportStyles}">
                <style>
                    ${allStyles}
                </style>
                ${content}
                ${pageNumberElement}
            </div>
        `;
    }

    /**
     * Apply element transforms to HTML
     */
    static applyElementTransforms(html, pageId, project) {
        const pageTransforms = project.elementTransforms?.[pageId];
        if (!pageTransforms || Object.keys(pageTransforms).length === 0) {
            return html;
        }


        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Apply image transforms
        if (pageTransforms.images) {
            Object.entries(pageTransforms.images).forEach(([elementId, transform]) => {
                // Try to find element by ID - could be on container or image itself
                let elementWithId = doc.querySelector(`[data-element-id="${elementId}"]`);
                let img = null;

                if (elementWithId) {
                    if (elementWithId.tagName === 'IMG') {
                        img = elementWithId;
                    } else {
                        img = elementWithId.querySelector('img');
                    }
                }

                if (img) {
                    // Apply transforms
                    if (transform.translateX) img.style.setProperty('--img-x', transform.translateX);
                    if (transform.translateY) img.style.setProperty('--img-y', transform.translateY);
                    if (transform.scale) img.style.setProperty('--img-scale', transform.scale);
                    if (transform.src && transform.src !== img.src) {
                        img.src = transform.src;
                    }

                    // Apply direct transform for immediate effect
                    const translateX = transform.translateX || '0px';
                    const translateY = transform.translateY || '0px';
                    const scale = transform.scale || '1';

                    img.style.transform = `translate(${translateX}, ${translateY}) scale(${scale})`;
                    img.style.transformOrigin = 'center center';

                } else {
                }
            });
        }

        // Apply section transforms
        if (pageTransforms.sections) {
            Object.entries(pageTransforms.sections).forEach(([elementId, transform]) => {
                const section = doc.querySelector(`[data-element-id="${elementId}"]`);
                if (section && transform.styles) {
                    Object.entries(transform.styles).forEach(([property, value]) => {
                        section.style.setProperty(property, value);
                    });
                }
            });
        }

        // Remove all highlight classes before export
        const highlightClasses = ['highlight-content', 'highlight-container', 'highlight-header-footer'];
        highlightClasses.forEach(className => {
            const highlightedElements = doc.querySelectorAll(`.${className}`);
            highlightedElements.forEach(element => {
                element.classList.remove(className);
            });
        });

        return doc.documentElement.outerHTML;
    }

    /**
     * Minimal essential fixes - only hide editing UI elements
     */
    static generateUniversalFixes() {
        return `
            /* Hide editing elements only - DO NOT interfere with layout */
            input[type="file"],
            .image-input,
            .edit-indicator,
            [data-editable].selected {
                display: none !important;
            }
        `;
    }

    /**
     * Print optimizations
     */
    static generatePrintOptimizations() {
        return `
            @media print {
                /* Ensure all backgrounds print */
                * {
                    -webkit-print-color-adjust: exact !important;
                    color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                /* Remove page shadows and margins for print */
                .page {
                    box-shadow: none !important;
                    margin: 0 !important;
                }
            }
        `;
    }

    /**
     * Minimal overflow fixes - DO NOT interfere with template designs
     */
    static generateOverflowFixes() {
        return `
            /* ONLY fix the page wrapper - DO NOT touch template content */
            .unified-page {
                overflow: visible !important;
            }
        `;
    }

    /**
     * Page number styling
     */
    static generatePageNumberStyles(pageId) {
        return `
            .page-number-${pageId} {
                position: absolute;
                top: 10px;
                right: 10px;
                font-size: 12px;
                color: #666;
                z-index: 9999;
                background: rgba(255,255,255,0.8);
                padding: 2px 6px;
                border-radius: 3px;
                display: none !important;
            }

            @media print {
                .page-number-${pageId} {
                    display: block !important;
                }
            }
        `;
    }

    /**
     * Generate error page for missing templates
     */
    static generateErrorPage(pageId, pageNumber) {
        return `
            <div class="page page-error" data-page-id="${pageId}" style="
                width: 210mm;
                min-height: 297mm;
                margin: 20px auto;
                page-break-after: always;
                position: relative;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
                background: white;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #d32f2f;
            ">
                <div>
                    <h2>Template Missing</h2>
                    <p>Page ${pageNumber} (${pageId}) could not be rendered.</p>
                    <p>Please check that the template is available.</p>
                </div>
            </div>
        `;
    }

    /**
     * Generate combined document from multiple pages
     */
    static generateCombinedDocument(project, options = {}) {
        if (!project || !project.pages.length) {
            throw new Error('No pages to export');
        }

        const allPages = [];

        project.pages.forEach((page, index) => {
            const pageOptions = {
                ...options,
                includePageBreak: index < project.pages.length - 1, // No break on last page
                isMultiPageDocument: project.pages.length > 1 // Enable CSS scoping for multi-page docs
            };

            // Generate self-contained page - scoped only if multiple pages
            const selfContainedPage = this.generateSelfContainedPage(
                page,
                project,
                index + 1,
                pageOptions
            );

            allPages.push(selfContainedPage);
        });

        // Minimal wrapper - no global styles to conflict
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.metadata.title} - Document</title>

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <style>
        /* MINIMAL document wrapper - no conflicts */
        body {
            margin: 0;
            padding: 0;
            background: #f5f5f5;
        }

        @media print {
            body {
                background: white !important;
            }
        }
    </style>
</head>
<body>
${allPages.join('\n')}
</body>
</html>`;
    }

    /**
     * Clean nested HTML document structures from stored template HTML
     * This handles cases where complete HTML documents were saved in modifiedHtml
     */
    static cleanNestedHTML(html) {
        // Check if the content contains nested HTML document tags
        const hasNestedHTML = html.includes('</body>') || html.includes('</html>') || html.includes('<!DOCTYPE');

        if (hasNestedHTML) {
            // Remove nested document tags while preserving content
            let cleanHTML = html;

            // Remove DOCTYPE declarations
            cleanHTML = cleanHTML.replace(/<!DOCTYPE[^>]*>/gi, '');

            // Remove opening and closing html, head, body tags but preserve their content
            cleanHTML = cleanHTML.replace(/<\/?(html|head|body)[^>]*>/gi, '');

            return cleanHTML.trim();
        }

        // If no nested HTML, return as-is
        return html;
    }

    /**
     * NEW: Generate page with overlays for live editing (convenience method)
     * This is specifically for the zoom modal and editing scenarios
     */
    static generatePageWithOverlays(page, project, pageNumber = 1) {
        return this.generateSelfContainedPage(page, project, pageNumber, {
            includePageBreak: false,
            includePageNumber: false,
            applyTransforms: false, // Skip legacy transforms when using overlays
            applyOverlays: true     // Always apply overlays for editing
        });
    }

    /**
     * NEW: Generate page for export (clean, no overlays attributes)
     * This ensures export HTML is clean of editing artifacts
     */
    static generatePageForExport(page, project, pageNumber = 1) {
        let html = this.generateSelfContainedPage(page, project, pageNumber, {
            includePageBreak: true,
            includePageNumber: true,
            applyTransforms: false, // Skip legacy transforms
            applyOverlays: true     // Apply overlays but clean them after
        });

        // Clean overlay debugging attributes for export
        html = PreviewRenderer.cleanOverlayAttributes(html);
        return html;
    }

    /**
     * Scope all CSS rules to a specific page to prevent cross-page interference
     */
    static scopeStylesToPage(originalStyles, pageId) {
        return originalStyles.map(styleBlock => {
            // Prefix all CSS selectors with the page-specific class
            return styleBlock.replace(/([^{}]+){/g, (match, selector) => {
                const trimmedSelector = selector.trim();

                // Skip @rules (like @media, @page, etc.)
                if (trimmedSelector.startsWith('@')) {
                    return match;
                }

                // Skip :root variables - these need to be global
                if (trimmedSelector.includes(':root')) {
                    return match;
                }

                // Scope other selectors to this page
                return `.page-${pageId} ${trimmedSelector} {`;
            });
        });
    }

    /**
     * Generate scoped universal fixes for a specific page
     */
    static generateScopedUniversalFixes(pageId) {
        return `
            /* Scoped fixes for page ${pageId} only */
            .page-${pageId} input[type="file"],
            .page-${pageId} .image-input,
            .page-${pageId} .edit-indicator,
            .page-${pageId} [data-editable].selected {
                display: none !important;
            }

            /* Page wrapper fixes */
            .page-${pageId}.unified-page {
                overflow: visible !important;
            }
        `;
    }
}

export default UnifiedPageRenderer;