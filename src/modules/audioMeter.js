/**
 * AudioMeter & Sound Effects Module
 * Handles real-time microphone volume visualization and synthesized UI sound effects
 * using the Web Audio API without needing external sound files.
 */

export class AudioController {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.animationId = null;
    this.soundEnabled = true;
  }

  /**
   * Initializes or resumes AudioContext and attaches to media stream
   * @param {MediaStream} stream 
   * @param {Function} onLevelChange Callback receiving normalized volume level (0.0 to 1.0)
   */
  startLevelMeter(stream, onLevelChange) {
    this.stopLevelMeter();

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks || audioTracks.length === 0) {
      if (onLevelChange) onLevelChange(0);
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.6;

      this.source = this.audioCtx.createMediaStreamSource(stream);
      this.source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      const update = () => {
        if (!this.analyser) return;

        this.analyser.getByteFrequencyData(this.dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += this.dataArray[i];
        }
        const average = sum / bufferLength;
        // Normalize 0..255 to 0..1 with non-linear boost for visual responsiveness
        const normalized = Math.min(1, Math.pow(average / 128, 1.2));

        if (onLevelChange) {
          onLevelChange(normalized);
        }

        this.animationId = requestAnimationFrame(update);
      };

      update();
    } catch (err) {
      console.warn('Could not initialize audio visualizer:', err);
    }
  }

  /**
   * Stops the volume meter animation and disconnects nodes
   */
  stopLevelMeter() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {}
      this.source = null;
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch (e) {}
      this.analyser = null;
    }
  }

  /**
   * Ensure AudioContext is ready for synthesis
   */
  _ensureAudioContext() {
    if (!this.soundEnabled) return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Plays a crisp synthesized mechanical camera shutter click
   */
  playShutterSound() {
    const ctx = this._ensureAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Noise click (aperture blade sound)
      const bufferSize = ctx.sampleRate * 0.05;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1200, now);
      noiseFilter.Q.setValueAtTime(3, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      whiteNoise.start(now);

      // Low mechanical thud
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.06);

      oscGain.gain.setValueAtTime(0.4, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch (e) {
      console.warn('Failed to play shutter sound:', e);
    }
  }

  /**
   * Plays a short high beep for countdown ticks
   * @param {boolean} isFinal If true, plays a higher pitch for zero/capture
   */
  playBeep(isFinal = false) {
    const ctx = this._ensureAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isFinal ? 1200 : 700, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + (isFinal ? 0.18 : 0.08));

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + (isFinal ? 0.2 : 0.1));
    } catch (e) {
      console.warn('Failed to play beep:', e);
    }
  }

  /**
   * Plays recording start beep (ascending tones)
   */
  playRecordStartSound() {
    const ctx = this._ensureAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.setValueAtTime(880, now + 0.08);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.setValueAtTime(0.25, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } catch (e) {
      console.warn('Failed to play start sound:', e);
    }
  }

  /**
   * Plays recording stop beep (descending tones)
   */
  playRecordStopSound() {
    const ctx = this._ensureAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(440, now + 0.08);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.setValueAtTime(0.2, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } catch (e) {
      console.warn('Failed to play stop sound:', e);
    }
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = Boolean(enabled);
  }
}
