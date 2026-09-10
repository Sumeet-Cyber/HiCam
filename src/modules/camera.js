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
    this.targetResolution = '1080p'; // '720p', '1080p', '4k', 'default'
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
        return true;
    }
  }

  /**
   * Requests media stream with current constraints
   * @param {Object} options Override default constraints
   * @returns {Promise<MediaStream>}
   */
  async startStream(options = {}) {
    if (!CameraManager.isSupported()) {
      throw new Error('MediaDevices API is not supported in this browser. Please use a modern browser.');
    }

    // Stop existing stream tracks
    this.stopStream();

    const videoConstraints = options.video === false ? false : {
      ...this._getResolutionConstraints(),
      deviceId: this.currentVideoDeviceId ? { exact: this.currentVideoDeviceId } : undefined,
      facingMode: !this.currentVideoDeviceId ? this.facingMode : undefined,
    };

    const audioConstraints = options.audio === false ? false : {
      deviceId: this.currentAudioDeviceId ? { exact: this.currentAudioDeviceId } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints,
      });

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

      // Apply initial mute states if set
      this.setVideoEnabled(!this.isVideoMuted);
      this.setAudioEnabled(!this.isAudioMuted);

      return this.stream;
    } catch (err) {
      console.error('Failed to get media stream:', err);
      // Fallback: If 1080p constraint failed, retry with basic video constraints
      if (this.targetResolution !== 'default' && (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError')) {
        console.warn('Retrying stream with default resolution constraints...');
        this.targetResolution = 'default';
        return this.startStream(options);
      }
      throw err;
    }
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
    this.currentVideoDeviceId = deviceId;
    return this.startStream();
  }

  /**
   * Switch active microphone
   */
  async switchMicrophone(deviceId) {
    this.currentAudioDeviceId = deviceId;
    return this.startStream();
  }

  /**
   * Toggle between front and back camera (for mobile/tablet devices)
   */
  async flipFacingMode() {
    this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    this.currentVideoDeviceId = null; // Clear explicit device ID to honor facingMode
    return this.startStream();
  }

  /**
   * Set resolution preset
   */
  async setResolution(resolution) {
    this.targetResolution = resolution;
    if (this.stream) {
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
