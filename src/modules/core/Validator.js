import { VALIDATION } from '../ui/constants.js';

class Validator {
    static validateProjectName(name) {
        const errors = [];

        if (!name || typeof name !== 'string') {
            errors.push('Project name is required');
            return { isValid: false, errors };
        }

        const trimmed = name.trim();

        if (trimmed.length === 0) {
            errors.push('Project name cannot be empty');
        }

        if (trimmed.length < VALIDATION.MIN_PROJECT_NAME_LENGTH) {
            errors.push(`Project name must be at least ${VALIDATION.MIN_PROJECT_NAME_LENGTH} character long`);
        }

        if (trimmed.length > VALIDATION.MAX_PROJECT_NAME_LENGTH) {
            errors.push(`Project name cannot exceed ${VALIDATION.MAX_PROJECT_NAME_LENGTH} characters`);
        }

        if (!VALIDATION.SAFE_FILENAME_REGEX.test(trimmed)) {
            errors.push('Project name contains invalid characters. Use only letters, numbers, spaces, hyphens, and underscores');
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized: trimmed
        };
    }

    static validateClientName(name) {
        const errors = [];

        if (!name) {
            return { isValid: true, errors, sanitized: '' };
        }

        if (typeof name !== 'string') {
            errors.push('Client name must be a string');
            return { isValid: false, errors };
        }

        const trimmed = name.trim();

        if (trimmed.length > VALIDATION.MAX_CLIENT_NAME_LENGTH) {
            errors.push(`Client name cannot exceed ${VALIDATION.MAX_CLIENT_NAME_LENGTH} characters`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized: trimmed
        };
    }

    static validateFileName(filename) {
        const errors = [];

        if (!filename || typeof filename !== 'string') {
            errors.push('Filename is required');
            return { isValid: false, errors };
        }

        const trimmed = filename.trim();

        if (trimmed.length === 0) {
            errors.push('Filename cannot be empty');
        }

        // Check for invalid characters
        const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
        if (invalidChars.test(trimmed)) {
            errors.push('Filename contains invalid characters');
        }

        // Check for reserved names (Windows)
        const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
        const nameWithoutExt = trimmed.replace(/\.[^.]*$/, '');
        if (reservedNames.test(nameWithoutExt)) {
            errors.push('Filename uses a reserved name');
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized: trimmed
        };
    }

    static sanitizeHTML(html) {
        if (!html || typeof html !== 'string') {
            return '';
        }

        // Basic HTML sanitization - remove script tags and event handlers
        let sanitized = html
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
            .replace(/on\w+\s*=\s*'[^']*'/gi, '')
            .replace(/javascript:/gi, '');

        return sanitized;
    }

    static validateEmail(email) {
        const errors = [];

        if (!email || typeof email !== 'string') {
            errors.push('Email is required');
            return { isValid: false, errors };
        }

        const trimmed = email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(trimmed)) {
            errors.push('Please enter a valid email address');
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized: trimmed.toLowerCase()
        };
    }

    static validateURL(url) {
        const errors = [];

        if (!url || typeof url !== 'string') {
            errors.push('URL is required');
            return { isValid: false, errors };
        }

        const trimmed = url.trim();

        try {
            new URL(trimmed);
        } catch {
            errors.push('Please enter a valid URL');
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized: trimmed
        };
    }

    static validateProjectMetadata(metadata) {
        const errors = [];
        const sanitized = {};

        // Validate project name
        const nameValidation = this.validateProjectName(metadata.title);
        if (!nameValidation.isValid) {
            errors.push(...nameValidation.errors);
        } else {
            sanitized.title = nameValidation.sanitized;
        }

        // Validate client name
        const clientValidation = this.validateClientName(metadata.client);
        if (!clientValidation.isValid) {
            errors.push(...clientValidation.errors);
        } else {
            sanitized.client = clientValidation.sanitized;
        }

        // Validate status
        const validStatuses = ['draft', 'review', 'final'];
        if (metadata.status && !validStatuses.includes(metadata.status)) {
            errors.push('Invalid project status');
        } else {
            sanitized.status = metadata.status || 'draft';
        }

        // Validate base template
        if (metadata.baseTemplate && typeof metadata.baseTemplate !== 'string') {
            errors.push('Base template must be a string');
        } else {
            sanitized.baseTemplate = metadata.baseTemplate || null;
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized
        };
    }

    static validateTemplateId(templateId) {
        const errors = [];

        if (!templateId || typeof templateId !== 'string') {
            errors.push('Template ID is required');
            return { isValid: false, errors };
        }

        const trimmed = templateId.trim();

        if (trimmed.length === 0) {
            errors.push('Template ID cannot be empty');
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized: trimmed
        };
    }

    static validatePageId(pageId) {
        const errors = [];

        if (!pageId || typeof pageId !== 'string') {
            errors.push('Page ID is required');
            return { isValid: false, errors };
        }

        const trimmed = pageId.trim();

        if (trimmed.length === 0) {
            errors.push('Page ID cannot be empty');
        }

        // Check if it follows expected format
        if (!trimmed.startsWith('page-')) {
            errors.push('Page ID must start with "page-"');
        }

        return {
            isValid: errors.length === 0,
            errors,
            sanitized: trimmed
        };
    }

    static validateFormData(formData, rules) {
        const errors = {};
        const sanitized = {};

        Object.entries(rules).forEach(([field, fieldRules]) => {
            const value = formData.get ? formData.get(field) : formData[field];
            const fieldErrors = [];

            // Required validation
            if (fieldRules.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
                fieldErrors.push(`${fieldRules.label || field} is required`);
            }

            if (value && typeof value === 'string') {
                const trimmed = value.trim();

                // Length validation
                if (fieldRules.minLength && trimmed.length < fieldRules.minLength) {
                    fieldErrors.push(`${fieldRules.label || field} must be at least ${fieldRules.minLength} characters`);
                }

                if (fieldRules.maxLength && trimmed.length > fieldRules.maxLength) {
                    fieldErrors.push(`${fieldRules.label || field} cannot exceed ${fieldRules.maxLength} characters`);
                }

                // Pattern validation
                if (fieldRules.pattern && !fieldRules.pattern.test(trimmed)) {
                    fieldErrors.push(fieldRules.patternMessage || `${fieldRules.label || field} format is invalid`);
                }

                // Custom validation
                if (fieldRules.validator) {
                    const customResult = fieldRules.validator(trimmed);
                    if (!customResult.isValid) {
                        fieldErrors.push(...customResult.errors);
                    }
                }

                sanitized[field] = trimmed;
            } else {
                sanitized[field] = value;
            }

            if (fieldErrors.length > 0) {
                errors[field] = fieldErrors;
            }
        });

        return {
            isValid: Object.keys(errors).length === 0,
            errors,
            sanitized
        };
    }

    static escapeHtml(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static stripHtml(html) {
        if (!html || typeof html !== 'string') {
            return '';
        }

        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    static validateJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            return { isValid: true, parsed, errors: [] };
        } catch (error) {
            return { isValid: false, parsed: null, errors: ['Invalid JSON format'] };
        }
    }
}

export default Validator;