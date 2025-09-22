import ErrorHandler from '../core/ErrorHandler.js';
import EventBus from '../core/EventBus.js';

class UploadValidator {
    static VALIDATION_LEVELS = {
        CRITICAL: 'critical',
        WARNING: 'warning',
        SUGGESTION: 'suggestion'
    };

    static FORBIDDEN_CSS = [
        'position:\\s*fixed',
        'position:\\s*sticky',
        'height:\\s*100vh',
        'width:\\s*100vw',
        'transform:\\s*rotate',
        'float:\\s*(left|right)',
        'background-attachment:\\s*fixed'
    ];

    static REQUIRED_DIMENSIONS = {
        width: '210mm',
        height: '297mm'
    };

    static validateDocumentStructure(htmlContent) {
        const validation = {
            critical: [],
            warnings: [],
            suggestions: []
        };

        try {
            if (!htmlContent || htmlContent.trim().length === 0) {
                validation.critical.push('File is empty');
                return validation;
            }

            // CRITICAL: Basic HTML structure
            if (!htmlContent.includes('<!DOCTYPE')) {
                validation.critical.push('Missing DOCTYPE declaration - required for PDF consistency');
            }

            if (!htmlContent.includes('<html')) {
                validation.critical.push('Missing <html> tag - invalid HTML document');
            }

            if (!htmlContent.includes('<head>')) {
                validation.critical.push('Missing <head> section - required for meta tags and styles');
            }

            if (!htmlContent.includes('<body>')) {
                validation.critical.push('Missing <body> tag - required document structure');
            }

            // CRITICAL: Required meta tags
            if (!htmlContent.includes('charset="UTF-8"')) {
                validation.critical.push('Missing UTF-8 charset declaration');
            }

            // WARNINGS: Best practices
            if (!htmlContent.includes('template-version')) {
                validation.warnings.push('Missing template-version meta tag');
            }

            if (!htmlContent.includes('template-type')) {
                validation.warnings.push('Missing template-type meta tag');
            }

            // SUGGESTIONS: Optimization
            if (!htmlContent.includes('rel="preconnect"')) {
                validation.suggestions.push('Consider adding font preconnect for faster loading');
            }

        } catch (error) {
            validation.critical.push('Failed to parse HTML content');
            ErrorHandler.logError(error, 'UploadValidator.validateDocumentStructure');
        }

        return validation;
    }

    static validateTemplateElements(htmlContent) {
        const validation = {
            critical: [],
            warnings: [],
            suggestions: [],
            editableCount: 0,
            statistics: {}
        };

        try {
            // Count different types of elements
            const editableMatches = htmlContent.match(/data-editable\s*=\s*["'][^"']*["']/gi) || [];
            const templateMatches = htmlContent.match(/data-page-template\s*=\s*["'][^"']*["']/gi) || [];
            const fieldMatches = htmlContent.match(/data-field\s*=\s*["'][^"']*["']/gi) || [];
            const zoneMatches = htmlContent.match(/data-zone\s*=\s*["'][^"']*["']/gi) || [];
            const adjustableMatches = htmlContent.match(/data-adjustable\s*=\s*["'][^"']*["']/gi) || [];
            const maxCharMatches = htmlContent.match(/data-max-chars\s*=\s*["'][^"']*["']/gi) || [];

            validation.editableCount = editableMatches.length;
            validation.statistics = {
                editableElements: editableMatches.length,
                templateIdentifiers: templateMatches.length,
                fieldElements: fieldMatches.length,
                zoneElements: zoneMatches.length,
                adjustableElements: adjustableMatches.length,
                characterLimits: maxCharMatches.length
            };

            // CRITICAL: Essential template structure
            if (templateMatches.length === 0) {
                validation.critical.push('Missing data-page-template identifier - required for template recognition');
            }

            if (templateMatches.length > 1) {
                validation.critical.push('Multiple data-page-template identifiers found - only one allowed');
            }

            // CRITICAL: Page container
            if (!htmlContent.includes('class="page"')) {
                validation.critical.push('Missing .page container - required for PDF layout');
            }

            // WARNINGS: Usability
            if (editableMatches.length === 0) {
                validation.warnings.push('No editable elements found - template will not be user-editable');
            }

            if (editableMatches.length < 2) {
                validation.warnings.push('Very few editable elements - consider adding more user-editable content');
            }

            if (fieldMatches.length < editableMatches.length) {
                validation.warnings.push('Some editable elements missing data-field attributes');
            }

            if (maxCharMatches.length < editableMatches.length * 0.5) {
                validation.warnings.push('Many text elements missing character limits (data-max-chars)');
            }

            // SUGGESTIONS: Best practices
            if (zoneMatches.length === 0) {
                validation.suggestions.push('Consider using zone system (data-zone) for better layout control');
            }

            if (adjustableMatches.length === 0) {
                validation.suggestions.push('Consider adding adjustable elements for better user control');
            }

            if (editableMatches.length > 15) {
                validation.suggestions.push('Many editable elements - consider grouping related fields');
            }

            // Check for getPageData function
            if (!htmlContent.includes('getPageData')) {
                validation.warnings.push('Missing getPageData() function - required for data extraction');
            }

        } catch (error) {
            validation.critical.push('Failed to analyze template elements');
            ErrorHandler.logError(error, 'UploadValidator.validateTemplateElements');
        }

        return validation;
    }

    static validateFile(file) {
        const validation = {
            critical: [],
            warnings: [],
            suggestions: []
        };

        const maxSize = 2 * 1024 * 1024; // 2MB
        const minSize = 1024; // 1KB
        const optimalMaxSize = 500 * 1024; // 500KB

        // CRITICAL: File size limits
        if (file.size > maxSize) {
            validation.critical.push(`File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max: 2MB)`);
        }

        if (file.size < minSize) {
            validation.critical.push(`File too small: ${file.size} bytes (likely empty or corrupted)`);
        }

        // CRITICAL: File type
        if (!file.name.toLowerCase().endsWith('.html') && !file.name.toLowerCase().endsWith('.htm')) {
            validation.critical.push('File must be HTML format (.html or .htm)');
        }

        // WARNINGS: Performance
        if (file.size > optimalMaxSize) {
            validation.warnings.push(`Large file: ${(file.size / 1024).toFixed(0)}KB - may slow template loading`);
        }

        // SUGGESTIONS: Optimization
        if (file.size > 100 * 1024) {
            validation.suggestions.push('Consider optimizing images or removing unused CSS for better performance');
        }

        return validation;
    }

    static validatePDFCompatibility(htmlContent) {
        const validation = {
            critical: [],
            warnings: [],
            suggestions: []
        };

        try {
            // CRITICAL: Forbidden CSS properties
            this.FORBIDDEN_CSS.forEach(pattern => {
                const regex = new RegExp(pattern, 'gi');
                const matches = htmlContent.match(regex);
                if (matches) {
                    validation.critical.push(`Forbidden CSS detected: ${matches[0]} - will break PDF export`);
                }
            });

            // CRITICAL: Page dimensions
            if (!htmlContent.includes('width: 210mm') && !htmlContent.includes('width:210mm')) {
                validation.critical.push('Missing A4 width (210mm) - required for proper PDF sizing');
            }

            if (!htmlContent.includes('height: 297mm') && !htmlContent.includes('height:297mm')) {
                validation.critical.push('Missing A4 height (297mm) - required for proper PDF sizing');
            }

            // CRITICAL: Page setup
            if (!htmlContent.includes('@page')) {
                validation.critical.push('Missing @page CSS rule - required for PDF page setup');
            }

            if (!htmlContent.includes('overflow: hidden')) {
                validation.warnings.push('Page container should have overflow: hidden to prevent content bleeding');
            }

            // WARNINGS: Viewport units
            const viewportUnits = htmlContent.match(/(\d+)(vh|vw|vmin|vmax)/gi) || [];
            if (viewportUnits.length > 0) {
                validation.warnings.push(`Viewport units found (${viewportUnits.join(', ')}) - may cause PDF inconsistencies`);
            }

            // WARNINGS: Complex positioning
            const complexPositioning = htmlContent.match(/position:\s*(absolute|relative)/gi) || [];
            if (complexPositioning.length > 3) {
                validation.warnings.push(`Many positioned elements (${complexPositioning.length}) - verify PDF layout`);
            }

            // SUGGESTIONS: Print optimization
            if (!htmlContent.includes('@media print')) {
                validation.suggestions.push('Consider adding @media print styles for better PDF output');
            }

            if (!htmlContent.includes('page-break')) {
                validation.suggestions.push('Consider adding page-break CSS for multi-page content control');
            }

        } catch (error) {
            validation.critical.push('Failed to analyze PDF compatibility');
            ErrorHandler.logError(error, 'UploadValidator.validatePDFCompatibility');
        }

        return validation;
    }

    static validateSecurity(htmlContent) {
        const validation = {
            critical: [],
            warnings: [],
            suggestions: []
        };

        try {
            // CRITICAL: Dangerous scripts
            const scriptMatches = htmlContent.match(/<script[^>]*src\s*=\s*["'][^"']*["'][^>]*>/gi) || [];
            const inlineScripts = htmlContent.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];

            if (scriptMatches.length > 0) {
                validation.critical.push(`External scripts found (${scriptMatches.length}) - security risk`);
            }

            // WARNINGS: Event handlers
            const onEventMatches = htmlContent.match(/\son\w+\s*=/gi) || [];
            if (onEventMatches.length > 10) {
                validation.warnings.push(`Many inline event handlers (${onEventMatches.length}) - review for security`);
            }

            // WARNINGS: External resources
            const allowedDomains = ['fonts.googleapis.com', 'fonts.gstatic.com', 'images.squarespace-cdn.com', 'unpkg.com'];
            const externalLinks = htmlContent.match(/https?:\/\/[^\s"'<>]+/gi) || [];
            const unauthorizedLinks = externalLinks.filter(link =>
                !allowedDomains.some(domain => link.includes(domain))
            );

            if (unauthorizedLinks.length > 0) {
                validation.warnings.push(`Unauthorized external resources: ${unauthorizedLinks.slice(0, 3).join(', ')}`);
            }

            // SUGGESTIONS: Best practices
            if (inlineScripts.length > 0) {
                validation.suggestions.push('Inline scripts found - ensure they follow template requirements');
            }

        } catch (error) {
            validation.critical.push('Failed to analyze security aspects');
            ErrorHandler.logError(error, 'UploadValidator.validateSecurity');
        }

        return validation;
    }

    static async validateUploadedFile(file, htmlContent) {
        try {
            const validations = [
                this.validateFile(file),
                this.validateDocumentStructure(htmlContent),
                this.validateTemplateElements(htmlContent),
                this.validatePDFCompatibility(htmlContent),
                this.validateSecurity(htmlContent)
            ];

            const combined = {
                valid: true,
                critical: [],
                warnings: [],
                suggestions: [],
                editableCount: 0,
                statistics: {},
                summary: {}
            };

            // Combine all validation results
            validations.forEach(validation => {
                combined.critical.push(...(validation.critical || []));
                combined.warnings.push(...(validation.warnings || []));
                combined.suggestions.push(...(validation.suggestions || []));

                if (validation.editableCount !== undefined) {
                    combined.editableCount = validation.editableCount;
                }

                if (validation.statistics) {
                    combined.statistics = { ...combined.statistics, ...validation.statistics };
                }
            });

            // Determine overall validity
            combined.valid = combined.critical.length === 0;

            // Generate summary
            combined.summary = {
                level: combined.critical.length > 0 ? 'critical' :
                       combined.warnings.length > 0 ? 'warning' : 'good',
                totalIssues: combined.critical.length + combined.warnings.length,
                criticalCount: combined.critical.length,
                warningCount: combined.warnings.length,
                suggestionCount: combined.suggestions.length,
                canImport: combined.critical.length === 0,
                recommendImport: combined.critical.length === 0 && combined.warnings.length < 3
            };

            return combined;

        } catch (error) {
            ErrorHandler.logError(error, 'UploadValidator.validateUploadedFile');
            return {
                valid: false,
                critical: ['Validation failed due to unexpected error'],
                warnings: [],
                suggestions: [],
                editableCount: 0,
                statistics: {},
                summary: { level: 'critical', canImport: false }
            };
        }
    }

    static generateValidationReport(validation) {
        const report = {
            title: this.getValidationTitle(validation.summary.level),
            icon: this.getValidationIcon(validation.summary.level),
            color: this.getValidationColor(validation.summary.level),
            message: this.getValidationMessage(validation),
            sections: []
        };

        if (validation.critical.length > 0) {
            report.sections.push({
                title: '❌ Critical Issues (Must Fix)',
                items: validation.critical,
                level: 'critical'
            });
        }

        if (validation.warnings.length > 0) {
            report.sections.push({
                title: '⚠️ Warnings (Should Fix)',
                items: validation.warnings,
                level: 'warning'
            });
        }

        if (validation.suggestions.length > 0) {
            report.sections.push({
                title: '💡 Suggestions (Nice to Have)',
                items: validation.suggestions,
                level: 'suggestion'
            });
        }

        return report;
    }

    static getValidationTitle(level) {
        switch (level) {
            case 'critical': return 'Template Has Critical Issues';
            case 'warning': return 'Template Ready with Warnings';
            case 'good': return 'Template Validated Successfully';
            default: return 'Template Validation Complete';
        }
    }

    static getValidationIcon(level) {
        switch (level) {
            case 'critical': return '❌';
            case 'warning': return '⚠️';
            case 'good': return '✅';
            default: return 'ℹ️';
        }
    }

    static getValidationColor(level) {
        switch (level) {
            case 'critical': return '#dc3545';
            case 'warning': return '#ffc107';
            case 'good': return '#28a745';
            default: return '#6c757d';
        }
    }

    static getValidationMessage(validation) {
        const { summary } = validation;

        if (summary.level === 'critical') {
            return `Found ${summary.criticalCount} critical issue(s) that must be fixed before import.`;
        }

        if (summary.level === 'warning') {
            return `Template ready for import with ${summary.warningCount} warning(s) to review.`;
        }

        return 'Template meets all requirements and is ready for import.';
    }

    static generateBatchValidationSummary(validationResults) {
        const summary = {
            totalFiles: validationResults.length,
            validFiles: 0,
            criticalFiles: 0,
            warningFiles: 0,
            goodFiles: 0,
            totalCritical: 0,
            totalWarnings: 0,
            totalSuggestions: 0,
            canProceed: true,
            overallLevel: 'good'
        };

        validationResults.forEach(result => {
            if (result.summary.level === 'critical') {
                summary.criticalFiles++;
                summary.canProceed = false;
            } else if (result.summary.level === 'warning') {
                summary.warningFiles++;
                summary.validFiles++;
            } else {
                summary.goodFiles++;
                summary.validFiles++;
            }

            summary.totalCritical += result.critical.length;
            summary.totalWarnings += result.warnings.length;
            summary.totalSuggestions += result.suggestions.length;
        });

        // Determine overall level
        if (summary.criticalFiles > 0) {
            summary.overallLevel = 'critical';
        } else if (summary.warningFiles > 0) {
            summary.overallLevel = 'warning';
        }

        return summary;
    }
}

export default UploadValidator;