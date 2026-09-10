/**
 * Media Recorder Module
 * Handles recording video with audio or standalone audio using the browser's MediaRecorder API.
 * Detects browser-supported MIME types automatically.
 */

export class MediaRecordingManager {
  constructor() {
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.state = 'inactive'; // 'inactive', 'recording', 'paused'
    this.startTime = 0;
    this.durationInterval = null;
    this.elapsedSeconds = 0;
    this.pausedSeconds = 0;
    this.pauseStartTime = 0;
  }

  /**
   * Check if MediaRecorder is supported
   */
  static isSupported() {
    return typeof window.MediaRecorder !== 'undefined';
  }

  /**
   * Determine best supported MIME type for video recording
   */
  static getSupportedVideoMimeType() {
    if (!MediaRecordingManager.isSupported()) return '';

    const candidateTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
    ];

    for (const type of candidateTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }

  /**
   * Determine best supported MIME type for audio recording
   */
  static getSupportedAudioMimeType() {
    if (!MediaRecordingManager.isSupported()) return '';

    const candidateTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/wav',
    ];

    for (const type of candidateTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }

  /**
   * Start recording
   * @param {MediaStream} stream 
   * @param {'video' | 'audio'} mode 
   * @param {Object} options 
   * @returns {Promise<void>}
   */
  startRecording(stream, mode = 'video', options = {}) {
    if (!MediaRecordingManager.isSupported()) {
      throw new Error('MediaRecorder API is not supported in this browser.');
    }

    if (this.state !== 'inactive') {
      throw new Error('A recording is already in progress.');
    }

    this.recordedChunks = [];
    let mimeType = '';
    let recordingStream = stream;

    if (mode === 'audio') {
      mimeType = MediaRecordingManager.getSupportedAudioMimeType();
      // Only record audio tracks if in audio mode
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0) {
        throw new Error('No audio track available for audio recording. Please enable microphone.');
      }
      recordingStream = new MediaStream(audioTracks);
    } else {
      mimeType = MediaRecordingManager.getSupportedVideoMimeType();
    }

    const recorderOptions = {};
    if (mimeType) {
      recorderOptions.mimeType = mimeType;
    }

    try {
      this.mediaRecorder = new MediaRecorder(recordingStream, recorderOptions);
    } catch (e) {
      console.warn(`Failed with mimeType ${mimeType}, falling back to default options:`, e);
      this.mediaRecorder = new MediaRecorder(recordingStream);
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    return new Promise((resolve, reject) => {
      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        this._stopDurationTimer();
        this.state = 'inactive';
        if (options.onError) options.onError(event.error);
        reject(event.error);
      };

      this.mediaRecorder.onstart = () => {
        this.state = 'recording';
        this.startTime = Date.now();
        this.elapsedSeconds = 0;
        this.pausedSeconds = 0;
        this._startDurationTimer(options.onDurationTick);
        resolve();
      };

      // Request data every 1000ms to preserve chunks in case of unexpected termination
      this.mediaRecorder.start(1000);
    });
  }

  /**
   * Pause recording
   */
  pause() {
    if (this.mediaRecorder && this.state === 'recording') {
      if (typeof this.mediaRecorder.pause === 'function') {
        this.mediaRecorder.pause();
        this.state = 'paused';
        this.pauseStartTime = Date.now();
        return true;
      }
    }
    return false;
  }

  /**
   * Resume recording
   */
  resume() {
    if (this.mediaRecorder && this.state === 'paused') {
      if (typeof this.mediaRecorder.resume === 'function') {
        this.mediaRecorder.resume();
        this.state = 'recording';
        this.pausedSeconds += Math.floor((Date.now() - this.pauseStartTime) / 1000);
        return true;
      }
    }
    return false;
  }

  /**
   * Stop recording and package into a final Blob
   * @returns {Promise<{ blob: Blob, duration: number, mimeType: string, extension: string }>}
   */
  stopRecording() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.state === 'inactive') {
        reject(new Error('No active recording to stop.'));
        return;
      }

      this._stopDurationTimer();

      const finalDuration = this.elapsedSeconds;
      const actualMimeType = this.mediaRecorder.mimeType || 'video/webm';

      this.mediaRecorder.onstop = () => {
        this.state = 'inactive';
        try {
          const blob = new Blob(this.recordedChunks, { type: actualMimeType });
          const isAudioOnly = actualMimeType.startsWith('audio');
          let extension = 'webm';
          if (actualMimeType.includes('mp4')) {
            extension = isAudioOnly ? 'm4a' : 'mp4';
          } else if (actualMimeType.includes('ogg')) {
            extension = 'ogg';
          } else if (actualMimeType.includes('wav')) {
            extension = 'wav';
          } else if (isAudioOnly) {
            extension = 'webm';
          }

          resolve({
            blob,
            duration: finalDuration,
            mimeType: actualMimeType,
            extension,
          });
        } catch (err) {
          reject(err);
        } finally {
          this.recordedChunks = [];
        }
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        reject(err);
      }
    });
  }

  _startDurationTimer(onTick) {
    this._stopDurationTimer();
    this.durationInterval = setInterval(() => {
      if (this.state === 'recording') {
        const totalElapsed = Math.floor((Date.now() - this.startTime) / 1000) - this.pausedSeconds;
        this.elapsedSeconds = Math.max(0, totalElapsed);
        if (onTick) {
          onTick(this.elapsedSeconds, this.formatDuration(this.elapsedSeconds));
        }
      }
    }, 500);
  }

  _stopDurationTimer() {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  /**
   * Format seconds to mm:ss or hh:mm:ss
   */
  formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const pad = (n) => String(n).padStart(2, '0');
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }
}
