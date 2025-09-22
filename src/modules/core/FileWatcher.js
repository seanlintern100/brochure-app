const chokidar = require('chokidar');
const path = require('path');

class FileWatcher {
    constructor(basePath, window) {
        this.basePath = basePath;
        this.window = window;
        this.templateWatcher = null;
        this.csvWatcher = null;
    }

    init() {
        const templatesPath = path.join(this.basePath, 'Templates');
        const csvPath = path.join(this.basePath, 'Images', '3bigthings_images_summary.csv');

        console.log('Setting up file watching...');
        console.log('Templates path:', templatesPath);
        console.log('CSV path:', csvPath);

        // Watch templates folder
        this.templateWatcher = chokidar.watch(templatesPath, {
            ignored: /(^|[\/\\])\../,  // ignore dotfiles
            persistent: true,
            depth: 3,
            ignoreInitial: true  // Don't trigger on startup scan
        });

        // Watch image CSV file
        this.csvWatcher = chokidar.watch(csvPath, {
            persistent: true,
            ignoreInitial: true
        });

        this.bindEvents();
    }

    bindEvents() {
        // Template file changes
        this.templateWatcher
            .on('add', (filePath) => this.handleTemplateChange('added', filePath))
            .on('change', (filePath) => this.handleTemplateChange('changed', filePath))
            .on('unlink', (filePath) => this.handleTemplateChange('removed', filePath))
            .on('error', (error) => console.error('Template watcher error:', error));

        // Image CSV changes
        this.csvWatcher
            .on('change', () => this.handleImageLibraryChange())
            .on('error', (error) => console.error('CSV watcher error:', error));

        console.log('✅ File watchers initialized successfully');
    }

    async handleTemplateChange(event, filePath) {
        console.log(`📁 Template ${event}: ${filePath}`);

        try {
            // Notify renderer to reload templates
            if (this.window && !this.window.isDestroyed()) {
                this.window.webContents.send('file-change', {
                    type: 'templates',
                    event,
                    filePath
                });
                console.log('✅ Template change notification sent to renderer');
            }
        } catch (error) {
            console.error('Error handling template change:', error);
        }
    }

    async handleImageLibraryChange() {
        console.log('🖼️ Image library CSV updated');

        try {
            // Notify renderer to reload images
            if (this.window && !this.window.isDestroyed()) {
                this.window.webContents.send('file-change', {
                    type: 'images'
                });
                console.log('✅ Image library change notification sent to renderer');
            }
        } catch (error) {
            console.error('Error handling image library change:', error);
        }
    }

    destroy() {
        if (this.templateWatcher) {
            this.templateWatcher.close();
            this.templateWatcher = null;
        }
        if (this.csvWatcher) {
            this.csvWatcher.close();
            this.csvWatcher = null;
        }
        console.log('File watchers destroyed');
    }
}

module.exports = FileWatcher;