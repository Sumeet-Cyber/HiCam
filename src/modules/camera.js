/**
 * Camera & Device Management Module
 * Wraps navigator.mediaDevices for stream acquisition, device enumeration,
 * resolution constraints, and dynamic track switching.
 */

export class CameraManager {
  constructor() {
    this.stream = null;
    this.currentVideoDeviceId = null;
    this.currentAudioDeviceId = null;
    this.targetResolution = '1080p'; // '720p', '1080p', '4k', '480p', 'default'
    this.facingMode = 'user'; // 'user' or 'environment'
    this.isVideoMuted = false;
    this.isAudioMuted = false;
  }

  /**
   * Check if getUserMedia is supported in current environment
   */
  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Check if current context is secure (HTTPS or localhost)
   */
  static isSecureContext() {
    return window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  }

  /**
   * Map resolution preset to MediaTrackConstraints width & height
   */
  _getResolutionConstraints() {
    switch (this.targetResolution) {
      case '4k':
        return { width: { ideal: 3840 }, height: { ideal: 2160 } };
      case '1080p':
        return { width: { ideal: 1920 }, height: { ideal: 1080 } };
      case '720p':
        return { width: { ideal: 1280 }, height: { ideal: 720 } };
      case '480p':
        return { width: { ideal: 640 }, height: { ideal: 480 } };
      default:
        return {};
    }
  }

  /**
   * Requests media stream with current constraints
   * Safely acquires the new stream BEFORE stopping old tracks to prevent preview freeze
   * @param {Object} options Override default constraints
   * @returns {Promise<MediaStream>}
   */
  async startStream(options = {}) {
    if (!CameraManager.isSupported()) {
      throw new Error('MediaDevices API is not supported in this browser. Please use a modern browser.');
    }

    const videoConstraints = options.video === false ? false : {
      ...this._getResolutionConstraints(),
      deviceId: this.currentVideoDeviceId ? { ideal: this.currentVideoDeviceId } : undefined,
      facingMode: !this.currentVideoDeviceId ? { ideal: this.facingMode } : undefined,
    };

    const audioConstraints = options.audio === false ? false : {
      deviceId: this.currentAudioDeviceId ? { ideal: this.currentAudioDeviceId } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    let newStream;
    try {
      newStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints,
      });
    } catch (err) {
      console.warn('Initial getUserMedia failed, attempting fallback constraints:', err);
      // Fallback: If ideal resolution or constraints failed, retry with basic video constraints
      if (this.targetResolution !== 'default' || this.currentVideoDeviceId) {
        this.targetResolution = 'default';
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: this.facingMode },
            },
            audio: audioConstraints,
          });
        } catch (fallbackErr) {
          console.error('Fallback stream acquisition also failed:', fallbackErr);
          throw fallbackErr;
        }
      } else {
        throw err;
      }
    }

    // Safely stop tracks on the PREVIOUS stream now that the new stream is ready
    const oldStream = this.stream;
    this.stream = newStream;
    if (oldStream) {
      oldStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {}
      });
    }

    // Update current device IDs based on active tracks
    const videoTrack = this.stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      if (settings.deviceId) this.currentVideoDeviceId = settings.deviceId;
    }

    const audioTrack = this.stream.getAudioTracks()[0];
    if (audioTrack) {
      const settings = audioTrack.getSettings();
      if (settings.deviceId) this.currentAudioDeviceId = settings.deviceId;
    }

    // Apply active mute states
    this.setVideoEnabled(!this.isVideoMuted);
    this.setAudioEnabled(!this.isAudioMuted);

    return this.stream;
  }

  /**
   * Get available cameras and microphones
   */
  async getDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return { cameras: [], microphones: [] };
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter(d => d.kind === 'videoinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${index + 1}`,
          groupId: d.groupId,
        }));

      const microphones = devices
        .filter(d => d.kind === 'audioinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${index + 1}`,
          groupId: d.groupId,
        }));

      return { cameras, microphones };
    } catch (err) {
      console.warn('Failed to enumerate devices:', err);
      return { cameras: [], microphones: [] };
    }
  }

  /**
   * Switch active camera
   */
  async switchCamera(deviceId) {
    this.currentVideoDeviceId = deviceId || null;
    return this.startStream();
  }

  /**
   * Switch active microphone
   */
  async switchMicrophone(deviceId) {
    this.currentAudioDeviceId = deviceId || null;
    return this.startStream();
  }

  /**
   * Flip camera:
   * - If multiple cameras exist, cycle to the next camera device.
   * - Otherwise, toggle facingMode (user <-> environment).
   */
  async flipCamera() {
    const { cameras } = await this.getDevices();
    if (cameras && cameras.length > 1) {
      const currentIndex = cameras.findIndex(c => c.deviceId === this.currentVideoDeviceId);
      const nextIndex = currentIndex === -1 ? 1 : (currentIndex + 1) % cameras.length;
      this.currentVideoDeviceId = cameras[nextIndex].deviceId;
      return this.startStream();
    } else {
      this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
      this.currentVideoDeviceId = null;
      return this.startStream();
    }
  }

  /**
   * Alias for backward compatibility
   */
  async flipFacingMode() {
    return this.flipCamera();
  }

  /**
   * Set resolution preset on the fly:
   * First attempts videoTrack.applyConstraints() for instant zero-restart change;
   * falls back to startStream() if needed.
   */
  async setResolution(resolution) {
    this.targetResolution = resolution;
    const constraints = this._getResolutionConstraints();

    if (this.stream) {
      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack && typeof videoTrack.applyConstraints === 'function') {
        try {
          await videoTrack.applyConstraints(constraints);
          return this.stream;
        } catch (e) {
          console.warn('videoTrack.applyConstraints failed, falling back to stream re-acquisition:', e);
        }
      }
      return this.startStream();
    }
  }

  /**
   * Enable/disable video track
   */
  setVideoEnabled(enabled) {
    this.isVideoMuted = !enabled;
    if (this.stream) {
      this.stream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Enable/disable audio track
   */
  setAudioEnabled(enabled) {
    this.isAudioMuted = !enabled;
    if (this.stream) {
      this.stream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Stops all active tracks on the stream
   */
  stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {}
      });
      this.stream = null;
    }
  }

  /**
   * Get active video track capabilities and settings
   */
  getVideoInfo() {
    if (!this.stream) return null;
    const track = this.stream.getVideoTracks()[0];
    if (!track) return null;

    const settings = track.getSettings();
    return {
      label: track.label,
      width: settings.width || 0,
      height: settings.height || 0,
      frameRate: settings.frameRate || 0,
      facingMode: settings.facingMode,
    };
  }
}
