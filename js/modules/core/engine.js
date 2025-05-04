/**
 * Engine Module
 * Core engine functionality for LiveArt
 */

import LiveArt from '../index.js';
import events from './events.js';
import settings from './settings.js';
import utils from './utils.js';

class Engine {
    constructor() {
        // Engine state
        this.state = {
            running: false,
            currentVisual: null,
            time: 0,
            lastFrameTime: 0,
            fps: 0,
            isWebGL: false
        };
        
        // Bindings
        this.animate = this.animate.bind(this);
        this.frameId = null;
    }
    
    /**
     * Initialize the engine
     */
    init() {
        LiveArt.log('Initializing engine...');
        
        // Listen for settings changes
        events.on('settings:loaded', this.handleSettingsLoaded, this);
        events.on('settings:changed', this.handleSettingsChanged, this);
        
        // Initialize engines when available
        events.on('visualEngine:ready', this.handleVisualEngineReady, this);
        events.on('webglEngine:ready', this.handleWebGLEngineReady, this);
        
        LiveArt.log('Engine initialized');
    }
    
    /**
     * Handle settings loaded
     * @param {object} loadedSettings - Loaded settings
     */
    handleSettingsLoaded(loadedSettings) {
        // Initialize with loaded settings
    }
    
    /**
     * Handle settings changes
     * @param {object} changes - Changed settings
     */
    handleSettingsChanged(changes) {
        // React to settings changes
        if (changes.path.startsWith('params.')) {
            // Parameter changed, update visual engines
            const paramName = changes.path.split('.')[1];
            const paramValue = changes.value;
            
            // Update all engines
            events.trigger('parameter:changed', { param: paramName, value: paramValue });
        }
    }
    
    /**
     * Handle visual engine ready
     * @param {object} visualEngine - Visual engine instance
     */
    handleVisualEngineReady(visualEngine) {
        this.visualEngine = visualEngine;
        
        // Start animation if not already running
        if (!this.state.running) {
            this.start();
        }
    }
    
    /**
     * Handle WebGL engine ready
     * @param {object} webglEngine - WebGL engine instance
     */
    handleWebGLEngineReady(webglEngine) {
        this.webglEngine = webglEngine;
    }
    
    /**
     * Start the engine
     */
    start() {
        if (this.state.running) return;
        
        this.state.running = true;
        this.state.lastFrameTime = performance.now();
        this.frameId = requestAnimationFrame(this.animate);
        
        events.trigger('engine:started');
        LiveArt.log('Engine started');
    }
    
    /**
     * Stop the engine
     */
    stop() {
        if (!this.state.running) return;
        
        this.state.running = false;
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        
        events.trigger('engine:stopped');
        LiveArt.log('Engine stopped');
    }
    
    /**
     * Main animation loop
     * @param {number} timestamp - Current timestamp
     */
    animate(timestamp) {
        if (!this.state.running) return;
        
        // Calculate delta time and update time
        const delta = timestamp - this.state.lastFrameTime;
        this.state.lastFrameTime = timestamp;
        
        // Update FPS
        this.state.fps = 1000 / delta;
        
        // Update time
        this.state.time += delta * 0.001;
        
        // Trigger animation event for other modules
        events.trigger('engine:animate', {
            timestamp,
            delta,
            fps: this.state.fps,
            time: this.state.time
        });
        
        // Request next frame
        this.frameId = requestAnimationFrame(this.animate);
    }
    
    /**
     * Switch to a different visualization
     * @param {string} visualId - Visualization identifier
     */
    switchVisual(visualId) {
        // Check if already showing this visual
        if (this.state.currentVisual === visualId) return;
        
        const isWebGL = visualId.startsWith('webgl-');
        
        // Update state
        this.state.currentVisual = visualId;
        this.state.isWebGL = isWebGL;
        
        // Notify about visual change
        events.trigger('engine:visualChanged', {
            visualId,
            isWebGL
        });
        
        LiveArt.log(`Switched to visual: ${visualId}`);
    }
    
    /**
     * Get the current engine state
     * @returns {object} Current engine state
     */
    getState() {
        return { ...this.state };
    }
}

// Create the engine instance
const engine = new Engine();

// Register as a module
LiveArt.registerModule('engine', engine);

export default engine;