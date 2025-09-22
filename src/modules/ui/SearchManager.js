import StateManager from '../core/StateManager.js';
import EventBus from '../core/EventBus.js';
import TemplateManager from '../data/TemplateManager.js';
import UIManager from './UIManager.js';
import { Templates } from './templates.js';
import { EVENTS } from './constants.js';

class SearchManager {
    static searchTerm = '';
    static originalTemplates = [];
    static searchInputElement = null;

    static init() {
        this.setupSearchInput();
        this.setupEventListeners();
    }

    static setupSearchInput() {
        this.searchInputElement = document.getElementById('templateSearchInput');
        if (!this.searchInputElement) return;

        // Set up real-time search with debouncing
        let debounceTimer;
        this.searchInputElement.addEventListener('input', (event) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.handleSearch(event.target.value);
            }, 300); // 300ms debounce
        });

        // Clear search on escape key
        this.searchInputElement.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.clearSearch();
            }
        });
    }

    static setupEventListeners() {
        // Store original templates when they're loaded
        EventBus.on(EVENTS.TEMPLATES_LOADED, () => {
            this.storeOriginalTemplates();
        });

        // Also listen for state changes
        EventBus.on(EVENTS.STATE_TEMPLATES_CHANGED, () => {
            this.storeOriginalTemplates();
        });
    }

    static storeOriginalTemplates() {
        const templates = StateManager.getState().templates;
        if (templates && templates.length > 0) {
            this.originalTemplates = [...templates];
        }
    }

    static handleSearch(searchTerm) {
        this.searchTerm = searchTerm.trim().toLowerCase();
        console.log('Searching for:', this.searchTerm);

        if (this.searchTerm === '') {
            this.showAllTemplates();
        } else {
            this.filterTemplates();
        }

        // Re-apply feather icons after DOM update
        if (window.feather) {
            window.feather.replace();
        }
    }

    static filterTemplates() {
        const allTemplates = StateManager.getState().templates || [];

        // Filter templates by name (case-insensitive)
        const filteredTemplates = allTemplates.filter(template =>
            template.name.toLowerCase().includes(this.searchTerm)
        );

        console.log(`Found ${filteredTemplates.length} templates matching "${this.searchTerm}"`);

        if (filteredTemplates.length === 0) {
            this.showNoResults();
        } else {
            this.renderFilteredTemplates(filteredTemplates);
        }
    }

    static renderFilteredTemplates(templates) {
        const categoriesEl = document.querySelector('#templateCategories');
        if (!categoriesEl) return;

        // Group filtered templates by category
        const categories = {};
        templates.forEach(template => {
            const category = template.category || 'general';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(template);
        });

        // Render filtered categories
        categoriesEl.innerHTML = Object.entries(categories).map(([categoryName, templateList]) =>
            Templates.templateCategory(categoryName, templateList)
        ).join('');

        // Expand all categories when searching to show results
        categoriesEl.querySelectorAll('.template-category').forEach(category => {
            category.classList.remove('collapsed');
        });
    }

    static showAllTemplates() {
        console.log('Showing all templates');
        // Re-render the complete template library
        UIManager.renderTemplateLibrary();
    }

    static showNoResults() {
        const categoriesEl = document.querySelector('#templateCategories');
        if (!categoriesEl) return;

        categoriesEl.innerHTML = `
            <div class="search-no-results">
                <div class="no-results-icon">
                    <i data-feather="search"></i>
                </div>
                <div class="no-results-text">
                    <h4>No templates found</h4>
                    <p>Try a different search term or check the spelling.</p>
                </div>
            </div>
        `;
    }

    static clearSearch() {
        if (this.searchInputElement) {
            this.searchInputElement.value = '';
            this.handleSearch('');
        }
    }

    static getSearchTerm() {
        return this.searchTerm;
    }

    static isSearchActive() {
        return this.searchTerm !== '';
    }

    static highlightMatches(text, searchTerm) {
        if (!searchTerm) return text;

        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    static refreshSearchResults() {
        if (this.isSearchActive()) {
            this.handleSearch(this.searchTerm);
        }
    }

    static updateSearchPlaceholder(count) {
        if (this.searchInputElement && count !== undefined) {
            this.searchInputElement.placeholder = `Search ${count} templates...`;
        }
    }
}

export default SearchManager;