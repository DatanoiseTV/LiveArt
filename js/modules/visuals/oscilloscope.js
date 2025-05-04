/**
 * Oscilloscope Visualization
 * Simulates a classic CRT oscilloscope with authentic phosphor effects
 */

import LiveArt from '../index.js';
import events from '../core/events.js';
import utils from '../core/utils.js';
import VisualEngine from './visual-engine.js';

class OscilloscopeVisualizer {
    constructor(visualEngine) {
        this.engine = visualEngine;
        this.name = 'oscilloscope';
        
        // Oscilloscope buffers for phosphor effect
        this.buffers = {
            initialized: false,
            canvas: null,
            ctx: null,
            bloomCanvas: null,
            bloomCtx: null,
            longTrailCanvas: null,
            longTrailCtx: null,
            phosphorType: 'p31', // Default phosphor type (P31 - bright green, fast decay)
            lastFrameTime: 0,
            beamIntensity: 0.8, // Electron beam intensity/focus
            beamSharpness: 0.8, // Beam focus/sharpness
            opacity: 0.95, // Base opacity
            baseHue: 0.33, // Green for classic oscilloscope
            decay: 0.05, // Base decay rate
            gridColor: 'rgba(0, 255, 0, 0.15)',
            gridSize: 40,
            showGrid: true
        };
        
        // Phosphor decay constants based on real oscilloscope phosphors
        this.decayConstants = {
            // Fast decay - initial bright glow (ms)
            p1: { fast: 50, medium: 150, slow: 300, veryLong: 600 },
            p7: { fast: 60, medium: 200, slow: 500, veryLong: 1200 }, // Blue-yellow dual phosphor
            p31: { fast: 35, medium: 80, slow: 180, veryLong: 400 }   // Fast decay green phosphor
        };
    }
    
    /**
     * Initialize the oscilloscope visualization
     */
    init() {
        LiveArt.log('Initializing oscilloscope visualization...');
        
        // Register visualization with the engine
        this.engine.registerVisual(this.name, this.render.bind(this));
        
        // Initialize oscilloscope buffers
        this.initBuffers();
        
        // Listen for events
        events.on('audio:updated', this.handleAudioUpdate, this);
        
        LiveArt.log('Oscilloscope visualization initialized');
    }
    
    /**
     * Handle audio data updates
     * @param {object} audioData - Audio data
     */
    handleAudioUpdate(audioData) {
        // Update occurs in render method
    }
    
    /**
     * Initialize oscilloscope buffers
     */
    initBuffers() {
        if (this.buffers.initialized) return;
        
        // Get canvas dimensions
        const width = this.engine.width;
        const height = this.engine.height;
        
        // Create main drawing buffer (bright immediate glow)
        this.buffers.canvas = document.createElement('canvas');
        this.buffers.canvas.width = width;
        this.buffers.canvas.height = height;
        this.buffers.ctx = this.buffers.canvas.getContext('2d');
        
        // Create bloom effect buffer (for glow)
        this.buffers.bloomCanvas = document.createElement('canvas');
        this.buffers.bloomCanvas.width = width;
        this.buffers.bloomCanvas.height = height;
        this.buffers.bloomCtx = this.buffers.bloomCanvas.getContext('2d');
        
        // Create long trail buffer (for phosphor persistence)
        this.buffers.longTrailCanvas = document.createElement('canvas');
        this.buffers.longTrailCanvas.width = width;
        this.buffers.longTrailCanvas.height = height;
        this.buffers.longTrailCtx = this.buffers.longTrailCanvas.getContext('2d');
        
        // Mark as initialized
        this.buffers.initialized = true;
        this.buffers.lastFrameTime = performance.now();
    }
    
    /**
     * Set the phosphor type
     * @param {string} phosphorType - Phosphor type ('p1', 'p7', or 'p31')
     */
    setPhosphorType(phosphorType) {
        // Validate phosphor type
        const validTypes = ['p1', 'p7', 'p31'];
        if (!validTypes.includes(phosphorType)) {
            LiveArt.log(`Invalid phosphor type: ${phosphorType}. Using default.`, 'warn');
            phosphorType = 'p31';
        }
        
        // Set phosphor type
        this.buffers.phosphorType = phosphorType;
        
        LiveArt.log(`Set oscilloscope phosphor type to: ${phosphorType}`);
    }
    
    /**
     * Render the oscilloscope visualization
     * @param {number} delta - Time since last frame (ms)
     */
    render(delta) {
        // Get audio engine
        const audioEngine = LiveArt.getModule('audioEngine');
        
        if (!audioEngine) {
            return;
        }
        
        // Get audio data
        const audioData = audioEngine.getAudioData();
        
        // Initialize buffers if needed
        this.initBuffers();
        
        // Get parameters from engine
        const hue = 0.33; // Fixed green for authentic oscilloscope look
        const saturation = this.engine.mapParam(this.engine.params.saturation, 0.7, 1.0);
        const brightness = this.engine.mapParam(this.engine.params.brightness, 0.6, 1.0);
        const complexity = this.engine.mapParam(this.engine.params.complexity, 1, 8);
        const speed = this.engine.mapParam(this.engine.params.speed, 0.2, 2.0);
        const size = this.engine.mapParam(this.engine.params.size, 0.5, 2.0);
        
        // Get time values for animation
        const time = this.engine.time * speed;
        
        // Calculate fade based on time since last frame for consistent fade regardless of framerate
        const now = performance.now();
        const deltaTime = Math.min(100, now - this.buffers.lastFrameTime) / 1000;
        this.buffers.lastFrameTime = now;
        
        // Get decay constants based on phosphor type
        const constants = this.decayConstants[this.buffers.phosphorType];
        
        // Calculate fade factors based on decay constants and delta time
        const fastDecay = Math.pow(0.1, deltaTime / (constants.fast / 1000));
        const mediumDecay = Math.pow(0.1, deltaTime / (constants.medium / 1000));
        const slowDecay = Math.pow(0.1, deltaTime / (constants.slow / 1000));
        
        // Apply phosphor decay to the buffers
        this.applyPhosphorDecay(fastDecay, mediumDecay, slowDecay);
        
        // Draw scope grid if enabled
        if (this.buffers.showGrid) {
            this.drawGrid();
        }
        
        // Apply CRT effects (scan lines, etc.)
        this.applyCRTEffects();
        
        // Get time domain data for oscilloscope
        const timeData = audioData.timeData;
        
        if (timeData) {
            // Draw the oscilloscope waveform
            this.drawWaveform(timeData, size, brightness);
        } else {
            // No audio data, draw a center dot
            this.drawCenterDot();
        }
        
        // Composite the buffers onto the main canvas
        this.compositeBuffers(brightness);
    }
    
    /**
     * Apply phosphor decay to the buffers
     * @param {number} fastDecay - Fast decay factor
     * @param {number} mediumDecay - Medium decay factor
     * @param {number} slowDecay - Slow decay factor
     */
    applyPhosphorDecay(fastDecay, mediumDecay, slowDecay) {
        // Apply different decay rates to different buffers
        
        // Main buffer - fast decay
        this.buffers.ctx.globalCompositeOperation = 'source-over';
        this.buffers.ctx.fillStyle = 'rgba(0, 0, 0, ' + (1 - fastDecay) + ')';
        this.buffers.ctx.fillRect(0, 0, this.engine.width, this.engine.height);
        
        // Bloom buffer - medium decay
        this.buffers.bloomCtx.globalCompositeOperation = 'source-over';
        this.buffers.bloomCtx.fillStyle = 'rgba(0, 0, 0, ' + (1 - mediumDecay) + ')';
        this.buffers.bloomCtx.fillRect(0, 0, this.engine.width, this.engine.height);
        
        // Long trail buffer - slow decay
        this.buffers.longTrailCtx.globalCompositeOperation = 'source-over';
        this.buffers.longTrailCtx.fillStyle = 'rgba(0, 0, 0, ' + (1 - slowDecay) + ')';
        this.buffers.longTrailCtx.fillRect(0, 0, this.engine.width, this.engine.height);
    }
    
    /**
     * Draw the oscilloscope grid
     */
    drawGrid() {
        const ctx = this.buffers.ctx;
        const width = this.engine.width;
        const height = this.engine.height;
        const gridSize = this.buffers.gridSize;
        
        // Draw grid
        ctx.strokeStyle = this.buffers.gridColor;
        ctx.lineWidth = 1;
        
        // Draw vertical grid lines
        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Draw horizontal grid lines
        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Draw center crosshair
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.beginPath();
        ctx.moveTo(width / 2, 0);
        ctx.lineTo(width / 2, height);
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
    }
    
    /**
     * Apply CRT effects to the oscilloscope
     */
    applyCRTEffects() {
        // Scan lines effect
        const ctx = this.buffers.ctx;
        const width = this.engine.width;
        const height = this.engine.height;
        
        // Draw scan lines
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        
        for (let y = 0; y < height; y += 2) {
            ctx.fillRect(0, y, width, 1);
        }
        
        // Reset composite operation
        ctx.globalCompositeOperation = 'source-over';
    }
    
    /**
     * Draw a waveform on the oscilloscope
     * @param {Uint8Array} timeData - Time domain audio data
     * @param {number} size - Size factor
     * @param {number} brightness - Brightness factor
     */
    drawWaveform(timeData, size, brightness) {
        // Get the number of points to draw
        const pointCount = Math.floor(timeData.length / 2);
        const timeDataLength = timeData.length;
        
        // Calculate dimensions
        const width = this.engine.width;
        const height = this.engine.height;
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Set drawing style based on phosphor type
        let mainColor, bloomColor, trailColor;
        
        switch (this.buffers.phosphorType) {
            case 'p1': // Standard green medium persistence
                mainColor = 'rgba(0, 255, 0, ' + (0.9 * brightness) + ')';
                bloomColor = 'rgba(0, 255, 0, ' + (0.5 * brightness) + ')';
                trailColor = 'rgba(0, 255, 0, ' + (0.3 * brightness) + ')';
                break;
                
            case 'p7': // Blue-yellow dual phosphor (blue short persistence, yellow long persistence)
                mainColor = 'rgba(100, 180, 255, ' + (0.9 * brightness) + ')';
                bloomColor = 'rgba(100, 180, 255, ' + (0.5 * brightness) + ')';
                trailColor = 'rgba(255, 230, 150, ' + (0.4 * brightness) + ')';
                break;
                
            case 'p31': // Bright green fast-decay phosphor
            default:
                mainColor = 'rgba(50, 255, 150, ' + (0.9 * brightness) + ')';
                bloomColor = 'rgba(50, 255, 150, ' + (0.5 * brightness) + ')';
                trailColor = 'rgba(50, 255, 150, ' + (0.3 * brightness) + ')';
                break;
        }
        
        // Main buffer drawing (bright, immediate)
        const mainCtx = this.buffers.ctx;
        mainCtx.lineWidth = 2 * size;
        mainCtx.strokeStyle = mainColor;
        mainCtx.shadowBlur = 5;
        mainCtx.shadowColor = mainColor;
        mainCtx.globalCompositeOperation = 'lighter';
        
        // Bloom buffer drawing (glow)
        const bloomCtx = this.buffers.bloomCtx;
        bloomCtx.lineWidth = 4 * size;
        bloomCtx.strokeStyle = bloomColor;
        bloomCtx.shadowBlur = 8;
        bloomCtx.shadowColor = bloomColor;
        bloomCtx.globalCompositeOperation = 'lighter';
        
        // Long trail buffer drawing (persistence)
        const trailCtx = this.buffers.longTrailCtx;
        trailCtx.lineWidth = 2 * size;
        trailCtx.strokeStyle = trailColor;
        trailCtx.shadowBlur = 0;
        trailCtx.globalCompositeOperation = 'lighter';
        
        // Use first half of buffer for left channel (X) and second half for right channel (Y)
        // This creates a proper X/Y vectorscope where X = left channel, Y = right channel
        const halfLength = Math.floor(timeDataLength / 2);
        
        // Draw the waveform path
        [mainCtx, bloomCtx, trailCtx].forEach(ctx => {
            ctx.beginPath();
            
            for (let i = 0; i < pointCount; i++) {
                // Direct mapping to left (X) and right (Y) channels for true vectorscope
                const xIndex = Math.floor(i * halfLength / pointCount); // Left channel (X-axis)
                const yIndex = halfLength + Math.floor(i * halfLength / pointCount); // Right channel (Y-axis)
                
                // Get normalized values (0-1)
                const xValue = (timeData[xIndex] / 255) * 2 - 1; // -1 to 1 range
                const yValue = (timeData[yIndex] / 255) * 2 - 1; // -1 to 1 range
                
                // Map to screen coordinates with scaling
                const x = centerX + xValue * centerX * 0.8 * size;
                const y = centerY + yValue * centerY * 0.8 * size;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            ctx.stroke();
        });
        
        // Reset composite operation
        mainCtx.globalCompositeOperation = 'source-over';
        bloomCtx.globalCompositeOperation = 'source-over';
        trailCtx.globalCompositeOperation = 'source-over';
        
        // Clear shadows
        mainCtx.shadowBlur = 0;
        bloomCtx.shadowBlur = 0;
    }
    
    /**
     * Draw a center dot when no audio is present
     */
    drawCenterDot() {
        const centerX = this.engine.width / 2;
        const centerY = this.engine.height / 2;
        
        // Set color based on phosphor type
        let dotColor;
        
        switch (this.buffers.phosphorType) {
            case 'p1': // Standard green
                dotColor = 'rgba(0, 255, 0, 0.7)';
                break;
                
            case 'p7': // Blue-yellow dual phosphor
                dotColor = 'rgba(100, 180, 255, 0.7)';
                break;
                
            case 'p31': // Bright green
            default:
                dotColor = 'rgba(50, 255, 150, 0.7)';
                break;
        }
        
        // Draw center dot on main buffer
        const ctx = this.buffers.ctx;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
        
        // Draw glow on bloom buffer
        const bloomCtx = this.buffers.bloomCtx;
        bloomCtx.beginPath();
        bloomCtx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        bloomCtx.fillStyle = dotColor.replace('0.7', '0.3');
        bloomCtx.fill();
    }
    
    /**
     * Composite the buffer layers onto the main canvas
     * @param {number} brightness - Brightness factor
     */
    compositeBuffers(brightness) {
        const ctx = this.engine.ctx;
        const width = this.engine.width;
        const height = this.engine.height;
        
        // Clear main canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw background
        ctx.fillStyle = 'rgb(10, 12, 14)';
        ctx.fillRect(0, 0, width, height);
        
        // Composite buffers
        ctx.globalCompositeOperation = 'lighter';
        
        // Draw long trail buffer first (lowest layer)
        ctx.globalAlpha = 0.8 * brightness;
        ctx.drawImage(this.buffers.longTrailCanvas, 0, 0);
        
        // Draw bloom buffer
        ctx.globalAlpha = 0.9 * brightness;
        ctx.drawImage(this.buffers.bloomCanvas, 0, 0);
        
        // Draw main buffer on top
        ctx.globalAlpha = 1.0 * brightness;
        ctx.drawImage(this.buffers.canvas, 0, 0);
        
        // Reset composite operation and alpha
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
    }
}

export default OscilloscopeVisualizer;