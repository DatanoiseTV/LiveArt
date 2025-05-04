/**
 * MIDI Mapping Module
 * Maps MIDI CC messages to visual parameters
 */

import LiveArt from '../index.js';
import events from '../core/events.js';
import settings from '../core/settings.js';
import utils from '../core/utils.js';

class MidiMapping {
    constructor() {
        // MIDI mapping configuration
        this.mappings = {};
        this.presets = {};
        
        // Learning state
        this.learning = {
            active: false,
            param: null,
            callback: null
        };
        
        // Bind methods
        this.handleControlChange = this.handleControlChange.bind(this);
        this.handleProgramChange = this.handleProgramChange.bind(this);
    }
    
    /**
     * Initialize the MIDI mapping
     */
    init() {
        LiveArt.log('Initializing MIDI mapping...');
        
        // Load mappings from settings
        this.loadMappings();
        
        // Listen for MIDI events
        events.on('midi:controlChange', this.handleControlChange, this);
        events.on('midi:programChange', this.handleProgramChange, this);
        
        LiveArt.log('MIDI mapping initialized');
    }
    
    /**
     * Load mappings from settings
     */
    loadMappings() {
        this.mappings = settings.getMidiMappings() || {};
        
        // Notify that mappings are loaded
        events.trigger('midiMapping:loaded', {
            mappings: { ...this.mappings }
        });
        
        LiveArt.log(`Loaded ${Object.keys(this.mappings).length} MIDI mappings`);
    }
    
    /**
     * Save mappings to settings
     */
    saveMappings() {
        settings.saveMidiMappings(this.mappings);
        
        // Notify that mappings are saved
        events.trigger('midiMapping:saved', {
            mappings: { ...this.mappings }
        });
        
        LiveArt.log('MIDI mappings saved');
    }
    
    /**
     * Handle MIDI Control Change
     * @param {object} message - MIDI CC message
     */
    handleControlChange(message) {
        const { channel, controller, value, normalizedValue } = message;
        const ccKey = `${channel}:${controller}`;
        
        // If in learning mode, assign this CC to the parameter
        if (this.learning.active && this.learning.param) {
            this.learnMapping(ccKey, this.learning.param);
            return;
        }
        
        // Check if this CC is mapped to any parameter
        if (this.mappings[ccKey]) {
            const mapping = this.mappings[ccKey];
            
            // Process the mapping
            this.processMapping(mapping, normalizedValue);
        }
    }
    
    /**
     * Handle MIDI Program Change
     * @param {object} message - MIDI Program Change message
     */
    handleProgramChange(message) {
        const { channel, program } = message;
        
        // Notify about program change
        events.trigger('midiMapping:programChange', {
            channel,
            program
        });
        
        LiveArt.log(`MIDI Program Change: ${program} on channel ${channel}`);
    }
    
    /**
     * Process a MIDI mapping
     * @param {object} mapping - Mapping object
     * @param {number} value - Normalized value (0-1)
     */
    processMapping(mapping, value) {
        // Apply curve if specified
        let processedValue = value;
        
        if (mapping.curve === 'exponential') {
            // Exponential curve for more precision at lower values
            processedValue = value * value;
        } else if (mapping.curve === 'logarithmic') {
            // Logarithmic curve for more precision at higher values
            processedValue = Math.sqrt(value);
        } else if (mapping.curve === 'sine') {
            // Sine curve for more precision in the middle
            processedValue = (Math.sin((value - 0.5) * Math.PI) + 1) / 2;
        }
        
        // Adjust range if min/max is specified
        if (mapping.min !== undefined || mapping.max !== undefined) {
            const min = mapping.min !== undefined ? mapping.min : 0;
            const max = mapping.max !== undefined ? mapping.max : 1;
            processedValue = min + processedValue * (max - min);
        }
        
        // Apply invert if specified
        if (mapping.invert) {
            processedValue = 1 - processedValue;
        }
        
        // Special handling for custom parameters
        if (mapping.custom) {
            // Handle custom parameters
            this.handleCustomMapping(mapping, processedValue, value);
        } else {
            // Regular parameter
            events.trigger('parameter:changed', {
                param: mapping.param,
                value: processedValue,
                source: 'midi',
                mapping
            });
        }
        
        // Trigger activity event for UI
        events.trigger('midiMapping:activity', {
            param: mapping.param,
            value: processedValue,
            rawValue: value,
            mapping
        });
    }
    
    /**
     * Handle custom parameter mapping
     * @param {object} mapping - Mapping object
     * @param {number} value - Processed value
     * @param {number} rawValue - Raw normalized value (0-1)
     */
    handleCustomMapping(mapping, value, rawValue) {
        // Handle special parameters like rotation in degrees
        if (mapping.param === 'rotation' && mapping.custom === true) {
            // Map MIDI value (0-1) to 0-359 degrees for display purposes
            const degreesValue = Math.round(value * 359);
            
            // Trigger event for display
            events.trigger('midiMapping:customValue', {
                param: mapping.param,
                value,
                rawValue,
                customValue: degreesValue,
                unit: '°',
                mapping
            });
            
            // We still use the normalized value for the actual parameter
            events.trigger('parameter:changed', {
                param: mapping.param,
                value,
                source: 'midi',
                mapping
            });
        } else {
            // Default handling for unknown custom mappings
            events.trigger('parameter:changed', {
                param: mapping.param,
                value,
                source: 'midi',
                mapping
            });
        }
    }
    
    /**
     * Start MIDI learn mode for a parameter
     * @param {string} param - Parameter name
     * @param {function} callback - Callback function when learning completes
     */
    startLearn(param, callback = null) {
        this.learning.active = true;
        this.learning.param = param;
        this.learning.callback = callback;
        
        // Notify that learning has started
        events.trigger('midiMapping:learnStarted', { param });
        
        LiveArt.log(`MIDI learn started for parameter: ${param}`);
    }
    
    /**
     * Cancel MIDI learn mode
     */
    cancelLearn() {
        const wasActive = this.learning.active;
        const param = this.learning.param;
        
        this.learning.active = false;
        this.learning.param = null;
        this.learning.callback = null;
        
        if (wasActive) {
            // Notify that learning has been cancelled
            events.trigger('midiMapping:learnCancelled', { param });
            
            LiveArt.log('MIDI learn cancelled');
        }
    }
    
    /**
     * Learn a MIDI mapping
     * @param {string} ccKey - CC key (channel:controller)
     * @param {string} param - Parameter name
     */
    learnMapping(ccKey, param) {
        // Check if this CC is already mapped
        const existingParam = this.mappingsForCC(ccKey)[0];
        
        if (existingParam && existingParam !== param) {
            // Remove existing mapping if different parameter
            this.removeMapping(existingParam);
        }
        
        // Check if param is already mapped to a different CC
        const existingCC = this.ccForParam(param);
        
        if (existingCC && existingCC !== ccKey) {
            // Remove existing mapping for this parameter
            delete this.mappings[existingCC];
        }
        
        // Create the mapping
        this.mappings[ccKey] = {
            param,
            curve: 'linear',
            min: 0,
            max: 1,
            invert: false,
            custom: false
        };
        
        // Save mappings
        this.saveMappings();
        
        // Notify that learning has completed
        events.trigger('midiMapping:learnCompleted', {
            param,
            ccKey,
            mapping: this.mappings[ccKey]
        });
        
        // Call the callback if provided
        if (this.learning.callback) {
            this.learning.callback(ccKey, param);
        }
        
        // Reset learning state
        this.learning.active = false;
        this.learning.param = null;
        this.learning.callback = null;
        
        LiveArt.log(`MIDI mapping learned: ${ccKey} → ${param}`);
    }
    
    /**
     * Remove a mapping for a parameter
     * @param {string} param - Parameter name
     * @returns {boolean} - Success
     */
    removeMapping(param) {
        const ccKey = this.ccForParam(param);
        
        if (!ccKey) {
            return false;
        }
        
        // Remove the mapping
        delete this.mappings[ccKey];
        
        // Save mappings
        this.saveMappings();
        
        // Notify that mapping has been removed
        events.trigger('midiMapping:removed', {
            param,
            ccKey
        });
        
        LiveArt.log(`MIDI mapping removed: ${ccKey} → ${param}`);
        
        return true;
    }
    
    /**
     * Get all mappings
     * @returns {object} Mappings object
     */
    getMappings() {
        return { ...this.mappings };
    }
    
    /**
     * Get a mapping for a CC key
     * @param {string} ccKey - CC key (channel:controller)
     * @returns {object|null} Mapping object or null
     */
    getMapping(ccKey) {
        return this.mappings[ccKey] ? { ...this.mappings[ccKey] } : null;
    }
    
    /**
     * Get all CC keys mapped to a parameter
     * @param {string} param - Parameter name
     * @returns {Array} Array of CC keys
     */
    ccsForParam(param) {
        return Object.entries(this.mappings)
            .filter(([_, mapping]) => mapping.param === param)
            .map(([ccKey, _]) => ccKey);
    }
    
    /**
     * Get the first CC key mapped to a parameter
     * @param {string} param - Parameter name
     * @returns {string|null} CC key or null
     */
    ccForParam(param) {
        const ccs = this.ccsForParam(param);
        return ccs.length > 0 ? ccs[0] : null;
    }
    
    /**
     * Get all parameters mapped to a CC key
     * @param {string} ccKey - CC key (channel:controller)
     * @returns {Array} Array of parameter names
     */
    mappingsForCC(ccKey) {
        return this.mappings[ccKey] ? [this.mappings[ccKey].param] : [];
    }
    
    /**
     * Update a mapping property
     * @param {string} ccKey - CC key (channel:controller)
     * @param {string} property - Property name
     * @param {any} value - Property value
     */
    updateMapping(ccKey, property, value) {
        if (!this.mappings[ccKey]) {
            return;
        }
        
        // Update the property
        this.mappings[ccKey][property] = value;
        
        // Save mappings
        this.saveMappings();
        
        // Notify that mapping has been updated
        events.trigger('midiMapping:updated', {
            ccKey,
            property,
            value,
            mapping: this.mappings[ccKey]
        });
        
        LiveArt.log(`MIDI mapping updated: ${ccKey}.${property} = ${value}`);
    }
    
    /**
     * Save the current mappings as a preset
     * @param {string} name - Preset name
     */
    savePreset(name) {
        this.presets[name] = JSON.parse(JSON.stringify(this.mappings));
        
        // Save presets
        localStorage.setItem('liveArtMidiPresets', JSON.stringify(this.presets));
        
        // Notify that preset has been saved
        events.trigger('midiMapping:presetSaved', {
            name,
            preset: this.presets[name]
        });
        
        LiveArt.log(`MIDI mapping preset saved: ${name}`);
    }
    
    /**
     * Load a preset
     * @param {string} name - Preset name
     * @returns {boolean} - Success
     */
    loadPreset(name) {
        if (!this.presets[name]) {
            LiveArt.log(`MIDI mapping preset not found: ${name}`, 'error');
            return false;
        }
        
        // Load the preset
        this.mappings = JSON.parse(JSON.stringify(this.presets[name]));
        
        // Save mappings
        this.saveMappings();
        
        // Notify that preset has been loaded
        events.trigger('midiMapping:presetLoaded', {
            name,
            preset: this.presets[name]
        });
        
        LiveArt.log(`MIDI mapping preset loaded: ${name}`);
        
        return true;
    }
    
    /**
     * Delete a preset
     * @param {string} name - Preset name
     * @returns {boolean} - Success
     */
    deletePreset(name) {
        if (!this.presets[name]) {
            LiveArt.log(`MIDI mapping preset not found: ${name}`, 'error');
            return false;
        }
        
        // Delete the preset
        delete this.presets[name];
        
        // Save presets
        localStorage.setItem('liveArtMidiPresets', JSON.stringify(this.presets));
        
        // Notify that preset has been deleted
        events.trigger('midiMapping:presetDeleted', {
            name
        });
        
        LiveArt.log(`MIDI mapping preset deleted: ${name}`);
        
        return true;
    }
    
    /**
     * Get all presets
     * @returns {object} Presets object
     */
    getPresets() {
        return { ...this.presets };
    }
    
    /**
     * Import mappings from JSON string
     * @param {string} json - JSON string
     * @returns {boolean} - Success
     */
    importFromJSON(json) {
        try {
            const imported = JSON.parse(json);
            
            // Validate imported data
            if (typeof imported !== 'object') {
                throw new Error('Invalid JSON format');
            }
            
            // Import mappings
            this.mappings = imported;
            
            // Save mappings
            this.saveMappings();
            
            // Notify that mappings have been imported
            events.trigger('midiMapping:imported', {
                mappings: { ...this.mappings }
            });
            
            LiveArt.log('MIDI mappings imported');
            
            return true;
        } catch (error) {
            LiveArt.log(`Error importing MIDI mappings: ${error.message}`, 'error');
            console.error(error);
            return false;
        }
    }
    
    /**
     * Export mappings to JSON string
     * @returns {string} JSON string
     */
    exportToJSON() {
        return JSON.stringify(this.mappings, null, 2);
    }
    
    /**
     * Reset all mappings
     */
    resetMappings() {
        this.mappings = {};
        
        // Save mappings
        this.saveMappings();
        
        // Notify that mappings have been reset
        events.trigger('midiMapping:reset');
        
        LiveArt.log('MIDI mappings reset');
    }
    
    /**
     * Check if learning is active
     * @returns {boolean} Learning active
     */
    isLearning() {
        return this.learning.active;
    }
    
    /**
     * Get the current learning state
     * @returns {object} Learning state
     */
    getLearningState() {
        return { ...this.learning };
    }
}

// Create MIDI mapping instance
const midiMapping = new MidiMapping();

// Register as a module
LiveArt.registerModule('midiMapping', midiMapping);

export default midiMapping;