class ErrorHandler {
    static statusElement = null;

    static init() {
        this.statusElement = document.getElementById('statusMessage');

        window.addEventListener('error', (event) => {
            this.logError(event.error, 'window.error', 'An unexpected error occurred');
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.logError(event.reason, 'unhandledrejection', 'An unexpected error occurred');
        });
    }

    static logError(error, context, userMessage = null) {
        const errorInfo = {
            message: error?.message || 'Unknown error',
            stack: error?.stack || 'No stack trace',
            context: context,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        };

        if (userMessage) {
            this.showUserError(userMessage, 'error');
        }
    }

    static showUserError(message, type = 'error') {
        if (!this.statusElement) return;

        this.statusElement.textContent = message;
        this.statusElement.className = `status-message ${type} show`;

        setTimeout(() => {
            this.statusElement.classList.remove('show');
        }, 4000);
    }

    static showError(message) {
        this.showUserError(message, 'error');
    }

    static showSuccess(message) {
        this.showUserError(message, 'success');
    }

    static showInfo(message) {
        this.showUserError(message, 'info');
    }

    static showSuccessModal(title, message, actionButton = null) {
        // Create modal for important success messages that need user dismissal
        const modalId = 'successModal';
        let existingModal = document.getElementById(modalId);

        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal';
        modal.style.display = 'flex';

        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px; text-align: center;">
                <button class="modal-close" onclick="document.getElementById('${modalId}').remove()">
                    <i data-feather="x"></i>
                </button>

                <div style="padding: var(--space-4);">
                    <div style="margin-bottom: var(--space-3);">
                        <i data-feather="check-circle" style="width: 48px; height: 48px; color: var(--color-success); margin-bottom: var(--space-2);"></i>
                        <h2 style="margin: 0 0 var(--space-2) 0; color: var(--color-teal);">${title}</h2>
                    </div>

                    <div style="margin-bottom: var(--space-3); color: var(--color-charcoal);">
                        ${message}
                    </div>

                    <div style="display: flex; gap: var(--space-2); justify-content: center; align-items: center;">
                        ${actionButton || ''}
                        <button class="btn btn-primary" onclick="document.getElementById('${modalId}').remove()">
                            <i data-feather="check"></i>
                            OK
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Initialize Feather icons for the new modal
        if (typeof feather !== 'undefined') {
            feather.replace();
        }

        return modal;
    }

    static async handleAsyncError(promise, fallbackMessage = 'Operation failed') {
        try {
            return await promise;
        } catch (error) {
            this.logError(error, 'async operation', fallbackMessage);
            throw error;
        }
    }

    static createErrorBoundary(fn, fallback = null) {
        return (...args) => {
            try {
                const result = fn(...args);
                if (result instanceof Promise) {
                    return this.handleAsyncError(result);
                }
                return result;
            } catch (error) {
                this.logError(error, 'error boundary', 'Operation failed');
                return fallback;
            }
        };
    }
}

export default ErrorHandler;