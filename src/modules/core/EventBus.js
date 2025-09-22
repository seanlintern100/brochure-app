class EventBus {
    static listeners = new Map();

    static emit(event, data = null) {
        if (!this.listeners.has(event)) return;

        const callbacks = this.listeners.get(event);
        callbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.warn(`Error in event listener for "${event}":`, error);
            }
        });
    }

    static on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        return () => this.off(event, callback);
    }

    static off(event, callback) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).delete(callback);
    }

    static once(event, callback) {
        const unsubscribe = this.on(event, (data) => {
            unsubscribe();
            callback(data);
        });
        return unsubscribe;
    }

    static clear(event = null) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    static getListenerCount(event) {
        return this.listeners.has(event) ? this.listeners.get(event).size : 0;
    }
}

export default EventBus;