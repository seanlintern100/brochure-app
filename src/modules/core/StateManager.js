import EventBus from './EventBus.js';

class StateManager {
    static state = {
        currentProject: null,
        templates: [],
        imageLibrary: [],
        basePath: '',
        isDirty: false,
        ui: {
            activeModal: null,
            selectedPageId: null,
            draggedTemplateId: null
        }
    };

    static subscribers = new Set();

    static getState() {
        return Object.freeze(JSON.parse(JSON.stringify(this.state)));
    }

    static setState(updates) {
        const previousState = this.getState();
        this.state = { ...this.state, ...updates };

        if (updates.hasOwnProperty('isDirty') && updates.isDirty !== previousState.isDirty) {
            EventBus.emit('state:dirty-changed', this.state.isDirty);
        }

        if (updates.currentProject !== previousState.currentProject) {
            EventBus.emit('state:project-changed', this.state.currentProject);
        }

        if (updates.templates !== previousState.templates) {
            EventBus.emit('state:templates-changed', this.state.templates);
        }

        this.notifySubscribers(previousState);
    }

    static updateProject(updates) {
        if (!this.state.currentProject) return;

        this.setState({
            currentProject: { ...this.state.currentProject, ...updates },
            isDirty: true
        });
    }

    static updateProjectMetadata(updates) {
        if (!this.state.currentProject) return;

        this.setState({
            currentProject: {
                ...this.state.currentProject,
                metadata: { ...this.state.currentProject.metadata, ...updates }
            },
            isDirty: true
        });
    }

    static addPage(page) {
        if (!this.state.currentProject) return;

        const updatedPages = [...this.state.currentProject.pages, page];
        this.updateProject({ pages: updatedPages });
    }

    static removePage(pageId) {
        if (!this.state.currentProject) return;

        const updatedPages = this.state.currentProject.pages.filter(p => p.id !== pageId);
        this.updateProject({ pages: updatedPages });
    }

    static updatePage(pageId, updates) {
        if (!this.state.currentProject) return;

        const updatedPages = this.state.currentProject.pages.map(page =>
            page.id === pageId ? { ...page, ...updates } : page
        );
        this.updateProject({ pages: updatedPages });
    }

    static updateTemplates(templates) {
        this.setState({ templates });
    }

    static setUIState(updates) {
        this.setState({
            ui: { ...this.state.ui, ...updates }
        });
    }

    static subscribe(callback) {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    static notifySubscribers(previousState) {
        this.subscribers.forEach(callback => {
            try {
                callback(this.getState(), previousState);
            } catch (error) {
                console.warn('Error in state subscriber:', error);
            }
        });
    }

    static reset() {
        this.setState({
            currentProject: null,
            isDirty: false,
            ui: {
                activeModal: null,
                selectedPageId: null,
                draggedTemplateId: null
            }
        });
    }
}

export default StateManager;