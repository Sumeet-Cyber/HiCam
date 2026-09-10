# hiCam 📷

A lightweight, modern, and privacy-first browser webcam application that captures photos, records videos with audio, and records standalone audio using native Browser APIs (`getUserMedia`, `MediaRecorder`, HTML5 Canvas, and Web Audio API).

![hiCam Preview](https://raw.githubusercontent.com/placeholder/hicam.png) *(Preview)*

---

## 🌟 Key Features

- 📸 **Photo Capture**:
  - High-resolution frame capture from video stream to Canvas.
  - Automatic selfie mirroring option (what you see is what you capture).
  - Shutter flash visual animation and synthesized camera shutter click sound.
  - Configurable countdown timer (3s, 5s, 10s).
  - PNG export.

- 🎥 **Video Recording**:
  - Crisp video + audio recording using `MediaRecorder`.
  - Adaptive MIME type detection (`video/webm;codecs=vp9,opus`, `video/webm`, or `video/mp4`).
  - Pulsing live recording indicator badge and elapsed duration timer.
  - Automatic video thumbnail generation.

- 🎙️ **Audio Only Recording**:
  - Dedicated microphone recording mode.
  - Generates standalone audio files (`.webm` / `.m4a` / `.ogg`).
  - Waveform / animated microphone visualizer.

- 📊 **Real-time Audio VU Meter**:
  - Live microphone volume visualization driven by Web Audio API `AnalyserNode`.
  - Color-coded level bar (green → yellow → red).

- ⚙️ **Device & Quality Controls**:
  - **Camera & Mic Selection**: Switch between front/rear cameras or external USB webcams and microphones.
  - **Resolution Presets**: Full HD (1080p), HD (720p), SD (480p), and Ultra HD (4K).
  - **Framing Grid**: Rule-of-thirds 3x3 overlay.
  - **Picture-in-Picture (PiP)**: Pop the webcam feed out into a floating window.
  - **Microphone Mute**: Instant audio muting toggle.

- 🖼️ **In-App Media Gallery & Lightbox**:
  - Bottom-left quick preview with live capture badge counter.
  - Slide-out gallery tray displaying all captures from the session.
  - Lightbox modal for full-resolution photo viewing and video/audio playback.
  - Direct local file downloads and deletion with automatic memory cleanup.

- 🎹 **Keyboard Shortcuts**:
  - `Space`: Shutter / Start & Stop Recording
  - `Escape`: Close open drawers, menus, and modals

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)

### Installation & Run

1. Clone or navigate to the project directory:
   ```bash
   cd hiCam
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

4. Open the displayed URL (usually `http://localhost:5173`) in any modern web browser (Google Chrome, Firefox, Safari, Microsoft Edge).

> [!IMPORTANT]
> Browser camera and microphone APIs (`getUserMedia`) require a **Secure Context** (`https://` or `http://localhost`). When accessing on localhost, the browser grants permissions directly after user approval.

### Production Build

To build an optimized static production bundle:
```bash
npm run build
```

To preview the production build locally:
```bash
npm run preview
```

---

## 📁 Architecture & File Structure

```
hiCam/
├── index.html              # Main HTML5 semantic structure & SVG iconography
├── package.json            # Project metadata & Vite scripts
├── vite.config.js          # Vite configuration
├── src/
│   ├── main.js             # Application controller & event coordination
│   ├── style.css           # Viewfinder dark theme, animations, responsive layout
│   └── modules/
│       ├── camera.js       # MediaStream acquisition, device enumeration, constraints
│       ├── capture.js      # Frame rendering to Canvas, countdown timer, mirroring
│       ├── recorder.js     # MediaRecorder controller for video & audio
│       ├── audioMeter.js   # Web Audio API volume analyser & synthesized sounds
│       └── gallery.js      # Media storage, blob management, downloads & cleanup
└── README.md               # Documentation
```

---

## 🔒 Privacy & Permissions

- **100% Client-Side**: All photo captures, video recordings, and audio recordings remain strictly within your browser session. No data is transmitted to external servers.
- **Permission Prompt**: On first launch, the browser will request permission to access your camera and microphone. If blocked, an in-app troubleshooting screen will guide you on how to grant access.
