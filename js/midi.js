/**
 * LiveArt - MIDI Controller Integration
 * Handles Web MIDI API connections and message processing
 */
class MidiController {
    constructor() {
        this.midiAccess = null;
        this.midiInput = null;
        this.ccValues = new Map();
        this.anyControlChangeCallback = null;
        this.programChangeCallback = null;
        this.connected = false;
        this.boundMidiMessageHandler = null;
        
        // Initialize MIDI if available
        this.init();
    }
    
    init() {
        if (navigator.requestMIDIAccess) {
            navigator.requestMIDIAccess({ sysex: false })
                .then(this.onMIDISuccess.bind(this), this.onMIDIFailure.bind(this));
        } else {
            console.warn('Web MIDI API not supported in this browser.');
        }
    }
    
    onMIDISuccess(midiAccess) {
        this.midiAccess = midiAccess;
        this.connected = true;
        
        // Set up event handlers
        this.midiAccess.addEventListener('statechange', this.onStateChange.bind(this));
        
        // Initialize input dropdown with all available devices
        this.updateDeviceList();
        
        // Auto-select the first MIDI device if available
        this.autoSelectFirstDevice();
    }
    
    autoSelectFirstDevice() {
        if (!this.midiAccess || this.midiAccess.inputs.size === 0) return;
        
        // Get the first device
        const firstDevice = this.midiAccess.inputs.values().next().value;
        if (firstDevice) {
            // Select it in the dropdown
            const dropdown = document.getElementById('midi-input');
            if (dropdown) {
                dropdown.value = firstDevice.id;
                // Trigger change event to connect to it
                this.selectInput(firstDevice.id);
                
                // Update UI with selected device name
                const deviceLabel = document.querySelector('.midi-status span');
                if (deviceLabel) {
                    deviceLabel.textContent = firstDevice.name;
                }
                
                console.log(`Auto-connected to MIDI input: ${firstDevice.name}`);
            }
        }
    }
    
    onMIDIFailure(error) {
        console.warn('Failed to access MIDI devices:', error);
    }
    
    onStateChange(event) {
        // Update device list when MIDI devices are connected/disconnected
        this.updateDeviceList();
    }
    
    updateDeviceList() {
        const dropdown = document.getElementById('midi-input');
        if (!dropdown) return;
        
        // Clear existing options
        dropdown.innerHTML = '';
        
        // Add "None" option
        const noneOption = document.createElement('option');
        noneOption.value = '';
        noneOption.textContent = '-- Select MIDI Input --';
        dropdown.appendChild(noneOption);
        
        // Add available inputs
        if (this.midiAccess) {
            let hasInputs = false;
            
            for (const input of this.midiAccess.inputs.values()) {
                const option = document.createElement('option');
                option.value = input.id;
                option.textContent = input.name;
                dropdown.appendChild(option);
                hasInputs = true;
            }
            
            // Update status indicator
            const indicator = document.querySelector('.indicator');
            if (indicator) {
                if (hasInputs) {
                    indicator.classList.add('available');
                } else {
                    indicator.classList.remove('available');
                    indicator.classList.remove('connected');
                }
            }
            
            // If no inputs detected, show message in dropdown
            if (!hasInputs) {
                const noDevicesOption = document.createElement('option');
                noDevicesOption.value = 'no-devices';
                noDevicesOption.textContent = 'No MIDI devices detected';
                noDevicesOption.disabled = true;
                dropdown.appendChild(noDevicesOption);
                
                // Update status text
                const deviceLabel = document.querySelector('.midi-status span');
                if (deviceLabel) {
                    deviceLabel.textContent = 'No MIDI devices';
                }
            }
        }
        
        // Remove previous event listener if it exists
        if (dropdown._changeHandler) {
            dropdown.removeEventListener('change', dropdown._changeHandler);
        }
        
        // Set up change listener
        dropdown._changeHandler = (e) => {
            const success = this.selectInput(e.target.value);
            
            // Update UI with selected device name
            const deviceLabel = document.querySelector('.midi-status span');
            if (deviceLabel) {
                if (success && this.midiInput) {
                    deviceLabel.textContent = this.midiInput.name;
                } else {
                    deviceLabel.textContent = 'MIDI';
                }
            }
        };
        
        dropdown.addEventListener('change', dropdown._changeHandler);
    }
    
    selectInput(inputId) {
        // Disconnect current input if any
        if (this.midiInput) {
            // Store reference to bound handler
            if (this.boundMidiMessageHandler) {
                this.midiInput.removeEventListener('midimessage', this.boundMidiMessageHandler);
            }
        }
        
        // Connect to selected input
        if (inputId && this.midiAccess) {
            this.midiInput = this.midiAccess.inputs.get(inputId);
            if (this.midiInput) {
                // Create and store a new bound handler
                this.boundMidiMessageHandler = this.onMIDIMessage.bind(this);
                this.midiInput.addEventListener('midimessage', this.boundMidiMessageHandler);
                console.log(`Connected to MIDI input: ${this.midiInput.name}`);
                
                // Update UI to show connected state
                this.connected = true;
                const indicator = document.querySelector('.indicator');
                if (indicator) {
                    indicator.classList.add('connected');
                }
                
                return true;
            }
        }
        
        this.midiInput = null;
        
        // Update UI to show disconnected state
        this.connected = false;
        const indicator = document.querySelector('.indicator');
        if (indicator) {
            indicator.classList.remove('connected');
        }
        
        return false;
    }
    
    onMIDIMessage(message) {
        const data = message.data;
        const messageType = data[0] & 0xf0; // Mask channel bits
        
        // Handle Control Change messages (CC)
        if (messageType === 0xB0) {
            const ccNumber = data[1];
            const value = data[2] / 127.0; // Normalize to 0-1 range
            
            // Store value
            this.ccValues.set(ccNumber, value);
            
            // Pulse the activity indicator
            this.pulseActivityIndicator();
            
            // Call any registered callbacks
            if (this.anyControlChangeCallback) {
                this.anyControlChangeCallback(ccNumber, value);
            }
        }
        // Handle Program Change messages
        else if (messageType === 0xC0) {
            const programNumber = data[1];
            
            // Pulse the activity indicator
            this.pulseActivityIndicator();
            
            // Call any registered callback
            if (this.programChangeCallback) {
                this.programChangeCallback(programNumber);
            }
        }
    }
    
    pulseActivityIndicator() {
        const indicator = document.querySelector('.indicator');
        if (indicator) {
            indicator.classList.add('pulse');
            setTimeout(() => {
                indicator.classList.remove('pulse');
            }, 100);
        }
    }
    
    // Register a callback for any CC change
    onAnyControlChange(callback) {
        this.anyControlChangeCallback = callback;
    }
    
    // Register a callback for program changes
    onProgramChange(callback) {
        this.programChangeCallback = callback;
    }
    
    // Register a one-time callback for the next CC change
    once(callback) {
        const originalCallback = this.anyControlChangeCallback;
        
        // Set a one-time callback wrapper
        this.anyControlChangeCallback = (ccNumber, value) => {
            // Call our one-time callback first
            callback(ccNumber, value);
            
            // Then call original callback if it exists
            if (originalCallback) {
                originalCallback(ccNumber, value);
            }
            
            // Restore original callback
            this.anyControlChangeCallback = originalCallback;
        };
    }
    
    // Utility method to get a CC value
    getCC(ccNumber) {
        return this.ccValues.get(ccNumber) || 0;
    }
}

// Initialize the MIDI controller
const midiController = new MidiController();

// Setup UI indicator
document.addEventListener('DOMContentLoaded', () => {
    const indicator = document.querySelector('.indicator');
    if (indicator && midiController.connected) {
        indicator.classList.add('connected');
    }
    
    // Setup rescan button
    const rescanButton = document.querySelector('.rescan-midi-button');
    if (rescanButton) {
        rescanButton.addEventListener('click', () => {
            midiController.updateDeviceList();
            console.log('MIDI devices rescanned');
        });
    }
});