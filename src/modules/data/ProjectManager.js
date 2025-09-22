import StateManager from '../core/StateManager.js';
import EventBus from '../core/EventBus.js';
import ErrorHandler from '../core/ErrorHandler.js';
import EventManager from '../ui/EventManager.js';
import UnifiedPageRenderer from '../rendering/UnifiedPageRenderer.js';
import TemplateManager from './TemplateManager.js';
import { EVENTS } from '../ui/constants.js';

class ProjectManager {
    static async createProject(metadata, templateManager) {
        try {
            const project = {
                version: '2.0',
                metadata: {
                    title: metadata.title,
                    client: metadata.client || '',
                    status: metadata.status || 'draft',
                    baseTemplate: metadata.baseTemplate || null,
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                },
                templateCopies: {},
                pages: []
            };

            // Pre-populate with template pages if specified
            if (metadata.baseTemplate) {
                await this.addAllTemplatePagesToProject(project, metadata.baseTemplate, templateManager);
            }

            StateManager.setState({ currentProject: project, isDirty: true });
            EventBus.emit(EVENTS.PROJECT_CREATED, project);

            return project;
        } catch (error) {
            ErrorHandler.logError(error, 'ProjectManager.createProject', 'Failed to create project');
            throw error;
        }
    }

    static async addAllTemplatePagesToProject(project, templateName, templateManager) {
        const templates = StateManager.getState().templates;
        const templatePages = templates.filter(t => t.template === templateName);

        for (const template of templatePages) {
            const pageId = `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const page = {
                id: pageId,
                templateId: template.id,
                template: template.template,
                filename: template.filename,
                position: project.pages.length + 1,
                edits: {}
            };

            // Add template copy if not already exists
            if (!project.templateCopies[template.id]) {
                project.templateCopies[template.id] = {
                    originalSource: template.content,
                    modifiedHtml: template.content,
                    metadata: template.metadata
                };
            }

            project.pages.push(page);
        }
    }

    static async saveProject(project = null) {
        try {
            const currentProject = project || StateManager.getState().currentProject;
            if (!currentProject) {
                throw new Error('No project to save');
            }

            const result = await window.electronAPI.saveProject(currentProject);

            if (result.success) {
                StateManager.setState({ isDirty: false });
                EventBus.emit(EVENTS.PROJECT_SAVED, { project: currentProject, result });
                ErrorHandler.showSuccess(`Project saved as ${result.filename}`);
                return result;
            }
        } catch (error) {
            ErrorHandler.logError(error, 'ProjectManager.saveProject', 'Failed to save project');
            throw error;
        }
    }

    static async loadProject(filename) {
        try {
            const project = await window.electronAPI.loadProject(filename);

            StateManager.setState({
                currentProject: project,
                isDirty: false
            });

            // Repair any missing template copies after loading
            TemplateManager.repairMissingTemplateCopies();

            EventBus.emit(EVENTS.PROJECT_LOADED, project);
            ErrorHandler.showSuccess(`Project "${project.metadata.title}" loaded successfully`);

            return project;
        } catch (error) {
            ErrorHandler.logError(error, 'ProjectManager.loadProject', 'Failed to load project');
            throw error;
        }
    }

    static async loadProjectForPreview(filename) {
        try {
            const project = await window.electronAPI.loadProject(filename);
            return project;
        } catch (error) {
            ErrorHandler.logError(error, 'ProjectManager.loadProjectForPreview', 'Failed to load project for preview');
            throw error;
        }
    }

    static async listProjects() {
        try {
            return await window.electronAPI.listProjects();
        } catch (error) {
            ErrorHandler.logError(error, 'ProjectManager.listProjects', 'Failed to load projects');
            throw error;
        }
    }

    static generateSinglePageHTML(page) {
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) return '<p>No project loaded</p>';

        return this.generateSinglePageHTMLForProject(page, currentProject);
    }

    static generateSinglePageHTMLForProject(page, project) {
        const templateCopy = project.templateCopies[page.templateId];
        if (!templateCopy) return '<p>Page not found</p>';

        let fullHTML = templateCopy.modifiedHtml;

        // If it's not a complete HTML document, wrap it
        if (!fullHTML.includes('<!DOCTYPE html>')) {
            const styleMatch = fullHTML.match(/<style[^>]*>(.*?)<\/style>/s);
            const styles = styleMatch ? styleMatch[1] : '';
            const contentWithoutStyles = fullHTML.replace(/<style[^>]*>.*?<\/style>/gs, '');

            fullHTML = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Page Preview</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet">
                    <style>
                        body {
                            margin: 0;
                            font-family: 'Source Sans 3', Arial, sans-serif;
                            background: white;
                        }
                        ${styles}
                    </style>
                </head>
                <body>
                    ${contentWithoutStyles}
                </body>
                </html>
            `;
        }

        // Apply element transforms if they exist for this page
        fullHTML = this.applyElementTransformsToHTML(fullHTML, page.id, project);

        return fullHTML;
    }

    static applyElementTransformsToHTML(html, pageId, project) {
        // Get saved transforms for this page
        const pageTransforms = project.elementTransforms?.[pageId];
        if (!pageTransforms || Object.keys(pageTransforms).length === 0) {
            console.log('📝 No transforms to apply for page:', pageId);
            return html;
        }

        console.log('🔄 Applying transforms to HTML for page:', pageId, pageTransforms);

        // Create a temporary DOM to apply transforms
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Apply image transforms
        if (pageTransforms.images) {
            Object.entries(pageTransforms.images).forEach(([elementId, transform]) => {
                const container = doc.querySelector(`[data-element-id="${elementId}"]`);
                if (container) {
                    const img = container.querySelector('img');
                    if (img) {
                        // Apply CSS custom properties for transforms
                        if (transform.translateX) img.style.setProperty('--img-x', transform.translateX);
                        if (transform.translateY) img.style.setProperty('--img-y', transform.translateY);
                        if (transform.scale) img.style.setProperty('--img-scale', transform.scale);
                        if (transform.src && transform.src !== img.src) {
                            img.src = transform.src;
                        }

                        // Apply the transform directly to the style for immediate effect
                        const translateX = transform.translateX || '0px';
                        const translateY = transform.translateY || '0px';
                        const scale = transform.scale || '1';

                        img.style.transform = `translate(${translateX}, ${translateY}) scale(${scale})`;
                        img.style.transformOrigin = 'center center';

                        console.log(`✅ Applied transform to image in element ${elementId}:`, {
                            translateX, translateY, scale, src: transform.src
                        });
                    }
                } else {
                    console.warn(`⚠️ Could not find element with ID: ${elementId}`);
                }
            });
        }

        // Apply section transforms if they exist
        if (pageTransforms.sections) {
            Object.entries(pageTransforms.sections).forEach(([elementId, transform]) => {
                const section = doc.querySelector(`[data-element-id="${elementId}"]`);
                if (section && transform.styles) {
                    Object.entries(transform.styles).forEach(([property, value]) => {
                        section.style.setProperty(property, value);
                    });
                    console.log(`✅ Applied section transform to element ${elementId}`);
                }
            });
        }

        // Return the modified HTML
        return doc.documentElement.outerHTML;
    }

    static generateSelfContainedPage(originalHtml, pageId, pageNumber) {
        let modifiedHtml = originalHtml.trim();

        console.log(`🏗️ Generating page section for ${pageId}`);

        // For complete HTML documents, extract the body content and styles
        if (modifiedHtml.includes('<!DOCTYPE html>')) {
            console.log('✅ Complete HTML document detected');

            // Extract body content
            const bodyMatch = modifiedHtml.match(/<body[^>]*>(.*?)<\/body>/s);
            const bodyContent = bodyMatch ? bodyMatch[1].trim() : '';

            // Extract ALL styles from the document
            const allStyleMatches = modifiedHtml.matchAll(/<style[^>]*>(.*?)<\/style>/gs);
            const allStyles = [];
            for (const styleMatch of allStyleMatches) {
                const styleContent = styleMatch[1].trim();
                if (styleContent) {
                    allStyles.push(styleContent);
                    console.log(`📦 Page ${pageNumber} extracted style:`, styleContent.substring(0, 150) + '...');
                }
            }

            console.log(`📊 Page ${pageNumber} total styles extracted:`, allStyles.length);
            console.log(`🎨 Page ${pageNumber} combined styles length:`, allStyles.join('\n').length);

            // Create a page section with preserved styles
            return `
                <div class="page" data-page-id="${pageId}" style="
                    width: 210mm;
                    min-height: 297mm;
                    margin: 20px auto;
                    page-break-after: always;
                    position: relative;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                ">
                    <style>
                        /* Preserve all original styles */
                        ${allStyles.join('\n')}

                        /* Page number styling - only show in print */
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
                            display: none;
                        }

                        @media print {
                            .page-number-${pageId} {
                                display: block !important;
                            }
                        }

                        /* Universal image centering fix */
                        [style*="text-align: center"] img,
                        .text-center img,
                        [class*="center"] img,
                        [class*="logo"] img {
                            margin-left: auto !important;
                            margin-right: auto !important;
                        }

                        /* Ensure backgrounds print correctly */
                        * {
                            -webkit-print-color-adjust: exact !important;
                            color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }

                        /* Fix CSS specificity for page backgrounds */
                        .page.page-cover {
                            background: linear-gradient(135deg, var(--color-teal) 0%, var(--color-teal-dark) 100%) !important;
                        }

                        .page.page-cta {
                            background: linear-gradient(135deg, var(--color-teal-dark) 0%, var(--color-teal) 100%) !important;
                        }

                        /* Override template overflow:hidden for PDF export to prevent border clipping */
                        @media print {
                            .page {
                                overflow: visible !important;
                            }
                        }
                    </style>
                    ${bodyContent}
                    <div class="page-number-${pageId}">${pageNumber}</div>
                </div>
            `;
        } else {
            console.log('⚠️ HTML fragment detected');

            // Handle fragments by preserving any inline styles
            const styleMatches = modifiedHtml.matchAll(/<style[^>]*>(.*?)<\/style>/gs);
            const styles = [];
            for (const styleMatch of styleMatches) {
                styles.push(styleMatch[1].trim());
            }

            // Remove style tags from content since we'll include them separately
            const contentWithoutStyles = modifiedHtml.replace(/<style[^>]*>.*?<\/style>/gs, '');

            return `
                <div class="page" data-page-id="${pageId}" style="
                    width: 210mm;
                    min-height: 297mm;
                    margin: 20px auto;
                    page-break-after: always;
                    position: relative;
                    box-shadow: 0 0 10px rgba(0,0,0,0.1);
                ">
                    <style>
                        /* Preserve fragment styles */
                        ${styles.join('\n')}

                        /* Page number styling - only show in print */
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
                            display: none;
                        }

                        @media print {
                            .page-number-${pageId} {
                                display: block !important;
                            }
                        }

                        /* Universal image centering fix */
                        [style*="text-align: center"] img,
                        .text-center img,
                        [class*="center"] img,
                        [class*="logo"] img {
                            margin-left: auto !important;
                            margin-right: auto !important;
                        }

                        /* Ensure backgrounds print correctly */
                        * {
                            -webkit-print-color-adjust: exact !important;
                            color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }

                        /* Fix CSS specificity for page backgrounds */
                        .page.page-cover {
                            background: linear-gradient(135deg, var(--color-teal) 0%, var(--color-teal-dark) 100%) !important;
                        }

                        .page.page-cta {
                            background: linear-gradient(135deg, var(--color-teal-dark) 0%, var(--color-teal) 100%) !important;
                        }

                        /* Override template overflow:hidden for PDF export to prevent border clipping */
                        @media print {
                            .page {
                                overflow: visible !important;
                            }
                        }
                    </style>
                    ${contentWithoutStyles}
                    <div class="page-number-${pageId}">${pageNumber}</div>
                </div>
            `;
        }
    }

    static enhanceStylesForSelfContainedPage(css) {
        // Now that we removed the conflicting inline background, we just need to ensure print preservation
        let enhancedCSS = css;

        console.log('🎨 Original CSS length:', css.length);
        console.log('🎨 Original CSS preview:', css.substring(0, 200) + '...');

        // Add print color preservation
        enhancedCSS += `
            /* Ensure all backgrounds print correctly */
            * {
                -webkit-print-color-adjust: exact !important;
                color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        `;

        console.log('✨ Enhanced CSS length:', enhancedCSS.length);

        return enhancedCSS;
    }

    static generateConsolidatedHTML() {
        console.log('🎨 ProjectManager: Using UnifiedPageRenderer for export generation');

        const currentProject = StateManager.getState().currentProject;
        if (!currentProject || !currentProject.pages.length) {
            throw new Error('No pages to export');
        }

        // Use UnifiedPageRenderer for consistent, self-contained export
        return UnifiedPageRenderer.generateCombinedDocument(currentProject, {
            includePageNumber: true,
            applyTransforms: true,
            isExport: true
        });
    }

    static updateProjectMetadata(updates) {
        StateManager.updateProjectMetadata(updates);
        EventBus.emit(EVENTS.PROJECT_DIRTY, true);
    }

    static getCurrentProject() {
        return StateManager.getState().currentProject;
    }

    static generateProjectPreview(project) {
        if (!project.pages || project.pages.length === 0) {
            return null; // No pages to preview
        }

        // Get the first page
        const firstPage = project.pages[0];
        const templateCopy = project.templateCopies[firstPage.templateId];

        if (!templateCopy) {
            return null;
        }

        // Generate HTML for preview without relying on current project state
        return this.generateSinglePageHTMLForProject(firstPage, project);
    }


    static resetCurrentProject() {
        StateManager.setState({ currentProject: null, isDirty: false });
    }
}

export default ProjectManager;