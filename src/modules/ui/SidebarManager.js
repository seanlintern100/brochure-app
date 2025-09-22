import EventBus from '../core/EventBus.js';
import StateManager from '../core/StateManager.js';
import { EVENTS } from './constants.js';

class SidebarManager {
    static STORAGE_KEY = 'brochure_sidebar_states';
    static DEFAULT_STATES = {
        projectSettings: true,
        templateLibrary: true,
        images: false,
        connectionStatus: false
    };

    static init() {
        this.loadSectionStates();
        this.setupEventListeners();

        // Update visibility after a brief delay to ensure DOM is ready
        setTimeout(() => {
            this.updateSectionVisibility();
        }, 100);
    }

    static loadSectionStates() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            this.sectionStates = stored ?
                { ...this.DEFAULT_STATES, ...JSON.parse(stored) } :
                { ...this.DEFAULT_STATES };
        } catch (error) {
            console.warn('Failed to load sidebar states:', error);
            this.sectionStates = { ...this.DEFAULT_STATES };
        }
    }

    static saveSectionStates() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.sectionStates));
        } catch (error) {
            console.warn('Failed to save sidebar states:', error);
        }
    }

    static setupEventListeners() {
        EventBus.on(EVENTS.SIDEBAR_TOGGLE_SECTION, (data) => {
            this.toggleSection(data.sectionId);
        });

        // Listen for project state changes
        EventBus.on(EVENTS.PROJECT_LOADED, () => {
            this.updateSectionVisibility();
        });

        EventBus.on(EVENTS.PROJECT_CREATED, () => {
            this.updateSectionVisibility();
        });

        // Reset to no-project state when project is cleared
        EventBus.on(EVENTS.STATE_PROJECT_CHANGED, () => {
            this.updateSectionVisibility();
        });
    }

    static toggleSection(sectionId) {
        if (!this.sectionStates.hasOwnProperty(sectionId)) {
            console.warn(`Unknown section ID: ${sectionId}`);
            return;
        }

        const oldState = this.sectionStates[sectionId];
        this.sectionStates[sectionId] = !this.sectionStates[sectionId];
        console.log(`Toggling ${sectionId}: ${oldState} → ${this.sectionStates[sectionId]}`);

        this.saveSectionStates();
        this.applySectionState(sectionId);
    }

    static applySectionStates() {
        Object.keys(this.sectionStates).forEach(sectionId => {
            this.applySectionState(sectionId);
        });
    }

    static applySectionState(sectionId) {
        const isExpanded = this.sectionStates[sectionId];
        const section = document.querySelector(`[data-section="${sectionId}"]`);
        const header = document.querySelector(`[data-section-header="${sectionId}"]`);
        const content = document.querySelector(`[data-section-content="${sectionId}"]`);
        const toggle = document.querySelector(`[data-section-toggle="${sectionId}"]`);

        console.log(`Applying section state for ${sectionId}:`, {
            isExpanded,
            sectionExists: !!section,
            headerExists: !!header,
            contentExists: !!content,
            toggleExists: !!toggle
        });

        if (!section || !content) {
            console.warn(`Cannot apply state to ${sectionId}: missing elements`);
            return;
        }

        if (isExpanded) {
            section.classList.remove('collapsed');
            section.classList.add('expanded');
            content.style.display = 'block';
            if (toggle) {
                toggle.style.transform = 'rotate(180deg)';
            }
        } else {
            section.classList.remove('expanded');
            section.classList.add('collapsed');
            content.style.display = 'none';
            if (toggle) {
                toggle.style.transform = 'rotate(0deg)';
            }
        }

        console.log(`Applied ${isExpanded ? 'expanded' : 'collapsed'} state to ${sectionId}`);
    }

    static updateSectionVisibility() {
        const currentProject = StateManager.getState().currentProject;
        const hasProject = !!currentProject;

        console.log('Updating section visibility. Has project:', hasProject);

        // Define which sections should be visible based on project state
        const sectionsToShow = hasProject
            ? ['projectSettings', 'templateLibrary', 'images', 'connectionStatus']
            : ['connectionStatus'];

        // Hide/show sections based on project state
        ['projectSettings', 'templateLibrary', 'images', 'connectionStatus'].forEach(sectionId => {
            const section = document.querySelector(`[data-section="${sectionId}"]`);
            if (section) {
                if (sectionsToShow.includes(sectionId)) {
                    section.style.display = 'block';
                    // Apply saved state only if section should be visible
                    this.applySectionState(sectionId);
                } else {
                    section.style.display = 'none';
                }
            }
        });
    }

    static expandSection(sectionId) {
        if (this.sectionStates[sectionId]) return;
        this.toggleSection(sectionId);
    }

    static collapseSection(sectionId) {
        if (!this.sectionStates[sectionId]) return;
        this.toggleSection(sectionId);
    }

    static getSectionState(sectionId) {
        return this.sectionStates[sectionId] || false;
    }

    static isExpanded(sectionId) {
        return this.getSectionState(sectionId);
    }

    static setupSectionHeader(sectionId, title) {
        return `
            <div class="sidebar-section-header" data-section-header="${sectionId}"
                 data-action="toggle-sidebar-section" data-section-id="${sectionId}">
                <h3 class="sidebar-title">${title}</h3>
                <button class="sidebar-toggle" data-section-toggle="${sectionId}">
                    <i data-feather="chevron-down"></i>
                </button>
            </div>
        `;
    }
}

export default SidebarManager;