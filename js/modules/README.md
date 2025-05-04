# LiveArt Modular Structure

This directory contains the modularized components of the LiveArt application.

## Module Structure

- `core/` - Core application functionality
  - `engine.js` - Main engine and initialization
  - `settings.js` - Settings management and persistence
  - `utils.js` - Utility functions and helpers

- `audio/` - Audio processing and analysis
  - `audio-engine.js` - Audio context and device handling
  - `frequency-analyzer.js` - Audio frequency analysis
  - `frequency-mapping.js` - Audio frequency to parameter mapping

- `midi/` - MIDI controller integration
  - `midi-controller.js` - MIDI device management
  - `midi-mapping.js` - MIDI CC to parameter mapping

- `ui/` - User interface components
  - `ui-manager.js` - UI initialization and management
  - `controls.js` - Parameter controls and panels
  - `notifications.js` - User notifications
  - `visualizers.js` - UI visualizers for audio/frequency

- `visuals/` - Visual effects and rendering
  - `visual-engine.js` - Base visual engine functionality
  - `canvas-renderer.js` - Canvas-based rendering
  - `oscilloscope.js` - Oscilloscope visualizations
  - `audio-reactive.js` - Audio reactive visualizations

- `webgl/` - WebGL visualizations
  - `webgl-engine.js` - WebGL rendering engine
  - `shader-manager.js` - Shader management
  - `3d-scenes.js` - 3D scene definitions
  - `post-processing.js` - WebGL post-processing effects

## Module Communication

Modules communicate through a simple event system and shared state management.