/**
 * Utility Module
 * Common utility functions for LiveArt
 */

import LiveArt from '../index.js';

const utils = {
    /**
     * Map a value from one range to another
     * @param {number} value - Value to map
     * @param {number} inMin - Input range minimum
     * @param {number} inMax - Input range maximum
     * @param {number} outMin - Output range minimum
     * @param {number} outMax - Output range maximum
     * @returns {number} Mapped value
     */
    mapRange(value, inMin, inMax, outMin, outMax) {
        return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
    },
    
    /**
     * Clamp a value between min and max
     * @param {number} value - Value to clamp
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Clamped value
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    
    /**
     * Linear interpolation between two values
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },
    
    /**
     * Convert HSB/HSV color to RGB
     * @param {number} h - Hue (0-1)
     * @param {number} s - Saturation (0-1)
     * @param {number} b - Brightness (0-1)
     * @param {number} a - Alpha (0-1)
     * @returns {object} RGB color object
     */
    hsbToRgb(h, s, b, a = 1) {
        h = ((h % 1) * 6);
        const i = Math.floor(h);
        const f = h - i;
        const p = b * (1 - s);
        const q = b * (1 - s * f);
        const t = b * (1 - s * (1 - f));
        
        let r, g, bl;
        switch (i % 6) {
            case 0: r = b; g = t; bl = p; break;
            case 1: r = q; g = b; bl = p; break;
            case 2: r = p; g = b; bl = t; break;
            case 3: r = p; g = q; bl = b; break;
            case 4: r = t; g = p; bl = b; break;
            case 5: r = b; g = p; bl = q; break;
        }
        
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(bl * 255),
            a
        };
    },
    
    /**
     * Convert HSB/HSV color to RGBA string
     * @param {number} h - Hue (0-1)
     * @param {number} s - Saturation (0-1)
     * @param {number} b - Brightness (0-1)
     * @param {number} a - Alpha (0-1)
     * @returns {string} RGBA color string
     */
    hsbToRgbaString(h, s, b, a = 1) {
        const { r, g, b: bl, a: alpha } = this.hsbToRgb(h, s, b, a);
        return `rgba(${r}, ${g}, ${bl}, ${alpha})`;
    },
    
    /**
     * Generate a random number between min and max
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random number
     */
    random(min, max) {
        return Math.random() * (max - min) + min;
    },
    
    /**
     * Generate a random integer between min and max (inclusive)
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Random integer
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },
    
    /**
     * Generate a UUID
     * @returns {string} UUID
     */
    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    
    /**
     * Debounce a function
     * @param {function} func - Function to debounce
     * @param {number} wait - Debounce wait time in milliseconds
     * @returns {function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), wait);
        };
    },
    
    /**
     * Throttle a function
     * @param {function} func - Function to throttle
     * @param {number} limit - Throttle limit in milliseconds
     * @returns {function} Throttled function
     */
    throttle(func, limit) {
        let lastCall = 0;
        return function(...args) {
            const now = Date.now();
            if (now - lastCall >= limit) {
                lastCall = now;
                func.apply(this, args);
            }
        };
    },
    
    /**
     * Get the distance between two points
     * @param {number} x1 - First point x coordinate
     * @param {number} y1 - First point y coordinate
     * @param {number} x2 - Second point x coordinate
     * @param {number} y2 - Second point y coordinate
     * @returns {number} Distance between points
     */
    distance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },
    
    /**
     * Create a throttled save function
     * @param {function} saveFunc - Function to call when saving
     * @param {number} delay - Delay in milliseconds
     * @returns {function} Throttled save function
     */
    createThrottledSave(saveFunc, delay = 500) {
        let saveTimeout = null;
        
        return function() {
            if (saveTimeout) return;
            
            saveTimeout = setTimeout(() => {
                saveFunc();
                saveTimeout = null;
            }, delay);
        };
    }
};

// Register as a module
LiveArt.registerModule('utils', utils);

export default utils;