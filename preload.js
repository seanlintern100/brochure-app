const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getBasePath: () => ipcRenderer.invoke('get-base-path'),

    checkOneDriveAccess: () => ipcRenderer.invoke('check-onedrive-access'),

    loadTemplates: () => ipcRenderer.invoke('load-templates'),

    saveProject: (project) => ipcRenderer.invoke('save-project', project),

    loadProject: (filename) => ipcRenderer.invoke('load-project', filename),

    exportPDF: (html, filename) => ipcRenderer.invoke('export-pdf', html, filename),

    exportPageAsTemplate: (data) => ipcRenderer.invoke('export-page-as-template', data),

    loadImages: () => ipcRenderer.invoke('load-images'),

    listProjects: () => ipcRenderer.invoke('list-projects'),

    deleteProject: (filename) => ipcRenderer.invoke('delete-project', filename),
    showInFinder: (path) => ipcRenderer.invoke('show-in-finder', path),

    // Template Upload APIs
    uploadTemplateBatch: (uploadData) => ipcRenderer.invoke('upload-template-batch', uploadData),
    validateTemplateName: (templateName) => ipcRenderer.invoke('validate-template-name', templateName),
    getTemplateCategories: () => ipcRenderer.invoke('get-template-categories'),

    // File watching API
    onFileChange: (callback) => ipcRenderer.on('file-change', (event, data) => callback(data))
});