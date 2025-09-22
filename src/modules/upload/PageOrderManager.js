import EventBus from '../core/EventBus.js';
import ErrorHandler from '../core/ErrorHandler.js';

class PageOrderManager {
    static draggedIndex = null;
    static draggedElement = null;

    static renderOrderableList(pages, containerId) {
        try {
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container element with ID "${containerId}" not found`);
            }

            const listHTML = pages.map((page, index) => this.createPageOrderItem(page, index)).join('');

            container.innerHTML = `
                <div class="page-order-list">
                    ${listHTML}
                </div>
            `;

            this.setupDragHandlers(container);
            return container;

        } catch (error) {
            ErrorHandler.logError(error, 'PageOrderManager.renderOrderableList');
            throw error;
        }
    }

    static createPageOrderItem(page, index) {
        const validation = page.validation || { valid: true, warnings: [], errors: [] };
        const statusClass = validation.valid ? 'valid' : 'invalid';
        const warningCount = (validation.warnings && validation.warnings.length) || 0;
        const errorCount = (validation.errors && validation.errors.length) || 0;

        return `
            <div class="page-order-item" data-index="${index}" draggable="true">
                <div class="drag-handle">
                    <i data-feather="move"></i>
                </div>

                <div class="page-order-content">
                    <div class="page-order-header">
                        <div class="page-number">Page ${page.pageNumber}</div>
                        <div class="page-status ${statusClass}">
                            ${validation.valid ? '✓' : '✗'}
                        </div>
                    </div>

                    <div class="page-name-container">
                        <input type="text"
                               class="page-name-input"
                               value="${page.pageName}"
                               data-index="${index}"
                               placeholder="Page name">
                    </div>

                    <div class="page-file-info">
                        <span class="file-name">${page.file.name}</span>
                        <span class="file-size">${this.formatFileSize(page.file.size)}</span>
                    </div>

                    ${(warningCount > 0 || errorCount > 0) ? `
                        <div class="validation-summary">
                            ${errorCount > 0 ? `<span class="error-count">${errorCount} error(s)</span>` : ''}
                            ${warningCount > 0 ? `<span class="warning-count">${warningCount} warning(s)</span>` : ''}
                        </div>
                    ` : ''}
                </div>

                <div class="page-order-actions">
                    <button class="page-order-btn move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>
                        <i data-feather="chevron-up"></i>
                    </button>
                    <button class="page-order-btn move-down" data-index="${index}">
                        <i data-feather="chevron-down"></i>
                    </button>
                </div>
            </div>
        `;
    }

    static setupDragHandlers(container) {
        const items = container.querySelectorAll('.page-order-item');
        const buttons = container.querySelectorAll('.page-order-btn');

        items.forEach(item => {
            item.addEventListener('dragstart', this.handleDragStart.bind(this));
            item.addEventListener('dragover', this.handleDragOver.bind(this));
            item.addEventListener('drop', this.handleDrop.bind(this));
            item.addEventListener('dragend', this.handleDragEnd.bind(this));
        });

        buttons.forEach(button => {
            button.addEventListener('click', this.handleButtonMove.bind(this));
        });

        const inputs = container.querySelectorAll('.page-name-input');
        inputs.forEach(input => {
            input.addEventListener('input', this.handlePageNameChange.bind(this));
            input.addEventListener('blur', this.handlePageNameBlur.bind(this));
        });
    }

    static handleDragStart(e) {
        this.draggedIndex = parseInt(e.target.dataset.index);
        this.draggedElement = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    static handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const targetItem = e.target.closest('.page-order-item');
        if (targetItem && targetItem !== this.draggedElement) {
            targetItem.classList.add('drag-over');
        }
    }

    static handleDrop(e) {
        e.preventDefault();

        const targetItem = e.target.closest('.page-order-item');
        if (!targetItem || targetItem === this.draggedElement) return;

        const targetIndex = parseInt(targetItem.dataset.index);
        const sourceIndex = this.draggedIndex;

        if (sourceIndex !== targetIndex) {
            this.movePageToPosition(sourceIndex, targetIndex);
        }

        this.clearDragStyles();
    }

    static handleDragEnd(e) {
        this.clearDragStyles();
        this.draggedIndex = null;
        this.draggedElement = null;
    }

    static handleButtonMove(e) {
        const button = e.target.closest('.page-order-btn');
        if (!button) return;

        const currentIndex = parseInt(button.dataset.index);
        const isUp = button.classList.contains('move-up');
        const newIndex = isUp ? currentIndex - 1 : currentIndex + 1;

        if (newIndex >= 0) {
            this.movePageToPosition(currentIndex, newIndex);
        }
    }

    static handlePageNameChange(e) {
        const input = e.target;
        const index = parseInt(input.dataset.index);
        const newName = input.value.trim();

        EventBus.emit('upload:page-name-changed', { index, newName });
    }

    static handlePageNameBlur(e) {
        const input = e.target;
        if (input.value.trim() === '') {
            input.value = `Page ${parseInt(input.dataset.index) + 1}`;
            this.handlePageNameChange(e);
        }
    }

    static movePageToPosition(fromIndex, toIndex) {
        try {
            EventBus.emit('upload:page-order-change-requested', { fromIndex, toIndex });
        } catch (error) {
            ErrorHandler.logError(error, 'PageOrderManager.movePageToPosition');
        }
    }

    static clearDragStyles() {
        document.querySelectorAll('.page-order-item').forEach(item => {
            item.classList.remove('dragging', 'drag-over');
        });
    }

    static updatePageNumbers(container) {
        const items = container.querySelectorAll('.page-order-item');
        items.forEach((item, index) => {
            const pageNumber = item.querySelector('.page-number');
            const nameInput = item.querySelector('.page-name-input');
            const buttons = item.querySelectorAll('.page-order-btn');

            if (pageNumber) {
                pageNumber.textContent = `Page ${String(index + 1).padStart(2, '0')}`;
            }

            if (nameInput) {
                nameInput.dataset.index = index;
            }

            buttons.forEach(btn => {
                btn.dataset.index = index;
                if (btn.classList.contains('move-up')) {
                    btn.disabled = index === 0;
                }
                if (btn.classList.contains('move-down')) {
                    btn.disabled = index === items.length - 1;
                }
            });

            item.dataset.index = index;
        });

        feather.replace();
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    }

    static getOrderedPages(container) {
        const items = container.querySelectorAll('.page-order-item');
        const orderedIndexes = Array.from(items).map(item => parseInt(item.dataset.index));
        return orderedIndexes;
    }

    static validatePageNames(container) {
        const inputs = container.querySelectorAll('.page-name-input');
        const names = Array.from(inputs).map(input => input.value.trim());
        const duplicates = names.filter((name, index) => names.indexOf(name) !== index);

        if (duplicates.length > 0) {
            return {
                valid: false,
                errors: [`Duplicate page names: ${[...new Set(duplicates)].join(', ')}`]
            };
        }

        const emptyNames = names.filter(name => name === '');
        if (emptyNames.length > 0) {
            return {
                valid: false,
                errors: ['All pages must have names']
            };
        }

        return { valid: true, errors: [] };
    }
}

export default PageOrderManager;