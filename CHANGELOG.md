# Changelog

All notable changes to LiveArt will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2023-05-03

### Added
- Implemented error handling in WebGL animation loop for improved stability
- Extended documentation in README and comments
- Comprehensive .gitignore for development environments

### Fixed
- Fixed draggable parameter sliders implementation for better touch and mouse interaction
- Fixed WebGL scene switching between different 3D visualizations
- Fixed MIDI UI feedback to properly indicate connected device status
- Fixed post-processing effects initialization with proper shader dependencies
- Prevented keyboard shortcuts from triggering when typing in form inputs
- Fixed render pass management in WebGL effect composer
- Fixed error handling in THREE.js rendering pipeline

## [0.1.0] - 2023-05-01

### Added
- Initial repository setup
- Core visualization engine with 2D and 3D support
- MIDI controller integration
- Parameter control system
- Visual preset selection
- Touch and mouse interaction support
- Keyboard shortcuts
- Fullscreen and Live Mode
- Visual preset saving/loading
- Post-processing effects for 2D and 3D
- Draggable parameter sliders in mapping panel
- CC Map preset system with import/export capabilities
