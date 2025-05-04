/**
 * Frequency Mapping Module
 * Maps audio frequency bands to visual parameters
 */

import LiveArt from '../index.js';
import events from '../core/events.js';
import settings from '../core/settings.js';
import utils from '../core/utils.js';
import audioEngine from './audio-engine.js';

class FrequencyMapper {
    constructor() {
        // Frequency mapping configuration
        this.config = {
            enabled: false,
            sensitivity: 0.5,
            smoothing: 0.7,
            minThreshold: 0.05,
            maxInfluence: 0.8,
            mappings: []
        };
        
        // Predefined frequency bands for easy mapping
        this.bands = {
            bass: { start: 0, end: 10, name: "Bass" },
            lowMid: { start: 11, end: 30, name: "Low Mid" },
            mid: { start: 31, end: 60, name: "Mid" },
            highMid: { start: 61, end: 90, name: "High Mid" },
            treble: { start: 91, end: 127, name: "Treble" }
        };
        
        // Bind methods
        this.processFrequencyMappings = this.processFrequencyMappings.bind(this);
    }
    
    /**
     * Initialize the frequency mapper
     */
    init() {
        LiveArt.log('Initializing frequency mapper...');
        
        // Load settings
        const audioSettings = settings.getAudioSettings();
        
        if (audioSettings.freqMapping) {
            this.config.enabled = audioSettings.freqMapping.enabled || false;
            this.config.sensitivity = audioSettings.freqMapping.sensitivity || 0.5;
            this.config.smoothing = audioSettings.freqMapping.smoothing || 0.7;
            
            // Load mappings
            if (audioSettings.freqMapping.mappings && Array.isArray(audioSettings.freqMapping.mappings)) {
                this.importMappings(audioSettings.freqMapping.mappings);
            }
        }
        
        // Listen for audio updates
        events.on('audio:updated', this.processFrequencyMappings, this);
        
        // Listen for settings changes
        events.on('settings:audioSettingsSaved', this.handleAudioSettingsChanged, this);
        
        LiveArt.log('Frequency mapper initialized');
    }
    
    /**
     * Handle audio settings changes
     * @param {object} newSettings - New audio settings
     */
    handleAudioSettingsChanged(newSettings) {
        if (newSettings.freqMapping) {
            // Update configuration
            this.config.enabled = newSettings.freqMapping.enabled;
            this.config.sensitivity = newSettings.freqMapping.sensitivity || 0.5;
            this.config.smoothing = newSettings.freqMapping.smoothing || 0.7;
            
            // Update mappings
            if (newSettings.freqMapping.mappings && Array.isArray(newSettings.freqMapping.mappings)) {
                this.importMappings(newSettings.freqMapping.mappings);
            }
        }
    }
    
    /**
     * Import mappings from settings
     * @param {Array} mappings - Mappings array from settings
     */
    importMappings(mappings) {
        this.config.mappings = [];
        
        // Process each mapping
        mappings.forEach(mapping => {
            // Get band start/end
            let start, end;
            
            if (mapping.band.includes('-')) {
                const parts = mapping.band.split('-');
                start = parseInt(parts[0], 10);
                end = parseInt(parts[1], 10);
            } else if (this.bands[mapping.band]) {
                start = this.bands[mapping.band].start;
                end = this.bands[mapping.band].end;
            } else {
                console.error(`Invalid frequency band: ${mapping.band}`);
                return; // Skip this mapping
            }
            
            // Create mapping
            this.config.mappings.push({
                id: mapping.id,
                band: mapping.band,
                param: mapping.param,
                amount: mapping.amount,
                direction: mapping.direction,
                start,
                end,
                active: true
            });
        });
        
        LiveArt.log(`Imported ${this.config.mappings.length} frequency mappings`);
    }
    
    /**
     * Add a new audio frequency to parameter mapping
     * @param {string} band - Predefined band key or custom range "start-end"
     * @param {string} param - Parameter name to control
     * @param {number} amount - Amount of influence (0-1)
     * @param {string} direction - "normal" or "inverted"
     * @returns {string} - ID of the created mapping
     */
    addMapping(band, param, amount = 0.5, direction = "normal") {
        // Generate unique ID
        const id = `mapping_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        // Determine frequency range
        let start, end;
        
        if (band.includes('-')) {
            const parts = band.split('-');
            start = parseInt(parts[0], 10);
            end = parseInt(parts[1], 10);
        } else if (this.bands[band]) {
            start = this.bands[band].start;
            end = this.bands[band].end;
        } else {
            throw new Error(`Invalid frequency band: ${band}`);
        }
        
        // Create mapping object
        const mapping = {
            id,
            band,
            param,
            amount,
            direction,
            start,
            end,
            active: true
        };
        
        // Add to mappings array
        this.config.mappings.push(mapping);
        
        // Enable frequency mapping if not already enabled
        this.config.enabled = true;
        
        // Save to settings
        this.saveToSettings();
        
        // Notify about new mapping
        events.trigger('frequencyMapping:added', mapping);
        
        LiveArt.log(`Added frequency mapping: ${band} → ${param} (${amount.toFixed(2)})`);
        
        return id;
    }
    
    /**
     * Remove a frequency mapping by ID
     * @param {string} id - Mapping ID to remove
     * @returns {boolean} - Success
     */
    removeMapping(id) {
        const index = this.config.mappings.findIndex(m => m.id === id);
        
        if (index === -1) {
            LiveArt.log(`Frequency mapping not found: ${id}`, 'error');
            return false;
        }
        
        // Remove mapping
        const removedMapping = this.config.mappings.splice(index, 1)[0];
        
        // Disable frequency mapping if no mappings left
        if (this.config.mappings.length === 0) {
            this.config.enabled = false;
        }
        
        // Save to settings
        this.saveToSettings();
        
        // Notify about removed mapping
        events.trigger('frequencyMapping:removed', {
            id,
            mapping: removedMapping
        });
        
        LiveArt.log(`Removed frequency mapping: ${id}`);
        
        return true;
    }
    
    /**
     * Update a frequency mapping
     * @param {string} id - Mapping ID to update
     * @param {object} updates - Properties to update
     * @returns {boolean} - Success
     */
    updateMapping(id, updates) {
        const index = this.config.mappings.findIndex(m => m.id === id);
        
        if (index === -1) {
            LiveArt.log(`Frequency mapping not found: ${id}`, 'error');
            return false;
        }
        
        const mapping = this.config.mappings[index];
        
        // Update mapping properties
        Object.keys(updates).forEach(key => {
            if (key === 'band') {
                mapping.band = updates.band;
                
                // Update start/end based on band
                if (updates.band.includes('-')) {
                    const parts = updates.band.split('-');
                    mapping.start = parseInt(parts[0], 10);
                    mapping.end = parseInt(parts[1], 10);
                } else if (this.bands[updates.band]) {
                    mapping.start = this.bands[updates.band].start;
                    mapping.end = this.bands[updates.band].end;
                }
            } else if (key !== 'id' && key !== 'start' && key !== 'end') {
                mapping[key] = updates[key];
            }
        });
        
        // Save to settings
        this.saveToSettings();
        
        // Notify about updated mapping
        events.trigger('frequencyMapping:updated', {
            id,
            mapping
        });
        
        return true;
    }
    
    /**
     * Enable or disable frequency mapping
     * @param {boolean} enabled - Whether to enable
     */
    setEnabled(enabled) {
        this.config.enabled = !!enabled;
        this.saveToSettings();
        
        events.trigger('frequencyMapping:enabledChanged', {
            enabled: this.config.enabled
        });
        
        LiveArt.log(`Frequency mapping ${this.config.enabled ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Set sensitivity level
     * @param {number} sensitivity - Sensitivity level (0-1)
     */
    setSensitivity(sensitivity) {
        this.config.sensitivity = utils.clamp(sensitivity, 0, 1);
        this.saveToSettings();
        
        events.trigger('frequencyMapping:sensitivityChanged', {
            sensitivity: this.config.sensitivity
        });
    }
    
    /**
     * Set smoothing level
     * @param {number} smoothing - Smoothing level (0-1)
     */
    setSmoothing(smoothing) {
        this.config.smoothing = utils.clamp(smoothing, 0, 1);
        this.saveToSettings();
        
        events.trigger('frequencyMapping:smoothingChanged', {
            smoothing: this.config.smoothing
        });
    }
    
    /**
     * Save current configuration to settings
     */
    saveToSettings() {
        const audioSettings = settings.getAudioSettings();
        
        // Update frequency mapping settings
        audioSettings.freqMapping = {
            enabled: this.config.enabled,
            sensitivity: this.config.sensitivity,
            smoothing: this.config.smoothing,
            mappings: this.config.mappings.map(mapping => ({
                id: mapping.id,
                band: mapping.band,
                param: mapping.param,
                amount: mapping.amount,
                direction: mapping.direction
            }))
        };
        
        // Save settings
        settings.saveAudioSettings(audioSettings);
    }
    
    /**
     * Process all active frequency mappings
     * @param {object} audioData - Audio data from audio engine
     */
    processFrequencyMappings(audioData) {
        if (!this.config.enabled || this.config.mappings.length === 0) {
            return;
        }
        
        // Process each mapping
        for (const mapping of this.config.mappings) {
            if (!mapping.active) continue;
            
            // Get audio band value
            const bandValue = audioEngine.getFrequencyBand(mapping.start, mapping.end);
            
            // Apply threshold with increased sensitivity
            let influence = bandValue - (this.config.minThreshold * 0.5); // Reduce threshold for more sensitivity
            influence = Math.max(0, influence) * (this.config.sensitivity * 1.5); // Boost sensitivity
            
            // Apply maximum influence
            influence = Math.min(influence, this.config.maxInfluence);
            
            // Apply direction
            if (mapping.direction === "inverted") {
                influence = -influence;
            }
            
            // Scale by amount (increase effect for better visibility)
            influence *= mapping.amount * 1.5; // Boost effect
            
            // Trigger parameter change event
            events.trigger('parameter:influenced', {
                param: mapping.param,
                influence,
                direction: mapping.direction,
                source: 'frequency',
                mapping
            });
        }
    }
    
    /**
     * Get the configuration
     * @returns {object} Current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    
    /**
     * Get all mappings
     * @returns {Array} Mappings array
     */
    getMappings() {
        return [...this.config.mappings];
    }
    
    /**
     * Get predefined bands
     * @returns {object} Bands object
     */
    getBands() {
        return { ...this.bands };
    }
}

// Create frequency mapper instance
const frequencyMapper = new FrequencyMapper();

// Register as a module
LiveArt.registerModule('frequencyMapper', frequencyMapper);

export default frequencyMapper;