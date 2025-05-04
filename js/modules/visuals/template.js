/**
 * Template Visualizer
 * 
 * This file serves as a template for creating new LiveArt visualizers.
 * It includes the basic structure, lifecycle methods, and examples of
 * how to interact with the engine and respond to events.
 * 
 * How to use this template:
 * 1. Copy this file and rename it to match your visualization (e.g., "my-visualizer.js")
 * 2. Change the class name and visualization name to match your visualization
 * 3. Implement the render method with your visualization code
 * 4. Add your visualization to the main.js file
 * 5. Register any custom parameters or events as needed
 */

import LiveArt from '../index.js';
import events from '../core/events.js';
import utils from '../core/utils.js';
import VisualEngine from './visual-engine.js';

class TemplateVisualizer {
    /**
     * Constructor
     * @param {VisualEngine} visualEngine - Reference to the visual engine
     */
    constructor(visualEngine) {
        // Store reference to the engine
        this.engine = visualEngine;
        
        // Set a unique name for this visualization
        // This name will be used when registering and selecting the visualization
        this.name = 'template-visualizer';
        
        // Initialize any visualization-specific properties
        this.customProperties = {
            // Add any properties specific to your visualization here
            elapsedTime: 0,
            particleCount: 100,
            particles: []
        };
        
        // You can define custom color schemes
        this.colorSchemes = {
            default: {
                background: [0, 0, 0.1],  // Dark blue
                primary: [0.6, 0.8, 1.0], // Bright blue
                accent: [1.0, 0.5, 0.0]   // Orange
            },
            alternate: {
                background: [0.1, 0, 0.1], // Dark purple
                primary: [0.8, 0.3, 0.8],  // Bright purple
                accent: [0.3, 0.8, 0.3]    // Green
            }
        };
        
        // Current color scheme
        this.currentScheme = 'default';
        
        // Bind methods to this instance
        this.render = this.render.bind(this);
        this.handleAudioUpdate = this.handleAudioUpdate.bind(this);
    }
    
    /**
     * Initialize the visualizer
     * This is called when the visualizer is first loaded
     */
    init() {
        LiveArt.log(`Initializing ${this.name} visualization...`);
        
        // Register this visualization with the engine
        // This maps your render function to the visualization name
        this.engine.registerVisual(this.name, this.render);
        
        // Initialize any resources needed for your visualization
        this.initResources();
        
        // Set up event listeners
        // Listen for audio updates if your visualization is audio-reactive
        events.on('audio:updated', this.handleAudioUpdate, this);
        
        // You can listen for other events as needed
        events.on('parameter:changed', this.handleParameterChanged, this);
        
        LiveArt.log(`${this.name} visualization initialized`);
    }
    
    /**
     * Initialize resources for the visualization
     * This is a good place to load textures, create geometries, etc.
     */
    initResources() {
        // Example: Initialize particles
        this.customProperties.particles = [];
        
        for (let i = 0; i < this.customProperties.particleCount; i++) {
            this.customProperties.particles.push({
                x: Math.random() * this.engine.width,
                y: Math.random() * this.engine.height,
                size: Math.random() * 5 + 1,
                speed: Math.random() * 2 + 0.5
            });
        }
    }
    
    /**
     * Clean up any resources when the visualizer is unloaded
     * This is important to prevent memory leaks
     */
    cleanup() {
        // Remove event listeners
        events.off('audio:updated', this.handleAudioUpdate);
        events.off('parameter:changed', this.handleParameterChanged);
        
        // Clean up any resources
        this.customProperties.particles = [];
        
        LiveArt.log(`${this.name} visualization cleaned up`);
    }
    
    /**
     * Handle audio data updates
     * @param {object} audioData - Audio data from the audio engine
     */
    handleAudioUpdate(audioData) {
        // You can store or process audio data here if needed
        // This is useful if you want to maintain state between renders
        
        // Example: Store peak level for use in render
        if (audioData && audioData.peakLevel) {
            this.customProperties.peakLevel = audioData.peakLevel;
        }
    }
    
    /**
     * Handle parameter changes
     * @param {object} data - Parameter change data
     */
    handleParameterChanged(data) {
        const { param, value } = data;
        
        // Example: Switch color scheme based on hue parameter
        if (param === 'hue') {
            this.currentScheme = value > 0.5 ? 'alternate' : 'default';
        }
    }
    
    /**
     * Get a color from the current scheme
     * @param {string} colorName - Name of the color in the scheme
     * @param {number} alpha - Alpha value (0-1)
     * @returns {string} - RGBA color string
     */
    getSchemeColor(colorName, alpha = 1) {
        const scheme = this.colorSchemes[this.currentScheme];
        if (!scheme || !scheme[colorName]) {
            return 'rgba(255, 255, 255, ' + alpha + ')';
        }
        
        const color = scheme[colorName];
        return `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${alpha})`;
    }
    
    /**
     * Main render method
     * This is called on each animation frame when the visualization is active
     * @param {number} delta - Time since last frame (ms)
     */
    render(delta) {
        // Get the drawing context from the engine
        const ctx = this.engine.ctx;
        
        // Get canvas dimensions
        const width = this.engine.width;
        const height = this.engine.height;
        
        // Update elapsed time
        this.customProperties.elapsedTime += delta * 0.001;
        
        // Get parameters from the engine
        // These come from the global parameter controls
        const hue = this.engine.params.hue;
        const saturation = this.engine.params.saturation;
        const brightness = this.engine.params.brightness;
        const complexity = this.engine.params.complexity;
        const speed = this.engine.mapParam(this.engine.params.speed, 0.1, 2.0);
        const size = this.engine.mapParam(this.engine.params.size, 0.5, 2.0);
        
        // Get audio data for audio-reactive elements
        const audioEngine = LiveArt.getModule('audioEngine');
        let audioData = null;
        
        if (audioEngine) {
            audioData = audioEngine.getAudioData();
        }
        
        // Example audio reactive values
        let bassValue = 0;
        let midValue = 0;
        let highValue = 0;
        
        if (audioData && audioData.smoothedValues) {
            // Get different frequency bands
            bassValue = this.getAudioBand(audioData.smoothedValues, 0, 8);
            midValue = this.getAudioBand(audioData.smoothedValues, 8, 32);
            highValue = this.getAudioBand(audioData.smoothedValues, 32, 64);
        }
        
        // Clear the canvas with a background
        // You can use a solid color or gradient
        ctx.fillStyle = this.engine.hsbaToRgba(hue, saturation * 0.2, brightness * 0.2, 1);
        ctx.fillRect(0, 0, width, height);
        
        // Draw visualization elements
        this.drawBackground(ctx, width, height, hue, saturation, brightness);
        this.drawParticles(ctx, width, height, hue, saturation, brightness, speed, size, bassValue);
        
        // Draw overlay elements if needed
        if (complexity > 0.5) {
            this.drawOverlay(ctx, width, height, hue, saturation, brightness, midValue);
        }
    }
    
    /**
     * Draw background elements
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {number} hue - Color hue (0-1)
     * @param {number} saturation - Color saturation (0-1)
     * @param {number} brightness - Color brightness (0-1)
     */
    drawBackground(ctx, width, height, hue, saturation, brightness) {
        // Example: Draw a radial gradient background
        const gradient = ctx.createRadialGradient(
            width / 2, height / 2, 0,
            width / 2, height / 2, Math.max(width, height) / 2
        );
        gradient.addColorStop(0, this.engine.hsbaToRgba(hue, saturation * 0.3, brightness * 0.4, 1));
        gradient.addColorStop(1, this.engine.hsbaToRgba(hue, saturation * 0.2, brightness * 0.1, 1));
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }
    
    /**
     * Draw particle elements
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {number} hue - Color hue (0-1)
     * @param {number} saturation - Color saturation (0-1)
     * @param {number} brightness - Color brightness (0-1)
     * @param {number} speed - Animation speed
     * @param {number} size - Element size
     * @param {number} audioValue - Audio reactive value (0-1)
     */
    drawParticles(ctx, width, height, hue, saturation, brightness, speed, size, audioValue) {
        // Example: Draw and update particles
        for (const particle of this.customProperties.particles) {
            // Update particle position
            particle.y += particle.speed * speed;
            
            // Reset particle if it goes off screen
            if (particle.y > height) {
                particle.y = 0;
                particle.x = Math.random() * width;
            }
            
            // Draw particle
            const particleSize = particle.size * size * (1 + audioValue);
            const particleColor = this.engine.hsbaToRgba(
                (hue + particle.x / width * 0.2) % 1,
                saturation,
                brightness,
                0.8
            );
            
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particleSize, 0, Math.PI * 2);
            ctx.fillStyle = particleColor;
            ctx.fill();
        }
    }
    
    /**
     * Draw overlay elements
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @param {number} hue - Color hue (0-1)
     * @param {number} saturation - Color saturation (0-1)
     * @param {number} brightness - Color brightness (0-1)
     * @param {number} audioValue - Audio reactive value (0-1)
     */
    drawOverlay(ctx, width, height, hue, saturation, brightness, audioValue) {
        // Example: Draw circular overlay
        const time = this.customProperties.elapsedTime;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.4 * (1 + audioValue * 0.2);
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(time * 0.2);
        
        // Draw spokes
        const spokeCount = 12;
        for (let i = 0; i < spokeCount; i++) {
            const angle = (i / spokeCount) * Math.PI * 2;
            const spokeColor = this.engine.hsbaToRgba(
                (hue + i / spokeCount) % 1,
                saturation,
                brightness,
                0.3 + audioValue * 0.3
            );
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
            ctx.strokeStyle = spokeColor;
            ctx.lineWidth = 2 + audioValue * 3;
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    /**
     * Get average value for a frequency band
     * @param {Array} smoothedValues - Smoothed frequency values
     * @param {number} startBin - Start frequency bin
     * @param {number} endBin - End frequency bin
     * @returns {number} Band average (0-1)
     */
    getAudioBand(smoothedValues, startBin, endBin) {
        if (!smoothedValues) return 0;
        
        // Clamp to valid range
        const start = Math.min(Math.max(0, Math.floor(startBin)), smoothedValues.length - 1);
        const end = Math.min(Math.max(start, Math.floor(endBin)), smoothedValues.length - 1);
        
        let sum = 0;
        for (let i = start; i <= end; i++) {
            sum += smoothedValues[i] || 0;
        }
        
        return sum / (end - start + 1);
    }
}

export default TemplateVisualizer;

/* 
Visualization Integration Guide:

To add your visualization to LiveArt:

1. In main.js, import your visualizer:
   import MyVisualizer from './visuals/my-visualizer.js';

2. Initialize your visualizer:
   const myVisualizer = new MyVisualizer(visualEngine);
   myVisualizer.init();

3. Add your visualization to the UI (in ui-manager.js):
   Add an entry to the visualization selection dropdown.

4. Register custom parameters (if needed):
   If your visualization requires custom parameters beyond the standard set,
   you can listen for specific parameter changes or add custom UI controls.

Best Practices:
- Keep your visualization responsive to window resizing
- Use the engine's parameters for consistent behavior across visualizations
- Clean up resources when your visualization is not active
- Use audio data responsively for audio-reactive visualizations
- Follow the established naming and coding conventions

Performance Tips:
- Minimize object creation in the render loop
- Use requestAnimationFrame properly (handled by the engine)
- Consider using canvas optimizations for complex visualizations
- Test your visualization on lower-end devices
*/