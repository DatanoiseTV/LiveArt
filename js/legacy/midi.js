/**
 * LiveArt - MIDI Controller Integration
 * Handles Web MIDI API connections and message processing
 * Enhanced with auto-retry and reconnection capabilities
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
        
        // Retry configuration
        this.retryCount = 0;
        this.maxRetries = 10; // Increased max retries
        this.retryDelay = 1000; // Base delay in milliseconds
        this.retryTimer = null;
        this.retryBackoff = 1.5; // Exponential backoff multiplier
        this.deviceCheckInterval = null;
        this.isRetrying = false;
        
        // Initialize MIDI if available
        this.init();
    }
    
    init() {
        // Clear any existing timers
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        
        if (this.deviceCheckInterval) {
            clearInterval(this.deviceCheckInterval);
            this.deviceCheckInterval = null;
        }
        
        if (navigator.requestMIDIAccess) {
            // Update status during initial connection attempt
            if (!this.midiAccess) {
                this.updateRetryStatus('Connecting to MIDI devices...');
            }
            
            navigator.requestMIDIAccess({ sysex: false })
                .then(this.onMIDISuccess.bind(this), this.onMIDIFailure.bind(this))
                .catch(err => {
                    console.error('Unexpected error during MIDI initialization:', err);
                    this.updateRetryStatus('Unexpected MIDI error. Retrying...');
                    this.scheduleRetry();
                });
        } else {
            console.warn('Web MIDI API not supported in this browser.');
            this.updateRetryStatus('MIDI not supported in this browser', true);
        }
    }
    
    // Schedule the next retry with exponential backoff
    scheduleRetry() {
        // Don't schedule if we're at max retries
        if (this.retryCount >= this.maxRetries) {
            console.warn(`MIDI initialization retry limit (${this.maxRetries}) reached. Please reload the page or check your MIDI device.`);
            this.updateRetryStatus('Max retries reached. Please reload or check MIDI device.', true);
            this.isRetrying = false;
            return;
        }
        
        this.isRetrying = true;
        
        // Calculate delay with exponential backoff
        const delay = this.retryDelay * Math.pow(this.retryBackoff, this.retryCount);
        const cappedDelay = Math.min(delay, 10000); // Cap at 10 seconds
        
        console.log(`Scheduling MIDI retry ${this.retryCount + 1}/${this.maxRetries} in ${Math.floor(cappedDelay)}ms`);
        
        this.retryTimer = setTimeout(() => {
            this.retry();
        }, cappedDelay);
    }
    
    // Try to reconnect to MIDI system
    retry() {
        // Increment retry counter
        this.retryCount++;
        
        // Update status
        this.updateRetryStatus(`Attempting to connect to MIDI devices (try ${this.retryCount}/${this.maxRetries})...`);
        console.log(`MIDI retry attempt ${this.retryCount}/${this.maxRetries}`);
        
        // Try to initialize again
        this.init();
        
        // If we fail, the next retry will be scheduled by onMIDIFailure
        // If we succeed, onMIDISuccess will reset the retry mechanism
    }
    
    // Update UI with retry status
    updateRetryStatus(message, fadeOut = false) {
        // Don't try to update DOM if document isn't ready yet
        if (!document.body) {
            console.log('Document not ready yet, status update:', message);
            return;
        }
        
        // Try to find or create a status element
        let statusEl = document.getElementById('midi-retry-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'midi-retry-status';
            
            // Find the MIDI control area to append to
            const midiStatus = document.querySelector('.midi-status');
            if (midiStatus) {
                midiStatus.appendChild(statusEl);
            } else {
                // If MIDI status area doesn't exist yet, create a temporary container
                // This might happen if DOM is not fully loaded
                const tempContainer = document.createElement('div');
                tempContainer.id = 'midi-temp-container';
                tempContainer.style.position = 'fixed';
                tempContainer.style.bottom = '20px';
                tempContainer.style.left = '20px';
                tempContainer.style.zIndex = '1000';
                tempContainer.style.background = 'rgba(0,0,0,0.7)';
                tempContainer.style.padding = '10px';
                tempContainer.style.borderRadius = '5px';
                tempContainer.appendChild(statusEl);
                document.body.appendChild(tempContainer);
                
                // When DOM is fully loaded, move to the proper location
                document.addEventListener('DOMContentLoaded', () => {
                    const midiStatus = document.querySelector('.midi-status');
                    if (midiStatus && statusEl.parentElement) {
                        statusEl.parentElement.removeChild(statusEl);
                        midiStatus.appendChild(statusEl);
                        document.body.removeChild(tempContainer);
                    }
                });
            }
        }
        
        // Update message with pulsing effect for retry attempts
        statusEl.textContent = message;
        
        // Add pulsing class for retry messages
        if (message.includes('Attempting') || message.includes('Retrying') || message.includes('Waiting')) {
            statusEl.classList.add('pulsing');
        } else {
            statusEl.classList.remove('pulsing');
        }
        
        // Fade out if requested
        if (fadeOut) {
            setTimeout(() => {
                statusEl.style.opacity = '0';
                
                setTimeout(() => {
                    statusEl.textContent = '';
                    statusEl.style.opacity = '1';
                    statusEl.style.animation = 'none';
                }, 1000);
            }, 3000);
        }
    }
    
    onMIDISuccess(midiAccess) {
        this.midiAccess = midiAccess;
        this.connected = true;
        
        // Set up event handlers for device state changes
        this.midiAccess.addEventListener('statechange', this.onStateChange.bind(this));
        
        // Initialize input dropdown with all available devices
        this.updateDeviceList();
        
        // Check if any MIDI devices are connected
        if (this.midiAccess.inputs.size === 0) {
            console.warn('MIDI access granted but no devices detected. Will retry...');
            this.updateRetryStatus('Waiting for MIDI devices to appear...');
            
            // Start device detection polling
            this.startDevicePolling();
            return;
        }
        
        // We found devices, reset retry mechanism
        this.resetRetryMechanism();
        
        // Auto-select the first MIDI device
        this.autoSelectFirstDevice();
        
        // Show success message
        this.updateRetryStatus('MIDI devices connected!', true);
    }
    
    // Reset retry mechanism when we're successful
    resetRetryMechanism() {
        this.retryCount = 0;
        this.isRetrying = false;
        
        // Clear retry timer if running
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
    }
    
    // Start polling for devices to appear
    startDevicePolling() {
        // Clear any existing interval
        if (this.deviceCheckInterval) {
            clearInterval(this.deviceCheckInterval);
        }
        
        // Only schedule device polling if we haven't exceeded retry count
        if (this.retryCount < this.maxRetries) {
            // Check every second if devices appeared
            this.deviceCheckInterval = setInterval(() => {
                if (this.midiAccess && this.midiAccess.inputs.size > 0) {
                    // Devices appeared, stop polling and select device
                    clearInterval(this.deviceCheckInterval);
                    this.deviceCheckInterval = null;
                    
                    console.log('MIDI devices detected during polling!');
                    this.resetRetryMechanism();
                    this.updateDeviceList();
                    this.autoSelectFirstDevice();
                    this.updateRetryStatus('MIDI devices connected!', true);
                } else {
                    // No devices yet, schedule a retry if we're not already retrying
                    if (!this.isRetrying && !this.retryTimer) {
                        this.scheduleRetry();
                    }
                }
            }, 1000);
        }
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
        
        // Update UI with error information
        let errorMsg = 'Failed to access MIDI';
        
        // Add specific error information if available
        if (error) {
            if (error.name) {
                errorMsg += ` (${error.name})`;
            }
            if (error.message) {
                errorMsg += `: ${error.message}`;
            }
        }
        
        this.updateRetryStatus(`${errorMsg}. Retrying soon...`);
        
        // Start retry process with exponential backoff if not already retrying
        if (!this.isRetrying) {
            this.scheduleRetry();
        }
    }
    
    onStateChange(event) {
        // Get details about the state change
        const port = event.port;
        const portState = port.state;
        const portType = port.type; // 'input' or 'output'
        const portName = port.name || 'Unknown device';
        
        // Log the state change
        console.log(`MIDI ${portType} "${portName}" ${portState}`);
        
        // Update the device list to reflect changes
        this.updateDeviceList();
        
        // Handle disconnection of the currently selected device
        if (this.midiInput && port.id === this.midiInput.id && portState === 'disconnected') {
            console.warn(`Current MIDI device "${portName}" disconnected!`);
            this.updateRetryStatus(`MIDI device "${portName}" disconnected. Watching for reconnection...`);
            
            // Show a notification
            this.showNotification(`MIDI device "${portName}" disconnected`, 'warning');
            
            // Check if we need to select a new device automatically
            setTimeout(() => {
                // If we don't have any connected devices, start polling for new ones
                if (this.midiAccess && this.midiAccess.inputs.size === 0) {
                    // Start the device polling system
                    this.startDevicePolling();
                } else if (!this.midiInput) {
                    // Select another device if available
                    this.autoSelectFirstDevice();
                }
            }, 500);
        }
        
        // Handle new device connections
        if (portState === 'connected' && portType === 'input') {
            // Stop retrying if we were in retry mode
            if (this.isRetrying) {
                this.resetRetryMechanism();
            }
            
            this.updateRetryStatus(`MIDI device "${portName}" connected!`, true);
            
            // Show a notification
            this.showNotification(`MIDI device "${portName}" connected`, 'success');
            
            // If we don't have a device selected, select this one
            if (!this.midiInput) {
                // Short delay to ensure the port is ready before selecting
                setTimeout(() => {
                    this.autoSelectFirstDevice();
                }, 300);
            }
        }
        
        // If all devices are disconnected, start polling
        if (this.midiAccess && this.midiAccess.inputs.size === 0) {
            console.log('All MIDI devices disconnected. Watching for reconnection...');
            
            // Only start polling if we're not already retrying
            if (!this.deviceCheckInterval && !this.isRetrying) {
                this.startDevicePolling();
            }
        }
    }
    
    updateDeviceList() {
        const dropdown = document.getElementById('midi-input');
        if (!dropdown) return;
        
        // Remember selected device ID before clearing
        const previouslySelectedId = dropdown.value;
        
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
            let inputCount = 0;
            let selectedOption = null;
            
            for (const input of this.midiAccess.inputs.values()) {
                const option = document.createElement('option');
                option.value = input.id;
                
                // Format device name with state and manufacturer if available
                let deviceText = input.name || 'Unnamed device';
                
                if (input.manufacturer) {
                    deviceText += ` (${input.manufacturer})`;
                }
                
                // Show connection state for debugging
                if (input.connection && input.connection !== 'open') {
                    deviceText += ` [${input.connection}]`;
                }
                
                // Mark the selected option
                if (this.midiInput && this.midiInput.id === input.id) {
                    option.selected = true;
                    selectedOption = option;
                } else if (previouslySelectedId === input.id) {
                    option.selected = true;
                    selectedOption = option;
                }
                
                option.textContent = deviceText;
                dropdown.appendChild(option);
                hasInputs = true;
                inputCount++;
            }
            
            // Update status indicator
            const indicator = document.querySelector('.indicator');
            if (indicator) {
                if (hasInputs) {
                    indicator.classList.add('available');
                    // Add connected class if we have a selected input
                    if (this.midiInput) {
                        indicator.classList.add('connected');
                    }
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
            } else {
                // Update device count in status
                const deviceLabel = document.querySelector('.midi-status span');
                if (deviceLabel) {
                    if (this.midiInput) {
                        deviceLabel.textContent = `${this.midiInput.name}`;
                        
                        if (inputCount > 1) {
                            deviceLabel.textContent += ` (+${inputCount-1} more)`;
                        }
                    } else {
                        deviceLabel.textContent = `${inputCount} MIDI device${inputCount !== 1 ? 's' : ''}`;
                    }
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
                    
                    // Show device count if multiple devices
                    if (this.midiAccess && this.midiAccess.inputs.size > 1) {
                        deviceLabel.textContent += ` (+${this.midiAccess.inputs.size-1} more)`;
                    }
                } else {
                    deviceLabel.textContent = 'MIDI';
                }
            }
        };
        
        dropdown.addEventListener('change', dropdown._changeHandler);
    }
    
    selectInput(inputId) {
        // Preserve existing callback when switching devices
        const existingCallback = this.anyControlChangeCallback;
        const existingProgramCallback = this.programChangeCallback;
        
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
                
                // Show notification when we manually select a device
                this.showNotification(`Connected to "${this.midiInput.name}"`, 'success');
                
                // Restore any existing callbacks
                if (existingCallback) {
                    this.anyControlChangeCallback = existingCallback;
                }
                
                if (existingProgramCallback) {
                    this.programChangeCallback = existingProgramCallback;
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
                console.log(`MIDI CC ${ccNumber}: ${value.toFixed(2)} - Calling callback`);
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
        if (!this.connected || !this.midiInput) {
            console.warn('MIDI not connected, cannot register one-time callback');
            
            // Show notification to user
            if (document.body) {
                const notification = document.createElement('div');
                notification.className = 'notification';
                notification.style.backgroundColor = 'rgba(255, 0, 0, 0.9)'; // Red for error
                notification.textContent = 'MIDI device not connected. Please connect a MIDI device first.';
                document.body.appendChild(notification);
                setTimeout(() => {
                    if (notification.parentNode) notification.parentNode.removeChild(notification);
                }, 3000);
            }
            
            // Call the callback immediately with failure
            setTimeout(() => {
                callback(null, 0);
            }, 500);
            return;
        }
        
        // Store a reference to this instance for the closure
        const self = this;
        
        // Create a temporary message handler function
        const tempHandler = function(ccNumber, value) {
            // Call the callback with the CC data
            callback(ccNumber, value);
            
            // Remove this temporary handler after first execution
            self.anyControlChangeCallback = self.originalCallback || null;
            
            // Clear the stored reference
            self.originalCallback = null;
            
            // Show visual feedback that we received a MIDI message
            self.pulseActivityIndicator();
            
            console.log(`MIDI one-time callback executed for CC ${ccNumber} (${value})`);
        };
        
        // Store the original callback
        this.originalCallback = this.anyControlChangeCallback;
        
        // Replace with our temporary handler
        this.anyControlChangeCallback = tempHandler;
        
        console.log('MIDI one-time handler registered. Waiting for controller input...');
    }
    
    // Utility method to get a CC value
    getCC(ccNumber) {
        return this.ccValues.get(ccNumber) || 0;
    }
    
    // Show a temporary notification
    showNotification(message, type = 'info') {
        // Don't try to update DOM if document isn't ready yet
        if (!document.body) {
            console.log('Document not ready yet, notification:', message);
            return;
        }
        
        // Check if we already have a notification
        let notification = document.querySelector('.notification');
        
        // Create one if it doesn't exist
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'notification';
            document.body.appendChild(notification);
        }
        
        // Set color based on type
        if (type === 'success') {
            notification.style.backgroundColor = 'rgba(0, 128, 0, 0.9)';
        } else if (type === 'error') {
            notification.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
        } else if (type === 'warning') {
            notification.style.backgroundColor = 'rgba(255, 165, 0, 0.9)';
        } else {
            notification.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        }
        
        // Set content
        notification.textContent = message;
        
        // Make sure it's visible
        notification.style.display = 'block';
        
        // Remove any previous animation
        notification.style.animation = 'none';
        
        // Force reflow
        void notification.offsetWidth;
        
        // Apply fade-in-out animation
        notification.style.animation = 'fade-in-out 2s forwards';
        
        // Remove after animation completes
        setTimeout(() => {
            if (notification && notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 2000);
    }
}

// Initialize the MIDI controller
const midiController = new MidiController();

// Setup UI indicator and controls
document.addEventListener('DOMContentLoaded', () => {
    const indicator = document.querySelector('.indicator');
    if (indicator && midiController.connected) {
        indicator.classList.add('connected');
    }
    
    // Setup rescan button with enhanced functionality
    const rescanButton = document.querySelector('.rescan-midi-button');
    if (rescanButton) {
        rescanButton.addEventListener('click', () => {
            // Show visual feedback
            rescanButton.style.transform = 'rotate(360deg)';
            rescanButton.style.transition = 'transform 0.5s ease';
            
            // Add loading state to button
            rescanButton.style.backgroundColor = '#ff9800';
            
            // Update status
            midiController.updateRetryStatus('Rescanning MIDI devices...');
            
            // Reset the retry counter
            midiController.retryCount = 0;
            
            // Stop any running timers
            if (midiController.retryTimer) {
                clearTimeout(midiController.retryTimer);
                midiController.retryTimer = null;
            }
            
            if (midiController.deviceCheckInterval) {
                clearInterval(midiController.deviceCheckInterval);
                midiController.deviceCheckInterval = null;
            }
            
            console.log('Manual MIDI rescan initiated by user');
            
            // Request MIDI access again to refresh the connection
            setTimeout(() => {
                midiController.init();
                
                // Reset button after scan
                setTimeout(() => {
                    rescanButton.style.transform = '';
                    rescanButton.style.backgroundColor = '';
                }, 500);
            }, 100);
        });
    }
    
    // Create a display for connection status if it doesn't exist
    if (!document.getElementById('midi-retry-status')) {
        midiController.updateRetryStatus('MIDI initialized');
    }
});