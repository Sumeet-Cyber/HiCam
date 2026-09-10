/**
 * Photo Capture Module
 * Captures high-resolution still frames from HTMLVideoElement onto Canvas,
 * handling mirroring, custom aspect ratio crops (1:1, 16:9, 9:16, 4:3, 3:4),
 * flash animations, and countdown timers.
 */

/**
 * Calculates centered crop coordinates and output dimensions for a given aspect ratio
 * Ensures even-pixel dimensions for maximum encoder & renderer compatibility.
 * @param {number} videoWidth 
 * @param {number} videoHeight 
 * @param {string|number} targetAspectRatio e.g. '1:1', '16:9', '9:16', '4:3', '3:4', 'native'
 * @returns {{ sx: number, sy: number, sWidth: number, sHeight: number, dWidth: number, dHeight: number }}
 */
export function calculateCrop(videoWidth, videoHeight, targetAspectRatio) {
  if (!targetAspectRatio || targetAspectRatio === 'native') {
    const evenW = Math.floor(videoWidth / 2) * 2;
    const evenH = Math.floor(videoHeight / 2) * 2;
    return {
      sx: 0,
      sy: 0,
      sWidth: evenW,
      sHeight: evenH,
      dWidth: evenW,
      dHeight: evenH,
    };
  }

  let ratio = 1;
  if (typeof targetAspectRatio === 'number') {
    ratio = targetAspectRatio;
  } else if (typeof targetAspectRatio === 'string') {
    const parts = targetAspectRatio.split(':').map(Number);
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
      ratio = parts[0] / parts[1];
    }
  }

  const srcRatio = videoWidth / videoHeight;
  let sWidth, sHeight;

  if (srcRatio > ratio) {
    // Source is wider than target: crop left & right
    sHeight = Math.floor(videoHeight / 2) * 2;
    sWidth = Math.floor((sHeight * ratio) / 2) * 2;
  } else {
    // Source is taller than target: crop top & bottom
    sWidth = Math.floor(videoWidth / 2) * 2;
    sHeight = Math.floor((sWidth / ratio) / 2) * 2;
  }

  const sx = Math.floor((videoWidth - sWidth) / 2);
  const sy = Math.floor((videoHeight - sHeight) / 2);

  return {
    sx,
    sy,
    sWidth,
    sHeight,
    dWidth: sWidth,
    dHeight: sHeight,
  };
}

export class PhotoCapturer {
  constructor() {
    this.countdownTimer = null;
  }

  /**
   * Captures the current frame from video element with aspect ratio crop
   * @param {HTMLVideoElement} videoEl
   * @param {Object} options { mirrored: boolean, aspectRatio: string, format: string, quality: number }
   * @returns {Promise<{ blob: Blob, dataUrl: string, width: number, height: number }>}
   */
  async captureFrame(videoEl, options = {}) {
    const {
      mirrored = true,
      aspectRatio = 'native',
      format = 'image/png',
      quality = 0.95,
    } = options;

    if (!videoEl || videoEl.readyState < 2) {
      throw new Error('Video stream is not ready for capture');
    }

    const rawWidth = videoEl.videoWidth || 1280;
    const rawHeight = videoEl.videoHeight || 720;

    const crop = calculateCrop(rawWidth, rawHeight, aspectRatio);

    const canvas = document.createElement('canvas');
    canvas.width = crop.dWidth;
    canvas.height = crop.dHeight;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to create canvas 2D rendering context');
    }

    // Apply mirroring if requested
    if (mirrored) {
      ctx.translate(crop.dWidth, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(
      videoEl,
      crop.sx,
      crop.sy,
      crop.sWidth,
      crop.sHeight,
      0,
      0,
      crop.dWidth,
      crop.dHeight
    );

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
          width: crop.dWidth,
          height: crop.dHeight,
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
