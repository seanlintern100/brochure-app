export const Templates = {
    pageCard: (page, index, templateName) => `
        <div class="page-item" data-page-id="${page.id}">
            <div class="page-header">
                <div class="page-title">${index + 1}. ${templateName}</div>
                <div class="page-actions">
                    <button class="page-btn" data-action="move-page-up" data-page-id="${page.id}" title="Move Up" ${index === 0 ? 'disabled' : ''}>
                        <i data-feather="arrow-up"></i>
                    </button>
                    <button class="page-btn" data-action="move-page-down" data-page-id="${page.id}" title="Move Down">
                        <i data-feather="arrow-down"></i>
                    </button>
                    <button class="page-btn" data-action="duplicate-page" data-page-id="${page.id}" title="Duplicate">
                        <i data-feather="copy"></i>
                    </button>
                    <button class="page-btn delete" data-action="delete-page" data-page-id="${page.id}" title="Delete">
                        <i data-feather="trash"></i>
                    </button>
                </div>
            </div>
            <div class="page-preview" data-action="zoom-page" data-page-id="${page.id}">
                <div class="page-content">
                    <iframe class="page-preview-iframe" src="data:text/html;charset=utf-8,${encodeURIComponent(page.html)}"></iframe>
                </div>
            </div>
        </div>
    `,

    projectItem: (project) => `
        <div class="project-item" data-action="open-project" data-filename="${project.filename}">
            <div class="project-title">${project.title}</div>
            <div class="project-meta">
                <span>${project.client || 'No client'} • ${project.pages} pages</span>
                <span>${new Date(project.modified).toLocaleDateString()}</span>
            </div>
        </div>
    `,

    projectCard: (project, previewHtml = '') => `
        <div class="project-card" data-action="open-project" data-filename="${project.filename}" style="cursor: pointer;">
            <div class="project-preview">
                <div class="project-content">
                    ${previewHtml ?
                        `<iframe class="project-preview-iframe" src="data:text/html;charset=utf-8,${encodeURIComponent(previewHtml)}"></iframe>` :
                        `<div class="project-no-preview">No Pages</div>`
                    }
                </div>
            </div>
            <div class="project-info">
                <div class="project-title">${project.title}</div>
                <div class="project-meta">
                    <span class="project-client">${project.client || 'No client'}</span>
                    <span class="project-pages">${project.pages} pages</span>
                </div>
                <div class="project-date">${new Date(project.modified).toLocaleDateString()}</div>
            </div>
            <div class="project-actions">
                <button class="btn btn-primary project-open-btn" data-action="open-project" data-filename="${project.filename}">
                    <i data-feather="folder"></i>
                    Open
                </button>
                <button class="btn btn-danger project-delete-btn" data-action="delete-project" data-filename="${project.filename}" onclick="event.stopPropagation();">
                    <i data-feather="trash"></i>
                    Delete
                </button>
            </div>
        </div>
    `,

    templateItem: (template) => `
        <li class="template-item" data-template-id="${template.id}">
            <div class="template-info">
                <span class="template-name">${template.name}</span>
                <span class="template-badge">${template.template}</span>
            </div>
            <button class="template-add-btn" data-action="add-template-page" data-template-id="${template.id}">
                <i data-feather="plus"></i>
            </button>
        </li>
    `,

    templateCategory: (categoryName, templates) => `
        <div class="template-category">
            <div class="category-header" data-action="toggle-category">
                <div class="category-title">
                    <span>${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}</span>
                    <span class="template-count">(${templates.length})</span>
                </div>
                <i data-feather="chevron-down"></i>
            </div>
            <ul class="template-list">
                ${templates.map(template => Templates.templateItem(template)).join('')}
            </ul>
        </div>
    `,

    // New compact template library components
    templateCategoryCompact: (categoryName, templateGroups, isExpanded = true) => `
        <div class="template-category-compact" data-category="${categoryName}">
            <div class="category-header-compact" data-action="toggle-category" data-category="${categoryName}">
                <i data-feather="${isExpanded ? 'chevron-down' : 'chevron-right'}" class="category-chevron"></i>
                <i data-feather="folder" class="category-icon"></i>
                <span class="category-name">${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)}</span>
                <span class="category-count">(${templateGroups.length})</span>
            </div>
            <div class="template-groups" style="display: ${isExpanded ? 'block' : 'none'}">
                ${templateGroups.map(group => Templates.templateGroupCompact(group)).join('')}
            </div>
        </div>
    `,

    templateGroupCompact: (templateGroup) => `
        <div class="template-group-compact" data-template="${templateGroup.name}">
            <div class="template-header-compact" data-action="toggle-template" data-template="${templateGroup.name}">
                <i data-feather="chevron-right" class="template-chevron"></i>
                <i data-feather="file-text" class="template-icon"></i>
                <span class="template-name-compact">${templateGroup.name}</span>
                <span class="page-count">${templateGroup.pages.length} pages</span>
                <button class="add-template-btn-compact" data-action="add-full-template" data-template="${templateGroup.name}">
                    <i data-feather="plus"></i>
                    Add All
                </button>
            </div>
            <div class="template-pages" style="display: none">
                ${templateGroup.pages.map(page => Templates.templatePageCompact(page, templateGroup.name)).join('')}
            </div>
        </div>
    `,

    templatePageCompact: (page, templateName) => `
        <div class="template-page-compact" data-page-id="${page.id}">
            <i data-feather="file" class="page-icon"></i>
            <span class="page-name-compact">${page.pageName || page.name}</span>
            <button class="add-page-btn-compact" data-action="add-template-page" data-template-id="${page.id}">
                <i data-feather="plus"></i>
            </button>
        </div>
    `,

    addPageButton: () => `
        <button class="add-page-btn" data-action="show-add-page">
            <i data-feather="plus"></i>
            Drop template pages here or click to add
        </button>
    `,

    connectionStatus: (isConnected, message) => `
        <i data-feather="${isConnected ? 'check-circle' : 'alert-circle'}"
           style="color: ${isConnected ? '#2e7d32' : '#d32f2f'};"></i>
        <span>${message}</span>
    `,

    loadingSpinner: (message = 'Loading...') => `
        <div class="loading">
            <div class="loading-spinner"></div>
            <p>${message}</p>
        </div>
    `,

    errorMessage: (message, details = '') => `
        <div style="color: #d32f2f; text-align: center;">
            <i data-feather="alert-circle"></i>
            <p>${message}</p>
            ${details ? `<p style="font-size: 12px;">${details}</p>` : ''}
        </div>
    `,

    emptyState: (title, subtitle) => `
        <div style="text-align: center; padding: 40px; color: var(--color-cool-gray);">
            <p>${title}</p>
            <p style="font-size: 12px; margin-top: 10px;">${subtitle}</p>
        </div>
    `,

    imageThumb: (image) => `
        <div class="image-thumb" title="${image.description}" data-image-url="${image.url}">
            <img src="${image.url}" alt="${image.description}" loading="lazy"
                 onerror="this.parentElement.style.display='none'">
        </div>
    `,

    pagePreviewHTML: (content, styles = '') => `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Page Preview</title>
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <style>
                body {
                    margin: 0;
                    font-family: 'Source Sans 3', Arial, sans-serif;
                    background: white;
                    width: 850px;
                    height: 1200px;
                    transform: scale(0.35);
                    transform-origin: top left;
                    overflow: hidden;
                }
                html {
                    overflow: hidden;
                }
                ${styles}
            </style>
        </head>
        <body>
            ${content}
        </body>
        </html>
    `,

    // Helper function to set up iframe previews safely (minimal logging)
    setupScaledPreviews: (container) => {
        const scaledPreviews = container.querySelectorAll('[data-preview-html]');
        scaledPreviews.forEach(previewDiv => {
            const encodedHtml = previewDiv.getAttribute('data-preview-html');
            if (encodedHtml) {
                try {
                    // Create iframe with proper styling for preview cards
                    const iframe = document.createElement('iframe');
                    iframe.className = 'page-preview-iframe';
                    iframe.style.cssText = `
                        width: 100%;
                        height: 100%;
                        border: none;
                        transform: scale(0.35);
                        transform-origin: top left;
                        pointer-events: none;
                    `;

                    // Use srcdoc instead of data URL to reduce console logging
                    const decodedHtml = decodeURIComponent(encodedHtml);

                    // Wrap the content to ensure proper scaling behavior
                    iframe.srcdoc = `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <style>
                                body {
                                    margin: 0;
                                    overflow: hidden;
                                    width: 850px;
                                    height: 1200px;
                                    background: white;
                                }
                            </style>
                        </head>
                        <body>
                            ${decodedHtml}
                        </body>
                        </html>
                    `;

                    previewDiv.innerHTML = '';
                    previewDiv.appendChild(iframe);
                    previewDiv.removeAttribute('data-preview-html');
                } catch (error) {
                    // Fallback to placeholder if decoding fails
                    previewDiv.innerHTML = '<div class="preview-placeholder">Preview unavailable</div>';
                }
            }
        });
    }
};