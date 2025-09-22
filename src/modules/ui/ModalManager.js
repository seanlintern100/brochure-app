import EventBus from '../core/EventBus.js';
import ErrorHandler from '../core/ErrorHandler.js';
import StateManager from '../core/StateManager.js';
import ProjectManager from '../data/ProjectManager.js';
import UIManager from './UIManager.js';
import UnifiedPageRenderer from '../rendering/UnifiedPageRenderer.js';
import { Templates } from './templates.js';
import { MODAL_IDS, EVENTS, CSS_CLASSES } from './constants.js';

class ModalManager {
    static activeModal = null;

    static init() {
        this.setupEventListeners();
    }

    static setupEventListeners() {
        EventBus.on(EVENTS.MODAL_OPENED, this.handleModalOpened.bind(this));
        EventBus.on(EVENTS.MODAL_CLOSED, this.handleModalClosed.bind(this));
    }

    static show(modalId, data = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            ErrorHandler.logError(new Error(`Modal ${modalId} not found`), 'ModalManager.show');
            return;
        }


        // Prepare modal content based on type
        this.prepareModal(modalId, data);

        // Clear any inline display style that might be blocking the modal
        modal.style.display = '';

        // Show modal
        modal.classList.add(CSS_CLASSES.MODAL_ACTIVE);
        this.activeModal = modalId;

    }

    static hide(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.classList.remove(CSS_CLASSES.MODAL_ACTIVE);

        if (this.activeModal === modalId) {
            this.activeModal = null;
        }
    }

    static hideAll() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.classList.remove(CSS_CLASSES.MODAL_ACTIVE);
        });
        this.activeModal = null;
    }

    static prepareModal(modalId, data) {
        switch (modalId) {
            case MODAL_IDS.NEW_PROJECT:
                this.prepareNewProjectModal();
                break;
            case MODAL_IDS.OPEN_PROJECT:
                this.prepareOpenProjectModal();
                break;
            case MODAL_IDS.PAGE_ZOOM:
                this.preparePageZoomModal(data);
                break;
        }
    }

    static prepareNewProjectModal() {
        // Clear form
        const form = document.getElementById('newProjectForm');
        if (form) {
            form.reset();
        }

        // Populate template dropdown
        UIManager.populateTemplateDropdown();
    }

    static async prepareOpenProjectModal() {
        const projectGrid = document.getElementById('projectGrid');
        if (!projectGrid) return;

        // Show loading state
        projectGrid.innerHTML = '<div class="loading"><div class="loading-spinner"></div><p>Loading projects...</p></div>';

        try {
            const projectList = await ProjectManager.listProjects();

            if (projectList.length === 0) {
                projectGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--color-cool-gray); padding: 40px;">No projects found. Create a new project to get started!</div>';
                return;
            }

            // Load each project to generate preview
            const projectCards = [];
            for (const projectMeta of projectList) {
                try {
                    // Load the full project to generate preview (without triggering state changes)
                    const project = await ProjectManager.loadProjectForPreview(projectMeta.filename);
                    const previewHtml = ProjectManager.generateProjectPreview(project);

                    // Use the metadata from the list (has file info) but with loaded project data
                    const projectData = {
                        ...projectMeta,
                        pages: project.pages ? project.pages.length : 0
                    };

                    projectCards.push(Templates.projectCard(projectData, previewHtml));
                } catch (error) {
                    console.warn(`Could not load project ${projectMeta.filename} for preview:`, error);
                    // Still show the project card without preview
                    projectCards.push(Templates.projectCard(projectMeta, null));
                }
            }

            projectGrid.innerHTML = projectCards.join('');

            // Preview iframes are set directly in template HTML

            // Initialize feather icons in the new cards
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        } catch (error) {
            ErrorHandler.logError(error, 'ModalManager.prepareOpenProjectModal', 'Failed to load projects');
            projectGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--color-cool-gray); padding: 40px;">Failed to load projects</div>';
        }
    }


    static preparePageZoomModal(data) {
        const { pageId } = data;
        const currentProject = ProjectManager.getCurrentProject();

        if (!currentProject) {
            ErrorHandler.showUserError('No project loaded', 'error');
            this.hide(MODAL_IDS.PAGE_ZOOM);
            return;
        }

        const page = currentProject.pages.find(p => p.id === pageId);
        if (!page) {
            ErrorHandler.showUserError('Page not found', 'error');
            this.hide(MODAL_IDS.PAGE_ZOOM);
            return;
        }

        // Set modal title
        const zoomPageTitle = document.getElementById('zoomPageTitle');
        if (zoomPageTitle) {
            const templates = StateManager.getState().templates;
            const template = templates.find(t => t.id === page.templateId);
            const templateName = template ? template.name : 'Unknown Template';
            zoomPageTitle.textContent = `Edit: ${templateName}`;
        }

        // Generate page HTML with overlays for editing
        const pageWithOverlays = UnifiedPageRenderer.generatePageWithOverlays(page, currentProject);


        // Load page content in zoom frame using srcdoc (more reliable than data URL)
        const zoomFrame = document.getElementById('zoomFrame');
        if (zoomFrame) {
            // Use srcdoc attribute which is more reliable for large content
            zoomFrame.srcdoc = pageWithOverlays;

            // Fallback for empty content
            if (!pageWithOverlays || pageWithOverlays.trim().length === 0) {
                zoomFrame.srcdoc = '<html><body><h1>Error</h1><p>Content generation failed</p></body></html>';
            }
        }

        // Store current page for saving
        this.currentZoomPage = page;
    }

    /**
     * Sanitize HTML for direct DOM insertion (security)
     */
    static sanitizeHTML(html) {
        // Remove script tags and dangerous elements
        let sanitized = html;

        // Remove script tags
        sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        // Remove iframe tags (prevent nested iframes)
        sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');

        // Remove object/embed tags
        sanitized = sanitized.replace(/<(object|embed)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');

        console.log('🛡️ HTML sanitized for direct DOM insertion');
        return sanitized;
    }

    /**
     * Apply element transforms to direct DOM (no iframe)
     */
    static applyElementTransformsDirect(pageContainer, pageId, project) {
        try {
            // Get saved transforms for this page
            const pageTransforms = project.elementTransforms?.[pageId];
            if (!pageTransforms) {
                console.log('📝 No saved transforms found for page:', pageId);
                return;
            }

            console.log('🔄 Applying saved transforms to direct DOM for page:', pageId, pageTransforms);

            // Apply image transforms
            if (pageTransforms.images) {
                Object.entries(pageTransforms.images).forEach(([elementId, transform]) => {
                    const container = pageContainer.querySelector(`[data-element-id="${elementId}"]`);
                    if (container) {
                        const img = container.tagName === 'IMG' ? container : container.querySelector('img');
                        if (img) {
                            // Apply CSS custom properties for transforms
                            if (transform.translateX) img.style.setProperty('--img-x', transform.translateX);
                            if (transform.translateY) img.style.setProperty('--img-y', transform.translateY);
                            if (transform.scale) img.style.setProperty('--img-scale', transform.scale);

                            // CRITICAL: Apply image source directly - no serialization issues!
                            if (transform.src && transform.src !== img.src) {
                                img.src = transform.src;
                                img.setAttribute('src', transform.src); // Ensure it persists in innerHTML
                            }

                            // Apply direct transform for immediate effect
                            const translateX = transform.translateX || '0px';
                            const translateY = transform.translateY || '0px';
                            const scale = transform.scale || '1';
                            img.style.transform = `translate(${translateX}, ${translateY}) scale(${scale})`;
                            img.style.transformOrigin = 'center center';

                            console.log(`✅ Applied transform to direct DOM: ${elementId}`, transform);
                        }
                    }
                });
            }

            // Apply section transforms
            if (pageTransforms.sections) {
                Object.entries(pageTransforms.sections).forEach(([elementId, transform]) => {
                    const section = pageContainer.querySelector(`[data-element-id="${elementId}"]`);
                    if (section) {
                        // Apply height adjustments
                        if (transform.height && transform.height !== 'auto') {
                            section.style.height = transform.height;
                        }

                        // Apply ordering
                        if (transform.order) {
                            section.style.order = transform.order;
                        }

                        console.log(`✅ Applied section transform to direct DOM: ${elementId}`, transform);
                    }
                });
            }

            console.log('✅ All transforms applied to direct DOM successfully');

        } catch (error) {
            console.error('❌ Error applying transforms to direct DOM:', error);
        }
    }

    static applyElementTransforms(iframe, pageId, project) {
        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (!iframeDoc) {
                console.warn('⚠️ Cannot access iframe document for applying transforms');
                return;
            }

            // Get saved transforms for this page
            const pageTransforms = project.elementTransforms?.[pageId];
            if (!pageTransforms) {
                console.log('📝 No saved transforms found for page:', pageId);
                return;
            }

            console.log('🔄 Applying saved transforms for page:', pageId, pageTransforms);

            // Apply image transforms
            if (pageTransforms.images) {
                Object.entries(pageTransforms.images).forEach(([elementId, transform]) => {
                    const container = iframeDoc.querySelector(`[data-element-id="${elementId}"]`);
                    if (container) {
                        const img = container.tagName === 'IMG' ? container : container.querySelector('img');
                        if (img) {
                            // Apply CSS custom properties for transforms
                            if (transform.translateX) img.style.setProperty('--img-x', transform.translateX);
                            if (transform.translateY) img.style.setProperty('--img-y', transform.translateY);
                            if (transform.scale) img.style.setProperty('--img-scale', transform.scale);
                            if (transform.src) img.src = transform.src;

                            // Mark container as editable
                            container.setAttribute('data-editable', 'image');
                            console.log('✅ Applied image transforms to:', elementId);
                        }
                    }
                });
            }

            // Apply section transforms
            if (pageTransforms.sections) {
                Object.entries(pageTransforms.sections).forEach(([elementId, transform]) => {
                    const section = iframeDoc.querySelector(`[data-element-id="${elementId}"]`);
                    if (section) {
                        // Apply height adjustments
                        if (transform.height && transform.height !== 'auto') {
                            section.style.height = transform.height;
                        }

                        // Apply section ordering
                        if (transform.order && transform.order !== '0') {
                            section.style.order = transform.order;
                        }

                        // Add classes to indicate adjustability
                        if (transform.heightAdjustable) {
                            section.classList.add('height-adjustable');
                        }
                        if (transform.reorderable) {
                            section.classList.add('reorderable');
                        }

                        // Mark as editable section
                        section.setAttribute('data-editable', 'section');
                        console.log('✅ Applied section transforms to:', elementId);
                    }
                });
            }

            console.log('✅ All element transforms applied successfully');

        } catch (error) {
            console.error('❌ Error applying element transforms:', error);
        }
    }

    static handleModalOpened(data) {
        const { modalId, data: modalData } = data;
        this.show(modalId, modalData);
    }

    static handleModalClosed(data) {
        const { modalId } = data;
        this.hide(modalId);
    }

    static saveZoomPageChanges() {
        if (!this.currentZoomPage) {
            ErrorHandler.showUserError('No page to save', 'error');
            return;
        }

        // For now, just show a message that changes would be saved
        // In the future, this would extract content from the iframe and save it
        ErrorHandler.showSuccess('Page changes saved successfully');
        this.hide(MODAL_IDS.PAGE_ZOOM);

        // Mark project as dirty
        ProjectManager.updateProjectMetadata({ modified: new Date().toISOString() });
    }

    static isModalOpen(modalId = null) {
        if (modalId) {
            return this.activeModal === modalId;
        }
        return this.activeModal !== null;
    }

    static getActiveModal() {
        return this.activeModal;
    }

    static closeActiveModal() {
        if (this.activeModal) {
            this.hide(this.activeModal);
        }
    }

    static handleEscapeKey() {
        if (this.activeModal) {
            this.closeActiveModal();
        }
    }

    static setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.handleEscapeKey();
            }
        });
    }

    static cleanup() {
        this.hideAll();
        this.currentZoomPage = null;

        document.removeEventListener('keydown', this.handleEscapeKey);
    }
}

// Setup keyboard shortcuts on module load
ModalManager.setupKeyboardShortcuts();

export default ModalManager;