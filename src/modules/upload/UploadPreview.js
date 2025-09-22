import { Templates } from '../ui/templates.js';
import ErrorHandler from '../core/ErrorHandler.js';
import EventBus from '../core/EventBus.js';

class UploadPreview {
    static thumbnailCache = new Map();

    static generateThumbnail(htmlContent, fileName) {
        try {
            if (this.thumbnailCache.has(fileName)) {
                return this.thumbnailCache.get(fileName);
            }

            const previewContent = this.extractPreviewContent(htmlContent);
            const previewStyles = this.extractPreviewStyles(htmlContent);
            const thumbnail = Templates.pagePreviewHTML(previewContent, previewStyles);

            this.thumbnailCache.set(fileName, thumbnail);
            return thumbnail;

        } catch (error) {
            ErrorHandler.logError(error, 'UploadPreview.generateThumbnail');
            return this.createErrorThumbnail(fileName);
        }
    }

    static extractPreviewContent(htmlContent) {
        try {
            let content = htmlContent;

            content = content.replace(/<!DOCTYPE html>.*?<body[^>]*>/s, '');
            content = content.replace(/<\/body>.*?<\/html>/s, '');
            content = content.replace(/<style[^>]*>.*?<\/style>/gs, '');
            content = content.replace(/<script[^>]*>.*?<\/script>/gs, '');

            const metadataDiv = content.match(/<div[^>]*data-page-template[^>]*style\s*=\s*["'][^"']*display\s*:\s*none[^"']*["'][^>]*>.*?<\/div>/s);
            if (metadataDiv) {
                content = content.replace(metadataDiv[0], '');
            }

            return content.trim();

        } catch (error) {
            ErrorHandler.logError(error, 'UploadPreview.extractPreviewContent');
            return '<div class="preview-error">Preview unavailable</div>';
        }
    }

    static extractPreviewStyles(htmlContent) {
        try {
            const styleMatches = htmlContent.match(/<style[^>]*>(.*?)<\/style>/s);
            if (!styleMatches) return '';

            let styles = styleMatches[1];

            styles = styles.replace(/@page[^{]*\{[^}]*\}/g, '');
            styles = styles.replace(/page-break-[^:]*:[^;]*;/g, '');

            return styles;

        } catch (error) {
            ErrorHandler.logError(error, 'UploadPreview.extractPreviewStyles');
            return '';
        }
    }

    static renderPreviewGrid(pages, containerId) {
        try {
            const container = document.getElementById(containerId);
            if (!container) {
                throw new Error(`Container element with ID "${containerId}" not found`);
            }

            const gridHTML = pages.map((page, index) => this.createPreviewItem(page, index)).join('');

            container.innerHTML = `
                <div class="upload-preview-grid">
                    ${gridHTML}
                </div>
            `;

            this.setupPreviewEvents(container);
            EventBus.emit('upload:preview-rendered', { pageCount: pages.length });

            return container;

        } catch (error) {
            ErrorHandler.logError(error, 'UploadPreview.renderPreviewGrid');
            throw error;
        }
    }

    static createPreviewItem(page, index) {
        const thumbnail = this.generateThumbnail(page.htmlContent, page.file.name);
        const validation = page.validation || { valid: true, warnings: [], errors: [] };
        const statusClass = validation.valid ? 'valid' : 'invalid';

        return `
            <div class="upload-preview-item" data-index="${index}">
                <div class="preview-header">
                    <div class="preview-title">${page.pageName}</div>
                    <div class="preview-status ${statusClass}">
                        ${validation.valid ? '✓' : '✗'}
                    </div>
                </div>

                <div class="preview-thumbnail" data-index="${index}">
                    <div class="preview-content">
                        <iframe srcdoc="${thumbnail.replace(/"/g, '&quot;')}"
                                style="width: 100%; height: 100%; border: none; border-radius: 4px;"></iframe>
                    </div>
                </div>

                <div class="preview-info">
                    <div class="file-name">${page.file.name}</div>
                    <div class="file-details">
                        <span class="file-size">${this.formatFileSize(page.file.size)}</span>
                        ${validation.editableCount ? `<span class="editable-count">${validation.editableCount} editable</span>` : ''}
                    </div>
                </div>

                ${(!validation.valid) ? `
                    <div class="preview-issues">
                        ${(validation.errors || []).map(error => `<div class="issue error">${error}</div>`).join('')}
                        ${(validation.warnings || []).map(warning => `<div class="issue warning">${warning}</div>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    static setupPreviewEvents(container) {
        const thumbnails = container.querySelectorAll('.preview-thumbnail');

        thumbnails.forEach(thumbnail => {
            thumbnail.addEventListener('click', this.handlePreviewClick.bind(this));
            thumbnail.addEventListener('mouseenter', this.handlePreviewHover.bind(this));
            thumbnail.addEventListener('mouseleave', this.handlePreviewLeave.bind(this));
        });
    }

    static handlePreviewClick(e) {
        const index = parseInt(e.currentTarget.dataset.index);
        EventBus.emit('upload:preview-clicked', { index });
    }

    static handlePreviewHover(e) {
        e.currentTarget.classList.add('hover');
    }

    static handlePreviewLeave(e) {
        e.currentTarget.classList.remove('hover');
    }

    static createErrorThumbnail(fileName) {
        return `
            <div class="preview-error">
                <div class="error-icon">⚠️</div>
                <div class="error-message">Preview Error</div>
                <div class="error-file">${fileName}</div>
            </div>
        `;
    }

    static updatePreviewOrder(container, newOrder) {
        try {
            const grid = container.querySelector('.upload-preview-grid');
            if (!grid) return;

            const items = Array.from(grid.querySelectorAll('.upload-preview-item'));

            newOrder.forEach((originalIndex, newPosition) => {
                const item = items.find(item => parseInt(item.dataset.index) === originalIndex);
                if (item) {
                    item.dataset.index = newPosition;
                    grid.appendChild(item);
                }
            });

            EventBus.emit('upload:preview-reordered', { newOrder });

        } catch (error) {
            ErrorHandler.logError(error, 'UploadPreview.updatePreviewOrder');
        }
    }

    static highlightPreviewItem(container, index, highlight = true) {
        const items = container.querySelectorAll('.upload-preview-item');
        items.forEach((item, i) => {
            if (i === index) {
                item.classList.toggle('highlighted', highlight);
            } else {
                item.classList.remove('highlighted');
            }
        });
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    }

    static getPreviewSummary(pages) {
        const summary = {
            totalPages: pages.length,
            validPages: 0,
            totalWarnings: 0,
            totalErrors: 0,
            totalSize: 0,
            editableElements: 0
        };

        pages.forEach(page => {
            const validation = page.validation || { valid: true, warnings: [], errors: [], editableCount: 0 };

            if (validation.valid) summary.validPages++;
            summary.totalWarnings += (validation.warnings && validation.warnings.length) || 0;
            summary.totalErrors += (validation.errors && validation.errors.length) || 0;
            summary.totalSize += (page.file && page.file.size) || 0;
            summary.editableElements += validation.editableCount || 0;
        });

        return summary;
    }

    static clearThumbnailCache() {
        this.thumbnailCache.clear();
    }

    static removeThumbnailFromCache(fileName) {
        this.thumbnailCache.delete(fileName);
    }

    static getCacheSize() {
        return this.thumbnailCache.size;
    }

    static validatePreviewGeneration(pages) {
        const results = {
            successful: 0,
            failed: 0,
            errors: []
        };

        pages.forEach((page, index) => {
            try {
                this.generateThumbnail(page.htmlContent, page.file.name);
                results.successful++;
            } catch (error) {
                results.failed++;
                results.errors.push(`Page ${index + 1} (${page.file.name}): ${error.message}`);
            }
        });

        return results;
    }
}

export default UploadPreview;