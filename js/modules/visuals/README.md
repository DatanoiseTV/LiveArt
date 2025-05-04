# LiveArt Visualizers

This directory contains visualization modules for LiveArt. Each visualization is implemented as a separate module that interacts with the visual engine.

## Structure

- `visual-engine.js` - Base engine class for 2D canvas rendering
- `oscilloscope.js` - CRT oscilloscope visualization with phosphor effects
- `audio-reactive.js` - Audio reactive visualization
- `template.js` - Template for creating new visualizations

## Creating a Visualization

To create a new visualization:

1. Use `template.js` as a starting point
2. Create a new class that implements the following methods:
   - `constructor(visualEngine)` - Initialize with engine reference
   - `init()` - Set up the visualization
   - `render(delta)` - Render the visualization
   - `cleanup()` - Clean up resources
3. Register your visualization with the engine in `init()`
4. Import and initialize your visualization in `main.js`

## Parameters

Visualizations use parameters from the global parameter system. Common parameters:

| Parameter   | Range | Description                                     |
|-------------|-------|-------------------------------------------------|
| hue         | 0-1   | Base color hue                                  |
| saturation  | 0-1   | Color saturation                                |
| brightness  | 0-1   | Overall brightness                              |
| complexity  | 0-1   | Level of detail/complexity                      |
| density     | 0-1   | Density of elements                             |
| reactivity  | 0-1   | How responsive to audio                         |
| zoom        | 0-1   | Zoom level                                      |
| noiseScale  | 0-1   | Scale of noise effects                          |
| speed       | 0-1   | Animation speed                                 |
| size        | 0-1   | Element size                                    |
| rotation    | 0-1   | Rotation amount                                 |
| symmetry    | 0-n   | Symmetry factor (typically 1-10)                |
| smoothing   | 0-1   | Parameter transition smoothing                  |

## Audio Data

Audio frequency data is available via the `audio:updated` event or from the `audioEngine` module:

```javascript
const audioEngine = LiveArt.getModule('audioEngine');
const audioData = audioEngine.getAudioData();

// Access frequency data
if (audioData && audioData.smoothedValues) {
    // smoothedValues is an array of frequency bins (0-1 range)
    const bassValue = this.getAudioBand(audioData.smoothedValues, 0, 8);
    const midValue = this.getAudioBand(audioData.smoothedValues, 8, 32);
    const highValue = this.getAudioBand(audioData.smoothedValues, 32, 64);
}
```

## Example: Minimal Visualization

```javascript
import LiveArt from '../index.js';
import events from '../core/events.js';
import VisualEngine from './visual-engine.js';

class MinimalVisualizer {
    constructor(visualEngine) {
        this.engine = visualEngine;
        this.name = 'minimal-viz';
    }
    
    init() {
        this.engine.registerVisual(this.name, this.render.bind(this));
    }
    
    render(delta) {
        const ctx = this.engine.ctx;
        const width = this.engine.width;
        const height = this.engine.height;
        
        // Clear canvas
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
        
        // Draw something
        ctx.fillStyle = this.engine.hsbaToRgba(
            this.engine.params.hue,
            this.engine.params.saturation,
            this.engine.params.brightness,
            1
        );
        
        ctx.beginPath();
        ctx.arc(width/2, height/2, height/4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    cleanup() {
        // No resources to clean up
    }
}

export default MinimalVisualizer;
```

## Best Practices

1. **Performance**: Minimize object creation in the render loop
2. **Responsiveness**: Adapt to canvas size changes
3. **Consistency**: Use engine parameters for consistent behavior
4. **Cleanup**: Release resources when not active
5. **Audio Reactivity**: Use audio data effectively for audio-reactive visuals
6. **Conventions**: Follow the naming and coding patterns of other visualizations