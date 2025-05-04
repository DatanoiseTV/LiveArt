/**
 * Event System
 * Provides pub/sub functionality for cross-module communication
 */

import LiveArt from '../index.js';

class EventSystem {
    constructor() {
        this.events = {};
    }
    
    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {function} callback - Event handler
     * @param {object} context - Context for the callback
     * @returns {object} Subscription object for unsubscribing
     */
    on(event, callback, context = null) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        
        const subscription = { callback, context };
        this.events[event].push(subscription);
        
        // Return unsubscribe function
        return {
            unsubscribe: () => this.off(event, callback, context)
        };
    }
    
    /**
     * Subscribe to an event that will be triggered only once
     * @param {string} event - Event name
     * @param {function} callback - Event handler
     * @param {object} context - Context for the callback
     * @returns {object} Subscription object for unsubscribing
     */
    once(event, callback, context = null) {
        const onceCallback = (...args) => {
            this.off(event, onceCallback, context);
            callback.apply(context, args);
        };
        
        return this.on(event, onceCallback, context);
    }
    
    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {function} callback - Event handler
     * @param {object} context - Context for the callback
     */
    off(event, callback, context = null) {
        if (!this.events[event]) return;
        
        if (!callback) {
            // Remove all callbacks for this event
            delete this.events[event];
            return;
        }
        
        this.events[event] = this.events[event].filter(subscription => {
            return subscription.callback !== callback || 
                   (context && subscription.context !== context);
        });
        
        if (this.events[event].length === 0) {
            delete this.events[event];
        }
    }
    
    /**
     * Trigger an event
     * @param {string} event - Event name
     * @param {...any} args - Arguments to pass to the event handlers
     */
    trigger(event, ...args) {
        if (!this.events[event]) return;
        
        LiveArt.log(`Event triggered: ${event}`, 'debug');
        
        this.events[event].forEach(subscription => {
            try {
                subscription.callback.apply(
                    subscription.context, 
                    args
                );
            } catch (error) {
                LiveArt.log(`Error in event handler for '${event}': ${error.message}`, 'error');
                console.error(error);
            }
        });
    }
    
    /**
     * Clear all event subscriptions
     */
    clear() {
        this.events = {};
    }
}

// Create the event system instance
const events = new EventSystem();

// Register as a module
LiveArt.registerModule('events', events);

export default events;