/**
 * Audio Engine Module
 * Handles audio input, processing, and analysis
 */

import LiveArt from '../index.js';
import events from '../core/events.js';
import settings from '../core/settings.js';

class AudioEngine {
    constructor() {
        // Audio context and nodes
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.timeDomainArray = null;
        this.smoothedValues = null;
        
        // Audio stream and source
        this.stream = null;
        this.source = null;
        
        // Audio settings
        this.settings = {
            initialized: false,
            deviceId: null,
            bufferSize: 512,
            smoothingFactor: 0.2,
            peakLevel: 0.1
        };
        
        // Bind methods
        this.updateAudioData = this.updateAudioData.bind(this);
    }
    
    /**
     * Initialize the audio engine
     */
    init() {
        LiveArt.log('Initializing audio engine...');
        
        // Load settings
        const audioSettings = settings.getAudioSettings();
        this.settings.deviceId = audioSettings.selectedSourceId;
        this.settings.bufferSize = audioSettings.bufferSize || 512;
        
        // Initialize audio context
        this.initAudioContext();
        
        // Listen for settings changes
        events.on('settings:audioSettingsSaved', this.handleAudioSettingsChanged, this);
        
        // Listen for animation updates to process audio
        events.on('engine:animate', this.updateAudioData, this);
        
        LiveArt.log('Audio engine initialized');
    }
    
    /**
     * Initialize audio context and analyzer
     */
    initAudioContext() {
        if (this.settings.initialized) return;
        
        try {
            // Create audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            
            // Create analyzer node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.settings.bufferSize;
            
            // Create data arrays
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
            this.timeDomainArray = new Uint8Array(bufferLength);
            this.smoothedValues = new Array(128).fill(0);
            
            // Connect analyzer to destination
            this.analyser.connect(this.audioContext.destination);
            
            // Set initialized flag
            this.settings.initialized = true;
            
            // Trigger event
            events.trigger('audio:initialized', {
                bufferLength,
                context: this.audioContext
            });
            
            LiveArt.log('Audio context initialized');
            
            // Connect to input device if specified
            if (this.settings.deviceId) {
                this.connectToAudioInput(this.settings.deviceId);
            }
            
            return true;
        } catch (error) {
            LiveArt.log(`Error initializing audio context: ${error.message}`, 'error');
            console.error(error);
            return false;
        }
    }
    
    /**
     * Connect to an audio input device
     * @param {string} deviceId - Input device ID
     * @returns {Promise} Promise resolving when connected
     */
    async connectToAudioInput(deviceId = null) {
        if (!this.settings.initialized) {
            this.initAudioContext();
        }
        
        // Disconnect existing source if any
        this.disconnectAudio();
        
        try {
            // Request microphone access
            const constraints = {
                audio: deviceId ? { deviceId: { exact: deviceId } } : true
            };
            
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Create media source
            const source = this.audioContext.createMediaStreamSource(stream);
            
            // Connect source to analyzer
            source.connect(this.analyser);
            
            // Store references
            this.stream = stream;
            this.source = source;
            this.settings.deviceId = deviceId;
            
            // Update settings
            const audioSettings = settings.getAudioSettings();
            audioSettings.selectedSourceId = deviceId;
            settings.saveAudioSettings(audioSettings);
            
            // Notify about connection
            events.trigger('audio:connected', { deviceId });
            LiveArt.log(`Connected to audio input: ${deviceId || 'default'}`);
            
            return true;
        } catch (error) {
            LiveArt.log(`Error connecting to audio input: ${error.message}`, 'error');
            console.error(error);
            return false;
        }
    }
    
    /**
     * Disconnect audio source
     */
    disconnectAudio() {
        // Disconnect and stop existing stream
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        // Clear data arrays
        if (this.dataArray) {
            this.dataArray.fill(0);
        }
        
        if (this.timeDomainArray) {
            this.timeDomainArray.fill(0);
        }
        
        if (this.smoothedValues) {
            this.smoothedValues.fill(0);
        }
        
        events.trigger('audio:disconnected');
    }
    
    /**
     * List available audio input devices
     * @returns {Promise<Array>} Promise resolving to array of devices
     */
    async listAudioDevices() {
        try {
            // Request permission first
            await navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    // Stop tracks immediately after getting permission
                    stream.getTracks().forEach(track => track.stop());
                });
            
            // Get devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            
            // Filter audio input devices
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            
            events.trigger('audio:devicesListed', { devices: audioInputs });
            return audioInputs;
        } catch (error) {
            LiveArt.log(`Error listing audio devices: ${error.message}`, 'error');
            console.error(error);
            return [];
        }
    }
    
    /**
     * Handle audio settings changes
     * @param {object} newSettings - New audio settings
     */
    handleAudioSettingsChanged(newSettings) {
        // Check if device ID changed
        if (newSettings.selectedSourceId !== this.settings.deviceId) {
            this.connectToAudioInput(newSettings.selectedSourceId);
        }
        
        // Check if buffer size changed
        if (newSettings.bufferSize !== this.settings.bufferSize) {
            this.settings.bufferSize = newSettings.bufferSize;
            
            // Reinitialize audio context with new buffer size
            this.settings.initialized = false;
            this.disconnectAudio();
            this.initAudioContext();
            
            // Reconnect to audio input
            if (newSettings.selectedSourceId) {
                this.connectToAudioInput(newSettings.selectedSourceId);
            }
        }
    }
    
    /**
     * Update audio data on animation frame
     */
    updateAudioData() {
        if (!this.settings.initialized || !this.analyser) return false;
        
        // Resume audio context if suspended
        if (this.audioContext && this.audioContext.state !== 'running') {
            this.audioContext.resume();
        }
        
        // Get frequency data
        if (this.dataArray) {
            this.analyser.getByteFrequencyData(this.dataArray);
        }
        
        // Get time domain data
        if (this.timeDomainArray) {
            this.analyser.getByteTimeDomainData(this.timeDomainArray);
        }
        
        // Process frequency data
        const bufferLength = this.dataArray ? this.dataArray.length : 128;
        const smoothingFactor = this.settings.smoothingFactor;
        let totalAmplitude = 0;
        let maxValue = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            // Get current value (or generate fake data if we don't have real data)
            const value = this.dataArray ? 
                this.dataArray[i] / 255 : 
                // Fake data pattern if no audio
                (1 - (i / bufferLength)) * (0.5 + 0.5 * Math.sin(performance.now() * 0.003 + i * 0.2));
            
            // Smooth the values
            this.smoothedValues[i] = this.smoothedValues[i] * (1 - smoothingFactor) + 
                value * smoothingFactor;
            
            // Calculate stats
            totalAmplitude += this.smoothedValues[i];
            maxValue = Math.max(maxValue, this.smoothedValues[i]);
        }
        
        // Calculate average amplitude
        const averageAmplitude = totalAmplitude / bufferLength;
        
        // Smooth the peak level for better dynamics
        this.settings.peakLevel = this.settings.peakLevel * 0.95 + maxValue * 0.05;
        
        // Trigger event with audio data
        events.trigger('audio:updated', {
            smoothedValues: this.smoothedValues,
            timeData: this.timeDomainArray,
            frequencyData: this.dataArray,
            averageAmplitude,
            peakLevel: this.settings.peakLevel,
            bufferLength
        });
        
        return true;
    }
    
    /**
     * Get a frequency bin value (0-1 range)
     * @param {number} index - Frequency bin index
     * @returns {number} Bin value (0-1)
     */
    getFrequencyBin(index) {
        if (!this.smoothedValues) return 0;
        
        // Clamp index to valid range
        const i = Math.min(Math.max(0, Math.floor(index)), this.smoothedValues.length - 1);
        return this.smoothedValues[i] || 0;
    }
    
    /**
     * Get average value for a frequency band
     * @param {number} startBin - Start frequency bin
     * @param {number} endBin - End frequency bin
     * @returns {number} Band average (0-1)
     */
    getFrequencyBand(startBin, endBin) {
        if (!this.smoothedValues) return 0;
        
        // Clamp to valid range
        const start = Math.min(Math.max(0, Math.floor(startBin)), this.smoothedValues.length - 1);
        const end = Math.min(Math.max(start, Math.floor(endBin)), this.smoothedValues.length - 1);
        
        let sum = 0;
        for (let i = start; i <= end; i++) {
            sum += this.smoothedValues[i] || 0;
        }
        
        return sum / (end - start + 1);
    }
    
    /**
     * Get all audio data
     * @returns {object} Audio data object
     */
    getAudioData() {
        return {
            smoothedValues: this.smoothedValues ? [...this.smoothedValues] : null,
            timeData: this.timeDomainArray ? [...this.timeDomainArray] : null,
            frequencyData: this.dataArray ? [...this.dataArray] : null,
            peakLevel: this.settings.peakLevel
        };
    }
}

// Create audio engine instance
const audioEngine = new AudioEngine();

// Register as a module
LiveArt.registerModule('audioEngine', audioEngine);

export default audioEngine;