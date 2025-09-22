/**
 * ImageReplacer - Handle image replacement with overlay system
 *
 * Provides clean image replacement functionality without DOM corruption.
 * Stores changes as overlay data for reliable persistence.
 */

import OverlayManager from './OverlayManager.js';
import EventBus from '../core/EventBus.js';
import { EVENTS } from '../ui/constants.js';

class ImageReplacer {
    /**
     * Initialize image replacement system
     */
    static init() {
        console.log('🖼️ ImageReplacer initialized');
        this.setupEventListeners();
    }

    static setupEventListeners() {
        // Listen for zoom modal opening to enable image selection
        EventBus.on(EVENTS.MODAL_OPENED, (data) => {
            if (data.modalId === 'pageZoomModal') {
                this.setupImageSelection(data.data?.pageId);
            }
        });

        EventBus.on(EVENTS.MODAL_CLOSED, (data) => {
            if (data.modalId === 'pageZoomModal') {
                this.clearImageSelection();
            }
        });
    }

    /**
     * Setup image selection in the zoom modal iframe
     */
    static setupImageSelection(pageId) {
        if (!pageId) return;

        const zoomFrame = document.getElementById('zoomFrame');
        if (!zoomFrame) return;

        // Wait for iframe to load
        zoomFrame.onload = () => {
            const iframeDoc = zoomFrame.contentDocument;
            if (!iframeDoc) return;

            // Add click handlers to all images
            const images = iframeDoc.querySelectorAll('img');
            images.forEach((img, index) => {
                img.style.cursor = 'pointer';
                img.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.selectImage(img, pageId);
                });

                // Add hover effect
                img.addEventListener('mouseenter', () => {
                    img.style.outline = '2px solid var(--color-orange)';
                    img.style.outlineOffset = '2px';
                });

                img.addEventListener('mouseleave', () => {
                    if (!img.classList.contains('selected-image')) {
                        img.style.outline = '';
                        img.style.outlineOffset = '';
                    }
                });
            });

            console.log(`🖼️ Image selection enabled for ${images.length} images`);
        };
    }

    /**
     * Select an image for editing
     */
    static selectImage(imgElement, pageId) {
        // Clear previous selections
        this.clearImageSelection();

        // Mark as selected
        imgElement.classList.add('selected-image');
        imgElement.style.outline = '3px solid var(--color-teal)';
        imgElement.style.outlineOffset = '2px';

        // Generate selector for this image
        const selector = this.generateImageSelector(imgElement);

        // Show image replacement UI
        this.showImageReplacementUI(pageId, selector, imgElement.src);

        console.log('🖼️ Image selected:', selector);
    }

    /**
     * Generate CSS selector for an image element
     */
    static generateImageSelector(imgElement) {
        // Try to find a unique identifier
        if (imgElement.id) {
            return `#${imgElement.id}`;
        }

        // Try class names
        if (imgElement.className) {
            const classes = imgElement.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
                return `img.${classes.join('.')}`;
            }
        }

        // Try data attributes
        for (const attr of imgElement.attributes) {
            if (attr.name.startsWith('data-') && attr.value) {
                return `img[${attr.name}="${attr.value}"]`;
            }
        }

        // Try src-based selection (last resort)
        const srcParts = imgElement.src.split('/');
        const filename = srcParts[srcParts.length - 1];
        return `img[src*="${filename}"]`;
    }

    /**
     * Show image replacement UI in the editor panel
     */
    static showImageReplacementUI(pageId, selector, currentSrc) {
        // Show the image controls in the editor panel
        const imageControls = document.getElementById('imageControls');
        const noElementSelected = document.getElementById('noElementSelected');

        if (imageControls && noElementSelected) {
            noElementSelected.style.display = 'none';
            imageControls.style.display = 'block';

            // Update current image preview
            this.updateImagePreview(currentSrc);

            // Load image library
            this.loadImageLibrary(pageId, selector);
        }

        // Store current selection
        this.currentSelection = { pageId, selector, currentSrc };
    }

    /**
     * Update the current image preview in the UI
     */
    static updateImagePreview(imageSrc) {
        const imageLibrary = document.getElementById('elementImageLibrary');
        if (!imageLibrary) return;

        // Show current image at the top
        imageLibrary.innerHTML = `
            <div class="current-image-preview">
                <h5>Current Image</h5>
                <img src="${imageSrc}" alt="Current image" style="max-width: 100px; border: 2px solid var(--color-teal);">
            </div>
            <div class="image-replacement-grid">
                <p>Loading image library...</p>
            </div>
        `;
    }

    /**
     * Load available images for replacement
     */
    static loadImageLibrary(pageId, selector) {
        // TODO: Integrate with existing image library system
        // For now, create a placeholder
        const imageGrid = document.querySelector('.image-replacement-grid');
        if (!imageGrid) return;

        // Mock image library (replace with actual image library integration)
        const mockImages = [
            'https://via.placeholder.com/300x200/E68A2E/white?text=Sample+1',
            'https://via.placeholder.com/300x200/0A6B7C/white?text=Sample+2',
            'https://via.placeholder.com/300x200/D4AE80/white?text=Sample+3',
            'https://via.placeholder.com/300x200/A9C1B5/white?text=Sample+4'
        ];

        imageGrid.innerHTML = `
            <h5>Available Images</h5>
            <div class="image-thumbnails">
                ${mockImages.map(src => `
                    <img src="${src}"
                         alt="Replacement option"
                         class="replacement-thumbnail"
                         data-src="${src}"
                         onclick="ImageReplacer.replaceImage('${pageId}', '${selector}', '${src}')"
                         style="cursor: pointer; max-width: 80px; margin: 5px; border: 1px solid #ddd;">
                `).join('')}
            </div>
        `;
    }

    /**
     * Replace the selected image with a new source
     */
    static replaceImage(pageId, selector, newImageSrc) {
        // Store the change as overlay data
        OverlayManager.setImageOverlay(pageId, selector, newImageSrc);

        // Update the preview immediately
        this.updateImageInPreview(selector, newImageSrc);

        // Provide user feedback
        console.log('🖼️ Image replaced:', { pageId, selector, newImageSrc });

        // TODO: Show success message
        EventBus.emit(EVENTS.OVERLAY_CHANGED, {
            type: 'image',
            pageId,
            selector,
            value: newImageSrc
        });
    }

    /**
     * Update the image in the preview iframe
     */
    static updateImageInPreview(selector, newImageSrc) {
        const zoomFrame = document.getElementById('zoomFrame');
        if (!zoomFrame || !zoomFrame.contentDocument) return;

        const iframeDoc = zoomFrame.contentDocument;
        const targetImages = iframeDoc.querySelectorAll(selector);

        targetImages.forEach(img => {
            img.src = newImageSrc;
            img.setAttribute('src', newImageSrc); // Ensure it persists
        });
    }

    /**
     * Clear image selection
     */
    static clearImageSelection() {
        const zoomFrame = document.getElementById('zoomFrame');
        if (zoomFrame && zoomFrame.contentDocument) {
            const selectedImages = zoomFrame.contentDocument.querySelectorAll('.selected-image');
            selectedImages.forEach(img => {
                img.classList.remove('selected-image');
                img.style.outline = '';
                img.style.outlineOffset = '';
            });
        }

        // Hide image controls
        const imageControls = document.getElementById('imageControls');
        const noElementSelected = document.getElementById('noElementSelected');

        if (imageControls && noElementSelected) {
            imageControls.style.display = 'none';
            noElementSelected.style.display = 'block';
        }

        this.currentSelection = null;
    }

    /**
     * Reset image to original
     */
    static resetImage(pageId, selector) {
        if (!this.currentSelection) return;

        // Remove overlay for this image
        OverlayManager.removeOverlay(pageId, 'images', selector);

        // Reset preview to original
        // TODO: Get original image source from template
        console.log('🔄 Image reset to original');
    }
}

export default ImageReplacer;