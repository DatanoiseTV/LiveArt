/**
 * WebGL Engine Module
 * Handles 3D rendering with THREE.js
 */

import LiveArt from '../index.js';
import events from '../core/events.js';
import settings from '../core/settings.js';
import utils from '../core/utils.js';

class WebGLEngine {
    constructor(containerId) {
        // THREE.js dependencies will be loaded dynamically
        this.THREE = window.THREE;
        
        // Container element
        this.containerId = containerId;
        this.container = null;
        
        // THREE.js objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.clock = null;
        
        // Parameters (will be synced with global params)
        this.params = { ...settings.getParams() };
        this.targetParams = { ...this.params };
        
        // Transformation parameters
        this.rotationX = 0;
        this.rotationY = 0;
        this.translationZ = 0;
        
        // Scene objects
        this.sceneObjects = {};
        this.floor = null;
        this.showFloor = true;
        
        // Post-processing effects
        this.effectsEnabled = true;
        this.bloomPass = null;
        this.glitchPass = null;
        this.rgbShiftPass = null;
        this.vignettePass = null;
        
        // Animation state
        this.isRunning = false;
        this.frameId = null;
        this.lastFrameTime = 0;
        
        // Visual registry
        this.visualGenerators = {};
        this.currentVisual = null;
        
        // Performance monitoring
        this.fps = 0;
        this.lastFpsUpdate = 0;
        this.fpsUpdateInterval = 250;
        
        // Bind methods
        this.animate = this.animate.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }
    
    /**
     * Initialize the WebGL engine
     */
    init() {
        LiveArt.log('Initializing WebGL engine...');
        
        // Check if THREE.js is loaded
        if (!window.THREE) {
            LiveArt.log('THREE.js not loaded', 'error');
            return false;
        }
        
        this.THREE = window.THREE;
        
        // Get container element
        this.container = document.getElementById(this.containerId);
        
        if (!this.container) {
            LiveArt.log(`Container not found: ${this.containerId}`, 'error');
            return false;
        }
        
        // Initialize THREE.js scene
        this.initScene();
        
        // Initialize post-processing
        this.initPostProcessing();
        
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
        events.trigger('webglEngine:ready', this);
        
        LiveArt.log('WebGL engine initialized');
        return true;
    }
    
    /**
     * Initialize THREE.js scene
     */
    initScene() {
        // Create scene
        this.scene = new this.THREE.Scene();
        this.scene.background = new this.THREE.Color(0x000000);
        
        // Create camera
        this.camera = new this.THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 5;
        
        // Create renderer
        this.renderer = new this.THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
        
        // Create clock for animation
        this.clock = new this.THREE.Clock();
        
        // Create floor grid
        this.createFloorGrid();
    }
    
    /**
     * Create floor grid
     */
    createFloorGrid() {
        // Create floor grid
        const gridHelper = new this.THREE.GridHelper(20, 20, 0x333333, 0x222222);
        gridHelper.position.y = -2;
        this.scene.add(gridHelper);
        this.floor = gridHelper;
        
        // Create floor plane
        const planeGeometry = new this.THREE.PlaneGeometry(20, 20);
        const planeMaterial = new this.THREE.MeshBasicMaterial({
            color: 0x000000,
            side: this.THREE.DoubleSide,
            transparent: true,
            opacity: 0.2
        });
        const plane = new this.THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = Math.PI / 2;
        plane.position.y = -2;
        this.scene.add(plane);
    }
    
    /**
     * Initialize post-processing effects
     */
    initPostProcessing() {
        // Create effect composer
        this.composer = new this.THREE.EffectComposer(this.renderer);
        
        // Add render pass
        const renderPass = new this.THREE.RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        
        // Add bloom pass
        this.bloomPass = new this.THREE.UnrealBloomPass(
            new this.THREE.Vector2(window.innerWidth, window.innerHeight),
            1.5, // strength
            0.4, // radius
            0.85 // threshold
        );
        this.composer.addPass(this.bloomPass);
        
        // Add RGB shift pass
        this.rgbShiftPass = new this.THREE.ShaderPass(this.THREE.RGBShiftShader);
        this.rgbShiftPass.uniforms.amount.value = 0.0015;
        this.composer.addPass(this.rgbShiftPass);
        
        // Add vignette pass
        this.vignettePass = new this.THREE.ShaderPass(this.THREE.VignetteShader);
        this.vignettePass.uniforms.offset.value = 1.5;
        this.vignettePass.uniforms.darkness.value = 1.3;
        this.composer.addPass(this.vignettePass);
        
        // Add glitch pass
        this.glitchPass = new this.THREE.GlitchPass();
        this.glitchPass.goWild = false;
        this.glitchPass.enabled = false; // Disabled by default
        this.composer.addPass(this.glitchPass);
        
        // Set the last pass to render to screen
        this.vignettePass.renderToScreen = true;
    }
    
    /**
     * Handle window resize
     */
    handleResize() {
        // Update camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        // Update renderer size
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Update composer size
        this.composer.setSize(window.innerWidth, window.innerHeight);
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
        
        // Apply effect-specific parameters
        this.updateEffects();
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
        
        // Update effects based on new parameter values
        this.updateEffects();
    }
    
    /**
     * Handle visual change
     * @param {object} data - Visual change data
     */
    handleVisualChanged(data) {
        const { visualId, isWebGL } = data;
        
        // Only react if this is a WebGL visualization
        if (isWebGL) {
            this.setVisual(visualId);
        }
    }
    
    /**
     * Update post-processing effects based on parameters
     */
    updateEffects() {
        // Only update if effects are initialized
        if (!this.bloomPass || !this.rgbShiftPass || !this.vignettePass || !this.glitchPass) {
            return;
        }
        
        // Update bloom pass
        this.bloomPass.strength = this.mapParam(this.params.brightness, 0.5, 2.0);
        this.bloomPass.radius = this.mapParam(this.params.size, 0.1, 1.0);
        this.bloomPass.threshold = this.mapParam(1 - this.params.reactivity, 0.1, 0.9);
        
        // Update RGB shift pass
        this.rgbShiftPass.uniforms.amount.value = this.mapParam(this.params.complexity, 0.0, 0.005);
        
        // Update vignette pass
        this.vignettePass.uniforms.offset.value = this.mapParam(this.params.zoom, 0.5, 2.0);
        this.vignettePass.uniforms.darkness.value = this.mapParam(this.params.density, 0.5, 2.0);
        
        // Update glitch pass (rarely used, but kept for special effects)
        this.glitchPass.enabled = false; // Typically disabled
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
     * Toggle floor grid visibility
     */
    toggleFloor() {
        if (this.floor) {
            this.showFloor = !this.showFloor;
            this.floor.visible = this.showFloor;
        }
    }
    
    /**
     * Register a visualization generator
     * @param {string} name - Visualization name
     * @param {function} generator - Visualization generator function
     */
    registerVisual(name, generator) {
        this.visualGenerators[name] = generator.bind(this);
        
        LiveArt.log(`Registered WebGL visual: ${name}`);
    }
    
    /**
     * Set the current visualization
     * @param {string} name - Visualization name
     * @returns {boolean} - Success
     */
    setVisual(name) {
        // Clean up current visual if any
        this.cleanupCurrentVisual();
        
        // Set new visual
        if (!this.visualGenerators[name]) {
            LiveArt.log(`WebGL visual not found: ${name}`, 'error');
            return false;
        }
        
        this.currentVisual = name;
        
        // Initialize the new visual
        this.visualGenerators[name]();
        
        LiveArt.log(`Set WebGL visual: ${name}`);
        return true;
    }
    
    /**
     * Clean up the current visualization
     */
    cleanupCurrentVisual() {
        // Remove all objects except the floor
        while (this.scene.children.length > 0) {
            const obj = this.scene.children[0];
            if (obj === this.floor) {
                // Skip the floor
                this.scene.remove(this.scene.children[1]);
            } else {
                this.scene.remove(obj);
            }
        }
        
        // Re-add floor if it was removed
        if (this.floor && !this.scene.children.includes(this.floor)) {
            this.scene.add(this.floor);
            this.floor.visible = this.showFloor;
        }
    }
    
    /**
     * Start the animation loop
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastFrameTime = performance.now();
        this.clock.start();
        this.frameId = requestAnimationFrame(this.animate);
        
        LiveArt.log('WebGL engine started');
    }
    
    /**
     * Stop the animation loop
     */
    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        this.clock.stop();
        
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        
        LiveArt.log('WebGL engine stopped');
    }
    
    /**
     * Update parameters with smoothing
     * @param {number} delta - Time since last frame (seconds)
     */
    updateParamsWithSmoothing(delta) {
        // Get smoothing amount (0 = immediate, 1 = very smooth)
        const smoothingAmount = this.params.smoothing || 0.5;
        
        // Calculate smoothing factor (lower = smoother)
        const smoothingFactor = Math.min(1, delta / (0.02 + smoothingAmount * 0.3));
        
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
        try {
            if (!this.isRunning) return;
            
            // Get delta time (convert to seconds)
            const delta = this.clock.getDelta();
            
            // Update parameters with smoothing
            this.updateParamsWithSmoothing(delta);
            
            // Update FPS counter
            this.updateFPS(delta);
            
            // Apply 3D transformations
            this.applyTransformations();
            
            // Update effects with current parameters
            this.updateEffects();
            this.effectsEnabled = true;
            
            // Render with post-processing (if enabled)
            if (this.effectsEnabled && this.composer) {
                this.composer.render(delta);
            } else {
                this.renderer.render(this.scene, this.camera);
            }
            
            // Request next frame
            this.frameId = requestAnimationFrame(this.animate);
        } catch (error) {
            LiveArt.log(`Error in WebGL animation loop: ${error.message}`, 'error');
            console.error('WebGL animation error:', error);
            
            // Try to recover by stopping and starting again
            this.stop();
            setTimeout(() => this.start(), 1000);
        }
    }
    
    /**
     * Apply 3D transformations
     */
    applyTransformations() {
        // Apply rotation to camera
        this.camera.position.x = Math.sin(this.rotationY) * 5;
        this.camera.position.z = Math.cos(this.rotationY) * 5;
        this.camera.position.y = Math.sin(this.rotationX) * 5;
        
        // Apply translation (zoom)
        this.camera.position.multiplyScalar(1 + this.translationZ);
        
        // Look at center
        this.camera.lookAt(0, 0, 0);
    }
    
    /**
     * Update FPS counter
     * @param {number} deltaSeconds - Time since last frame (seconds)
     */
    updateFPS(deltaSeconds) {
        // Convert delta seconds to milliseconds for consistency with VisualEngine
        const delta = deltaSeconds * 1000;
        
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
     * Get the current frame stats
     * @returns {object} Frame statistics
     */
    getStats() {
        return {
            fps: this.fps,
            isRunning: this.isRunning,
            currentVisual: this.currentVisual
        };
    }
}

export default WebGLEngine;