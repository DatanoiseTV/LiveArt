/**
 * MIDI Controller Module
 * Handles MIDI input devices and message processing
 */

import LiveArt from '../index.js';
import events from '../core/events.js';
import settings from '../core/settings.js';

class MidiController {
    constructor() {
        // MIDI access and devices
        this.midiAccess = null;
        this.midiInputs = {};
        this.selectedInput = null;
        
        // Status
        this.status = {
            available: false,
            connected: false,
            retrying: false
        };
        
        // Retry mechanism
        this.retryCount = 0;
        this.maxRetries = 5;
        this.retryDelay = 2000;
        this.retryTimeout = null;
        
        // Bind methods
        this.handleMIDIMessage = this.handleMIDIMessage.bind(this);
        this.handleMIDISuccess = this.handleMIDISuccess.bind(this);
        this.handleMIDIFailure = this.handleMIDIFailure.bind(this);
        this.handleStateChange = this.handleStateChange.bind(this);
    }
    
    /**
     * Initialize the MIDI controller
     */
    init() {
        LiveArt.log('Initializing MIDI controller...');
        
        // Check if MIDI is supported
        if (!navigator.requestMIDIAccess) {
            LiveArt.log('Web MIDI API not supported', 'warn');
            return;
        }
        
        // Request MIDI access
        navigator.requestMIDIAccess({ sysex: false })
            .then(this.handleMIDISuccess)
            .catch(this.handleMIDIFailure);
    }
    
    /**
     * Handle successful MIDI access
     * @param {MIDIAccess} midiAccess - MIDI access object
     */
    handleMIDISuccess(midiAccess) {
        this.midiAccess = midiAccess;
        this.status.available = true;
        
        // Add state change listener
        midiAccess.addEventListener('statechange', this.handleStateChange);
        
        // Get available MIDI inputs
        this.updateDeviceList();
        
        // Try to connect to the last used input
        this.connectToLastInput();
        
        // Notify about MIDI availability
        events.trigger('midi:available', {
            inputs: Object.values(this.midiInputs)
        });
        
        LiveArt.log('MIDI access granted');
    }
    
    /**
     * Handle MIDI access failure
     * @param {Error} error - Error object
     */
    handleMIDIFailure(error) {
        this.status.available = false;
        
        LiveArt.log(`MIDI access denied: ${error.message}`, 'error');
        console.error(error);
        
        // Notify about MIDI failure
        events.trigger('midi:failed', { error });
    }
    
    /**
     * Handle MIDI state change
     * @param {MIDIConnectionEvent} event - State change event
     */
    handleStateChange(event) {
        const port = event.port;
        
        // If it's an input port
        if (port.type === 'input') {
            if (port.state === 'connected') {
                // Add the input to our list if not already there
                if (!this.midiInputs[port.id]) {
                    this.midiInputs[port.id] = {
                        id: port.id,
                        name: port.name,
                        manufacturer: port.manufacturer,
                        port: port
                    };
                    
                    LiveArt.log(`MIDI input connected: ${port.name}`);
                }
            } else if (port.state === 'disconnected') {
                // Remove the input from our list
                if (this.midiInputs[port.id]) {
                    delete this.midiInputs[port.id];
                    
                    // Disconnect if this was the selected input
                    if (this.selectedInput && this.selectedInput.id === port.id) {
                        this.disconnect();
                        
                        // Try to reconnect after a short delay
                        this.startRetryConnection();
                    }
                    
                    LiveArt.log(`MIDI input disconnected: ${port.name}`);
                }
            }
            
            // Notify about device changes
            events.trigger('midi:deviceListChanged', {
                inputs: Object.values(this.midiInputs)
            });
        }
    }
    
    /**
     * Update the list of available MIDI devices
     */
    updateDeviceList() {
        // Clear current list
        this.midiInputs = {};
        
        // Get all inputs
        const inputs = this.midiAccess.inputs.values();
        
        for (const input of inputs) {
            this.midiInputs[input.id] = {
                id: input.id,
                name: input.name,
                manufacturer: input.manufacturer,
                port: input
            };
        }
        
        LiveArt.log(`Found ${Object.keys(this.midiInputs).length} MIDI input(s)`);
    }
    
    /**
     * Connect to a MIDI input by ID
     * @param {string} inputId - MIDI input ID
     * @returns {boolean} - Success
     */
    connect(inputId) {
        // Disconnect from current input if any
        this.disconnect();
        
        // Get the input
        const input = this.midiInputs[inputId];
        
        if (!input) {
            LiveArt.log(`MIDI input not found: ${inputId}`, 'error');
            return false;
        }
        
        // Connect to the input
        try {
            input.port.onmidimessage = this.handleMIDIMessage;
            this.selectedInput = input;
            this.status.connected = true;
            
            // Save the selected input ID
            const midiSettings = { lastInputId: inputId };
            localStorage.setItem('liveArtMidiDevice', JSON.stringify(midiSettings));
            
            // Stop retry if active
            this.stopRetryConnection();
            
            // Notify about connection
            events.trigger('midi:connected', { input });
            
            LiveArt.log(`Connected to MIDI input: ${input.name}`);
            return true;
        } catch (error) {
            LiveArt.log(`Error connecting to MIDI input: ${error.message}`, 'error');
            console.error(error);
            return false;
        }
    }
    
    /**
     * Connect to the last used MIDI input
     * @returns {boolean} - Success
     */
    connectToLastInput() {
        // Get last input ID from storage
        const midiSettings = localStorage.getItem('liveArtMidiDevice');
        
        if (midiSettings) {
            const settings = JSON.parse(midiSettings);
            
            if (settings.lastInputId && this.midiInputs[settings.lastInputId]) {
                return this.connect(settings.lastInputId);
            }
        }
        
        // If no last input or not available, connect to the first one
        const inputIds = Object.keys(this.midiInputs);
        
        if (inputIds.length > 0) {
            return this.connect(inputIds[0]);
        }
        
        return false;
    }
    
    /**
     * Disconnect from the current MIDI input
     */
    disconnect() {
        if (this.selectedInput) {
            try {
                this.selectedInput.port.onmidimessage = null;
                this.status.connected = false;
                
                // Notify about disconnection
                events.trigger('midi:disconnected', {
                    input: this.selectedInput
                });
                
                LiveArt.log(`Disconnected from MIDI input: ${this.selectedInput.name}`);
                
                this.selectedInput = null;
            } catch (error) {
                LiveArt.log(`Error disconnecting from MIDI input: ${error.message}`, 'error');
                console.error(error);
            }
        }
    }
    
    /**
     * Start retry connection mechanism
     */
    startRetryConnection() {
        if (this.status.retrying) return;
        
        this.status.retrying = true;
        this.retryCount = 0;
        
        this.retryConnection();
        
        // Notify about retry started
        events.trigger('midi:retryStarted');
        
        LiveArt.log('MIDI connection retry started');
    }
    
    /**
     * Retry connecting to MIDI
     */
    retryConnection() {
        // Clear existing timeout
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
        
        // Check if we've reached max retries
        if (this.retryCount >= this.maxRetries) {
            this.stopRetryConnection();
            return;
        }
        
        // Try to reconnect
        const success = this.connectToLastInput();
        
        if (success) {
            // Successfully reconnected
            this.stopRetryConnection();
        } else {
            // Failed, try again after delay
            this.retryCount++;
            
            // Notify about retry attempt
            events.trigger('midi:retryAttempt', {
                attempt: this.retryCount,
                maxRetries: this.maxRetries
            });
            
            LiveArt.log(`MIDI connection retry attempt ${this.retryCount}/${this.maxRetries}`);
            
            // Schedule next retry
            this.retryTimeout = setTimeout(() => {
                this.retryConnection();
            }, this.retryDelay);
        }
    }
    
    /**
     * Stop retry connection mechanism
     */
    stopRetryConnection() {
        if (!this.status.retrying) return;
        
        this.status.retrying = false;
        
        // Clear timeout
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
        
        // Notify about retry stopped
        events.trigger('midi:retryStopped', {
            connected: this.status.connected
        });
        
        LiveArt.log('MIDI connection retry stopped');
    }
    
    /**
     * Handle MIDI message
     * @param {MIDIMessageEvent} message - MIDI message
     */
    handleMIDIMessage(message) {
        const data = message.data;
        
        // [Status, Data1, Data2]
        const status = data[0];
        const data1 = data[1];
        const data2 = data[2];
        
        // Extract message type and channel
        const messageType = status & 0xF0; // Upper 4 bits
        const channel = status & 0x0F; // Lower 4 bits
        
        // Process message based on type
        switch (messageType) {
            case 0x80: // Note Off
                this.handleNoteOff(channel, data1, data2);
                break;
                
            case 0x90: // Note On
                this.handleNoteOn(channel, data1, data2);
                break;
                
            case 0xA0: // Polyphonic Aftertouch
                this.handlePolyAftertouch(channel, data1, data2);
                break;
                
            case 0xB0: // Control Change
                this.handleControlChange(channel, data1, data2);
                break;
                
            case 0xC0: // Program Change
                this.handleProgramChange(channel, data1);
                break;
                
            case 0xD0: // Channel Aftertouch
                this.handleChannelAftertouch(channel, data1);
                break;
                
            case 0xE0: // Pitch Bend
                this.handlePitchBend(channel, data1, data2);
                break;
                
            default:
                // Unhandled message type
                break;
        }
    }
    
    /**
     * Handle Note Off message
     * @param {number} channel - MIDI channel (0-15)
     * @param {number} note - Note number (0-127)
     * @param {number} velocity - Note velocity (0-127)
     */
    handleNoteOff(channel, note, velocity) {
        events.trigger('midi:noteOff', {
            channel,
            note,
            velocity
        });
    }
    
    /**
     * Handle Note On message
     * @param {number} channel - MIDI channel (0-15)
     * @param {number} note - Note number (0-127)
     * @param {number} velocity - Note velocity (0-127)
     */
    handleNoteOn(channel, note, velocity) {
        // Note On with velocity 0 is the same as Note Off
        if (velocity === 0) {
            this.handleNoteOff(channel, note, velocity);
            return;
        }
        
        events.trigger('midi:noteOn', {
            channel,
            note,
            velocity
        });
    }
    
    /**
     * Handle Polyphonic Aftertouch message
     * @param {number} channel - MIDI channel (0-15)
     * @param {number} note - Note number (0-127)
     * @param {number} pressure - Pressure value (0-127)
     */
    handlePolyAftertouch(channel, note, pressure) {
        events.trigger('midi:polyAftertouch', {
            channel,
            note,
            pressure
        });
    }
    
    /**
     * Handle Control Change message
     * @param {number} channel - MIDI channel (0-15)
     * @param {number} controller - Controller number (0-127)
     * @param {number} value - Controller value (0-127)
     */
    handleControlChange(channel, controller, value) {
        events.trigger('midi:controlChange', {
            channel,
            controller,
            value,
            normalizedValue: value / 127 // 0-1 range for easier use
        });
    }
    
    /**
     * Handle Program Change message
     * @param {number} channel - MIDI channel (0-15)
     * @param {number} program - Program number (0-127)
     */
    handleProgramChange(channel, program) {
        events.trigger('midi:programChange', {
            channel,
            program
        });
    }
    
    /**
     * Handle Channel Aftertouch message
     * @param {number} channel - MIDI channel (0-15)
     * @param {number} pressure - Pressure value (0-127)
     */
    handleChannelAftertouch(channel, pressure) {
        events.trigger('midi:channelAftertouch', {
            channel,
            pressure
        });
    }
    
    /**
     * Handle Pitch Bend message
     * @param {number} channel - MIDI channel (0-15)
     * @param {number} lsb - Least significant byte (0-127)
     * @param {number} msb - Most significant byte (0-127)
     */
    handlePitchBend(channel, lsb, msb) {
        // Combine bytes into a 14-bit value (0-16383)
        const value = (msb << 7) + lsb;
        
        events.trigger('midi:pitchBend', {
            channel,
            value,
            normalizedValue: (value - 8192) / 8192 // -1 to 1 range
        });
    }
    
    /**
     * Get the current MIDI status
     * @returns {object} Current MIDI status
     */
    getStatus() {
        return { ...this.status };
    }
    
    /**
     * Get the list of available MIDI inputs
     * @returns {Array} Array of MIDI inputs
     */
    getInputs() {
        return Object.values(this.midiInputs);
    }
    
    /**
     * Get the currently selected MIDI input
     * @returns {object|null} Selected MIDI input or null
     */
    getSelectedInput() {
        return this.selectedInput ? { ...this.selectedInput } : null;
    }
}

// Create MIDI controller instance
const midiController = new MidiController();

// Register as a module
LiveArt.registerModule('midiController', midiController);

export default midiController;