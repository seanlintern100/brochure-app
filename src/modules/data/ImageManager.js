import StateManager from '../core/StateManager.js';
import EventBus from '../core/EventBus.js';
import ErrorHandler from '../core/ErrorHandler.js';
import { EVENTS } from '../ui/constants.js';

class ImageManager {
    static async loadImages() {
        try {
            const images = await window.electronAPI.loadImages();

            StateManager.setState({ imageLibrary: images });
            EventBus.emit(EVENTS.UI_UPDATE, { type: 'images-loaded', data: images });

            return images;
        } catch (error) {
            ErrorHandler.logError(error, 'ImageManager.loadImages', 'Failed to load image library');
            throw error;
        }
    }

    static getImages() {
        return StateManager.getState().imageLibrary || [];
    }

    static getImageByUrl(url) {
        const images = this.getImages();
        return images.find(image => image.url === url);
    }

    static getImagesByPage(page) {
        const images = this.getImages();
        return images.filter(image => image.page === page);
    }

    static searchImages(searchTerm) {
        const images = this.getImages();
        const term = searchTerm.toLowerCase();

        return images.filter(image =>
            image.filename?.toLowerCase().includes(term) ||
            image.description?.toLowerCase().includes(term) ||
            image.suggestedUses?.toLowerCase().includes(term)
        );
    }

    static getImageCount() {
        return this.getImages().length;
    }

    static getImagesByType(type) {
        const images = this.getImages();
        return images.filter(image => {
            const filename = image.filename || '';
            const extension = filename.split('.').pop()?.toLowerCase();

            switch (type) {
                case 'jpg':
                case 'jpeg':
                    return extension === 'jpg' || extension === 'jpeg';
                case 'png':
                    return extension === 'png';
                case 'gif':
                    return extension === 'gif';
                case 'svg':
                    return extension === 'svg';
                default:
                    return false;
            }
        });
    }

    static handleImageSelection(imageUrl) {
        const image = this.getImageByUrl(imageUrl);
        if (!image) {
            ErrorHandler.showUserError('Image not found', 'error');
            return;
        }

        // For now, just show a message about future functionality
        // In the future, this would integrate with the page editor
        ErrorHandler.showInfo('Image selected: ' + image.filename);

        EventBus.emit(EVENTS.UI_UPDATE, { type: 'image-selected', data: image });
    }

    static setupImageClickHandlers() {
        const imageGallery = document.getElementById('imageGallery');
        if (!imageGallery) return;

        // Remove existing listeners to prevent duplicates
        const existingThumbs = imageGallery.querySelectorAll('.image-thumb');
        existingThumbs.forEach(thumb => {
            thumb.removeEventListener('click', this._handleImageClick);
        });

        // Add new listeners
        const thumbs = imageGallery.querySelectorAll('.image-thumb');
        thumbs.forEach(thumb => {
            thumb.addEventListener('click', this._handleImageClick.bind(this));
        });
    }

    static _handleImageClick(event) {
        const imageUrl = event.currentTarget.dataset.imageUrl;
        if (imageUrl) {
            ImageManager.handleImageSelection(imageUrl);
        }
    }

    static validateImage(image) {
        return image &&
               image.url &&
               image.filename;
    }

    static isImageLoaded(url) {
        return !!this.getImageByUrl(url);
    }

    static getImageDescription(url) {
        const image = this.getImageByUrl(url);
        return image ? image.description || '' : '';
    }

    static getImageSuggestedUses(url) {
        const image = this.getImageByUrl(url);
        return image ? image.suggestedUses || '' : '';
    }

    static getImagePage(url) {
        const image = this.getImageByUrl(url);
        return image ? image.page || '' : '';
    }

    static getUniquePages() {
        const images = this.getImages();
        const pages = images.map(image => image.page).filter(Boolean);
        return [...new Set(pages)];
    }

    static preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    static async preloadImages(imageUrls) {
        const preloadPromises = imageUrls.map(url => this.preloadImage(url));

        try {
            const results = await Promise.allSettled(preloadPromises);
            const successful = results.filter(result => result.status === 'fulfilled').length;

            if (successful < imageUrls.length) {
                const failed = imageUrls.length - successful;
                ErrorHandler.logError(
                    new Error(`${failed} images failed to preload`),
                    'ImageManager.preloadImages'
                );
            }

            return results;
        } catch (error) {
            ErrorHandler.logError(error, 'ImageManager.preloadImages', 'Failed to preload images');
            throw error;
        }
    }

    static getImageStats() {
        const images = this.getImages();
        const types = {};
        const pages = {};

        images.forEach(image => {
            // Count by file type
            const extension = image.filename?.split('.').pop()?.toLowerCase();
            if (extension) {
                types[extension] = (types[extension] || 0) + 1;
            }

            // Count by page
            if (image.page) {
                pages[image.page] = (pages[image.page] || 0) + 1;
            }
        });

        return {
            total: images.length,
            types,
            pages,
            uniquePages: Object.keys(pages).length
        };
    }
}

export default ImageManager;