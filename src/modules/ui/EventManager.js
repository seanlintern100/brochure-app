import EventBus from '../core/EventBus.js';
import ErrorHandler from '../core/ErrorHandler.js';
import StateManager from '../core/StateManager.js';
import PageManager from '../data/PageManager.js';
import TemplateManager from '../data/TemplateManager.js';
import ProjectManager from '../data/ProjectManager.js';
import ModalManager from './ModalManager.js';
import UploadModalManager from '../upload/UploadModalManager.js';
import OverlayManager from '../editing/OverlayManager.js';
import TextEditor from '../editing/TextEditor.js';
import ImageReplacer from '../editing/ImageReplacer.js';
import ContainerEditor from '../editing/ContainerEditor.js';
import SectionEditor from '../editing/SectionEditor.js';
import UnifiedPageRenderer from '../rendering/UnifiedPageRenderer.js';
import { ACTIONS, EVENTS } from './constants.js';

class EventManager {
    static init() {
        console.log('EventManager.init() called');
        this.setupEventDelegation();
        this.setupEventBusListeners();

        // Initialize the new editing system
        OverlayManager.init();
        TextEditor.init();
        ImageReplacer.init();
        ContainerEditor.init();
        SectionEditor.init();

        console.log('EventManager.init() completed');
    }

    static setupEventDelegation() {
        console.log('Setting up event delegation...');
        // Main click event delegation
        document.addEventListener('click', this.handleClick.bind(this));
        document.addEventListener('change', this.handleChange.bind(this));
        document.addEventListener('input', this.handleInput.bind(this));
        document.addEventListener('submit', this.handleSubmit.bind(this));
        console.log('Event delegation setup complete');
    }

    static setupEventBusListeners() {
        // Listen to state changes and update UI accordingly
        EventBus.on(EVENTS.PROJECT_CREATED, this.handleProjectCreated.bind(this));
        EventBus.on(EVENTS.PROJECT_LOADED, this.handleProjectLoaded.bind(this));
        EventBus.on(EVENTS.PROJECT_SAVED, this.handleProjectSaved.bind(this));
        EventBus.on(EVENTS.PROJECT_DIRTY, this.handleProjectDirty.bind(this));
        EventBus.on(EVENTS.PAGE_ADDED, this.handlePageAdded.bind(this));
        EventBus.on(EVENTS.PAGE_REMOVED, this.handlePageRemoved.bind(this));
        EventBus.on(EVENTS.PAGE_MOVED, this.handlePageMoved.bind(this));
        EventBus.on(EVENTS.TEMPLATE_SELECTED, this.handleTemplateSelected.bind(this));
        EventBus.on(EVENTS.TEMPLATES_LOADED, this.handleTemplatesLoaded.bind(this));
        EventBus.on(EVENTS.TEMPLATES_REFRESH_NEEDED, this.handleTemplatesRefreshNeeded.bind(this));
    }

    static async handleClick(event) {
        // Look for action on clicked element or walk up the DOM tree
        let element = event.target;
        let action = element.dataset.action;

        // If no action found, check parent elements up to 3 levels
        let attempts = 0;
        while (!action && element.parentElement && attempts < 3) {
            element = element.parentElement;
            action = element.dataset.action;
            attempts++;
        }
        if (!action) {
            return;
        }

        const cleanAction = action.trim();

        // Prevent default for button actions
        if (event.target.tagName === 'BUTTON') {
            event.preventDefault();
        }

        const handlers = {
            [ACTIONS.MOVE_PAGE_UP]: () => this.handleMovePageUp(event, element),
            [ACTIONS.MOVE_PAGE_DOWN]: () => this.handleMovePageDown(event, element),
            [ACTIONS.DUPLICATE_PAGE]: () => this.handleDuplicatePage(event, element),
            [ACTIONS.DELETE_PAGE]: () => this.handleDeletePage(event, element),
            [ACTIONS.ZOOM_PAGE]: () => this.handleZoomPage(event, element),
            [ACTIONS.OPEN_PROJECT]: () => this.handleOpenProject(event, element),
            [ACTIONS.TOGGLE_CATEGORY]: () => this.handleToggleCategory(event, element),
            [ACTIONS.TOGGLE_TEMPLATE]: () => this.handleToggleTemplate(event, element),
            [ACTIONS.ADD_FULL_TEMPLATE]: () => this.handleAddFullTemplate(event, element),
            [ACTIONS.SHOW_ADD_PAGE]: () => this.handleShowAddPage(event, element),
            'new-project': () => this.handleNewProject(event, element),
            'save-project': () => this.handleSaveProject(event, element),
            'export-project': () => this.handleExportProject(event, element),
            'confirm-export': () => this.confirmExport(),
            'open-project-dialog': () => this.handleOpenProjectDialog(event, element),
            'open-project': () => this.handleOpenProject(event, element),
            'delete-project': () => this.handleDeleteProject(event, element),
            'delete-current-project': () => this.handleDeleteCurrentProject(event, element),
            'close-modal': () => this.handleCloseModal(event, element),
            'submit-new-project': () => this.handleSubmitNewProject(event, element),
            'cancel-new-project': () => this.handleCancelNewProject(event, element),
            'save-zoom-changes': () => this.handleSaveZoomChanges(event, element),
            'export-page': () => this.handleExportPage(event, element),
            'select-template': () => this.handleSelectTemplate(event, element),
            'add-template-page': () => this.handleAddTemplatePage(event, element),
            [ACTIONS.OPEN_UPLOAD_MODAL]: () => this.handleOpenUploadModal(event, element),
            [ACTIONS.START_UPLOAD]: () => this.handleStartUpload(event, element),
            'toggle-sidebar-section': () => this.handleToggleSidebarSection(event, element),
            'set-selection-mode': () => this.handleSetSelectionMode(event, element),
            'close-element-editor': () => this.handleCloseElementEditor(event, element),
            // New editing actions
            'move-image': () => this.handleMoveImage(event, element),
            'resize-image': () => this.handleResizeImage(event, element),
            'reset-image': () => this.handleResetImage(event, element),
            'move-container': () => this.handleMoveContainer(event, element),
            'resize-container': () => this.handleResizeContainer(event, element),
            'reset-container': () => this.handleResetContainer(event, element),
            'extend-section': () => this.handleExtendSection(event, element),
            'shrink-section': () => this.handleShrinkSection(event, element),
            'reset-section-height': () => this.handleResetSectionHeight(event, element)
        };

        console.log('Available handlers:', Object.keys(handlers));
        const handler = handlers[cleanAction];
        console.log('Looking for handler for action:', cleanAction, 'Found handler:', !!handler);

        if (handler) {
            console.log('Executing handler for action:', cleanAction);
            try {
                await handler();
                console.log('Handler completed successfully for action:', cleanAction);
            } catch (error) {
                console.error('Handler failed for action:', cleanAction, error);
                ErrorHandler.logError(error, `EventManager.handleClick.${cleanAction}`, `Action "${cleanAction}" failed`);
                ErrorHandler.showUserError(`Operation failed: ${error.message}`, 'error');
            }
        }
    }

    static handleChange(event) {
        const element = event.target;

        // Handle project metadata changes
        if (element.id === 'projectName') {
            ProjectManager.updateProjectMetadata({ title: element.value });
        } else if (element.id === 'projectClient') {
            ProjectManager.updateProjectMetadata({ client: element.value });
        } else if (element.id === 'projectStatus') {
            ProjectManager.updateProjectMetadata({ status: element.value });
        }
    }

    static handleInput(event) {
        // Debounced input handling for real-time updates
        const element = event.target;

        if (element.id === 'projectName' || element.id === 'projectClient') {
            clearTimeout(this.inputTimeout);
            this.inputTimeout = setTimeout(() => {
                this.handleChange(event);
            }, 300);
        }
    }

    static handleSubmit(event) {
        if (event.target.id === 'newProjectForm') {
            event.preventDefault();
            this.handleSubmitNewProject(event);
        }
    }

    // Specific action handlers
    static handleMovePageUp(event, element) {
        const pageId = element ? element.dataset.pageId : event.target.dataset.pageId;
        if (pageId) {
            PageManager.movePageUp(pageId);
        }
    }

    static handleMovePageDown(event, element) {
        const pageId = element ? element.dataset.pageId : event.target.dataset.pageId;
        if (pageId) {
            PageManager.movePageDown(pageId);
        }
    }

    static handleDuplicatePage(event, element) {
        const pageId = element ? element.dataset.pageId : event.target.dataset.pageId;
        if (pageId) {
            PageManager.duplicatePage(pageId);
        }
    }

    static handleDeletePage(event, element) {
        const pageId = element ? element.dataset.pageId : event.target.dataset.pageId;
        if (pageId) {
            PageManager.deletePage(pageId);
        }
    }

    static handleZoomPage(event, element) {
        const pageId = element ? element.dataset.pageId : event.target.dataset.pageId;
        if (pageId) {
            EventBus.emit(EVENTS.MODAL_OPENED, { modalId: 'pageZoomModal', data: { pageId } });
        }
    }

    static handleOpenProject(event, element) {
        console.log('handleOpenProject called', event, element);
        const filename = element ? element.dataset.filename : event.target.dataset.filename;
        console.log('Filename:', filename);
        if (filename) {
            console.log('Loading project:', filename);
            ProjectManager.loadProject(filename);
        }
    }

    static async handleDeleteProject(event, element) {
        const filename = element ? element.dataset.filename : event.target.dataset.filename;
        if (!filename) return;

        // Simple confirmation dialog
        const confirmed = confirm(`Are you sure you want to delete "${filename}"?\n\nThis action cannot be undone.`);
        if (!confirmed) return;

        try {
            const result = await window.electronAPI.deleteProject(filename);

            if (result.success) {
                ErrorHandler.showSuccess('Project deleted successfully');

                // Refresh the project grid
                const modalManager = await import('./ModalManager.js');
                modalManager.default.prepareOpenProjectModal();
            } else {
                ErrorHandler.showUserError(`Failed to delete project: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting project:', error);
            ErrorHandler.showUserError('Failed to delete project', 'error');
        }
    }

    static async handleDeleteCurrentProject(event, element) {
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) {
            ErrorHandler.showUserError('No project to delete', 'error');
            return;
        }

        const projectTitle = currentProject.metadata.title;
        const confirmed = confirm(`Are you sure you want to delete "${projectTitle}"?\n\nThis action cannot be undone.`);
        if (!confirmed) return;

        try {
            // Get the filename from the current project
            const filename = currentProject.filename || `${projectTitle.replace(/[^a-zA-Z0-9-_\s]/g, '')}.3bt`;
            const result = await window.electronAPI.deleteProject(filename);

            if (result.success) {
                ErrorHandler.showSuccess('Project deleted successfully');

                // Reset current project and return to welcome screen
                ProjectManager.resetCurrentProject();
            } else {
                ErrorHandler.showUserError(`Failed to delete project: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('Error deleting current project:', error);
            ErrorHandler.showUserError('Failed to delete project', 'error');
        }
    }

    static handleToggleCategory(event) {
        const categoryElement = event.target.closest('.template-category-compact');
        if (categoryElement) {
            const templateGroups = categoryElement.querySelector('.template-groups');
            const chevron = categoryElement.querySelector('.category-chevron');

            if (templateGroups && chevron) {
                const isVisible = templateGroups.style.display !== 'none';
                templateGroups.style.display = isVisible ? 'none' : 'block';
                chevron.setAttribute('data-feather', isVisible ? 'chevron-right' : 'chevron-down');
                feather.replace();
            }
        }
    }

    static handleToggleTemplate(event) {
        const templateElement = event.target.closest('.template-group-compact');
        if (templateElement) {
            const templatePages = templateElement.querySelector('.template-pages');
            const chevron = templateElement.querySelector('.template-chevron');

            if (templatePages && chevron) {
                const isVisible = templatePages.style.display !== 'none';
                templatePages.style.display = isVisible ? 'none' : 'block';
                chevron.setAttribute('data-feather', isVisible ? 'chevron-right' : 'chevron-down');
                feather.replace();
            }
        }
    }

    static handleAddFullTemplate(event, element) {
        const templateName = element ? element.dataset.template : event.target.dataset.template;
        if (templateName) {
            const currentProject = StateManager.getState().currentProject;
            if (!currentProject) {
                ErrorHandler.showUserError('Please create or open a project first', 'error');
                return;
            }

            const templates = StateManager.getState().templates;
            const templatePages = templates.filter(t => t.template === templateName);

            if (templatePages.length === 0) {
                ErrorHandler.showUserError('No pages found for this template', 'error');
                return;
            }

            templatePages.forEach(template => {
                TemplateManager.addPageToProject(template.id);
            });

            ErrorHandler.showSuccess(`Added all ${templatePages.length} pages from "${templateName}" template`);
        }
    }

    static handleShowAddPage(event, element) {
        // Check if project exists first
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) {
            ErrorHandler.showUserError('Please create or open a project first', 'error');
            return;
        }

        // For now, just show help message directing users to sidebar
        ErrorHandler.showInfo('Select a template from the sidebar on the left to add to your project. You can click on any template or drag it to add a page.');
    }

    static handleSelectTemplate(event, element) {
        const templateId = element ? element.dataset.templateId : event.target.dataset.templateId;
        if (templateId) {
            const currentProject = StateManager.getState().currentProject;
            if (!currentProject) {
                ErrorHandler.showUserError('Please create or open a project first', 'error');
                return;
            }

            TemplateManager.addPageToProject(templateId);

            // Get template name for user feedback
            const templates = StateManager.getState().templates;
            const template = templates.find(t => t.id === templateId);
            const templateName = template ? template.name : 'Template';
            ErrorHandler.showSuccess(`Added "${templateName}" page to project`);
        }
    }

    static handleAddTemplatePage(event, element) {
        const templateId = element ? element.dataset.templateId : event.target.dataset.templateId;
        console.log('🎯 handleAddTemplatePage called, templateId:', templateId);
        console.log('🎯 Element:', element);
        console.log('🎯 Element dataset:', element?.dataset);
        console.log('🎯 Event target:', event.target);
        console.log('🎯 Event target dataset:', event.target.dataset);
        console.log('🎯 Event target closest button:', event.target.closest('button')?.dataset);

        if (templateId) {
            const currentProject = StateManager.getState().currentProject;
            if (!currentProject) {
                ErrorHandler.showUserError('Please create or open a project first', 'error');
                return;
            }

            console.log('📋 Current project exists, calling TemplateManager.addPageToProject');
            TemplateManager.addPageToProject(templateId);

            // Get template name for user feedback
            const templates = StateManager.getState().templates;
            const template = templates.find(t => t.id === templateId);
            const templateName = template ? template.name : 'Template';
            ErrorHandler.showSuccess(`Added "${templateName}" page to project`);
        } else {
            console.log('❌ No templateId found');
        }
    }

    static handleTemplateSelected(templateId) {
        TemplateManager.addPageToProject(templateId);
    }

    static handleNewProject(event) {
        console.log('handleNewProject called - emitting MODAL_OPENED event');
        EventBus.emit(EVENTS.MODAL_OPENED, { modalId: 'newProjectModal' });
        console.log('MODAL_OPENED event emitted for newProjectModal');
    }

    static handleSaveProject(event) {
        ProjectManager.saveProject();
    }


    static handleOpenProjectDialog(event) {
        console.log('Opening project dialog...');
        EventBus.emit(EVENTS.MODAL_OPENED, { modalId: 'openProjectModal' });
    }

    static handleCloseModal(event) {
        const modal = event.target.closest('.modal');
        if (modal) {
            // Restore original content if this is the pageZoomModal and it was hijacked by export preview
            if (modal.id === 'pageZoomModal' && window.originalModalContent) {
                this.restoreOriginalModalContent();
            }
            EventBus.emit(EVENTS.MODAL_CLOSED, { modalId: modal.id });
        }
    }

    static restoreOriginalModalContent() {
        console.log('🔄 Restoring original modal content...', {
            hasOriginalContent: !!window.originalModalContent,
            originalContentLength: window.originalModalContent?.length
        });

        if (window.originalModalContent) {
            const modal = document.getElementById('pageZoomModal');
            const modalContent = modal.querySelector('.modal-content');

            console.log('🔄 Modal state before restore:', {
                modalExists: !!modal,
                modalContentExists: !!modalContent,
                currentContentLength: modalContent?.innerHTML?.length
            });

            modalContent.innerHTML = window.originalModalContent;

            // Clear the stored content so it doesn't interfere later
            window.originalModalContent = null;

            // Ensure modal is completely reset to default state
            modal.classList.remove('active');
            modal.style.display = '';
            modal.style.removeProperty('display'); // Remove any lingering inline display property

            // Re-initialize feather icons
            if (typeof feather !== 'undefined') {
                feather.replace();
            }

            console.log('✅ Original modal content restored');
        } else {
            console.log('⚠️ No original modal content to restore');
        }
    }

    static handleSubmitNewProject(event) {
        const form = event.target.closest('form');
        if (!form) {
            console.error('No form found for submit action');
            return;
        }
        const formData = new FormData(form);

        const metadata = {
            title: formData.get('projectName')?.trim(),
            client: formData.get('projectClient')?.trim(),
            baseTemplate: formData.get('projectTemplate')
        };

        if (!metadata.title) {
            ErrorHandler.showUserError('Project name is required', 'error');
            return;
        }

        if (!metadata.baseTemplate) {
            ErrorHandler.showUserError('Please select a proposal template', 'error');
            return;
        }

        ProjectManager.createProject(metadata, TemplateManager);
        EventBus.emit(EVENTS.MODAL_CLOSED, { modalId: 'newProjectModal' });
    }

    static handleCancelNewProject(event) {
        EventBus.emit(EVENTS.MODAL_CLOSED, { modalId: 'newProjectModal' });
    }

    static async handleExportProject(event, element) {
        console.log('🚀 Export preview handler started');
        try {
            const currentProject = StateManager.getState().currentProject;

            if (!currentProject) {
                ErrorHandler.showUserError('No project to export', 'error');
                return;
            }

            console.log('📄 Generating consolidated HTML for preview...');
            const consolidatedHTML = ProjectManager.generateConsolidatedHTML();
            console.log('📄 HTML generated, length:', consolidatedHTML.length);

            // Show export preview modal
            this.showExportPreview(consolidatedHTML, currentProject.metadata.title);

        } catch (error) {
            console.error('💥 Export preview error:', error);
            ErrorHandler.logError(error, 'EventManager.handleExportProject', 'Export preview failed');
            ErrorHandler.showUserError('Failed to generate export preview: ' + error.message, 'error');
        }
    }

    static showExportPreview(html, projectTitle) {
        const modal = document.getElementById('pageZoomModal');
        const modalContent = modal.querySelector('.modal-content');

        // Store the original modal content so we can restore it later
        if (!window.originalModalContent) {
            window.originalModalContent = modalContent.innerHTML;
        }

        // Store HTML for later export
        window.exportPreviewData = { html, projectTitle };

        modalContent.innerHTML = `
            <div class="export-preview-modal">
                <div class="export-preview-header">
                    <h2>
                        <i data-feather="eye"></i>
                        Export Preview - ${projectTitle}
                    </h2>
                    <button class="modal-close" data-action="close-modal">
                        <i data-feather="x"></i>
                    </button>
                </div>

                <div class="export-preview-content">
                    <div class="preview-controls">
                        <p class="preview-description">
                            Review your document before exporting to PDF. This preview shows exactly how your PDF will look.
                        </p>
                        <div class="preview-buttons">
                            <button class="btn btn-secondary" data-action="close-modal">
                                <i data-feather="x"></i> Cancel
                            </button>
                            <button class="btn btn-primary" data-action="confirm-export">
                                <i data-feather="download"></i> Export to PDF
                            </button>
                        </div>
                    </div>

                    <div class="preview-document">
                        <iframe id="exportPreviewFrame"
                                src="about:blank"
                                style="width: 100%; height: 70vh; border: 1px solid var(--color-cool-gray); border-radius: 6px; background: white;">
                        </iframe>
                    </div>
                </div>
            </div>
        `;

        // Show modal using the standard ModalManager approach
        modal.classList.add('active');

        // Load HTML into iframe after modal is visible
        setTimeout(() => {
            try {
                const iframe = document.getElementById('exportPreviewFrame');
                if (!iframe) {
                    console.error('❌ Preview iframe not found');
                    return;
                }

                console.log('📄 Loading HTML into preview iframe...');
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

                if (!iframeDoc) {
                    console.error('❌ Cannot access iframe document');
                    return;
                }

                iframeDoc.open();
                iframeDoc.write(html);
                iframeDoc.close();
                console.log('✅ Export preview loaded successfully');

            } catch (error) {
                console.error('❌ Failed to load preview:', error);
                ErrorHandler.showUserError('Failed to load preview: ' + error.message, 'error');
            }
        }, 100);

        // Initialize Feather icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    static async confirmExport() {
        try {
            if (!window.exportPreviewData) {
                throw new Error('No export data available');
            }

            const { html, projectTitle } = window.exportPreviewData;

            // Close modal first and restore original content
            this.restoreOriginalModalContent();
            EventBus.emit(EVENTS.MODAL_CLOSED, { modalId: 'pageZoomModal' });

            // Show loading state
            ErrorHandler.showInfo('🔄 Generating PDF...');

            console.log('🔄 Calling exportPDF after preview confirmation...');
            const result = await window.electronAPI.exportPDF(html, projectTitle);

            if (!result.success) {
                throw new Error(result.error || 'Failed to export PDF');
            }

            console.log('✅ Export successful after preview');
            const filename = result.filename || result.path.split('/').pop();
            const directory = result.directory || result.path.replace(/\/[^\/]+$/, '');

            // Extract just the folder name from the full path for cleaner display
            const folderName = directory.split('/').pop() || 'Exports';

            // Show user-friendly success modal
            const message = `
                <div style="text-align: left;">
                    <p style="margin: 0 0 var(--space-2) 0;"><strong>File:</strong> ${filename}</p>
                    <p style="margin: 0; color: var(--color-warm-gray-text);">
                        <strong>Location:</strong> .../${folderName}/
                    </p>
                </div>
            `;

            const actionButton = `
                <button class="btn btn-secondary" onclick="window.electronAPI.showInFinder('${result.path}')">
                    <i data-feather="folder"></i>
                    Show in Finder
                </button>
            `;

            ErrorHandler.showSuccessModal('PDF Export Complete', message, actionButton);

            // Clear stored data
            delete window.exportPreviewData;

        } catch (error) {
            console.error('💥 Export confirmation error:', error);
            ErrorHandler.logError(error, 'EventManager.confirmExport', 'Export failed');
            ErrorHandler.showUserError('Failed to export project: ' + error.message, 'error');
        }
    }

    static async handleSaveZoomChanges(event, element) {
        try {
            if (!ModalManager.currentZoomPage) {
                throw new Error('No page to save');
            }

            const pageId = ModalManager.currentZoomPage.id;

            // Save overlay data instead of extracting broken HTML
            const overlayData = OverlayManager.getAllOverlays();

            console.log('💾 Saving overlay data for page:', pageId, overlayData[pageId]);

            // Update the project with overlay data
            const currentProject = StateManager.getState().currentProject;
            if (currentProject) {
                // Initialize overlayData if it doesn't exist
                if (!currentProject.overlayData) {
                    currentProject.overlayData = {};
                }

                // Store overlay data for all pages
                currentProject.overlayData = overlayData;

                // Mark project as dirty and update state
                StateManager.setState({
                    currentProject: currentProject,
                    isDirty: true
                });

                // Emit events to update UI
                EventBus.emit(EVENTS.PROJECT_DIRTY, true);
                EventBus.emit(EVENTS.PAGE_UPDATED, {
                    pageId: pageId,
                    overlayData: overlayData[pageId]
                });

                // Save project to disk immediately (don't wait for AutoSave)
                await ProjectManager.saveProject(currentProject);
                console.log('💾 Successfully saved overlay data to disk');
            }

            // Close modal and show success
            EventBus.emit(EVENTS.MODAL_CLOSED, { modalId: 'pageZoomModal' });
            ErrorHandler.showSuccess('Page changes saved successfully');

        } catch (error) {
            ErrorHandler.logError(error, 'EventManager.handleSaveZoomChanges', 'Save zoom changes failed');
            ErrorHandler.showUserError('Failed to save changes: ' + error.message, 'error');
        }
    }

    static async handleExportPage(event, element) {
        try {
            // Get current project and page for export
            const currentProject = ProjectManager.getCurrentProject();
            const currentPage = ModalManager.currentZoomPage;

            if (!currentProject || !currentPage) {
                throw new Error('No page content to export');
            }

            // Generate page HTML with current overlays applied
            const modifiedHTML = UnifiedPageRenderer.generatePageWithOverlays(
                currentPage,
                currentProject
            );

            // Get page information
            const pageName = currentPage.templateId || `page-${Date.now()}`;

            // Create metadata for the template
            const metadata = {
                name: `${pageName} (Edited)`,
                category: "custom",
                version: "1.0",
                created: new Date().toISOString().split('T')[0],
                description: `Exported from project on ${new Date().toLocaleDateString()}`,
                pages: [pageName],
                locked: false
            };

            // Show loading state
            ErrorHandler.showInfo('📄 Exporting page as template...');

            console.log('🔄 Calling exportPageAsTemplate...');
            const result = await window.electronAPI.exportPageAsTemplate({
                pageName,
                html: modifiedHTML,
                metadata
            });

            if (!result.success) {
                throw new Error(result.error || 'Failed to export page');
            }

            console.log('✅ Page export successful');

            // Show success modal
            const message = `
                <div style="text-align: left;">
                    <p style="margin: 0 0 var(--space-2) 0;"><strong>Template:</strong> ${metadata.name}</p>
                    <p style="margin: 0; color: var(--color-warm-gray-text);">
                        <strong>Location:</strong> ~/OneDrive/Exports/Templates/${pageName}/
                    </p>
                </div>
            `;

            const actionButton = result.path ? `
                <button class="btn btn-secondary" onclick="window.electronAPI.showInFinder('${result.path}')">
                    <i data-feather="folder"></i>
                    Show in Finder
                </button>
            ` : '';

            ErrorHandler.showSuccessModal('Page Exported as Template', message, actionButton);

        } catch (error) {
            console.error('💥 Page export error:', error);
            ErrorHandler.logError(error, 'EventManager.handleExportPage', 'Page export failed');
            ErrorHandler.showUserError('Failed to export page: ' + error.message, 'error');
        }
    }

    static captureElementTransforms(pageContainer, pageId) {
        const transforms = {
            images: {},
            sections: {}
        };

        try {
            // Capture image transforms
            const images = pageContainer.querySelectorAll('[data-editable="image"] img');
            images.forEach(img => {
                const container = img.closest('[data-editable="image"]');
                const elementId = container?.dataset.elementId;

                if (elementId) {
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

            console.log('🔍 Captured element transforms:', transforms);
            return transforms;

        } catch (error) {
            console.warn('⚠️ Error capturing element transforms:', error);
            return transforms; // Return partial results even if error occurred
        }
    }

    // EventBus listeners
    static handleProjectCreated(project) {
        EventBus.emit(EVENTS.UI_UPDATE, { type: 'project-created', data: project });
        // Close the new project modal
        EventBus.emit(EVENTS.MODAL_CLOSED, { modalId: 'newProjectModal' });
    }

    static handleProjectLoaded(project) {
        EventBus.emit(EVENTS.UI_UPDATE, { type: 'project-loaded', data: project });
        // Close the open project modal
        EventBus.emit(EVENTS.MODAL_CLOSED, { modalId: 'openProjectModal' });
    }

    static handleProjectSaved(data) {
        EventBus.emit(EVENTS.UI_UPDATE, { type: 'project-saved', data });
    }

    static handleProjectDirty(isDirty) {
        EventBus.emit(EVENTS.UI_UPDATE, { type: 'project-dirty', data: { isDirty } });
    }

    static handlePageAdded(data) {
        EventBus.emit(EVENTS.UI_UPDATE, { type: 'page-added', data });
    }

    static handlePageRemoved(data) {
        EventBus.emit(EVENTS.UI_UPDATE, { type: 'page-removed', data });
    }

    static handlePageMoved(data) {
        EventBus.emit(EVENTS.UI_UPDATE, { type: 'page-moved', data });
    }

    static handleTemplatesLoaded(templates) {
        EventBus.emit(EVENTS.UI_UPDATE, { type: 'templates-loaded', data: templates });
    }

    static cleanup() {
        console.log('EventManager.cleanup() called');
        // Remove event listeners
        document.removeEventListener('click', this.handleClick);
        document.removeEventListener('change', this.handleChange);
        document.removeEventListener('input', this.handleInput);
        document.removeEventListener('submit', this.handleSubmit);
        console.log('EventManager.cleanup() completed');

        // Clear EventBus listeners
        EventBus.clear();
    }

    static handleOpenUploadModal(event, element) {
        console.log('Opening upload modal');
        EventBus.emit(EVENTS.UPLOAD_MODAL_OPEN);
    }

    static async handleStartUpload(event, element) {
        console.log('Starting upload from EventManager');
        try {
            await UploadModalManager.startUpload();
        } catch (error) {
            console.error('Upload failed:', error);
            ErrorHandler.logError(error, 'EventManager.handleStartUpload');
            ErrorHandler.showUserError(`Upload failed: ${error.message}`, 'error');
        }
    }

    static async handleTemplatesRefreshNeeded() {
        try {
            console.log('Refreshing templates after upload');
            await TemplateManager.loadTemplates();
            ErrorHandler.showInfo('Template library refreshed');
        } catch (error) {
            ErrorHandler.logError(error, 'EventManager.handleTemplatesRefreshNeeded');
            ErrorHandler.showUserError('Failed to refresh template library', 'error');
        }
    }

    static handleToggleSidebarSection(event, element) {
        const sectionId = element.dataset.sectionId;
        if (!sectionId) return;

        EventBus.emit(EVENTS.SIDEBAR_TOGGLE_SECTION, { sectionId });
    }

    static handleSetSelectionMode(event, element) {
        const mode = element.dataset.mode;
        if (!mode) return;

        console.log('🎯 Setting selection mode to:', mode);

        // Update button states
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        element.classList.add('active');

        // Update hint text
        const hintElement = document.getElementById('modeHint');
        if (hintElement) {
            const hintTexts = {
                'text': 'Click highlighted text elements to edit them',
                'images': 'Click highlighted images to edit, move, or zoom them',
                'containers': 'Click highlighted containers to resize, move, or modify layout'
            };
            hintElement.textContent = hintTexts[mode] || 'Click highlighted elements to edit them';
        }

        // Emit mode change event for all editors to listen
        EventBus.emit(EVENTS.SET_SELECTION_MODE, { mode });

        // Also notify TextEditor directly for backward compatibility
        if (mode === 'text' || mode === 'images') {
            TextEditor.setMode(mode);
        } else if (mode === 'containers') {
            TextEditor.setMode(mode); // Let TextEditor know to stop handling clicks
        }

        // If ElementEditor exists, notify it too
        if (window.ElementEditor) {
            window.ElementEditor.setSelectionMode(mode);
        }
    }

    /**
     * Extract clean HTML from pageContainer, handling nested HTML documents properly
     * This preserves the self-contained approach while preventing HTML corruption
     */
    static extractCleanHTML(pageContainer) {
        console.log('💾 DEBUG: Extracting clean HTML - preserving template content separation');
        console.log('💾 DEBUG: pageContainer HTML structure:', pageContainer.innerHTML.substring(0, 500) + '...');
        console.log('💾 DEBUG: pageContainer classes:', pageContainer.className);
        console.log('💾 DEBUG: pageContainer children count:', pageContainer.children.length);

        // Check what children the pageContainer has
        for (let i = 0; i < pageContainer.children.length; i++) {
            const child = pageContainer.children[i];
            console.log(`💾 DEBUG: Child ${i}: tagName=${child.tagName}, className="${child.className}"`);
        }

        // The pageContainer contains the self-contained page structure:
        // <div class="unified-page">
        //   <style>...</style>
        //   {template content}
        // </div>

        // We need to extract ONLY the template content, not the wrapper or styles
        const unifiedPageDiv = pageContainer.querySelector('.unified-page');
        console.log('💾 DEBUG: unifiedPageDiv found:', !!unifiedPageDiv);

        if (unifiedPageDiv) {
            console.log('💾 DEBUG: Found unified-page wrapper - extracting content only');

            // Clone the unified page to avoid modifying the original
            const contentClone = unifiedPageDiv.cloneNode(true);

            // Remove the style element (generated by UnifiedPageRenderer)
            const styleElement = contentClone.querySelector('style');
            if (styleElement) {
                styleElement.remove();
                console.log('💾 DEBUG: Removed generated style element');
            }

            // Return only the inner content (template HTML with edits)
            const templateContent = contentClone.innerHTML.trim();
            console.log('💾 DEBUG: Extracted template content length:', templateContent.length);

            return templateContent;
        }

        // CRITICAL FIX: The pageContainer contains the full HTML document structure
        // We need to preserve the COMPLETE document structure that templates expect
        console.log('💾 DEBUG: Preserving complete HTML document structure for template compatibility');

        // Get the complete HTML including head and body structure
        const completeHTML = pageContainer.innerHTML;
        console.log('💾 DEBUG: Preserving complete HTML document length:', completeHTML.length);

        return completeHTML;
    }

    static handleCloseElementEditor(event, element) {
        // Hide the sidebar panel
        const sidebarPanel = document.getElementById('elementEditorPanel');
        const modal = document.getElementById('pageZoomModal');
        if (sidebarPanel) {
            sidebarPanel.classList.remove('active');
            // Remove class from modal too
            if (modal) modal.classList.remove('sidebar-active');
        }
    }

    // New editing action handlers that dispatch to the appropriate editor
    static handleMoveImage(event, element) {
        const direction = element.dataset.direction;
        EventBus.emit(EVENTS.ACTION, { action: 'move-image', direction });
    }

    static handleResizeImage(event, element) {
        const direction = element.dataset.direction;
        EventBus.emit(EVENTS.ACTION, { action: 'resize-image', direction });
    }

    static handleResetImage(event, element) {
        EventBus.emit(EVENTS.ACTION, { action: 'reset-image' });
    }

    static handleMoveContainer(event, element) {
        const direction = element.dataset.direction;
        EventBus.emit(EVENTS.ACTION, { action: 'move-container', direction });
    }

    static handleResizeContainer(event, element) {
        const direction = element.dataset.direction;
        EventBus.emit(EVENTS.ACTION, { action: 'resize-container', direction });
    }

    static handleResetContainer(event, element) {
        EventBus.emit(EVENTS.ACTION, { action: 'reset-container' });
    }

    static handleExtendSection(event, element) {
        EventBus.emit(EVENTS.ACTION, { action: 'extend-section' });
    }

    static handleShrinkSection(event, element) {
        EventBus.emit(EVENTS.ACTION, { action: 'shrink-section' });
    }

    static handleResetSectionHeight(event, element) {
        EventBus.emit(EVENTS.ACTION, { action: 'reset-section-height' });
    }
}

export default EventManager;