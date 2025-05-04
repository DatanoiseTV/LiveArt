/**
 * Frequency Visualizer Module
 * Visualizes audio frequency bands in the UI
 */

import LiveArt from '../index.js';
import events from '../core/events.js';
import utils from '../core/utils.js';
import frequencyMapper from '../audio/frequency-mapping.js';

class FrequencyVisualizer {
    constructor() {
        // Canvas and context
        this.canvas = null;
        this.ctx = null;
        
        // Animation
        this.animationId = null;
        this.isActive = false;
        
        // Interaction
        this.hoveredIndex = undefined;
        
        // Colors for bands
        this.bandColors = {
            bass: '#FF5252',     // Red
            lowMid: '#FFAB40',   // Orange
            mid: '#FFEB3B',      // Yellow
            highMid: '#4CAF50',  // Green
            treble: '#2196F3'    // Blue
        };
        
        // Bind methods
        this.render = this.render.bind(this);
    }
    
    /**
     * Initialize the visualizer
     */
    init() {
        LiveArt.log('Initializing frequency visualizer...');
        
        // Get canvas element
        this.canvas = document.getElementById('freq-visualizer-canvas');
        
        if (!this.canvas) {
            LiveArt.log('Frequency visualizer canvas not found', 'warn');
            return;
        }
        
        // Initialize canvas
        this.ctx = this.canvas.getContext('2d');
        
        // Set the canvas to the correct size with device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.clientWidth * dpr;
        this.canvas.height = this.canvas.clientHeight * dpr;
        this.ctx.scale(dpr, dpr);
        
        // Add mouse interaction
        this.setupInteraction();
        
        // Listen for panel visibility changes
        this.observePanelVisibility();
        
        // Listen for audio data updates
        events.on('audio:updated', this.handleAudioUpdate, this);
        
        LiveArt.log('Frequency visualizer initialized');
    }
    
    /**
     * Setup mouse interaction
     */
    setupInteraction() {
        if (!this.canvas) return;
        
        // Mouse move handler for hovering
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const width = this.canvas.clientWidth;
            
            // Calculate hovered frequency bin (0-127)
            const index = Math.floor((x / width) * 128);
            this.hoveredIndex = index;
        });
        
        // Mouse leave handler
        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredIndex = undefined;
        });
    }
    
    /**
     * Observe audio settings panel visibility
     */
    observePanelVisibility() {
        const audioSettingsPanel = document.getElementById('audio-settings-panel');
        
        if (!audioSettingsPanel) {
            LiveArt.log('Audio settings panel not found', 'warn');
            return;
        }
        
        // Create mutation observer
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    if (audioSettingsPanel.classList.contains('active')) {
                        // Panel opened, start visualizer
                        this.start();
                    } else {
                        // Panel closed, stop visualizer
                        this.stop();
                    }
                }
            });
        });
        
        // Start observing
        observer.observe(audioSettingsPanel, { attributes: true });
    }
    
    /**
     * Handle audio data updates
     * @param {object} audioData - Audio data
     */
    handleAudioUpdate(audioData) {
        // Only update if active
        if (!this.isActive) return;
        
        // Just trigger a render - the render function will get the latest data
    }
    
    /**
     * Start the visualizer
     */
    start() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.render();
        
        LiveArt.log('Frequency visualizer started');
    }
    
    /**
     * Stop the visualizer
     */
    stop() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        LiveArt.log('Frequency visualizer stopped');
    }
    
    /**
     * Render the visualization
     */
    render() {
        if (!this.isActive || !this.ctx || !this.canvas) {
            return;
        }
        
        const ctx = this.ctx;
        const canvas = this.canvas;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Get audio data module
        const audioEngine = LiveArt.getModule('audioEngine');
        const audioData = audioEngine ? audioEngine.getAudioData() : null;
        
        // Get frequency bands
        const bands = frequencyMapper.getBands();
        
        // Only proceed if we have audio data
        if (audioData && audioData.smoothedValues) {
            // Draw frequency bands
            const barWidth = width / audioData.smoothedValues.length;
            
            // Draw background bands
            Object.entries(bands).forEach(([band, range]) => {
                const startX = (range.start / audioData.smoothedValues.length) * width;
                const endX = (range.end / audioData.smoothedValues.length) * width;
                const bandWidth = endX - startX;
                
                // Draw band background
                ctx.fillStyle = `${this.bandColors[band]}22`; // Semi-transparent
                ctx.fillRect(startX, 0, bandWidth, height);
                
                // Draw band dividers
                ctx.strokeStyle = `${this.bandColors[band]}44`;
                ctx.beginPath();
                ctx.moveTo(endX, 0);
                ctx.lineTo(endX, height);
                ctx.stroke();
            });
            
            // Draw frequency values
            audioData.smoothedValues.forEach((value, i) => {
                // Find which band this frequency belongs to
                let bandColor = '#FFFFFF';
                
                for (const [band, range] of Object.entries(bands)) {
                    if (i >= range.start && i <= range.end) {
                        bandColor = this.bandColors[band];
                        break;
                    }
                }
                
                const barHeight = value * height;
                const x = i * barWidth;
                
                // Draw bar
                ctx.fillStyle = bandColor;
                ctx.fillRect(x, height - barHeight, barWidth, barHeight);
            });
            
            // Draw hover indicator if active
            if (this.hoveredIndex !== undefined) {
                const i = this.hoveredIndex;
                const value = audioData.smoothedValues[i] || 0;
                const x = i * barWidth;
                
                // Highlight the bar
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(x, height - value * height, barWidth, value * height);
                
                // Draw value tooltip
                const tooltipText = `Bin ${i}: ${(value * 100).toFixed(1)}%`;
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(x - 40, height - value * height - 25, 80, 20);
                ctx.fillStyle = '#FFFFFF';
                ctx.textAlign = 'center';
                ctx.fillText(tooltipText, x, height - value * height - 10);
                
                // Add band name if available
                for (const [band, range] of Object.entries(bands)) {
                    if (i >= range.start && i <= range.end) {
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                        ctx.fillRect(x - 40, height - value * height - 45, 80, 20);
                        ctx.fillStyle = this.bandColors[band];
                        ctx.fillText(band, x, height - value * height - 30);
                        break;
                    }
                }
            }
        } else {
            // No audio data, show placeholder message
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '12px Arial';
            ctx.fillText('No audio data available', width / 2, height / 2);
        }
        
        // Request next frame
        this.animationId = requestAnimationFrame(this.render);
    }
}

// Create frequency visualizer instance
const frequencyVisualizer = new FrequencyVisualizer();

// Register as a module
LiveArt.registerModule('frequencyVisualizer', frequencyVisualizer);

export default frequencyVisualizer;