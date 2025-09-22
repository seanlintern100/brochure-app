import StateManager from '../core/StateManager.js';
import EventBus from '../core/EventBus.js';
import ErrorHandler from '../core/ErrorHandler.js';
import { EVENTS } from '../ui/constants.js';

class ZoneManager {
    static ZONE_TYPES = {
        HEADER: 'header',
        CONTENT: 'content',
        FOOTER: 'footer'
    };

    static ZONE_CONSTRAINTS = {
        header: {
            adjustable: false,
            maxHeight: 80, // mm
            overflow: 'hidden',
            flexShrink: 0,
            position: 'top'
        },
        content: {
            adjustable: true,
            minHeight: 150, // mm
            maxHeight: 220, // mm
            overflow: 'auto',
            flex: 1,
            position: 'middle'
        },
        footer: {
            adjustable: true,
            minHeight: 20, // mm
            maxHeight: 80, // mm
            overflow: 'hidden',
            flexShrink: 0,
            position: 'bottom'
        }
    };

    static PAGE_HEIGHT = 297; // mm (A4)
    static PAGE_WIDTH = 210; // mm (A4)

    static initializeZones(pageElement) {
        try {
            const zones = this.detectZones(pageElement);

            zones.forEach(zone => {
                this.setupZone(zone);
                this.enableZoneAdjustment(zone);
            });

            this.validatePageLayout(pageElement);
            return zones;

        } catch (error) {
            ErrorHandler.logError(error, 'ZoneManager.initializeZones');
            throw error;
        }
    }

    static detectZones(pageElement) {
        const zones = [];
        const zoneElements = pageElement.querySelectorAll('[data-zone]');

        zoneElements.forEach(element => {
            const zoneType = element.dataset.zone;
            const constraints = this.ZONE_CONSTRAINTS[zoneType];

            if (!constraints) {
                ErrorHandler.logError(new Error(`Unknown zone type: ${zoneType}`), 'ZoneManager.detectZones');
                return;
            }

            const zone = {
                element,
                type: zoneType,
                constraints,
                currentHeight: this.getElementHeight(element),
                id: element.id || `zone-${zoneType}-${Date.now()}`
            };

            // Ensure element has proper attributes
            this.applyZoneAttributes(zone);
            zones.push(zone);
        });

        // Sort zones by position (top to bottom)
        zones.sort((a, b) => {
            const order = { header: 1, content: 2, footer: 3 };
            return order[a.type] - order[b.type];
        });

        return zones;
    }

    static applyZoneAttributes(zone) {
        const { element, type, constraints } = zone;

        // Add CSS classes for styling
        element.classList.add('zone', `zone-${type}`);

        // Set data attributes for identification
        if (!element.id) {
            element.id = zone.id;
        }

        // Apply constraint attributes
        if (constraints.adjustable) {
            element.dataset.adjustable = 'height';
            element.dataset.minHeight = `${constraints.minHeight}mm`;
            element.dataset.maxHeight = `${constraints.maxHeight}mm`;
        }

        // Apply CSS properties for zone behavior
        const styles = this.generateZoneCSS(type, constraints);
        Object.assign(element.style, styles);
    }

    static generateZoneCSS(type, constraints) {
        const baseStyles = {
            position: 'relative',
            width: '100%',
            boxSizing: 'border-box'
        };

        switch (type) {
            case 'header':
                return {
                    ...baseStyles,
                    height: 'auto',
                    maxHeight: `${constraints.maxHeight}mm`,
                    overflow: constraints.overflow,
                    flexShrink: '0'
                };

            case 'content':
                return {
                    ...baseStyles,
                    flex: '1',
                    minHeight: `${constraints.minHeight}mm`,
                    maxHeight: `${constraints.maxHeight}mm`,
                    overflow: constraints.overflow
                };

            case 'footer':
                return {
                    ...baseStyles,
                    height: 'auto',
                    minHeight: `${constraints.minHeight}mm`,
                    maxHeight: `${constraints.maxHeight}mm`,
                    overflow: constraints.overflow,
                    flexShrink: '0'
                };

            default:
                return baseStyles;
        }
    }

    static enableZoneAdjustment(zone) {
        if (!zone.constraints.adjustable) return;

        const { element, type, constraints } = zone;

        // Add resize handle for adjustable zones
        const resizeHandle = this.createResizeHandle(zone);
        element.appendChild(resizeHandle);

        // Add adjustment controls
        const controls = this.createZoneControls(zone);
        element.appendChild(controls);

        // Enable drag-to-resize
        this.setupResizeDrag(zone, resizeHandle);
    }

    static createResizeHandle(zone) {
        const handle = document.createElement('div');
        handle.className = 'zone-resize-handle';
        handle.innerHTML = `
            <div class="resize-indicator">
                <svg width="16" height="16" viewBox="0 0 16 16">
                    <path d="M2 6h12M2 10h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </div>
        `;

        // Style the handle
        Object.assign(handle.style, {
            position: 'absolute',
            bottom: '0',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '40px',
            height: '10px',
            background: 'var(--color-orange)',
            borderRadius: '4px 4px 0 0',
            cursor: 'ns-resize',
            opacity: '0',
            transition: 'opacity 0.2s ease',
            zIndex: '1000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
        });

        // Show handle on zone hover
        zone.element.addEventListener('mouseenter', () => {
            if (StateManager.getState().editMode) {
                handle.style.opacity = '0.8';
            }
        });

        zone.element.addEventListener('mouseleave', () => {
            if (!handle.dataset.dragging) {
                handle.style.opacity = '0';
            }
        });

        return handle;
    }

    static createZoneControls(zone) {
        const controls = document.createElement('div');
        controls.className = 'zone-controls';
        controls.innerHTML = `
            <div class="zone-control-panel">
                <div class="zone-info">
                    <span class="zone-label">${zone.type.toUpperCase()}</span>
                    <span class="zone-height">${Math.round(zone.currentHeight)}mm</span>
                </div>
                <div class="zone-buttons">
                    <button class="zone-btn zone-btn-shrink" title="Shrink zone">−</button>
                    <button class="zone-btn zone-btn-grow" title="Grow zone">+</button>
                    <button class="zone-btn zone-btn-reset" title="Reset to default">⟲</button>
                </div>
            </div>
        `;

        // Style the controls
        Object.assign(controls.style, {
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid var(--color-cool-gray)',
            borderRadius: '6px',
            padding: '8px',
            fontSize: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            opacity: '0',
            transition: 'opacity 0.2s ease',
            zIndex: '1001'
        });

        // Show controls on zone hover in edit mode
        zone.element.addEventListener('mouseenter', () => {
            if (StateManager.getState().editMode) {
                controls.style.opacity = '1';
            }
        });

        zone.element.addEventListener('mouseleave', () => {
            controls.style.opacity = '0';
        });

        // Setup button events
        this.setupZoneControlEvents(zone, controls);

        return controls;
    }

    static setupZoneControlEvents(zone, controls) {
        const shrinkBtn = controls.querySelector('.zone-btn-shrink');
        const growBtn = controls.querySelector('.zone-btn-grow');
        const resetBtn = controls.querySelector('.zone-btn-reset');

        shrinkBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.adjustZoneHeight(zone, -10); // Shrink by 10mm
        });

        growBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.adjustZoneHeight(zone, 10); // Grow by 10mm
        });

        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.resetZoneHeight(zone);
        });
    }

    static setupResizeDrag(zone, handle) {
        let isDragging = false;
        let startY = 0;
        let startHeight = 0;

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            startY = e.clientY;
            startHeight = zone.currentHeight;

            handle.dataset.dragging = 'true';
            handle.style.opacity = '1';

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.body.style.cursor = 'ns-resize';
        });

        const onMouseMove = (e) => {
            if (!isDragging) return;

            const deltaY = e.clientY - startY;
            const deltaHeight = (deltaY * 0.75); // Convert px to mm (rough conversion)
            const newHeight = startHeight + deltaHeight;

            this.setZoneHeight(zone, newHeight);
        };

        const onMouseUp = () => {
            isDragging = false;
            handle.dataset.dragging = 'false';
            handle.style.opacity = '0';

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';

            // Emit adjustment event
            EventBus.emit(EVENTS.ZONE_ADJUSTED, {
                zoneId: zone.id,
                type: zone.type,
                height: zone.currentHeight
            });
        };
    }

    static adjustZoneHeight(zone, deltaHeight) {
        const newHeight = zone.currentHeight + deltaHeight;
        this.setZoneHeight(zone, newHeight);

        EventBus.emit(EVENTS.ZONE_ADJUSTED, {
            zoneId: zone.id,
            type: zone.type,
            height: zone.currentHeight,
            adjustment: deltaHeight
        });
    }

    static setZoneHeight(zone, height) {
        const { constraints } = zone;

        // Apply constraints
        const constrainedHeight = Math.max(
            constraints.minHeight || 0,
            Math.min(height, constraints.maxHeight || Infinity)
        );

        // Check total page height constraint
        const pageElement = zone.element.closest('.page');
        const totalHeight = this.calculateTotalPageHeight(pageElement, zone, constrainedHeight);

        if (totalHeight > this.PAGE_HEIGHT) {
            const overflow = totalHeight - this.PAGE_HEIGHT;
            const adjustedHeight = constrainedHeight - overflow;

            if (adjustedHeight >= (constraints.minHeight || 0)) {
                zone.currentHeight = adjustedHeight;
            } else {
                // Cannot adjust without violating constraints
                ErrorHandler.showUserError('Cannot resize: would exceed page boundaries', 'warning');
                return false;
            }
        } else {
            zone.currentHeight = constrainedHeight;
        }

        // Apply the height
        if (zone.type === 'content') {
            zone.element.style.minHeight = `${zone.currentHeight}mm`;
            zone.element.style.maxHeight = `${zone.currentHeight}mm`;
        } else {
            zone.element.style.height = `${zone.currentHeight}mm`;
        }

        // Update height display
        const heightDisplay = zone.element.querySelector('.zone-height');
        if (heightDisplay) {
            heightDisplay.textContent = `${Math.round(zone.currentHeight)}mm`;
        }

        return true;
    }

    static resetZoneHeight(zone) {
        const defaultHeight = zone.type === 'content'
            ? zone.constraints.minHeight
            : (zone.constraints.minHeight + zone.constraints.maxHeight) / 2;

        this.setZoneHeight(zone, defaultHeight);

        EventBus.emit(EVENTS.ZONE_RESET, {
            zoneId: zone.id,
            type: zone.type,
            height: zone.currentHeight
        });
    }

    static calculateTotalPageHeight(pageElement, modifiedZone = null, newHeight = null) {
        let totalHeight = 0;
        const zones = pageElement.querySelectorAll('[data-zone]');

        zones.forEach(zoneElement => {
            const zoneType = zoneElement.dataset.zone;
            let height;

            if (modifiedZone && zoneElement === modifiedZone.element) {
                height = newHeight;
            } else {
                height = this.getElementHeight(zoneElement);
            }

            totalHeight += height;
        });

        return totalHeight;
    }

    static getElementHeight(element) {
        const computed = window.getComputedStyle(element);
        const height = parseFloat(computed.height);

        // Convert px to mm (rough conversion: 1mm ≈ 3.78px at 96dpi)
        return height / 3.78;
    }

    static validatePageLayout(pageElement) {
        const warnings = [];
        const zones = this.detectZones(pageElement);

        // Check for missing essential zones
        const zoneTypes = zones.map(z => z.type);
        if (!zoneTypes.includes('content')) {
            warnings.push('Missing content zone - page may not display properly');
        }

        // Check total height
        const totalHeight = this.calculateTotalPageHeight(pageElement);
        if (totalHeight > this.PAGE_HEIGHT) {
            warnings.push(`Page content exceeds A4 height (${Math.round(totalHeight)}mm > ${this.PAGE_HEIGHT}mm)`);
        }

        // Check zone overlaps
        zones.forEach((zone, index) => {
            if (index > 0) {
                const prevZone = zones[index - 1];
                const zoneTop = this.getZonePosition(zone.element);
                const prevZoneBottom = this.getZonePosition(prevZone.element) + prevZone.currentHeight;

                if (zoneTop < prevZoneBottom) {
                    warnings.push(`Zone overlap detected: ${prevZone.type} and ${zone.type}`);
                }
            }
        });

        if (warnings.length > 0) {
            EventBus.emit(EVENTS.ZONE_VALIDATION_WARNING, { warnings });
        }

        return { valid: warnings.length === 0, warnings };
    }

    static getZonePosition(element) {
        const rect = element.getBoundingClientRect();
        const pageRect = element.closest('.page').getBoundingClientRect();
        return (rect.top - pageRect.top) / 3.78; // Convert to mm
    }

    static enableEditMode(pageElement) {
        const zones = this.detectZones(pageElement);
        zones.forEach(zone => {
            if (zone.constraints.adjustable) {
                zone.element.classList.add('zone-editable');
            }
        });

        StateManager.setUIState({ editMode: true });
        EventBus.emit(EVENTS.ZONE_EDIT_MODE_ENABLED);
    }

    static disableEditMode(pageElement) {
        const zones = this.detectZones(pageElement);
        zones.forEach(zone => {
            zone.element.classList.remove('zone-editable');
            const controls = zone.element.querySelector('.zone-controls');
            const handle = zone.element.querySelector('.zone-resize-handle');

            if (controls) controls.style.opacity = '0';
            if (handle) handle.style.opacity = '0';
        });

        StateManager.setUIState({ editMode: false });
        EventBus.emit(EVENTS.ZONE_EDIT_MODE_DISABLED);
    }

    static getZoneData(pageElement) {
        const zones = this.detectZones(pageElement);
        return zones.map(zone => ({
            id: zone.id,
            type: zone.type,
            height: zone.currentHeight,
            constraints: zone.constraints,
            adjustable: zone.constraints.adjustable
        }));
    }

    static applyZoneData(pageElement, zoneData) {
        zoneData.forEach(data => {
            const element = pageElement.querySelector(`#${data.id}`);
            if (element) {
                const zone = {
                    element,
                    type: data.type,
                    constraints: this.ZONE_CONSTRAINTS[data.type],
                    currentHeight: data.height,
                    id: data.id
                };

                this.setZoneHeight(zone, data.height);
            }
        });
    }
}

export default ZoneManager;