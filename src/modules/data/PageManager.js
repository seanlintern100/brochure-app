import StateManager from '../core/StateManager.js';
import EventBus from '../core/EventBus.js';
import ErrorHandler from '../core/ErrorHandler.js';
import { EVENTS } from '../ui/constants.js';

class PageManager {
    static movePageUp(pageId) {
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) return;

        const pageIndex = currentProject.pages.findIndex(p => p.id === pageId);
        if (pageIndex > 0) {
            const pages = [...currentProject.pages];
            const page = pages.splice(pageIndex, 1)[0];
            pages.splice(pageIndex - 1, 0, page);

            this.updatePagePositions(pages);
            StateManager.updateProject({ pages });

            EventBus.emit(EVENTS.PAGE_MOVED, { pageId, direction: 'up', newIndex: pageIndex - 1 });
        }
    }

    static movePageDown(pageId) {
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) return;

        const pageIndex = currentProject.pages.findIndex(p => p.id === pageId);
        if (pageIndex < currentProject.pages.length - 1 && pageIndex >= 0) {
            const pages = [...currentProject.pages];
            const page = pages.splice(pageIndex, 1)[0];
            pages.splice(pageIndex + 1, 0, page);

            this.updatePagePositions(pages);
            StateManager.updateProject({ pages });

            EventBus.emit(EVENTS.PAGE_MOVED, { pageId, direction: 'down', newIndex: pageIndex + 1 });
        }
    }

    static duplicatePage(pageId) {
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) return;

        const pageIndex = currentProject.pages.findIndex(p => p.id === pageId);
        if (pageIndex >= 0) {
            const originalPage = currentProject.pages[pageIndex];
            const duplicatedPage = {
                ...originalPage,
                id: `page-${Date.now()}`,
                position: originalPage.position + 1
            };

            const pages = [...currentProject.pages];
            pages.splice(pageIndex + 1, 0, duplicatedPage);

            this.updatePagePositions(pages);
            StateManager.updateProject({ pages });

            EventBus.emit(EVENTS.PAGE_DUPLICATED, { originalPageId: pageId, newPage: duplicatedPage });
            ErrorHandler.showSuccess('Page duplicated');

            return duplicatedPage;
        }
    }

    static deletePage(pageId) {
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) return;

        if (confirm('Are you sure you want to delete this page?')) {
            const pageIndex = currentProject.pages.findIndex(p => p.id === pageId);
            if (pageIndex >= 0) {
                const pages = [...currentProject.pages];
                const deletedPage = pages.splice(pageIndex, 1)[0];

                this.updatePagePositions(pages);
                StateManager.updateProject({ pages });

                EventBus.emit(EVENTS.PAGE_REMOVED, { pageId, deletedPage });
                ErrorHandler.showSuccess('Page deleted');

                return deletedPage;
            }
        }
    }

    static updatePagePositions(pages) {
        pages.forEach((page, index) => {
            page.position = index + 1;
        });
    }

    static getPageById(pageId) {
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) return null;

        return currentProject.pages.find(page => page.id === pageId);
    }

    static getPageIndex(pageId) {
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) return -1;

        return currentProject.pages.findIndex(page => page.id === pageId);
    }

    static updatePageContent(pageId, content) {
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) return;

        const page = this.getPageById(pageId);
        if (!page) return;

        // Update the template copy with new content
        if (currentProject.templateCopies[page.templateId]) {
            currentProject.templateCopies[page.templateId].modifiedHtml = content;
            StateManager.updateProject({ templateCopies: currentProject.templateCopies });

            EventBus.emit(EVENTS.PAGE_UPDATED, { pageId, content });
        }
    }

    static getPageContent(pageId) {
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) return null;

        const page = this.getPageById(pageId);
        if (!page) return null;

        const templateCopy = currentProject.templateCopies[page.templateId];
        return templateCopy ? templateCopy.modifiedHtml : null;
    }

    static addPage(page) {
        StateManager.addPage(page);
        EventBus.emit(EVENTS.PAGE_ADDED, { page });
    }

    static movePage(pageId, newPosition) {
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) return;

        const pageIndex = currentProject.pages.findIndex(p => p.id === pageId);
        if (pageIndex === -1 || newPosition < 0 || newPosition >= currentProject.pages.length) {
            return;
        }

        const pages = [...currentProject.pages];
        const page = pages.splice(pageIndex, 1)[0];
        pages.splice(newPosition, 0, page);

        this.updatePagePositions(pages);
        StateManager.updateProject({ pages });

        EventBus.emit(EVENTS.PAGE_MOVED, { pageId, newPosition, oldPosition: pageIndex });
    }

    static getPageCount() {
        const currentProject = StateManager.getState().currentProject;
        return currentProject ? currentProject.pages.length : 0;
    }

    static getAllPages() {
        const currentProject = StateManager.getState().currentProject;
        return currentProject ? currentProject.pages : [];
    }

    static canMoveUp(pageId) {
        const pageIndex = this.getPageIndex(pageId);
        return pageIndex > 0;
    }

    static canMoveDown(pageId) {
        const pageIndex = this.getPageIndex(pageId);
        const pageCount = this.getPageCount();
        return pageIndex >= 0 && pageIndex < pageCount - 1;
    }

    static getPageTemplateName(pageId) {
        const templates = StateManager.getState().templates;
        const page = this.getPageById(pageId);

        if (!page) return 'Unknown Template';

        const template = templates.find(t => t.id === page.templateId);
        return template ? template.name : 'Unknown Template';
    }

    static validatePage(page) {
        return page &&
               page.id &&
               page.templateId &&
               typeof page.position === 'number';
    }

    static reorderPages(newOrder) {
        const currentProject = StateManager.getState().currentProject;
        if (!currentProject) return;

        const reorderedPages = newOrder.map(pageId =>
            currentProject.pages.find(page => page.id === pageId)
        ).filter(Boolean);

        this.updatePagePositions(reorderedPages);
        StateManager.updateProject({ pages: reorderedPages });

        EventBus.emit(EVENTS.PAGE_MOVED, { reorder: true, newOrder });
    }
}

export default PageManager;