/**
 * Audio Reactive Visualization
 * Renders audio-reactive visualizations that respond to frequency data
 */

import LiveArt from '../index.js';
import events from '../core/events.js';
import utils from '../core/utils.js';
import VisualEngine from './visual-engine.js';

class AudioReactiveVisualizer {
    constructor(visualEngine) {
        this.engine = visualEngine;
        this.name = 'audio-reactive';
    }
    
    /**
     * Initialize the audio reactive visualization
     */
    init() {
        LiveArt.log('Initializing audio reactive visualization...');
        
        // Register visualization with the engine
        this.engine.registerVisual(this.name, this.render.bind(this));
        
        // Listen for events
        events.on('audio:updated', this.handleAudioUpdate, this);
        
        LiveArt.log('Audio reactive visualization initialized');
    }
    
    /**
     * Handle audio data updates
     * @param {object} audioData - Audio data
     */
    handleAudioUpdate(audioData) {
        // Update occurs in render method
    }
    
    /**
     * Render the audio reactive visualization
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
        
        // Extract parameters
        const hue = this.engine.params.hue;
        const saturation = this.engine.params.saturation;
        const brightness = this.engine.params.brightness;
        const complexity = this.engine.mapParam(this.engine.params.complexity, 4, 64); // Number of segments
        const speed = this.engine.mapParam(this.engine.params.speed, 0.2, 2);
        
        // Clear with subtle gradient background
        this.engine.ctx.save();
        const gradient = this.engine.ctx.createRadialGradient(
            this.engine.centerX, this.engine.centerY, 0,
            this.engine.centerX, this.engine.centerY, this.engine.height
        );
        gradient.addColorStop(0, this.engine.hsbaToRgba(hue, saturation * 0.2, brightness * 0.2, 1));
        gradient.addColorStop(1, this.engine.hsbaToRgba((hue + 0.5) % 1, saturation * 0.1, brightness * 0.1, 1));
        this.engine.ctx.fillStyle = gradient;
        this.engine.ctx.fillRect(0, 0, this.engine.width, this.engine.height);
        
        // Get audio bands for visualization
        let bassValue = 0;
        let midValue = 0;
        let highValue = 0;
        
        if (audioData && audioData.smoothedValues) {
            bassValue = this.getAudioBand(audioData.smoothedValues, 0, 8);
            midValue = this.getAudioBand(audioData.smoothedValues, 8, 32);
            highValue = this.getAudioBand(audioData.smoothedValues, 32, 64);
        }
        
        // Dynamic radius based on bass
        const baseRadius = Math.min(this.engine.width, this.engine.height) * 0.3;
        const dynamicRadius = baseRadius * (1 + bassValue * 0.3);
        
        // Rotation affected by mid-frequencies
        const rotation = this.engine.time * speed * 0.2 + midValue * 2;
        
        // Draw frequency bars in a circle
        const segments = Math.floor(complexity);
        const segmentAngle = (Math.PI * 2) / segments;
        
        // Only proceed if we have audio data
        if (audioData && audioData.smoothedValues) {
            for (let i = 0; i < segments; i++) {
                // Calculate segment angle
                const angle = i * segmentAngle + rotation;
                
                // Get audio value for this segment 
                // Map the segment index to the full audio range
                const freqIndex = Math.floor((i / segments) * (audioData.smoothedValues.length - 1));
                const audioValue = audioData.smoothedValues[freqIndex] || 0;
                
                // Bar height based on audio value
                const barHeight = audioValue * this.engine.mapParam(this.engine.params.size, 50, 200);
                const innerRadius = dynamicRadius;
                const outerRadius = innerRadius + barHeight;
                
                // Vary color based on frequency and parameters
                const segmentHue = (hue + (i / segments) * this.engine.mapParam(this.engine.params.complexity, 0.1, 0.5)) % 1;
                
                // Calculate points for bar corners
                const innerX = this.engine.centerX + innerRadius * Math.cos(angle);
                const innerY = this.engine.centerY + innerRadius * Math.sin(angle);
                const outerX = this.engine.centerX + outerRadius * Math.cos(angle);
                const outerY = this.engine.centerY + outerRadius * Math.sin(angle);
                
                // Calculate next angle
                const nextAngle = (i + 1) * segmentAngle + rotation;
                
                // Calculate next points
                const innerNextX = this.engine.centerX + innerRadius * Math.cos(nextAngle);
                const innerNextY = this.engine.centerY + innerRadius * Math.sin(nextAngle);
                const outerNextX = this.engine.centerX + outerRadius * Math.cos(nextAngle);
                const outerNextY = this.engine.centerY + outerRadius * Math.sin(nextAngle);
                
                // Draw bar as a quadrilateral
                this.engine.ctx.beginPath();
                this.engine.ctx.moveTo(innerX, innerY);
                this.engine.ctx.lineTo(outerX, outerY);
                this.engine.ctx.lineTo(outerNextX, outerNextY);
                this.engine.ctx.lineTo(innerNextX, innerNextY);
                this.engine.ctx.closePath();
                
                // Fill with gradient
                const barGradient = this.engine.ctx.createLinearGradient(innerX, innerY, outerX, outerY);
                barGradient.addColorStop(0, this.engine.hsbaToRgba(segmentHue, saturation * 0.5, brightness * 0.3, 0.5));
                barGradient.addColorStop(1, this.engine.hsbaToRgba(segmentHue, saturation, brightness, 0.8));
                this.engine.ctx.fillStyle = barGradient;
                this.engine.ctx.fill();
                
                // Draw edge
                this.engine.ctx.strokeStyle = this.engine.hsbaToRgba(segmentHue, saturation, brightness, 0.9);
                this.engine.ctx.lineWidth = 1.5;
                this.engine.ctx.stroke();
            }
        } else {
            // No audio data, draw placeholder circle
            this.engine.ctx.beginPath();
            this.engine.ctx.arc(
                this.engine.centerX,
                this.engine.centerY,
                dynamicRadius,
                0,
                Math.PI * 2
            );
            this.engine.ctx.strokeStyle = this.engine.hsbaToRgba(hue, saturation, brightness, 0.5);
            this.engine.ctx.lineWidth = 2;
            this.engine.ctx.stroke();
        }
        
        // Draw center point
        this.engine.ctx.beginPath();
        this.engine.ctx.arc(
            this.engine.centerX,
            this.engine.centerY,
            4 + highValue * 10,
            0,
            Math.PI * 2
        );
        this.engine.ctx.fillStyle = this.engine.hsbaToRgba(hue, saturation, brightness, 0.9);
        this.engine.ctx.fill();
        
        // Add glow
        this.engine.ctx.beginPath();
        this.engine.ctx.arc(
            this.engine.centerX,
            this.engine.centerY,
            10 + highValue * 30,
            0,
            Math.PI * 2
        );
        const glowGradient = this.engine.ctx.createRadialGradient(
            this.engine.centerX, this.engine.centerY, 5,
            this.engine.centerX, this.engine.centerY, 40 + highValue * 30
        );
        glowGradient.addColorStop(0, this.engine.hsbaToRgba(hue, saturation, brightness, 0.5));
        glowGradient.addColorStop(1, this.engine.hsbaToRgba(hue, saturation, brightness, 0));
        this.engine.ctx.fillStyle = glowGradient;
        this.engine.ctx.fill();
        
        this.engine.ctx.restore();
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

export default AudioReactiveVisualizer;