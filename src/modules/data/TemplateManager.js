import StateManager from '../core/StateManager.js';
import EventBus from '../core/EventBus.js';
import ErrorHandler from '../core/ErrorHandler.js';
import { EVENTS } from '../ui/constants.js';

class TemplateManager {
    static async loadTemplates() {
        try {
            const templates = await window.electronAPI.loadTemplates();

            StateManager.setState({ templates });
            EventBus.emit(EVENTS.TEMPLATES_LOADED, templates);

            return templates;
        } catch (error) {
            ErrorHandler.logError(error, 'TemplateManager.loadTemplates', 'Failed to load templates. Please check OneDrive connection.');
            throw error;
        }
    }

    static getTemplates() {
        return StateManager.getState().templates;
    }

    static getTemplateById(id) {
        const templates = StateManager.getState().templates;
        return templates.find(template => template.id === id);
    }

    static getTemplatesByCategory(category) {
        const templates = StateManager.getState().templates;
        return templates.filter(template => template.category === category);
    }

    static getTemplateCategories() {
        const templates = StateManager.getState().templates;
        const categories = {};

        templates.forEach(template => {
            const category = template.category || 'general';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(template);
        });

        return categories;
    }

    static getTemplatesByTemplateName(templateName) {
        const templates = StateManager.getState().templates;
        return templates.filter(template => template.template === templateName);
    }

    static getUniqueTemplates() {
        const templates = StateManager.getState().templates;
        const uniqueTemplates = {};

        templates.forEach(template => {
            if (!uniqueTemplates[template.template]) {
                uniqueTemplates[template.template] = template.metadata;
            }
        });

        return uniqueTemplates;
    }

    static getTemplateMetadata(id) {
        const template = this.getTemplateById(id);
        return template ? template.metadata : null;
    }

    static validateTemplate(template) {
        return template &&
               template.id &&
               template.name &&
               template.content &&
               template.template;
    }

    static addPageToProject(templateId) {
        console.log(`🎯 addPageToProject called with templateId: "${templateId}"`);

        const template = this.getTemplateById(templateId);
        console.log(`🔍 Found template:`, template);

        if (!template) {
            console.error(`❌ Template not found for ID: "${templateId}"`);

            // Debug: Show available template IDs
            const allTemplates = StateManager.getState().templates;
            console.log(`📋 Available template IDs:`, allTemplates.map(t => t.id));
            console.log(`📋 Available templates:`, allTemplates.map(t => ({ id: t.id, name: t.name, template: t.template })));

            ErrorHandler.showUserError('Template not found', 'error');
            return null;
        }

        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) {
            ErrorHandler.showUserError('Please create a project first', 'error');
            return null;
        }

        const pageId = `page-${Date.now()}`;
        const page = {
            id: pageId,
            templateId: templateId,
            template: template.template,
            filename: template.filename,
            position: currentProject.pages.length + 1,
            edits: {}
        };

        // Add template copy if not already exists
        console.log(`🔍 Checking template copy for templateId: "${templateId}"`);
        console.log(`🔍 Current template copies keys:`, Object.keys(currentProject.templateCopies));
        console.log(`🔍 Template data:`, { id: template.id, name: template.name, template: template.template });

        if (!currentProject.templateCopies[templateId]) {
            currentProject.templateCopies[templateId] = {
                originalSource: template.content,
                modifiedHtml: template.content,
                metadata: template.metadata
            };
            console.log(`✅ Created template copy for "${templateId}" (${template.name})`);
        } else {
            console.log(`♻️ Template copy already exists for "${templateId}"`);
        }

        // Add the page to the project's pages array
        currentProject.pages.push(page);
        console.log(`📋 Added page to project. Total pages: ${currentProject.pages.length}`);

        // Update state with both the new page and template copies
        StateManager.setState({
            currentProject: currentProject, // Use the modified project object
            isDirty: true
        });

        EventBus.emit(EVENTS.PAGE_ADDED, { page, template });
        ErrorHandler.showSuccess(`Added "${template.name}" to project`);

        return page;
    }

    static setupTemplateDragAndDrop() {
        const templateItems = document.querySelectorAll('.template-item');

        templateItems.forEach(item => {
            // Remove existing listeners to prevent duplicates
            item.removeEventListener('dragstart', this._handleDragStart);
            item.removeEventListener('dragend', this._handleDragEnd);

            // Add new listeners (click is now handled by EventManager)
            item.addEventListener('dragstart', this._handleDragStart);
            item.addEventListener('dragend', this._handleDragEnd);
        });
    }

    static _handleDragStart(e) {
        const templateId = e.target.dataset.templateId;
        e.dataTransfer.setData('text/plain', templateId);
        e.target.classList.add('dragging');

        StateManager.setUIState({ draggedTemplateId: templateId });
    }

    static _handleDragEnd(e) {
        e.target.classList.remove('dragging');
        StateManager.setUIState({ draggedTemplateId: null });
    }

    static _handleTemplateClick(e) {
        const templateId = e.target.dataset.templateId;
        if (templateId) {
            TemplateManager.addPageToProject(templateId);
        }
    }

    // setupDropZone removed - UIManager handles all drop zones to avoid duplicates

    static isTemplateLoaded(templateId) {
        return !!this.getTemplateById(templateId);
    }

    static getTemplateCount() {
        return StateManager.getState().templates.length;
    }

    static getCategoryCount() {
        return Object.keys(this.getTemplateCategories()).length;
    }

    static repairMissingTemplateCopies() {
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) {
            console.log('⚠️ No current project to repair');
            return;
        }

        console.log('🔧 Starting template copy repair for project:', currentProject.metadata.title);
        console.log('🔧 Project has', currentProject.pages?.length || 0, 'pages');
        console.log('🔧 Project has', Object.keys(currentProject.templateCopies || {}).length, 'template copies');

        let repairCount = 0;
        currentProject.pages.forEach(page => {
            if (!currentProject.templateCopies[page.templateId]) {
                console.log(`🔍 Missing template copy for page ${page.id} with templateId: "${page.templateId}"`);

                // Try to find the template by exact ID match
                let template = this.getTemplateById(page.templateId);

                if (!template) {
                    // If not found, try to find by filename (older format)
                    const templates = StateManager.getState().templates;
                    template = templates.find(t =>
                        t.filename === page.filename ||
                        t.id.includes(page.templateId) ||
                        page.templateId.includes(t.id)
                    );
                }

                if (template) {
                    currentProject.templateCopies[page.templateId] = {
                        originalSource: template.content,
                        modifiedHtml: template.content,
                        metadata: template.metadata
                    };
                    console.log(`✅ Repaired template copy for "${page.templateId}" using template "${template.name}"`);
                    repairCount++;
                } else {
                    console.warn(`❌ Could not find matching template for page ${page.id} with templateId: "${page.templateId}"`);
                    console.log(`Available template IDs:`, StateManager.getState().templates.map(t => t.id));
                }
            }
        });

        if (repairCount > 0) {
            StateManager.setState({ currentProject, isDirty: true });
            console.log(`✅ Repaired ${repairCount} missing template copies`);
            EventBus.emit(EVENTS.PROJECT_DIRTY, true);
            EventBus.emit(EVENTS.UI_UPDATE, { type: 'template-copies-repaired' });
        } else {
            console.log('✅ No template copies needed repair');
        }
    }
}

export default TemplateManager;