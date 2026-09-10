/**
 * Photo Capture Module
 * Captures high-resolution still frames from HTMLVideoElement onto Canvas,
 * handling mirroring, flash animations, and countdown timers.
 */

export class PhotoCapturer {
  constructor() {
    this.countdownTimer = null;
  }

  /**
   * Captures the current frame from video element
   * @param {HTMLVideoElement} videoEl
   * @param {Object} options { mirrored: boolean, format: 'image/png' | 'image/jpeg', quality: number }
   * @returns {Promise<{ blob: Blob, dataUrl: string, width: number, height: number }>}
   */
  async captureFrame(videoEl, options = {}) {
    const { mirrored = true, format = 'image/png', quality = 0.95 } = options;

    if (!videoEl || videoEl.readyState < 2) {
      throw new Error('Video stream is not ready for capture');
    }

    const width = videoEl.videoWidth || 1280;
    const height = videoEl.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to create canvas 2D rendering context');
    }

    // Apply mirroring if requested
    if (mirrored) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(videoEl, 0, 0, width, height);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to generate image blob from canvas'));
          return;
        }

        const dataUrl = canvas.toDataURL(format, quality);
        resolve({
          blob,
          dataUrl,
          width,
          height,
        });
      }, format, quality);
    });
  }

  /**
   * Runs a countdown timer before triggering the capture callback
   * @param {number} seconds 
   * @param {Function} onTick Callback for each remaining second
   * @returns {Promise<void>}
   */
  startCountdown(seconds, onTick) {
    return new Promise((resolve, reject) => {
      if (seconds <= 0) {
        if (onTick) onTick(0);
        resolve();
        return;
      }

      let remaining = seconds;
      if (onTick) onTick(remaining);

      this.cancelCountdown();

      this.countdownTimer = setInterval(() => {
        remaining -= 1;
        if (onTick) onTick(remaining);

        if (remaining <= 0) {
          this.cancelCountdown();
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * Cancel ongoing countdown if user cancels or switches modes
   */
  cancelCountdown() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }
}
