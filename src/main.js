import { CameraManager } from './modules/camera.js';
import { PhotoCapturer } from './modules/capture.js';
import { MediaRecordingManager } from './modules/recorder.js';
import { AudioController } from './modules/audioMeter.js';
import { GalleryManager } from './modules/gallery.js';

// DOM Elements
const previewVideo = document.getElementById('previewVideo');
const viewfinder = document.getElementById('viewfinder');
const streamStatusBadge = document.getElementById('streamStatusBadge');
const resolutionTag = document.getElementById('resolutionTag');
const audioMeterLevel = document.getElementById('audioMeterLevel');
const audioModeVisual = document.getElementById('audioModeVisual');
const framingGrid = document.getElementById('framingGrid');
const flashOverlay = document.getElementById('flashOverlay');
const countdownBadge = document.getElementById('countdownBadge');
const recordingBadge = document.getElementById('recordingBadge');
const recordingTimerText = document.getElementById('recordingTimerText');
const cameraErrorState = document.getElementById('cameraErrorState');
const errorMessageTitle = document.getElementById('errorMessageTitle');
const errorMessageDetail = document.getElementById('errorMessageDetail');
const btnRetryCamera = document.getElementById('btnRetryCamera');

// Quick Overlays & Header Buttons
const btnToggleGrid = document.getElementById('btnToggleGrid');
const btnToggleMirror = document.getElementById('btnToggleMirror');
const btnTogglePiP = document.getElementById('btnTogglePiP');
const btnOpenSettings = document.getElementById('btnOpenSettings');

// Mode Switchers
const modePhotoBtn = document.getElementById('modePhoto');
const modeVideoBtn = document.getElementById('modeVideo');
const modeAudioBtn = document.getElementById('modeAudio');

// Action Bar
const btnShutter = document.getElementById('btnShutter');
const btnTimerToggle = document.getElementById('btnTimerToggle');
const timerLabel = document.getElementById('timerLabel');
const timerMenu = document.getElementById('timerMenu');
const btnFlipCamera = document.getElementById('btnFlipCamera');
const btnToggleMic = document.getElementById('btnToggleMic');
const micIconOn = document.getElementById('micIconOn');
const micIconOff = document.getElementById('micIconOff');

// Gallery Elements
const btnOpenGallery = document.getElementById('btnOpenGallery');
const galleryThumbnailPlaceholder = document.getElementById('galleryThumbnailPlaceholder');
const galleryThumbnailImg = document.getElementById('galleryThumbnailImg');
const galleryBadge = document.getElementById('galleryBadge');
const galleryDrawer = document.getElementById('galleryDrawer');
const galleryBackdrop = document.getElementById('galleryBackdrop');
const btnCloseGallery = document.getElementById('btnCloseGallery');
const galleryGrid = document.getElementById('galleryGrid');
const galleryEmptyState = document.getElementById('galleryEmptyState');
const galleryCountHeader = document.getElementById('galleryCountHeader');

// Preview Modal (Lightbox)
const previewModal = document.getElementById('previewModal');
const previewModalBackdrop = document.getElementById('previewModalBackdrop');
const btnClosePreviewModal = document.getElementById('btnClosePreviewModal');
const previewModalTypeTag = document.getElementById('previewModalTypeTag');
const previewModalFilename = document.getElementById('previewModalFilename');
const previewMediaContainer = document.getElementById('previewMediaContainer');
const previewMetaSize = document.getElementById('previewMetaSize');
const previewMetaTime = document.getElementById('previewMetaTime');
const btnDeleteMedia = document.getElementById('btnDeleteMedia');
const btnDownloadMedia = document.getElementById('btnDownloadMedia');

// Settings Drawer
const settingsDrawer = document.getElementById('settingsDrawer');
const settingsBackdrop = document.getElementById('settingsBackdrop');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const selectCamera = document.getElementById('selectCamera');
const selectMicrophone = document.getElementById('selectMicrophone');
const selectResolution = document.getElementById('selectResolution');
const chkSoundEffects = document.getElementById('chkSoundEffects');
const chkMirrorVideo = document.getElementById('chkMirrorVideo');
const chkGridLines = document.getElementById('chkGridLines');

// Toast Container
const toastContainer = document.getElementById('toastContainer');

// State
let currentMode = 'photo'; // 'photo' | 'video' | 'audio'
let isMirrored = true;
let isGridVisible = false;
let countdownSeconds = 0;
let isRecording = false;
let currentPreviewItemId = null;

// Initialize Module Instances
const camera = new CameraManager();
const capturer = new PhotoCapturer();
const recorder = new MediaRecordingManager();
const audioController = new AudioController();
const gallery = new GalleryManager();

/**
 * Toast Notification Helper
 */
function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, duration);
}

/**
 * Update Resolution Display Tag
 */
function updateResolutionDisplay() {
  const w = previewVideo.videoWidth;
  const h = previewVideo.videoHeight;
  if (w && h) {
    resolutionTag.textContent = `${w}x${h}`;
  }
}

/**
 * Central Stream Attacher:
 * Binds active MediaStream to video element, starts playback,
 * attaches Audio VU meter, and updates resolution badges.
 */
async function attachStream(stream) {
  if (!stream) return;

  if (previewVideo.srcObject !== stream) {
    previewVideo.srcObject = stream;
  }

  try {
    await previewVideo.play();
  } catch (err) {
    console.warn('previewVideo.play() warning:', err);
  }

  updateResolutionDisplay();

  // Connect Audio VU Meter
  audioController.startLevelMeter(stream, (level) => {
    audioMeterLevel.style.width = `${Math.round(level * 100)}%`;
  });
}

/**
 * Update UI according to active mode
 */
function setMode(mode) {
  if (isRecording) {
    showToast('Please stop recording before switching modes.');
    return;
  }

  currentMode = mode;

  // Update tabs
  [modePhotoBtn, modeVideoBtn, modeAudioBtn].forEach(btn => {
    const isActive = btn.dataset.mode === mode;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Update Shutter button styling
  btnShutter.className = 'shutter-btn';
  if (mode === 'photo') {
    btnShutter.classList.add('photo-mode');
    btnShutter.setAttribute('title', 'Take Photo (Space)');
    btnTimerToggle.style.display = 'inline-flex';
    audioModeVisual.classList.add('hidden');
    previewVideo.style.display = 'block';
  } else if (mode === 'video') {
    btnShutter.classList.add('video-mode');
    btnShutter.setAttribute('title', 'Start Recording Video (Space)');
    btnTimerToggle.style.display = 'none';
    audioModeVisual.classList.add('hidden');
    previewVideo.style.display = 'block';
  } else if (mode === 'audio') {
    btnShutter.classList.add('audio-mode');
    btnShutter.setAttribute('title', 'Start Recording Audio (Space)');
    btnTimerToggle.style.display = 'none';
    audioModeVisual.classList.remove('hidden');
    previewVideo.style.display = 'none';
  }
}

/**
 * Initialize Camera and Audio Stream
 */
async function initCamera() {
  cameraErrorState.classList.add('hidden');
  streamStatusBadge.textContent = 'Connecting...';
  streamStatusBadge.className = 'status-badge';

  try {
    const stream = await camera.startStream();
    await attachStream(stream);

    streamStatusBadge.textContent = 'Live';
    streamStatusBadge.className = 'status-badge live';

    // Populate Device Lists
    await populateDeviceSelectors();

  } catch (err) {
    console.error('Camera initialization failed:', err);
    streamStatusBadge.textContent = 'Offline';
    streamStatusBadge.className = 'status-badge';
    showCameraError(err);
  }
}

/**
 * Show clear error explanation in case camera/mic fails
 */
function showCameraError(err) {
  cameraErrorState.classList.remove('hidden');
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    errorMessageTitle.textContent = 'Camera & Mic Access Blocked';
    errorMessageDetail.textContent = 'Permissions were denied. Please click the camera icon in your browser address bar and choose "Always allow", then retry.';
  } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    errorMessageTitle.textContent = 'No Camera or Microphone Found';
    errorMessageDetail.textContent = 'Could not detect an available camera or microphone on your system. Please connect a device and retry.';
  } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
    errorMessageTitle.textContent = 'Camera In Use';
    errorMessageDetail.textContent = 'Your camera or microphone might already be in use by another application. Close other camera apps and retry.';
  } else {
    errorMessageTitle.textContent = 'Camera Unavailable';
    errorMessageDetail.textContent = err.message || 'An unexpected error occurred while connecting to your camera.';
  }
}

/**
 * Populate Camera & Microphone selectors
 */
async function populateDeviceSelectors() {
  const { cameras, microphones } = await camera.getDevices();

  // Populate cameras
  selectCamera.innerHTML = '';
  if (cameras.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Default Camera';
    selectCamera.appendChild(opt);
  } else {
    cameras.forEach(cam => {
      const opt = document.createElement('option');
      opt.value = cam.deviceId;
      opt.textContent = cam.label;
      if (cam.deviceId === camera.currentVideoDeviceId) {
        opt.selected = true;
      }
      selectCamera.appendChild(opt);
    });
  }

  // Populate microphones
  selectMicrophone.innerHTML = '';
  if (microphones.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Default Microphone';
    selectMicrophone.appendChild(opt);
  } else {
    microphones.forEach(mic => {
      const opt = document.createElement('option');
      opt.value = mic.deviceId;
      opt.textContent = mic.label;
      if (mic.deviceId === camera.currentAudioDeviceId) {
        opt.selected = true;
      }
      selectMicrophone.appendChild(opt);
    });
  }
}

/**
 * Trigger Shutter Flash Animation
 */
function triggerFlash() {
  flashOverlay.classList.remove('active');
  void flashOverlay.offsetWidth;
  flashOverlay.classList.add('active');
  setTimeout(() => {
    flashOverlay.classList.remove('active');
  }, 350);
}

/**
 * Action: Capture Photo
 */
async function handleTakePhoto() {
  if (countdownSeconds > 0) {
    countdownBadge.classList.remove('hidden');

    await capturer.startCountdown(countdownSeconds, (sec) => {
      if (sec > 0) {
        countdownBadge.textContent = sec;
        audioController.playBeep(false);
      } else {
        countdownBadge.classList.add('hidden');
        audioController.playBeep(true);
      }
    });
  }

  try {
    triggerFlash();
    audioController.playShutterSound();

    const captureResult = await capturer.captureFrame(previewVideo, {
      mirrored: isMirrored,
      format: 'image/png',
    });

    const item = gallery.addItem({
      type: 'photo',
      blob: captureResult.blob,
      thumbnailUrl: captureResult.dataUrl,
    });

    showToast('Photo captured!');
    updateGalleryThumbnail(item);
  } catch (err) {
    console.error('Photo capture error:', err);
    showToast('Failed to take photo: ' + err.message);
  }
}

/**
 * Action: Start / Stop Video Recording
 */
async function handleToggleVideoRecording() {
  if (!isRecording) {
    // Start Recording
    try {
      if (!camera.stream) {
        showToast('Camera stream not active');
        return;
      }

      await recorder.startRecording(camera.stream, 'video', {
        onDurationTick: (secs, formatted) => {
          recordingTimerText.textContent = formatted;
        },
      });

      isRecording = true;
      audioController.playRecordStartSound();
      recordingBadge.classList.remove('hidden');
      recordingTimerText.textContent = '00:00';
      streamStatusBadge.textContent = 'Recording';
      streamStatusBadge.className = 'status-badge recording';

      btnShutter.classList.remove('video-mode');
      btnShutter.classList.add('video-recording');
      btnShutter.setAttribute('title', 'Stop Recording');

      showToast('Video recording started');
    } catch (err) {
      console.error('Start video error:', err);
      showToast('Failed to start recording: ' + err.message);
    }
  } else {
    // Stop Recording
    try {
      const result = await recorder.stopRecording();
      isRecording = false;
      audioController.playRecordStopSound();

      recordingBadge.classList.add('hidden');
      streamStatusBadge.textContent = 'Live';
      streamStatusBadge.className = 'status-badge live';

      btnShutter.classList.remove('video-recording');
      btnShutter.classList.add('video-mode');
      btnShutter.setAttribute('title', 'Start Recording Video');

      // Capture a thumbnail from the video
      let thumbUrl = '';
      try {
        const thumb = await capturer.captureFrame(previewVideo, { mirrored: isMirrored });
        thumbUrl = thumb.dataUrl;
      } catch (e) {}

      const item = gallery.addItem({
        type: 'video',
        blob: result.blob,
        duration: result.duration,
        extension: result.extension,
        thumbnailUrl: thumbUrl,
      });

      showToast(`Video saved (${recorder.formatDuration(result.duration)})`);
      updateGalleryThumbnail(item);
    } catch (err) {
      console.error('Stop video error:', err);
      showToast('Failed to save video: ' + err.message);
    }
  }
}

/**
 * Action: Start / Stop Audio Recording
 */
async function handleToggleAudioRecording() {
  if (!isRecording) {
    try {
      if (!camera.stream) {
        showToast('Microphone not active');
        return;
      }

      await recorder.startRecording(camera.stream, 'audio', {
        onDurationTick: (secs, formatted) => {
          recordingTimerText.textContent = formatted;
        },
      });

      isRecording = true;
      audioController.playRecordStartSound();
      recordingBadge.classList.remove('hidden');
      recordingTimerText.textContent = '00:00';
      streamStatusBadge.textContent = 'Recording Audio';
      streamStatusBadge.className = 'status-badge recording';

      btnShutter.classList.remove('audio-mode');
      btnShutter.classList.add('audio-recording');
      btnShutter.setAttribute('title', 'Stop Audio Recording');

      showToast('Audio recording started');
    } catch (err) {
      console.error('Start audio recording error:', err);
      showToast('Failed to start audio recording: ' + err.message);
    }
  } else {
    try {
      const result = await recorder.stopRecording();
      isRecording = false;
      audioController.playRecordStopSound();

      recordingBadge.classList.add('hidden');
      streamStatusBadge.textContent = 'Live';
      streamStatusBadge.className = 'status-badge live';

      btnShutter.classList.remove('audio-recording');
      btnShutter.classList.add('audio-mode');
      btnShutter.setAttribute('title', 'Start Recording Audio');

      const item = gallery.addItem({
        type: 'audio',
        blob: result.blob,
        duration: result.duration,
        extension: result.extension,
      });

      showToast(`Audio clip saved (${recorder.formatDuration(result.duration)})`);
      updateGalleryThumbnail(item);
    } catch (err) {
      console.error('Stop audio recording error:', err);
      showToast('Failed to save audio: ' + err.message);
    }
  }
}

/**
 * Main Shutter Click Router
 */
function handleShutterClick() {
  if (currentMode === 'photo') {
    handleTakePhoto();
  } else if (currentMode === 'video') {
    handleToggleVideoRecording();
  } else if (currentMode === 'audio') {
    handleToggleAudioRecording();
  }
}

/**
 * Update the bottom-left quick gallery preview thumbnail
 */
function updateGalleryThumbnail(latestItem) {
  if (!latestItem) {
    galleryThumbnailPlaceholder.classList.remove('hidden');
    galleryThumbnailImg.classList.add('hidden');
    galleryBadge.classList.add('hidden');
    return;
  }

  const count = gallery.getItems().length;
  galleryBadge.textContent = count;
  galleryBadge.classList.toggle('hidden', count === 0);

  if (latestItem.type === 'photo' || latestItem.type === 'video') {
    galleryThumbnailImg.src = latestItem.thumbnailUrl;
    galleryThumbnailImg.classList.remove('hidden');
    galleryThumbnailPlaceholder.classList.add('hidden');
  } else {
    // Audio item
    galleryThumbnailPlaceholder.classList.remove('hidden');
    galleryThumbnailImg.classList.add('hidden');
  }
}

/**
 * Render items in Gallery Drawer Grid
 */
function renderGalleryGrid(items) {
  galleryGrid.innerHTML = '';
  galleryCountHeader.textContent = items.length;

  if (items.length === 0) {
    galleryEmptyState.classList.remove('hidden');
    return;
  }

  galleryEmptyState.classList.add('hidden');

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'gallery-item-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View ${item.filename}`);

    if (item.type === 'audio') {
      card.innerHTML = `
        <div class="gallery-item-audio-placeholder">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
          <span>${recorder.formatDuration(item.duration)}</span>
        </div>
        <span class="gallery-item-type-pill">AUDIO</span>
      `;
    } else {
      card.innerHTML = `
        <img src="${item.thumbnailUrl}" class="gallery-item-thumbnail" alt="${item.filename}" />
        <span class="gallery-item-type-pill">${item.type.toUpperCase()}${item.duration ? ` • ${recorder.formatDuration(item.duration)}` : ''}</span>
      `;
    }

    card.addEventListener('click', () => openPreviewModal(item.id));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPreviewModal(item.id);
      }
    });

    galleryGrid.appendChild(card);
  });
}

/**
 * Open Media Preview Lightbox Modal
 */
function openPreviewModal(itemId) {
  const item = gallery.getItem(itemId);
  if (!item) return;

  currentPreviewItemId = itemId;
  previewModalTypeTag.textContent = item.type.toUpperCase();
  previewModalFilename.textContent = item.filename;
  previewMetaSize.textContent = gallery.formatBytes(item.size);
  previewMetaTime.textContent = item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  previewMediaContainer.innerHTML = '';

  if (item.type === 'photo') {
    const img = document.createElement('img');
    img.src = item.url;
    img.alt = item.filename;
    previewMediaContainer.appendChild(img);
  } else if (item.type === 'video') {
    const video = document.createElement('video');
    video.src = item.url;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    previewMediaContainer.appendChild(video);
  } else if (item.type === 'audio') {
    const audio = document.createElement('audio');
    audio.src = item.url;
    audio.controls = true;
    audio.autoplay = true;
    previewMediaContainer.appendChild(audio);
  }

  previewModal.classList.remove('hidden');
}

/**
 * Close Media Preview Modal
 */
function closePreviewModal() {
  previewModal.classList.add('hidden');
  previewMediaContainer.innerHTML = '';
  currentPreviewItemId = null;
}

// Attach Gallery state listener
gallery.onItemsChange = (items) => {
  renderGalleryGrid(items);
  updateGalleryThumbnail(gallery.getLatestItem());
};

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
  // Video element events
  previewVideo.addEventListener('loadedmetadata', updateResolutionDisplay);
  previewVideo.addEventListener('resize', updateResolutionDisplay);

  // Auto-refresh devices if plugged in / unplugged
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      await populateDeviceSelectors();
    });
  }

  // Mode Selection Tabs
  modePhotoBtn.addEventListener('click', () => setMode('photo'));
  modeVideoBtn.addEventListener('click', () => setMode('video'));
  modeAudioBtn.addEventListener('click', () => setMode('audio'));

  // Main Shutter Button
  btnShutter.addEventListener('click', handleShutterClick);

  // Keyboard Spacebar Shortcut
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      handleShutterClick();
    } else if (e.code === 'Escape') {
      if (!previewModal.classList.contains('hidden')) {
        closePreviewModal();
      } else if (!galleryDrawer.classList.contains('hidden')) {
        galleryDrawer.classList.add('hidden');
      } else if (!settingsDrawer.classList.contains('hidden')) {
        settingsDrawer.classList.add('hidden');
      }
    }
  });

  // Countdown Timer Selection
  btnTimerToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    timerMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!timerMenu.contains(e.target) && e.target !== btnTimerToggle) {
      timerMenu.classList.add('hidden');
    }
  });

  timerMenu.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      countdownSeconds = parseInt(btn.dataset.seconds, 10);
      timerMenu.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      timerLabel.textContent = countdownSeconds > 0 ? `${countdownSeconds}s` : 'Off';
      timerMenu.classList.add('hidden');
    });
  });

  // Mirror Toggle
  btnToggleMirror.addEventListener('click', () => {
    isMirrored = !isMirrored;
    viewfinder.classList.toggle('mirrored', isMirrored);
    btnToggleMirror.classList.toggle('active', isMirrored);
    chkMirrorVideo.checked = isMirrored;
    showToast(isMirrored ? 'Mirroring enabled' : 'Mirroring disabled');
  });

  chkMirrorVideo.addEventListener('change', (e) => {
    isMirrored = e.target.checked;
    viewfinder.classList.toggle('mirrored', isMirrored);
    btnToggleMirror.classList.toggle('active', isMirrored);
  });

  // Framing Grid Toggle
  btnToggleGrid.addEventListener('click', () => {
    isGridVisible = !isGridVisible;
    framingGrid.classList.toggle('hidden', !isGridVisible);
    btnToggleGrid.classList.toggle('active', isGridVisible);
    chkGridLines.checked = isGridVisible;
  });

  chkGridLines.addEventListener('change', (e) => {
    isGridVisible = e.target.checked;
    framingGrid.classList.toggle('hidden', !isGridVisible);
    btnToggleGrid.classList.toggle('active', isGridVisible);
  });

  // Picture in Picture Toggle
  btnTogglePiP.addEventListener('click', async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && previewVideo) {
        await previewVideo.requestPictureInPicture();
      } else {
        showToast('Picture in Picture is not supported in this browser.');
      }
    } catch (err) {
      console.warn('PiP error:', err);
      showToast('Could not enter Picture-in-Picture: ' + err.message);
    }
  });

  // Flip Camera Button
  btnFlipCamera.addEventListener('click', async () => {
    if (isRecording) {
      showToast('Please stop recording before switching cameras.');
      return;
    }

    try {
      streamStatusBadge.textContent = 'Switching...';
      streamStatusBadge.className = 'status-badge';

      const stream = await camera.flipCamera();
      await attachStream(stream);
      await populateDeviceSelectors();

      const info = camera.getVideoInfo();
      const label = info?.label ? `Switched to ${info.label}` : 'Camera switched';
      showToast(label);
    } catch (err) {
      console.error('Flip camera error:', err);
      showToast('Could not switch camera: ' + err.message);
    } finally {
      streamStatusBadge.textContent = 'Live';
      streamStatusBadge.className = 'status-badge live';
    }
  });

  // Mute / Unmute Microphone
  btnToggleMic.addEventListener('click', () => {
    const nextAudioMuted = !camera.isAudioMuted;
    camera.setAudioEnabled(!nextAudioMuted);
    btnToggleMic.classList.toggle('muted', nextAudioMuted);
    micIconOn.classList.toggle('hidden', nextAudioMuted);
    micIconOff.classList.toggle('hidden', !nextAudioMuted);
    showToast(nextAudioMuted ? 'Microphone muted' : 'Microphone unmuted');
  });

  // Settings Drawer Toggle
  btnOpenSettings.addEventListener('click', () => settingsDrawer.classList.remove('hidden'));
  btnCloseSettings.addEventListener('click', () => settingsDrawer.classList.add('hidden'));
  settingsBackdrop.addEventListener('click', () => settingsDrawer.classList.add('hidden'));

  // Camera Selector in Settings Drawer
  selectCamera.addEventListener('change', async (e) => {
    if (isRecording) {
      showToast('Please stop recording before switching cameras.');
      return;
    }

    try {
      streamStatusBadge.textContent = 'Switching...';
      streamStatusBadge.className = 'status-badge';

      const stream = await camera.switchCamera(e.target.value);
      await attachStream(stream);
      await populateDeviceSelectors();
      showToast('Switched camera');
    } catch (err) {
      console.error('Switch camera error:', err);
      showToast('Failed to switch camera: ' + err.message);
    } finally {
      streamStatusBadge.textContent = 'Live';
      streamStatusBadge.className = 'status-badge live';
    }
  });

  // Microphone Selector in Settings Drawer
  selectMicrophone.addEventListener('change', async (e) => {
    if (isRecording) {
      showToast('Please stop recording before switching microphones.');
      return;
    }

    try {
      const stream = await camera.switchMicrophone(e.target.value);
      await attachStream(stream);
      await populateDeviceSelectors();
      showToast('Switched microphone');
    } catch (err) {
      console.error('Switch mic error:', err);
      showToast('Failed to switch microphone: ' + err.message);
    }
  });

  // Resolution Preset Selector
  selectResolution.addEventListener('change', async (e) => {
    if (isRecording) {
      showToast('Please stop recording before changing resolution.');
      return;
    }

    try {
      streamStatusBadge.textContent = 'Updating...';
      const stream = await camera.setResolution(e.target.value);
      await attachStream(stream);
      setTimeout(updateResolutionDisplay, 200);
      showToast(`Resolution set to ${e.target.value}`);
    } catch (err) {
      console.error('Set resolution error:', err);
      showToast('Failed to set resolution: ' + err.message);
    } finally {
      streamStatusBadge.textContent = 'Live';
      streamStatusBadge.className = 'status-badge live';
    }
  });

  // Sound Effects Toggle
  chkSoundEffects.addEventListener('change', (e) => {
    audioController.setSoundEnabled(e.target.checked);
  });

  // Gallery Drawer Toggle
  btnOpenGallery.addEventListener('click', () => {
    renderGalleryGrid(gallery.getItems());
    galleryDrawer.classList.remove('hidden');
  });
  btnCloseGallery.addEventListener('click', () => galleryDrawer.classList.add('hidden'));
  galleryBackdrop.addEventListener('click', () => galleryDrawer.classList.add('hidden'));

  // Preview Modal Handlers
  btnClosePreviewModal.addEventListener('click', closePreviewModal);
  previewModalBackdrop.addEventListener('click', closePreviewModal);

  btnDownloadMedia.addEventListener('click', () => {
    if (currentPreviewItemId) {
      gallery.downloadItem(currentPreviewItemId);
      showToast('Download started');
    }
  });

  btnDeleteMedia.addEventListener('click', () => {
    if (currentPreviewItemId) {
      gallery.deleteItem(currentPreviewItemId);
      closePreviewModal();
      showToast('Item deleted');
    }
  });

  // Retry Camera Button in Error State
  btnRetryCamera.addEventListener('click', () => {
    initCamera();
  });
}

// Start Application
setupEventListeners();
initCamera();
