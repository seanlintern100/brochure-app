import EventBus from '../core/EventBus.js';
import ErrorHandler from '../core/ErrorHandler.js';
import TemplateUploader from './TemplateUploader.js';
import PageOrderManager from './PageOrderManager.js';
import UploadPreview from './UploadPreview.js';

class UploadModalManager {
    static isInitialized = false;
    static currentStep = 'upload'; // upload, metadata, preview, processing
    static existingCategories = [];

    static init() {
        if (this.isInitialized) return;

        this.setupEventListeners();
        this.loadExistingCategories();
        this.isInitialized = true;
    }

    static setupEventListeners() {
        EventBus.on('upload:modal-open', this.openModal.bind(this));
        EventBus.on('upload:file-processed', this.updateProgress.bind(this));
        EventBus.on('upload:validation-complete', this.showMetadataStep.bind(this));
        EventBus.on('upload:page-order-change-requested', this.handlePageReorder.bind(this));
        EventBus.on('upload:save-completed', this.handleUploadComplete.bind(this));
        EventBus.on('upload:save-error', this.handleUploadError.bind(this));
    }

    static async loadExistingCategories() {
        try {
            this.existingCategories = await TemplateUploader.getExistingCategories();
        } catch (error) {
            ErrorHandler.logError(error, 'UploadModalManager.loadExistingCategories');
            this.existingCategories = [];
        }
    }

    static openModal() {
        const modal = document.getElementById('uploadTemplatesModal');
        if (!modal) {
            this.createModal();
            return this.openModal();
        }

        this.currentStep = 'upload';
        this.renderUploadStep();
        modal.classList.add('active');
        EventBus.emit('modal:opened', { modalId: 'uploadTemplatesModal' });
    }

    static closeModal() {
        const modal = document.getElementById('uploadTemplatesModal');
        if (!modal) return;

        modal.classList.remove('active');
        modal.classList.remove('modal-preview-wide');
        TemplateUploader.resetUploadSession();
        UploadPreview.clearThumbnailCache();
        EventBus.emit('modal:closed', { modalId: 'uploadTemplatesModal' });
    }

    static createModal() {
        const modalHTML = `
            <div class="modal" id="uploadTemplatesModal">
                <div class="modal-content modal-large">
                    <button class="modal-close" id="closeUploadModal" data-action="close-modal">&times;</button>
                    <div id="uploadModalContent">
                        <!-- Content will be dynamically rendered -->
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('closeUploadModal').addEventListener('click', this.closeModal.bind(this));

        document.getElementById('uploadTemplatesModal').addEventListener('click', (e) => {
            if (e.target.id === 'uploadTemplatesModal') {
                this.closeModal();
            }
        });
    }

    static renderUploadStep() {
        const content = document.getElementById('uploadModalContent');
        if (!content) return;

        // Remove wide modal class for upload step
        const modal = document.getElementById('uploadTemplatesModal');
        if (modal) {
            modal.classList.remove('modal-preview-wide');
        }

        content.innerHTML = `
            <h2>Upload Templates</h2>

            <div class="upload-step upload-files">
                <div class="file-drop-zone" id="fileDropZone">
                    <div class="drop-zone-content">
                        <div class="drop-icon">📁</div>
                        <h3>Drop HTML files here or click to browse</h3>
                        <p>Upload single or multiple HTML template files</p>
                        <button class="btn btn-primary" id="browseFilesBtn">
                            <i data-feather="upload"></i>
                            Browse Files
                        </button>
                    </div>
                    <input type="file" id="fileInput" multiple accept=".html,.htm" style="display: none;">
                </div>

                <div class="upload-progress" id="uploadProgress" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                    <div class="progress-text" id="progressText">Processing files...</div>
                </div>
            </div>
        `;

        this.setupFileUploadEvents();
        feather.replace();
    }

    static setupFileUploadEvents() {
        const dropZone = document.getElementById('fileDropZone');
        const fileInput = document.getElementById('fileInput');
        const browseBtn = document.getElementById('browseFilesBtn');

        browseBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileSelection(e.target.files));

        dropZone.addEventListener('dragover', this.handleDragOver.bind(this));
        dropZone.addEventListener('drop', this.handleFileDrop.bind(this));
        dropZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
    }

    static handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
    }

    static handleFileDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        this.handleFileSelection(e.dataTransfer.files);
    }

    static handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    static async handleFileSelection(files) {
        if (!files || files.length === 0) return;

        try {
            document.getElementById('uploadProgress').style.display = 'block';
            await TemplateUploader.handleFileSelection(files);
        } catch (error) {
            ErrorHandler.showUserError('Failed to process files', 'error');
        }
    }

    static updateProgress(data) {
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');

        if (progressFill) progressFill.style.width = `${data.progress}%`;
        if (progressText) progressText.textContent = `Processing ${data.fileName}...`;
    }

    static showMetadataStep(data) {
        this.currentStep = 'metadata';
        this.renderMetadataStep(data.files);
    }

    static renderMetadataStep(files) {
        const content = document.getElementById('uploadModalContent');
        const summary = UploadPreview.getPreviewSummary(files);

        // Remove wide modal class for metadata step
        const modal = document.getElementById('uploadTemplatesModal');
        if (modal) {
            modal.classList.remove('modal-preview-wide');
        }

        content.innerHTML = `
            <h2>Template Information</h2>

            <div class="upload-step metadata-step">
                <div class="step-content">
                    <div class="metadata-form">
                        <div class="form-field">
                            <label for="templateName">Template Name *</label>
                            <input type="text" id="templateName"
                                   placeholder="e.g., Client Proposal Template"
                                   required
                                   maxlength="100">
                            <div class="field-validation" id="templateNameValidation"></div>
                            <div class="field-help">
                                <span class="field-tip">Use a clear, descriptive name that identifies the template's purpose</span>
                            </div>
                        </div>

                        <div class="form-field">
                            <label for="templateCategory">Category *</label>
                            <select id="templateCategory" required>
                                <option value="">Select category...</option>
                                ${this.existingCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                                <option value="__custom__">Add new category...</option>
                            </select>
                            <input type="text" id="customCategory" placeholder="New category name" style="display: none;">
                        </div>

                        <div class="form-field">
                            <label for="templateDescription">Description</label>
                            <textarea id="templateDescription"
                                      placeholder="Describe what this template is for and when to use it. e.g., 'Standard client proposal format with cover page, team introduction, services overview, and call-to-action.'"
                                      rows="4"
                                      maxlength="500"></textarea>
                            <div class="field-help">
                                <span class="char-count">0/500 characters</span>
                                <span class="field-tip">Good descriptions help users choose the right template</span>
                            </div>
                        </div>

                        <div class="form-field">
                            <label for="templateVersion">Version</label>
                            <input type="text" id="templateVersion" value="1.0" placeholder="1.0" pattern="[0-9]+\.[0-9]+(\.[0-9]+)?">
                            <div class="field-help">
                                <span class="field-tip">Use semantic versioning (e.g., 1.0, 1.2, 2.0)</span>
                            </div>
                        </div>
                    </div>

                    <div class="upload-summary">
                        <h4>Upload Summary</h4>
                        <div class="summary-stats">
                            <div class="stat">
                                <span class="stat-number">${summary.totalPages}</span>
                                <span class="stat-label">Pages</span>
                            </div>
                            <div class="stat">
                                <span class="stat-number">${summary.validPages}</span>
                                <span class="stat-label">Valid</span>
                            </div>
                            <div class="stat">
                                <span class="stat-number">${summary.totalErrors}</span>
                                <span class="stat-label">Errors</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="step-actions">
                    <button class="btn btn-secondary" id="backToUpload">
                        <i data-feather="arrow-left"></i>
                        Back
                    </button>
                    <button class="btn btn-primary" id="proceedToPreview" ${summary.totalErrors > 0 ? 'disabled' : ''}>
                        Next: Preview
                        <i data-feather="arrow-right"></i>
                    </button>
                </div>
            </div>
        `;

        this.setupMetadataEvents();
        feather.replace();
    }

    static setupMetadataEvents() {
        const templateName = document.getElementById('templateName');
        const templateCategory = document.getElementById('templateCategory');
        const customCategory = document.getElementById('customCategory');
        const templateDescription = document.getElementById('templateDescription');
        const backBtn = document.getElementById('backToUpload');
        const nextBtn = document.getElementById('proceedToPreview');

        templateName.addEventListener('blur', this.validateTemplateName.bind(this));
        templateCategory.addEventListener('change', this.handleCategoryChange.bind(this));
        templateDescription.addEventListener('input', this.updateCharacterCount.bind(this));
        backBtn.addEventListener('click', () => this.renderUploadStep());
        nextBtn.addEventListener('click', this.proceedToPreview.bind(this));
    }

    static async validateTemplateName() {
        const input = document.getElementById('templateName');
        const validation = document.getElementById('templateNameValidation');
        const name = input.value.trim();

        if (!name) {
            validation.innerHTML = '<div class="error">Template name is required</div>';
            return false;
        }

        const result = await TemplateUploader.validateTemplateName(name);
        if (!result.valid) {
            validation.innerHTML = `<div class="error">${result.message}</div>`;
            return false;
        }

        validation.innerHTML = '<div class="success">✓ Name available</div>';
        return true;
    }

    static handleCategoryChange() {
        const select = document.getElementById('templateCategory');
        const customInput = document.getElementById('customCategory');

        if (select.value === '__custom__') {
            customInput.style.display = 'block';
            customInput.required = true;
        } else {
            customInput.style.display = 'none';
            customInput.required = false;
        }
    }

    static updateCharacterCount() {
        const textarea = document.getElementById('templateDescription');
        const charCount = document.querySelector('.char-count');

        if (textarea && charCount) {
            const currentLength = textarea.value.length;
            const maxLength = textarea.getAttribute('maxlength') || 500;
            charCount.textContent = `${currentLength}/${maxLength} characters`;

            // Add visual feedback when approaching limit
            if (currentLength > maxLength * 0.9) {
                charCount.style.color = '#d32f2f';
            } else if (currentLength > maxLength * 0.75) {
                charCount.style.color = '#f57c00';
            } else {
                charCount.style.color = 'var(--color-cool-gray)';
            }
        }
    }

    static async proceedToPreview() {
        const templateName = document.getElementById('templateName').value.trim();
        const categorySelect = document.getElementById('templateCategory');
        const customCategory = document.getElementById('customCategory').value.trim();
        const description = document.getElementById('templateDescription').value.trim();
        const version = document.getElementById('templateVersion').value.trim();

        const category = categorySelect.value === '__custom__' ? customCategory : categorySelect.value;


        if (!templateName || !category) {
            ErrorHandler.showUserError('Please fill in all required fields', 'error');
            return;
        }

        const isValidName = await this.validateTemplateName();
        if (!isValidName) return;

        TemplateUploader.collectMetadata(templateName, category, description, version);
        this.currentStep = 'preview';
        this.renderPreviewStep();
    }

    static renderPreviewStep() {
        const session = TemplateUploader.getUploadSession();
        const content = document.getElementById('uploadModalContent');

        console.log('renderPreviewStep called with session:', session);

        if (!content) {
            console.error('uploadModalContent not found!');
            return;
        }

        // Add wide modal class for preview step
        const modal = document.getElementById('uploadTemplatesModal');
        if (modal) {
            console.log('Adding modal-preview-wide class to modal:', modal);
            modal.classList.add('modal-preview-wide');
            console.log('Modal classes after adding:', modal.className);

            // Check if the modal content has the right classes
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                console.log('Modal content classes:', modalContent.className);
            }
        }

        content.innerHTML = `
            <h2>Review & Upload</h2>

            <div class="upload-step preview-step">
                <div class="step-sections">
                    <div class="section page-ordering">
                        <h4>Page Order</h4>
                        <div id="pageOrderContainer"></div>
                    </div>

                    <div class="section page-previews">
                        <h4>Page Previews</h4>
                        <div id="pagePreviewContainer"></div>
                    </div>
                </div>

                <div class="step-actions">
                    <button class="btn btn-secondary" id="backToMetadata">
                        <i data-feather="arrow-left"></i>
                        Back
                    </button>
                    <button class="btn btn-success" id="uploadTemplates" data-action="start-upload">
                        <i data-feather="upload-cloud"></i>
                        Upload Template
                    </button>
                </div>
            </div>
        `;

        console.log('HTML inserted, now rendering components...');

        try {
            PageOrderManager.renderOrderableList(session.pageOrder, 'pageOrderContainer');
            console.log('PageOrderManager rendered successfully');
        } catch (error) {
            console.error('PageOrderManager failed:', error);
        }

        try {
            UploadPreview.renderPreviewGrid(session.pageOrder, 'pagePreviewContainer');
            console.log('UploadPreview rendered successfully');
        } catch (error) {
            console.error('UploadPreview failed:', error);
            // Fallback: show basic preview content
            const previewContainer = document.getElementById('pagePreviewContainer');
            if (previewContainer) {
                previewContainer.innerHTML = `
                    <div style="padding: 20px; text-align: center; border: 1px solid #ddd; border-radius: 8px;">
                        <p>Preview generation failed. ${session.pageOrder.length} page(s) ready for upload.</p>
                    </div>
                `;
            }
        }

        const backBtn = document.getElementById('backToMetadata');

        console.log('Preview step buttons found:', { backBtn: !!backBtn });

        if (backBtn) {
            backBtn.addEventListener('click', () => this.renderMetadataStep(session.pageOrder));
            console.log('Back button event listener added');
        }


        feather.replace();
    }

    static handlePageReorder(data) {
        const session = TemplateUploader.getUploadSession();
        const newOrder = [...session.pageOrder];
        const [movedItem] = newOrder.splice(data.fromIndex, 1);
        newOrder.splice(data.toIndex, 0, movedItem);

        TemplateUploader.updatePageOrder(newOrder);
        this.renderPreviewStep();
    }

    static async startUpload() {
        try {
            this.currentStep = 'processing';
            this.renderProcessingStep();
            await TemplateUploader.saveToFileSystem();
        } catch (error) {
            ErrorHandler.showUserError('Upload failed', 'error');
        }
    }

    static renderProcessingStep() {
        const content = document.getElementById('uploadModalContent');
        content.innerHTML = `
            <h2>Uploading Template</h2>
            <div class="upload-processing">
                <div class="loading-spinner"></div>
                <p>Saving template files...</p>
            </div>
        `;
    }

    static async handleUploadComplete(data) {
        ErrorHandler.showSuccess(`Template "${data.templateName}" uploaded successfully! It's now available when creating new projects.`);
        await this.loadExistingCategories();
        this.closeModal();
        EventBus.emit('templates:refresh-needed');
    }

    static handleUploadError(data) {
        ErrorHandler.showUserError(data.message, 'error');
        this.renderPreviewStep();
    }
}

export default UploadModalManager;