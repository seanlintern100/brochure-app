import StateManager from '../core/StateManager.js';
import EventBus from '../core/EventBus.js';
import ErrorHandler from '../core/ErrorHandler.js';
import UploadValidator from './UploadValidator.js';

class TemplateUploader {
    static uploadSession = {
        files: [],
        metadata: null,
        pageOrder: [],
        validationResults: {},
        status: 'idle'
    };

    static async handleFileSelection(files) {
        try {
            this.uploadSession.status = 'processing';
            this.uploadSession.files = Array.from(files);
            this.uploadSession.pageOrder = [];
            this.uploadSession.validationResults = {};

            EventBus.emit('upload:started', { fileCount: files.length });

            const processedFiles = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const htmlContent = await this.readFileContent(file);

                const validation = await UploadValidator.validateUploadedFile(file, htmlContent);
                this.uploadSession.validationResults[file.name] = validation;

                processedFiles.push({
                    file,
                    htmlContent,
                    validation,
                    order: i + 1,
                    pageName: this.generatePageName(file.name),
                    pageNumber: String(i + 1).padStart(2, '0')
                });

                EventBus.emit('upload:file-processed', {
                    fileName: file.name,
                    progress: ((i + 1) / files.length) * 100
                });
            }

            this.uploadSession.pageOrder = processedFiles;
            this.uploadSession.status = 'validated';

            EventBus.emit('upload:validation-complete', {
                files: processedFiles,
                hasErrors: processedFiles.some(f => !f.validation || !f.validation.valid)
            });

            return processedFiles;

        } catch (error) {
            this.uploadSession.status = 'error';
            ErrorHandler.logError(error, 'TemplateUploader.handleFileSelection');
            EventBus.emit('upload:error', { message: 'Failed to process files' });
            throw error;
        }
    }

    static async readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    static generatePageName(fileName) {
        return fileName
            .replace(/\.(html|htm)$/i, '')
            .replace(/^page-\d+-/, '')
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
            .substring(0, 50);
    }

    static collectMetadata(templateName, category, description, version = '1.0') {
        const metadata = {
            name: templateName.trim(),
            category: category.trim(),
            version: version.trim(),
            created: new Date().toISOString().split('T')[0],
            description: description.trim(),
            pages: this.uploadSession.pageOrder.map(p => p.pageName.toLowerCase().replace(/\s+/g, '-')),
            locked: false
        };

        this.uploadSession.metadata = metadata;

        EventBus.emit('upload:metadata-collected', metadata);
        return metadata;
    }

    static updatePageOrder(newOrder) {
        try {
            if (!Array.isArray(newOrder) || newOrder.length !== this.uploadSession.pageOrder.length) {
                throw new Error('Invalid page order array');
            }

            this.uploadSession.pageOrder = newOrder.map((page, index) => ({
                ...page,
                order: index + 1,
                pageNumber: String(index + 1).padStart(2, '0')
            }));

            EventBus.emit('upload:page-order-changed', this.uploadSession.pageOrder);
            return this.uploadSession.pageOrder;

        } catch (error) {
            ErrorHandler.logError(error, 'TemplateUploader.updatePageOrder');
            throw error;
        }
    }

    static generateFinalStructure() {
        try {
            if (!this.uploadSession.metadata) {
                throw new Error('Metadata not collected');
            }

            if (this.uploadSession.pageOrder.length === 0) {
                throw new Error('No pages to upload');
            }

            const structure = {
                templateName: this.uploadSession.metadata.name,
                metadata: {
                    name: this.uploadSession.metadata.name,
                    category: this.uploadSession.metadata.category,
                    description: this.uploadSession.metadata.description,
                    version: this.uploadSession.metadata.version,
                    created: this.uploadSession.metadata.created,
                    pages: this.uploadSession.pageOrder.map(p => p.pageName.toLowerCase().replace(/\s+/g, '-')),
                    locked: false
                },
                pages: this.uploadSession.pageOrder.map(page => ({
                    fileName: `page-${page.pageNumber}-${page.pageName.toLowerCase().replace(/\s+/g, '-')}.html`,
                    pageName: page.pageName,
                    htmlContent: page.htmlContent,
                    validation: page.validation
                }))
            };

            EventBus.emit('upload:structure-generated', structure);
            return structure;

        } catch (error) {
            ErrorHandler.logError(error, 'TemplateUploader.generateFinalStructure');
            throw error;
        }
    }

    static async saveToFileSystem() {
        try {
            this.uploadSession.status = 'saving';
            EventBus.emit('upload:save-started');

            const structure = this.generateFinalStructure();

            const saveData = {
                templateName: structure.templateName,
                metadata: structure.metadata,
                pages: structure.pages
            };

            const result = await window.electronAPI.uploadTemplateBatch(saveData);

            if (!result.success) {
                throw new Error(result.error || 'Failed to save template');
            }

            this.uploadSession.status = 'completed';
            EventBus.emit('upload:save-completed', {
                templateName: structure.templateName,
                pageCount: structure.pages.length,
                path: result.path
            });

            this.resetUploadSession();
            return result;

        } catch (error) {
            this.uploadSession.status = 'error';
            ErrorHandler.logError(error, 'TemplateUploader.saveToFileSystem');
            EventBus.emit('upload:save-error', { message: error.message });
            throw error;
        }
    }

    static async validateTemplateName(templateName) {
        try {
            const result = await window.electronAPI.validateTemplateName(templateName);
            return result;

        } catch (error) {
            ErrorHandler.logError(error, 'TemplateUploader.validateTemplateName');
            return { valid: false, error: 'Failed to validate template name' };
        }
    }

    static async getExistingCategories() {
        try {
            const result = await window.electronAPI.getTemplateCategories();
            return result.success ? result.categories : [];

        } catch (error) {
            ErrorHandler.logError(error, 'TemplateUploader.getExistingCategories');
            return [];
        }
    }

    static getUploadSession() {
        return { ...this.uploadSession };
    }

    static resetUploadSession() {
        this.uploadSession = {
            files: [],
            metadata: null,
            pageOrder: [],
            validationResults: {},
            status: 'idle'
        };

        EventBus.emit('upload:session-reset');
    }

    static getValidationSummary() {
        const files = this.uploadSession.pageOrder;
        const totalFiles = files.length;
        const validFiles = files.filter(f => f.validation.valid).length;
        const totalWarnings = files.reduce((sum, f) => sum + f.validation.warnings.length, 0);
        const totalErrors = files.reduce((sum, f) => sum + f.validation.errors.length, 0);

        return {
            totalFiles,
            validFiles,
            totalWarnings,
            totalErrors,
            canProceed: totalFiles > 0 && totalErrors === 0
        };
    }
}

export default TemplateUploader;