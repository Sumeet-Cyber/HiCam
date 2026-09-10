/**
 * Media Recorder Module
 * Handles recording video with audio or standalone audio using the browser's MediaRecorder API.
 * Supports aspect ratio cropping (1:1, 16:9, 9:16, 4:3, 3:4) via canvas stream rendering.
 */

import { calculateCrop } from './capture.js';

export class CanvasStreamRenderer {
  constructor(videoEl, aspectRatio = 'native', mirrored = false) {
    this.videoEl = videoEl;
    this.aspectRatio = aspectRatio;
    this.mirrored = mirrored;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.active = false;
    this.animId = null;
    this.stream = null;
  }

  start() {
    this.active = true;
    const rawW = this.videoEl.videoWidth || 1280;
    const rawH = this.videoEl.videoHeight || 720;
    const initialCrop = calculateCrop(rawW, rawH, this.aspectRatio);

    this.canvas.width = initialCrop.dWidth;
    this.canvas.height = initialCrop.dHeight;

    const renderLoop = () => {
      if (!this.active) return;

      if (this.videoEl && this.videoEl.readyState >= 2) {
        const vw = this.videoEl.videoWidth || 1280;
        const vh = this.videoEl.videoHeight || 720;
        const crop = calculateCrop(vw, vh, this.aspectRatio);

        if (this.canvas.width !== crop.dWidth || this.canvas.height !== crop.dHeight) {
          this.canvas.width = crop.dWidth;
          this.canvas.height = crop.dHeight;
        }

        this.ctx.save();
        if (this.mirrored) {
          this.ctx.translate(crop.dWidth, 0);
          this.ctx.scale(-1, 1);
        }
        this.ctx.drawImage(
          this.videoEl,
          crop.sx,
          crop.sy,
          crop.sWidth,
          crop.sHeight,
          0,
          0,
          crop.dWidth,
          crop.dHeight
        );
        this.ctx.restore();
      }

      this.animId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    if (typeof this.canvas.captureStream === 'function') {
      this.stream = this.canvas.captureStream(30);
    }
    return this.stream;
  }

  stop() {
    this.active = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        try { track.stop(); } catch (e) {}
      });
      this.stream = null;
    }
  }
}

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
    this.canvasRenderer = null;
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
   * @param {Object} options { aspectRatio: string, videoEl: HTMLVideoElement, mirrored: boolean, onDurationTick, onError }
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
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0) {
        throw new Error('No audio track available for audio recording. Please enable microphone.');
      }
      recordingStream = new MediaStream(audioTracks);
    } else {
      mimeType = MediaRecordingManager.getSupportedVideoMimeType();

      // If a custom aspect ratio or mirrored recording is requested and videoEl is provided:
      const needsCanvasRender = options.videoEl && (options.aspectRatio && options.aspectRatio !== 'native' || options.mirrored);
      if (needsCanvasRender) {
        this.canvasRenderer = new CanvasStreamRenderer(
          options.videoEl,
          options.aspectRatio || 'native',
          Boolean(options.mirrored)
        );
        const canvasStream = this.canvasRenderer.start();

        if (canvasStream) {
          const combinedStream = new MediaStream();
          canvasStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));
          stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
          recordingStream = combinedStream;
        }
      }
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
        this._cleanupCanvasRenderer();
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

      // Request data every 1000ms
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
        this._cleanupCanvasRenderer();

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
        this._cleanupCanvasRenderer();
        reject(err);
      }
    });
  }

  _cleanupCanvasRenderer() {
    if (this.canvasRenderer) {
      this.canvasRenderer.stop();
      this.canvasRenderer = null;
    }
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
