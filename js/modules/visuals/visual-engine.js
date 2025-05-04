/**
 * Visual Engine Base Class
 * Base class for visual rendering engines
 */

import LiveArt from '../index.js';
import events from '../core/events.js';
import settings from '../core/settings.js';
import utils from '../core/utils.js';

class VisualEngine {
    constructor(canvasId) {
        // Canvas setup
        this.canvasId = canvasId;
        this.canvas = null;
        this.ctx = null;
        this.width = 0;
        this.height = 0;
        this.centerX = 0;
        this.centerY = 0;
        
        // Animation state
        this.isRunning = false;
        this.frameId = null;
        this.lastFrameTime = 0;
        this.time = 0;
        
        // Parameters
        this.params = { ...settings.getParams() };
        this.targetParams = { ...this.params };
        
        // Visualizations registry
        this.visualGenerators = {};
        this.currentVisual = null;
        
        // Performance monitoring
        this.fps = 0;
        this.lastFpsUpdate = 0;
        this.fpsUpdateInterval = 250;
        
        // Effects
        this.effectsEnabled = true;
        
        // Bind methods
        this.animate = this.animate.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }
    
    /**
     * Initialize the visual engine
     */
    init() {
        LiveArt.log('Initializing visual engine...');
        
        // Get canvas element
        this.canvas = document.getElementById(this.canvasId);
        
        if (!this.canvas) {
            LiveArt.log(`Canvas not found: ${this.canvasId}`, 'error');
            return false;
        }
        
        // Get rendering context
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas dimensions
        this.updateCanvasSize();
        
        // Set event listeners
        window.addEventListener('resize', this.handleResize);
        
        // Listen for parameter changes
        events.on('parameter:changed', this.handleParameterChanged, this);
        events.on('parameter:influenced', this.handleParameterInfluenced, this);
        
        // Listen for engine events
        events.on('engine:started', this.start, this);
        events.on('engine:stopped', this.stop, this);
        events.on('engine:visualChanged', this.handleVisualChanged, this);
        
        // Register the engine with the core
        events.trigger('visualEngine:ready', this);
        
        LiveArt.log('Visual engine initialized');
        return true;
    }
    
    /**
     * Update canvas size
     */
    updateCanvasSize() {
        if (!this.canvas) return;
        
        // Set canvas to window size
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
        
        // Set canvas dimensions
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Notify that canvas size has changed
        events.trigger('visualEngine:resized', {
            width: this.width,
            height: this.height
        });
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        this.updateCanvasSize();
    }
    
    /**
     * Handle parameter changes
     * @param {object} data - Parameter change data
     */
    handleParameterChanged(data) {
        const { param, value } = data;
        
        // Update target parameter value
        if (this.targetParams[param] !== undefined) {
            this.targetParams[param] = value;
        }
    }
    
    /**
     * Handle parameter influences (like from audio)
     * @param {object} data - Parameter influence data
     */
    handleParameterInfluenced(data) {
        const { param, influence, direction } = data;
        
        // Only apply if this parameter exists
        if (this.params[param] === undefined) return;
        
        // Get the current parameter value (use target to avoid compounding influences)
        const baseValue = this.targetParams[param];
        
        // For some parameters like hue, we add influence (wrap around 0-1)
        if (['hue', 'rotation'].includes(param)) {
            let newValue = baseValue + influence;
            // Wrap around 0-1
            newValue = ((newValue % 1) + 1) % 1;
            // Set with immediate flag for responsive feel
            this.setParam(param, newValue, true);
        } 
        // For other parameters, we scale between min and max based on influence
        else {
            let newValue;
            
            if (direction === "normal") {
                // Normal direction: increase parameter with influence
                newValue = baseValue + influence;
            } else {
                // Inverted direction: decrease parameter with influence
                newValue = baseValue - influence;
            }
            
            // Clamp to 0-1 range
            newValue = utils.clamp(newValue, 0, 1);
            
            // Set with immediate flag for responsive feel
            this.setParam(param, newValue, true);
        }
    }
    
    /**
     * Handle visual change
     * @param {object} data - Visual change data
     */
    handleVisualChanged(data) {
        const { visualId, isWebGL } = data;
        
        // Only react if this is a 2D visualization (not WebGL)
        if (!isWebGL) {
            this.setVisual(visualId);
        }
    }
    
    /**
     * Set a parameter value
     * @param {string} paramName - Parameter name
     * @param {number} value - Parameter value (0-1)
     * @param {boolean} immediate - Apply immediately without smoothing
     */
    setParam(paramName, value, immediate = false) {
        // Update target value
        this.targetParams[paramName] = value;
        
        // If immediate, update current value too
        if (immediate) {
            this.params[paramName] = value;
        }
    }
    
    /**
     * Map a parameter to a range
     * @param {number} param - Parameter value (0-1)
     * @param {number} min - Minimum output value
     * @param {number} max - Maximum output value
     * @returns {number} Mapped value
     */
    mapParam(param, min, max) {
        return min + param * (max - min);
    }
    
    /**
     * Register a visualization generator
     * @param {string} name - Visualization name
     * @param {function} generator - Visualization generator function
     */
    registerVisual(name, generator) {
        this.visualGenerators[name] = generator.bind(this);
        
        LiveArt.log(`Registered visual: ${name}`);
    }
    
    /**
     * Set the current visualization
     * @param {string} name - Visualization name
     * @returns {boolean} - Success
     */
    setVisual(name) {
        if (!this.visualGenerators[name]) {
            LiveArt.log(`Visual not found: ${name}`, 'error');
            return false;
        }
        
        this.currentVisual = name;
        
        LiveArt.log(`Set visual: ${name}`);
        return true;
    }
    
    /**
     * Start the animation loop
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.frameId = requestAnimationFrame(this.animate);
        
        LiveArt.log('Visual engine started');
    }
    
    /**
     * Stop the animation loop
     */
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        
        LiveArt.log('Visual engine stopped');
    }
    
    /**
     * Update parameters with smoothing
     * @param {number} delta - Time since last frame (ms)
     */
    updateParamsWithSmoothing(delta) {
        // Get smoothing amount (0 = immediate, 1 = very smooth)
        const smoothingAmount = this.params.smoothing || 0.5;
        
        // Calculate smoothing factor (lower = smoother)
        // delta / 1000 converts milliseconds to seconds
        const smoothingFactor = Math.min(1, (delta / 1000) / (0.02 + smoothingAmount * 0.3));
        
        // Update each parameter
        for (const paramName in this.params) {
            if (paramName === 'smoothing') continue; // Don't smooth the smoothing parameter
            
            // Only if the target value is different
            if (this.params[paramName] !== this.targetParams[paramName]) {
                this.params[paramName] += (this.targetParams[paramName] - this.params[paramName]) * smoothingFactor;
                
                // Avoid very small differences
                if (Math.abs(this.params[paramName] - this.targetParams[paramName]) < 0.0001) {
                    this.params[paramName] = this.targetParams[paramName];
                }
            }
        }
    }
    
    /**
     * Main animation loop
     * @param {number} timestamp - Current timestamp
     */
    animate(timestamp) {
        if (!this.isRunning) return;
        
        // Calculate delta time and update time counter
        const delta = timestamp - this.lastFrameTime;
        this.lastFrameTime = timestamp;
        
        // Update parameters with smoothing
        this.updateParamsWithSmoothing(delta);
        
        // Update global time (scaled by speed)
        this.time += delta * 0.001 * this.mapParam(this.params.speed, 0.2, 2);
        
        // Update FPS counter
        this.updateFPS(delta);
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Render current visual
        if (this.visualGenerators[this.currentVisual]) {
            this.visualGenerators[this.currentVisual](delta);
        }
        
        // Request next frame
        this.frameId = requestAnimationFrame(this.animate);
    }
    
    /**
     * Update FPS counter
     * @param {number} delta - Time since last frame (ms)
     */
    updateFPS(delta) {
        // Calculate current FPS
        this.fps = 1000 / delta;
        
        // Update display occasionally to avoid rapid changes
        if (performance.now() - this.lastFpsUpdate > this.fpsUpdateInterval) {
            const fpsElement = document.getElementById('fps');
            if (fpsElement) {
                fpsElement.textContent = Math.round(this.fps);
            }
            this.lastFpsUpdate = performance.now();
        }
    }
    
    /**
     * Convert HSB/HSV color to RGB
     * @param {number} h - Hue (0-1)
     * @param {number} s - Saturation (0-1)
     * @param {number} b - Brightness (0-1)
     * @param {number} a - Alpha (0-1)
     * @returns {string} RGBA color string
     */
    hsbaToRgba(h, s, b, a = 1) {
        return utils.hsbToRgbaString(h, s, b, a);
    }
    
    /**
     * Get the current frame stats
     * @returns {object} Frame statistics
     */
    getStats() {
        return {
            fps: this.fps,
            time: this.time,
            isRunning: this.isRunning,
            currentVisual: this.currentVisual
        };
    }
}

export default VisualEngine;