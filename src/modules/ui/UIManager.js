import StateManager from '../core/StateManager.js';
import EventBus from '../core/EventBus.js';
import ErrorHandler from '../core/ErrorHandler.js';
import UnifiedPageRenderer from '../rendering/UnifiedPageRenderer.js';
import { Templates } from './templates.js';
import { CSS_CLASSES, SELECTORS, EVENTS } from './constants.js';

class UIManager {
    static renderPageList() {
        const currentProject = StateManager.getState().currentProject;
        const templates = StateManager.getState().templates;

        if (!currentProject) return;

        const pageListEl = document.querySelector(SELECTORS.PAGE_LIST);
        if (!pageListEl) return;

        const pagesHTML = currentProject.pages.map((page, index) => {
            const template = templates.find(t => t.id === page.templateId);
            const templateName = template ? template.name : 'Unknown Template';

            // Generate HTML for this page
            const pageHTML = this.generatePagePreviewHTML(page);
            const pageWithHTML = { ...page, html: pageHTML };

            return Templates.pageCard(pageWithHTML, index, templateName);
        });

        pageListEl.innerHTML = pagesHTML.join('');

        // Preview iframes are now set directly in template HTML

        feather.replace();
    }

    static generatePagePreviewHTML(page) {
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) return '<p>No project loaded</p>';

        const templateCopy = currentProject.templateCopies[page.templateId];
        if (!templateCopy) {
            console.warn(`Template copy not found for page ${page.id} with templateId ${page.templateId}`);
            console.log('Available template copies:', Object.keys(currentProject.templateCopies));
            return '<p>Template missing - try re-adding this page</p>';
        }

        // Use UnifiedPageRenderer for consistent preview generation
        const pageIndex = currentProject.pages.findIndex(p => p.id === page.id);
        const selfContainedHTML = UnifiedPageRenderer.generateSelfContainedPage(
            page,
            currentProject,
            pageIndex + 1,
            {
                includePageBreak: false,
                includePageNumber: false,
                applyTransforms: true
            }
        );

        // Extract content and styles for Templates.pagePreviewHTML scaling
        const parser = new DOMParser();
        const doc = parser.parseFromString(selfContainedHTML, 'text/html');
        const pageDiv = doc.querySelector('.unified-page');

        if (!pageDiv) {
            console.error('No page div found in self-contained HTML');
            return '<p>Preview generation error</p>';
        }

        const styleElement = pageDiv.querySelector('style');
        const styles = styleElement ? styleElement.textContent : '';

        // Get content without the style element
        const contentClone = pageDiv.cloneNode(true);
        const styleToRemove = contentClone.querySelector('style');
        if (styleToRemove) styleToRemove.remove();

        const content = contentClone.innerHTML;

        return Templates.pagePreviewHTML(content, styles);
    }


    static renderTemplateLibrary() {
        const templates = StateManager.getState().templates;
        const categoriesEl = document.querySelector(SELECTORS.TEMPLATE_CATEGORIES);

        if (!categoriesEl) return;

        // Transform flat template list into hierarchical structure
        const templateHierarchy = this.buildTemplateHierarchy(templates);

        // Add compact mode class
        categoriesEl.classList.add('compact-mode');

        // Generate stats
        const totalTemplates = Object.values(templateHierarchy).reduce((sum, groups) => sum + groups.length, 0);
        const totalPages = templates.length;

        categoriesEl.innerHTML = `
            <div class="template-library-tree">
                <div class="template-library-stats">
                    ${totalTemplates} templates • ${totalPages} pages
                </div>
                ${Object.entries(templateHierarchy).map(([categoryName, templateGroups]) =>
                    Templates.templateCategoryCompact(categoryName, templateGroups, true)
                ).join('')}
            </div>
        `;

        feather.replace();

        // Update search placeholder with template count
        if (window.SearchManager) {
            window.SearchManager.updateSearchPlaceholder(totalPages);
        }
    }

    static buildTemplateHierarchy(templates) {
        const hierarchy = {};

        // Group templates by category and template name
        templates.forEach(template => {
            const category = template.category || 'general';
            const templateName = template.template || 'Untitled Template';

            if (!hierarchy[category]) {
                hierarchy[category] = [];
            }

            // Find existing template group or create new one
            let templateGroup = hierarchy[category].find(group => group.name === templateName);
            if (!templateGroup) {
                templateGroup = {
                    name: templateName,
                    pages: []
                };
                hierarchy[category].push(templateGroup);
            }

            // Add page to template group
            templateGroup.pages.push({
                id: template.id,
                name: template.name,
                pageName: template.name
            });
        });

        return hierarchy;
    }

    static renderProjectList(projects) {
        const projectListEl = document.querySelector(SELECTORS.PROJECT_LIST);
        if (!projectListEl) return;

        if (projects.length === 0) {
            projectListEl.innerHTML = Templates.emptyState(
                'No projects found',
                'Create a new project to get started'
            );
            return;
        }

        projectListEl.innerHTML = projects.map(project =>
            Templates.projectItem(project)
        ).join('');
    }

    static updateProjectHeader() {
        const currentProject = StateManager.getState().currentProject;
        const titleEl = document.querySelector(SELECTORS.DOCUMENT_TITLE);
        const infoEl = document.querySelector(SELECTORS.DOCUMENT_INFO);

        if (!titleEl || !infoEl) return;

        if (currentProject) {
            titleEl.textContent = currentProject.metadata.title;
            infoEl.textContent = `${currentProject.pages.length} pages • ${currentProject.metadata.status} • ${currentProject.metadata.client || 'No client'}`;
        } else {
            titleEl.textContent = 'New Project';
            infoEl.textContent = 'Click "New Project" to get started';
        }
    }

    static updateProjectProperties() {
        const currentProject = StateManager.getState().currentProject;

        if (currentProject) {
            const projectNameEl = document.querySelector(SELECTORS.PROJECT_NAME);
            const projectClientEl = document.querySelector(SELECTORS.PROJECT_CLIENT);
            const projectStatusEl = document.querySelector(SELECTORS.PROJECT_STATUS);

            if (projectNameEl) projectNameEl.value = currentProject.metadata.title;
            if (projectClientEl) projectClientEl.value = currentProject.metadata.client || '';
            if (projectStatusEl) projectStatusEl.value = currentProject.metadata.status;
        }
    }

    static enableProjectControls(enabled = true) {
        const controls = [
            SELECTORS.SAVE_PROJECT_BTN,
            '#previewBtn',
            '#exportBtn',
            SELECTORS.PROJECT_NAME,
            SELECTORS.PROJECT_CLIENT,
            SELECTORS.PROJECT_STATUS
        ];

        controls.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.disabled = !enabled;
            }
        });

        // Show/hide the delete project button
        const deleteBtn = document.querySelector('#deleteProjectBtn');
        if (deleteBtn) {
            deleteBtn.style.display = enabled ? 'flex' : 'none';
        }
    }

    static showProjectWorkspace() {
        const welcomeMessage = document.querySelector('.welcome-message');
        const pageList = document.querySelector(SELECTORS.PAGE_LIST);

        if (welcomeMessage) welcomeMessage.style.display = 'none';
        if (pageList) pageList.style.display = 'block';
    }

    static hideProjectWorkspace() {
        const welcomeMessage = document.querySelector('.welcome-message');
        const pageList = document.querySelector(SELECTORS.PAGE_LIST);

        if (welcomeMessage) welcomeMessage.style.display = 'block';
        if (pageList) pageList.style.display = 'none';
    }

    static updateConnectionStatus(isConnected, message) {
        const statusEl = document.querySelector(SELECTORS.CONNECTION_STATUS);
        if (!statusEl) return;

        statusEl.innerHTML = Templates.connectionStatus(isConnected, message);
        statusEl.className = `${CSS_CLASSES.CONNECTION_STATUS} ${isConnected ? CSS_CLASSES.CONNECTION_CONNECTED : CSS_CLASSES.ERROR}`;

        feather.replace();
    }

    static showLoading(element, message = 'Loading...') {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }

        if (element) {
            element.innerHTML = Templates.loadingSpinner(message);
        }
    }

    static hideLoading(element) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }

        if (element) {
            element.innerHTML = '';
        }
    }

    static populateTemplateDropdown() {
        const dropdown = document.getElementById('newProjectTemplate');
        if (!dropdown) return;

        const templates = StateManager.getState().templates;

        // Clear existing options except the first one
        dropdown.innerHTML = '<option value="">Choose a template...</option>';

        // Add template options
        templates.forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            dropdown.appendChild(option);
        });
    }

    static renderImageLibrary(images) {
        const imageGallery = document.querySelector(SELECTORS.IMAGE_GALLERY);
        if (!imageGallery) return;

        if (images.length === 0) {
            imageGallery.innerHTML = Templates.emptyState(
                'No images found in library',
                'Add images to CSV file'
            );
            return;
        }

        imageGallery.innerHTML = images.slice(0, 20).map(image =>
            Templates.imageThumb(image)
        ).join('');
    }

    static updateSaveButton(isDirty) {
        const saveBtn = document.querySelector(SELECTORS.SAVE_PROJECT_BTN);
        if (!saveBtn) return;

        if (isDirty) {
            saveBtn.innerHTML = '<i data-feather="save"></i> ● Save';
            saveBtn.style.color = 'var(--color-orange)';
        } else {
            saveBtn.innerHTML = '<i data-feather="save"></i> Save';
            saveBtn.style.color = '';
        }
        feather.replace();
    }

    // Drag-and-drop removed in favor of Add buttons

    static populateTemplateDropdown() {
        const templateSelect = document.querySelector('#newProjectTemplate');
        if (!templateSelect) return;

        const templates = StateManager.getState().templates;
        const uniqueTemplates = {};

        templates.forEach(template => {
            if (!uniqueTemplates[template.template]) {
                uniqueTemplates[template.template] = template.metadata;
            }
        });

        templateSelect.innerHTML = '<option value="">Choose a template...</option>' +
            Object.entries(uniqueTemplates).map(([templateName, metadata]) =>
                `<option value="${templateName}">${metadata.name || templateName}</option>`
            ).join('');
    }

    static updatePageCard(pageId) {
        // Smart re-rendering - only update specific page card
        const pageCard = document.querySelector(`[data-page-id="${pageId}"]`);
        if (!pageCard) return;

        const currentProject = StateManager.getState().currentProject;
        const templates = StateManager.getState().templates;

        const page = currentProject.pages.find(p => p.id === pageId);
        const template = templates.find(t => t.id === page.templateId);

        if (page && template) {
            const pageHTML = this.generatePagePreviewHTML(page);
            const pageWithHTML = { ...page, html: pageHTML };
            const pageIndex = currentProject.pages.findIndex(p => p.id === pageId);

            pageCard.outerHTML = Templates.pageCard(pageWithHTML, pageIndex, template.name);

            // Preview iframe is set directly in template HTML

            feather.replace();
        }
    }
}

export default UIManager;