const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const FileWatcher = require('./src/modules/core/FileWatcher');

class BrochureApp {
    constructor() {
        this.window = null;
        this.basePath = null;
        this.isDev = process.argv.includes('--dev');
        this.fileWatcher = null;
    }

    async initialize() {
        await this.setupBasePath();
        await this.createFolderStructure();
        this.createWindow();
        this.setupIPC();
        this.initFileWatcher();
    }

    async setupBasePath() {
        const homedir = os.homedir();
        this.basePath = path.join(
            homedir,
            'Library/CloudStorage/OneDrive-Unimed',
            '3 Big Things Management Folder',
            'Brand',
            'Brochure',
            'Document Assembly'
        );

        console.log('Base path:', this.basePath);
    }

    async createFolderStructure() {
        const folders = [
            'Templates',
            'Images',
            'Images/cache',
            'Projects',
            'Exports/PDF',
            'Exports/Templates',
            'Config'
        ];

        try {
            for (const folder of folders) {
                const folderPath = path.join(this.basePath, folder);
                await fs.mkdir(folderPath, { recursive: true });
            }
            console.log('Folder structure created successfully');
        } catch (error) {
            console.error('Error creating folder structure:', error);
        }
    }

    createWindow() {
        this.window = new BrowserWindow({
            width: 1600,
            height: 1000,
            minWidth: 1200,
            minHeight: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            },
            titleBarStyle: 'default',
            title: 'Brochure - 3BT Document Assembly',
            icon: path.join(__dirname, 'assets', 'icon.png'),
            show: false
        });

        this.window.loadFile('src/index.html');

        this.window.once('ready-to-show', () => {
            this.window.show();
        });

        if (this.isDev) {
            this.window.webContents.openDevTools();
        }

        this.window.on('closed', () => {
            this.window = null;
        });
    }

    setupIPC() {
        ipcMain.handle('get-base-path', () => this.basePath);

        ipcMain.handle('check-onedrive-access', async () => {
            try {
                await fs.access(this.basePath);
                return { success: true };
            } catch (error) {
                return {
                    success: false,
                    error: 'OneDrive folder not accessible. Please ensure OneDrive is synced.'
                };
            }
        });

        ipcMain.handle('load-templates', () => this.loadTemplates());

        ipcMain.handle('save-project', (event, project) => this.saveProject(project));

        ipcMain.handle('load-project', (event, filename) => this.loadProject(filename));


        ipcMain.handle('export-pdf', (event, html, filename) => {
            console.log('🎯 IPC export-pdf handler called with filename:', filename);
            return this.exportPDF(html, filename);
        });

        ipcMain.handle('export-page-as-template', (event, data) => this.exportPageAsTemplate(data));

        ipcMain.handle('load-images', () => this.loadImages());

        ipcMain.handle('list-projects', () => this.listProjects());
        ipcMain.handle('delete-project', (event, filename) => this.deleteProject(filename));
        ipcMain.handle('show-in-finder', (event, path) => this.showInFinder(path));

        // Template Upload IPC Handlers
        ipcMain.handle('upload-template-batch', (event, uploadData) => this.uploadTemplateBatch(uploadData));
        ipcMain.handle('validate-template-name', (event, templateName) => this.validateTemplateName(templateName));
        ipcMain.handle('get-template-categories', () => this.getTemplateCategories());
    }

    async loadTemplates() {
        const templatesPath = path.join(this.basePath, 'Templates');
        const templates = [];

        try {
            const dirs = await fs.readdir(templatesPath);

            for (const dir of dirs) {
                if (dir.startsWith('.')) continue;

                const dirPath = path.join(templatesPath, dir);
                const stat = await fs.lstat(dirPath);

                if (stat.isDirectory()) {
                    const pagesPath = path.join(dirPath, 'pages');

                    if (await this.exists(pagesPath)) {
                        // This is a template folder (old structure)
                        await this.loadTemplateFromPath(dir, dirPath, templates);
                    } else {
                        // This is a category folder (new structure) - scan for templates inside
                        const categoryTemplates = await fs.readdir(dirPath);

                        for (const templateDir of categoryTemplates) {
                            if (templateDir.startsWith('.')) continue;

                            const templatePath = path.join(dirPath, templateDir);
                            const templateStat = await fs.lstat(templatePath);

                            if (templateStat.isDirectory()) {
                                await this.loadTemplateFromPath(templateDir, templatePath, templates, dir);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            throw new Error('Failed to load templates. Please check OneDrive connection.');
        }

        console.log(`Loaded ${templates.length} template pages`);
        return templates;
    }

    async loadTemplateFromPath(templateName, templatePath, templates, categoryOverride = null) {
        const pagesPath = path.join(templatePath, 'pages');
        const metadataPath = path.join(templatePath, 'metadata.json');

        if (!await this.exists(pagesPath)) return;

        let metadata = {
            name: templateName,
            category: categoryOverride || 'general',
            version: '1.0',
            pages: []
        };

        if (await this.exists(metadataPath)) {
            try {
                const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                const loadedMetadata = JSON.parse(metadataContent);
                metadata = { ...metadata, ...loadedMetadata };

                // Override category if this template is in a category folder
                if (categoryOverride) {
                    metadata.category = categoryOverride;
                }
            } catch (error) {
                console.warn(`Invalid metadata for template ${templateName}:`, error);
            }
        }

        const pages = await fs.readdir(pagesPath);
        for (const page of pages) {
            if (page.endsWith('.html')) {
                try {
                    const content = await fs.readFile(
                        path.join(pagesPath, page),
                        'utf-8'
                    );
                    templates.push({
                        id: `${templateName}-${page.replace('.html', '')}`,
                        name: page.replace('.html', '').replace(/^page-\d+-/, ''),
                        filename: page,
                        template: templateName,
                        category: metadata.category,
                        content: content,
                        metadata: metadata
                    });
                } catch (error) {
                    console.warn(`Error loading page ${page} from template ${templateName}:`, error);
                }
            }
        }
    }

    async saveProject(project) {
        const projectsPath = path.join(this.basePath, 'Projects');
        const safeTitle = project.metadata.title.replace(/[^a-zA-Z0-9-_]/g, '-');
        const filename = `${safeTitle}.3bt`;
        const projectPath = path.join(projectsPath, filename);

        project.metadata.modified = new Date().toISOString();

        try {
            await fs.writeFile(projectPath, JSON.stringify(project, null, 2));
            console.log('Project saved:', filename);
            return { success: true, path: projectPath, filename };
        } catch (error) {
            console.error('Error saving project:', error);
            throw new Error('Failed to save project');
        }
    }

    async loadProject(filename) {
        const projectPath = path.join(this.basePath, 'Projects', filename);

        try {
            // Check if file exists
            if (!(await this.exists(projectPath))) {
                throw new Error(`Project file "${filename}" not found`);
            }

            const content = await fs.readFile(projectPath, 'utf-8');
            const project = JSON.parse(content);
            console.log('Project loaded:', filename);
            return project;
        } catch (error) {
            console.error('Error loading project:', error);
            if (error.message.includes('not found')) {
                throw error;
            }
            throw new Error('Failed to load project: ' + error.message);
        }
    }


    async exportPDF(html, filename) {
        console.log('📄 Starting PDF export for:', filename);
        const timestamp = new Date().toISOString().split('T')[0];
        const safeName = filename.replace(/[^\w\s-]/g, '').trim();
        const exportDir = path.join(this.basePath, 'Exports', 'PDF', `${timestamp}-${safeName}`);
        console.log('📁 Creating export directory:', exportDir);
        await fs.mkdir(exportDir, { recursive: true });

        const exportPath = path.join(exportDir, `${safeName}.pdf`);
        console.log('📄 Target PDF path:', exportPath);

        try {
            // Save original HTML for comparison
            console.log('💾 Saving original HTML...');
            const originalHtmlPath = path.join(exportDir, `${safeName}-original.html`);
            await fs.writeFile(originalHtmlPath, html);
            console.log('📄 Original HTML saved to:', originalHtmlPath);

            // Create optimized HTML for PDF export
            console.log('🔧 Creating optimized HTML...');
            const optimizedHTML = this.createPrintOptimizedHTML(html);
            console.log('🔧 Optimized HTML length:', optimizedHTML.length);

            // Save optimized HTML for debugging
            const debugHtmlPath = path.join(exportDir, `${safeName}-optimized.html`);
            await fs.writeFile(debugHtmlPath, optimizedHTML);
            console.log('🐛 Optimized HTML saved to:', debugHtmlPath);

            // Create a hidden BrowserWindow for PDF generation
            console.log('🪟 Creating PDF window...');
            const pdfWindow = new BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: false // Allow local resources
                },
                width: 794, // A4 width in pixels at 96dpi (210mm)
                height: 1123 // A4 height in pixels at 96dpi (297mm)
            });

            // Load the HTML content
            console.log('📥 Loading HTML into window...');

            // Set up load event handlers before loading
            const loadPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    console.log('⚠️ Page load timeout after 30 seconds');
                    reject(new Error('Page load timeout'));
                }, 30000);

                pdfWindow.webContents.once('did-finish-load', () => {
                    console.log('✅ Page loaded successfully');
                    clearTimeout(timeout);
                    setTimeout(resolve, 2000); // Wait for fonts/images
                });

                pdfWindow.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
                    console.log('❌ Page failed to load:', errorCode, errorDescription);
                    clearTimeout(timeout);
                    reject(new Error(`Page load failed: ${errorDescription}`));
                });
            });

            try {
                await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(optimizedHTML)}`);
                console.log('⏳ Waiting for page load completion...');
                await loadPromise;
                console.log('✅ Page load completed, proceeding to PDF generation');
            } catch (loadError) {
                console.log('💥 Load error, trying alternative approach:', loadError.message);
                // Try writing to temp file instead of data URL
                const tempPath = path.join(os.tmpdir(), `brochure-export-${Date.now()}.html`);
                await fs.writeFile(tempPath, optimizedHTML);
                console.log('📝 Wrote temp file:', tempPath);
                await pdfWindow.loadFile(tempPath);
                console.log('✅ Loaded from temp file');
                setTimeout(() => fs.unlink(tempPath).catch(() => {}), 5000); // Cleanup
            }

            // Generate PDF
            console.log('🖨️ Generating PDF...');
            const pdfData = await pdfWindow.webContents.printToPDF({
                pageSize: 'A4',
                margins: {
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0
                },
                printBackground: true,
                landscape: false,
                preferCSSPageSize: true
            });
            console.log('✅ PDF generated, size:', pdfData.length, 'bytes');

            // Save PDF to file
            console.log('💾 Saving PDF to file...');
            await fs.writeFile(exportPath, pdfData);

            // Clean up
            console.log('🧹 Cleaning up...');
            pdfWindow.close();

            console.log('PDF exported successfully:', exportPath);
            return {
                success: true,
                path: exportPath,
                directory: exportDir,
                filename: `${safeName}.pdf`
            };

        } catch (error) {
            console.error('Error exporting PDF:', error);
            return {
                success: false,
                error: error.message || 'Failed to export PDF'
            };
        }
    }

    createPrintOptimizedHTML(html) {
        console.log('🔍 createPrintOptimizedHTML input length:', html.length);
        console.log('🔍 Input contains DOCTYPE:', html.includes('<!DOCTYPE'));
        console.log('🔍 Input contains <html:', html.includes('<html'));

        // Check if this is already a well-formed HTML document from ProjectManager
        const isWellFormedHTML = html.trim().startsWith('<!DOCTYPE html>') &&
                                html.includes('<head>') &&
                                html.includes('<body>') &&
                                html.includes('</body>') &&
                                html.includes('</html>');

        if (isWellFormedHTML) {
            console.log('✅ Input is already a well-formed HTML document from ProjectManager');
            console.log('✅ Passing through unchanged to preserve template styles');
            return html;
        }

        console.log('🧹 Input appears to be HTML fragments, applying cleanup...');

        // COMPLETELY STRIP ALL HTML DOCUMENT STRUCTURES
        let bodyContent = html;

        console.log('🧹 AGGRESSIVELY CLEANING HTML STRUCTURES...');

        // Step 1: Remove ALL instances of DOCTYPE declarations
        bodyContent = bodyContent.replace(/<!DOCTYPE[^>]*>/gi, '');
        console.log('📄 After DOCTYPE removal, length:', bodyContent.length);

        // Step 2: Remove ALL opening and closing html tags
        bodyContent = bodyContent.replace(/<\/?html[^>]*>/gi, '');
        console.log('📄 After HTML tag removal, length:', bodyContent.length);

        // Step 3: Remove ALL head sections completely
        bodyContent = bodyContent.replace(/<head[^>]*>.*?<\/head>/gis, '');
        console.log('📄 After HEAD removal, length:', bodyContent.length);

        // Step 4: Remove ALL opening and closing body tags (keep content inside)
        bodyContent = bodyContent.replace(/<\/?body[^>]*>/gi, '');
        console.log('📄 After BODY tag removal, length:', bodyContent.length);

        // Step 5: Remove ALL style tags since styles are already consolidated in HEAD
        bodyContent = bodyContent.replace(/<style[^>]*>.*?<\/style>/gs, '');
        console.log('📄 After STYLE removal, length:', bodyContent.length);

        // Step 6: Remove ALL script tags
        bodyContent = bodyContent.replace(/<script[^>]*>.*?<\/script>/gs, '');
        console.log('📄 After SCRIPT removal, length:', bodyContent.length);

        // Step 7: Remove meta tags and link tags that might be left over
        bodyContent = bodyContent.replace(/<meta[^>]*>/gi, '');
        bodyContent = bodyContent.replace(/<link[^>]*>/gi, '');
        console.log('📄 After META/LINK removal, length:', bodyContent.length);

        // Step 8: Clean up excessive whitespace
        bodyContent = bodyContent.replace(/\s*\n\s*\n\s*/g, '\n').trim();
        console.log('📄 After whitespace cleanup, length:', bodyContent.length);

        // Final validation - this should NEVER find any HTML document structures
        const hasDoctype = bodyContent.includes('<!DOCTYPE');
        const hasHtml = bodyContent.includes('<html');
        const hasHead = bodyContent.includes('<head');
        const hasBody = bodyContent.includes('<body');

        console.log('🔍 Final validation:');
        console.log('  - Contains DOCTYPE:', hasDoctype);
        console.log('  - Contains <html:', hasHtml);
        console.log('  - Contains <head:', hasHead);
        console.log('  - Contains <body:', hasBody);

        if (hasDoctype || hasHtml || hasHead || hasBody) {
            console.log('🚨 CRITICAL ERROR: HTML structures still found after cleanup!');
            console.log('📄 First 500 chars:', bodyContent.substring(0, 500));
        }

        console.log('📝 Final body content length:', bodyContent.length);
        console.log('🔍 Body content starts with:', bodyContent.substring(0, 100) + '...');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Export</title>

    <!-- Google Fonts for PDF export -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <style>
        /* PDF Export Optimized Styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        :root {
            /* 3 Big Things Brand Colors */
            --color-teal: #0A6B7C;
            --color-teal-dark: #045563;
            --color-orange: #E68A2E;
            --color-sand: #D4AE80;
            --color-sand-light: #E8D4BC;
            --color-warm-white: #FAF7F4;
            --color-charcoal: #2E2E2E;
            --color-cool-gray: #8C9A9E;
            --color-soft-sage: #A9C1B5;
        }

        /* Critical PDF Settings */
        @page {
            size: A4 portrait;
            margin: 0;
        }

        body {
            font-family: 'Source Sans 3', -apple-system, sans-serif;
            color: var(--color-charcoal);
            line-height: 1.4;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        /* Page container for each page */
        .page {
            width: 210mm;
            height: 297mm;
            position: relative;
            overflow: hidden;
            page-break-after: always;
            page-break-inside: avoid;
            background: white;
            display: block;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        /* Remove page break after last page */
        .page:last-child {
            page-break-after: avoid;
        }

        /* Hide interactive elements and edit indicators */
        .image-overlay,
        .zone-controls,
        .zone-resize-handle,
        .edit-controls,
        .edit-indicator,
        .selected,
        [data-editable].selected,
        [contenteditable],
        input[type="file"],
        .image-input {
            display: none !important;
        }

        /* Preserve image aspect ratios and prevent distortion */
        img {
            max-width: 100% !important;
            height: auto !important;
            object-fit: contain !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        /* Specific fixes for profile and circular images */
        .profile-pic,
        .profile-image,
        [class*="profile"] img,
        [class*="team"] img,
        [class*="member"] img {
            width: auto !important;
            height: auto !important;
            max-width: 150px !important;
            max-height: 150px !important;
            object-fit: cover !important;
            aspect-ratio: 1/1 !important;
            border-radius: 50% !important;
        }

        /* Preserve all background colors, gradients, and images */
        [style*="background"],
        [class*="bg-"],
        [class*="background"],
        .hero-section,
        .header-section,
        .cover-section,
        .teal-section,
        section,
        div[style*="background-color"],
        div[style*="background-image"],
        div[style*="background"] {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        /* Typography optimization for print */
        h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
            font-family: 'Lora', serif;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        p {
            orphans: 3;
            widows: 3;
        }

        /* Specific brand color preservation */
        .teal-bg,
        .bg-teal,
        [style*="background-color: #0A6B7C"],
        [style*="background-color: var(--color-teal)"],
        [style*="background: #0A6B7C"],
        [style*="background: var(--color-teal)"] {
            background-color: #0A6B7C !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        .orange-bg,
        .bg-orange,
        [style*="background-color: #E68A2E"],
        [style*="background-color: var(--color-orange)"],
        [style*="background: #E68A2E"],
        [style*="background: var(--color-orange)"] {
            background-color: #E68A2E !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        /* Ensure text is crisp */
        * {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }
    </style>
</head>
<body>
    ${bodyContent}
    <script>
        // Post-load fixes for PDF generation
        document.addEventListener('DOMContentLoaded', function() {
            // Force background color preservation
            const elementsWithStyle = document.querySelectorAll('[style*="background"]');
            elementsWithStyle.forEach(el => {
                el.style.webkitPrintColorAdjust = 'exact';
                el.style.colorAdjust = 'exact';
                el.style.printColorAdjust = 'exact';
            });

            // Fix profile image aspect ratios
            const profileImages = document.querySelectorAll('.profile-pic, .profile-image, [class*="profile"] img, [class*="team"] img, [class*="member"] img');
            profileImages.forEach(img => {
                img.style.objectFit = 'cover';
                img.style.aspectRatio = '1/1';
                img.style.borderRadius = '50%';
                img.style.maxWidth = '150px';
                img.style.maxHeight = '150px';
            });

            // Remove any remaining edit indicators
            const editElements = document.querySelectorAll('.selected, [data-editable].selected, .edit-indicator');
            editElements.forEach(el => {
                el.classList.remove('selected');
                const indicator = el.querySelector('.edit-indicator');
                if (indicator) indicator.remove();
            });
        });
    </script>
</body>
</html>`;
    }

    async loadImages() {
        const imagesPath = path.join(this.basePath, 'Images');
        const csvPath = path.join(imagesPath, '3bigthings_images_summary.csv');
        const images = [];

        try {
            if (await this.exists(csvPath)) {
                const csvContent = await fs.readFile(csvPath, 'utf-8');
                const lines = csvContent.split('\n');

                // Skip header row
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line) {
                        const [filename, page, url, description, suggestedUses] = line.split(',');
                        if (filename && url) {
                            images.push({
                                filename: filename.trim(),
                                page: page ? page.trim() : '',
                                url: url.trim(),
                                description: description ? description.trim() : '',
                                suggestedUses: suggestedUses ? suggestedUses.trim() : ''
                            });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading images:', error);
        }

        console.log(`Loaded ${images.length} images from library`);
        return images;
    }

    async listProjects() {
        const projectsPath = path.join(this.basePath, 'Projects');
        const projects = [];

        try {
            const files = await fs.readdir(projectsPath);

            for (const file of files) {
                if (file.endsWith('.3bt') && !file.endsWith('.lock')) {
                    try {
                        const filePath = path.join(projectsPath, file);
                        const stats = await fs.stat(filePath);
                        const content = await fs.readFile(filePath, 'utf-8');
                        const project = JSON.parse(content);

                        projects.push({
                            filename: file,
                            title: project.metadata.title || 'Untitled',
                            client: project.metadata.client || '',
                            modified: stats.mtime,
                            pages: project.pages ? project.pages.length : 0
                        });
                    } catch (error) {
                        console.warn(`Error reading project ${file}:`, error);
                    }
                }
            }

            // Sort by modified date, newest first
            projects.sort((a, b) => new Date(b.modified) - new Date(a.modified));

        } catch (error) {
            console.error('Error listing projects:', error);
        }

        return projects;
    }

    async deleteProject(filename) {
        const projectsPath = path.join(this.basePath, 'Projects');
        const projectFile = path.join(projectsPath, filename);
        const lockFile = path.join(projectsPath, `${filename}.lock`);

        try {
            // Delete the main project file
            await fs.unlink(projectFile);

            // Delete the lock file if it exists
            try {
                await fs.unlink(lockFile);
            } catch (lockError) {
                // Lock file might not exist, that's okay
            }

            return { success: true, message: 'Project deleted successfully' };
        } catch (error) {
            console.error('Error deleting project:', error);
            return { success: false, error: error.message };
        }
    }

    async exists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async uploadTemplateBatch(uploadData) {
        try {
            console.log('uploadTemplateBatch received data:', uploadData);
            const { templateName, metadata, pages } = uploadData;

            if (!templateName) {
                console.error('templateName is missing from upload data:', uploadData);
                throw new Error('Template name is required but was not provided');
            }

            // Create category folder structure if new category
            const templatesPath = path.join(this.basePath, 'Templates');
            const categoryPath = path.join(templatesPath, metadata.category);

            // Ensure category folder exists
            if (!await this.exists(categoryPath)) {
                console.log(`Creating new category folder: ${metadata.category}`);
                await fs.mkdir(categoryPath, { recursive: true });
            }

            const templatePath = path.join(categoryPath, templateName);

            if (await this.exists(templatePath)) {
                return {
                    success: false,
                    error: `Template "${templateName}" already exists in category "${metadata.category}"`
                };
            }

            await fs.mkdir(templatePath, { recursive: true });
            await fs.mkdir(path.join(templatePath, 'pages'), { recursive: true });

            const metadataPath = path.join(templatePath, 'metadata.json');
            await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

            for (const page of pages) {
                const pagePath = path.join(templatePath, 'pages', page.fileName);
                await fs.writeFile(pagePath, page.htmlContent);
            }

            return {
                success: true,
                path: templatePath,
                category: metadata.category,
                message: `Template "${templateName}" uploaded successfully to category "${metadata.category}"`
            };

        } catch (error) {
            console.error('Error uploading template batch:', error);
            return {
                success: false,
                error: error.message || 'Failed to upload template'
            };
        }
    }

    async validateTemplateName(templateName) {
        try {
            const templatePath = path.join(this.basePath, 'Templates', templateName);
            const exists = await this.exists(templatePath);

            return {
                valid: !exists,
                message: exists ? 'Template name already exists' : 'Template name is available'
            };

        } catch (error) {
            console.error('Error validating template name:', error);
            return {
                valid: false,
                error: 'Failed to validate template name'
            };
        }
    }

    async getTemplateCategories() {
        try {
            const templatesPath = path.join(this.basePath, 'Templates');
            const categories = new Set();

            if (await this.exists(templatesPath)) {
                const dirs = await fs.readdir(templatesPath);

                for (const dir of dirs) {
                    if (dir.startsWith('.')) continue;

                    const dirPath = path.join(templatesPath, dir);
                    const stat = await fs.lstat(dirPath);

                    if (stat.isDirectory()) {
                        const pagesPath = path.join(dirPath, 'pages');

                        if (await this.exists(pagesPath)) {
                            // This is a template folder (old structure) - get category from metadata
                            const metadataPath = path.join(dirPath, 'metadata.json');
                            if (await this.exists(metadataPath)) {
                                try {
                                    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
                                    const metadata = JSON.parse(metadataContent);
                                    if (metadata.category) {
                                        categories.add(metadata.category);
                                    }
                                } catch (error) {
                                    categories.add('general');
                                }
                            } else {
                                categories.add('general');
                            }
                        } else {
                            // This is a category folder (new structure)
                            categories.add(dir);
                        }
                    }
                }
            }

            return {
                success: true,
                categories: Array.from(categories).sort()
            };

        } catch (error) {
            console.error('Error getting template categories:', error);
            return {
                success: false,
                categories: [],
                error: 'Failed to load categories'
            };
        }
    }

    initFileWatcher() {
        this.fileWatcher = new FileWatcher(this.basePath, this.window);
        this.fileWatcher.init();
    }

    destroyFileWatcher() {
        if (this.fileWatcher) {
            this.fileWatcher.destroy();
            this.fileWatcher = null;
        }
    }

    async exportPageAsTemplate(data) {
        try {
            const { pageName, html, metadata } = data;
            console.log('📄 Starting page template export for:', pageName);

            // Create safe folder name
            const safeName = pageName.replace(/[^\w\s-]/g, '').trim();
            const templateDir = path.join(this.basePath, 'Exports', 'Templates', safeName);

            console.log('📁 Creating template directory:', templateDir);
            await fs.mkdir(templateDir, { recursive: true });

            // Create pages subfolder
            const pagesDir = path.join(templateDir, 'pages');
            await fs.mkdir(pagesDir, { recursive: true });

            // Save the HTML file
            const htmlPath = path.join(pagesDir, `${safeName}.html`);
            await fs.writeFile(htmlPath, html);
            console.log('📄 HTML saved to:', htmlPath);

            // Save the metadata.json file
            const metadataPath = path.join(templateDir, 'metadata.json');
            await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
            console.log('📄 Metadata saved to:', metadataPath);

            console.log('✅ Page exported as template successfully');
            return {
                success: true,
                path: templateDir,
                htmlPath,
                metadataPath
            };

        } catch (error) {
            console.error('💥 Error exporting page as template:', error);
            return {
                success: false,
                error: error.message || 'Failed to export page as template'
            };
        }
    }

    showInFinder(path) {
        const { shell } = require('electron');
        shell.showItemInFolder(path);
    }
}

app.whenReady().then(() => {
    const brochureApp = new BrochureApp();
    brochureApp.initialize();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        const brochureApp = new BrochureApp();
        brochureApp.initialize();
    }
});