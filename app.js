(function (global) {
  'use strict';

  const RADIUS = 108;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const MIN_MINUTES = 1;
  const MAX_MINUTES = 180;
  const DEFAULT_MINUTES = 25;
  const MS_PER_MINUTE = 60000;

  /**
   * Clamp minute input into the allowed [MIN_MINUTES, MAX_MINUTES] range.
   */
  function clampMinutes(value) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return DEFAULT_MINUTES;
    return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, parsed));
  }

  /**
   * Compute display minutes (ceiling so 0:59 shows 1 and 0:00 shows 0) and ring ratio.
   */
  function computeProgress(remainingMs, totalDurationMs) {
    const clampedMs = Math.max(0, remainingMs);
    const displayMinutes = clampedMs === 0 ? 0 : Math.ceil(clampedMs / MS_PER_MINUTE);
    const ratio = totalDurationMs > 0 ? Math.min(1, clampedMs / totalDurationMs) : 0;
    return {
      remainingMs: clampedMs,
      displayMinutes,
      ratio,
      strokeLength: ratio * CIRCUMFERENCE,
    };
  }

  /**
   * Parse optional URL query parameters for Notion embed customization.
   */
  function parseConfig(search) {
    const params = new URLSearchParams(search || '');
    const minutesParam = params.get('minutes') || params.get('m');
    const theme = params.get('theme');
    const bg = params.get('bg');
    const sound = params.get('sound');

    return {
      initialMinutes: minutesParam ? clampMinutes(minutesParam) : DEFAULT_MINUTES,
      theme: theme === 'dark' || theme === 'light' ? theme : null,
      transparentBg: bg === 'transparent',
      soundEnabled: sound !== 'off',
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      RADIUS,
      CIRCUMFERENCE,
      MIN_MINUTES,
      MAX_MINUTES,
      DEFAULT_MINUTES,
      clampMinutes,
      computeProgress,
      parseConfig,
    };
  }

  if (typeof document === 'undefined') {
    return;
  }

  const config = parseConfig(global.location ? global.location.search : '');

  if (config.theme) {
    document.documentElement.setAttribute('data-theme', config.theme);
  }
  if (config.transparentBg) {
    document.documentElement.setAttribute('data-bg', 'transparent');
  }

  const appEl = document.getElementById('timer-app');
  const ringProgressEl = document.getElementById('ring-progress');
  const minutesDisplayEl = document.getElementById('minutes-display');
  const btnMinus = document.getElementById('btn-minus');
  const btnPlus = document.getElementById('btn-plus');
  const btnPrimary = document.getElementById('btn-primary');
  const btnSecondary = document.getElementById('btn-secondary');

  let configuredMinutes = config.initialMinutes;
  let state = 'idle'; // 'idle' | 'running' | 'paused' | 'finished'
  let totalDurationMs = configuredMinutes * MS_PER_MINUTE;
  let endTimeMs = 0;
  let pausedRemainingMs = totalDurationMs;
  let rafId = null;
  let intervalId = null;
  let audioCtx = null;

  function unlockAudio() {
    if (!config.soundEnabled) return;
    const AudioCtx = global.AudioContext || global.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
  }

  function playCompletionChime() {
    if (!config.soundEnabled || !audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      const notes = [587.33, 880]; // D5 -> A5 gentle chime
      notes.forEach(function (freq, index) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const start = now + index * 0.16;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.12, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.65);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.7);
      });
    } catch (_err) {
      // Ignore audio failures inside restricted iframes
    }
  }

  function stopLoops() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function renderRingAndTime(remainingMs) {
    const progress = computeProgress(remainingMs, totalDurationMs);

    minutesDisplayEl.textContent = String(progress.displayMinutes);
    minutesDisplayEl.classList.toggle('is-three-digits', progress.displayMinutes >= 100);

    if (progress.remainingMs <= 0) {
      ringProgressEl.style.strokeDasharray = '0 ' + CIRCUMFERENCE;
      ringProgressEl.style.strokeOpacity = '0';
    } else {
      ringProgressEl.style.strokeDasharray = progress.strokeLength + ' ' + CIRCUMFERENCE;
      ringProgressEl.style.strokeOpacity = '1';
    }

    if (state === 'running') {
      document.title = progress.displayMinutes + ' min · Timebox Timer';
    } else if (state === 'paused') {
      document.title = progress.displayMinutes + ' min (Pause) · Timebox Timer';
    } else if (state === 'finished') {
      document.title = 'Fertig · Timebox Timer';
    } else {
      document.title = 'Timebox Timer';
    }
  }

  function syncUIState() {
    appEl.setAttribute('data-state', state);
    const isIdle = state === 'idle';

    btnMinus.disabled = !isIdle || configuredMinutes <= MIN_MINUTES;
    btnPlus.disabled = !isIdle || configuredMinutes >= MAX_MINUTES;
    btnMinus.tabIndex = isIdle ? 0 : -1;
    btnPlus.tabIndex = isIdle ? 0 : -1;
    btnMinus.setAttribute('aria-hidden', String(!isIdle));
    btnPlus.setAttribute('aria-hidden', String(!isIdle));

    if (state === 'idle') {
      btnPrimary.textContent = 'Start';
      btnSecondary.hidden = true;
    } else if (state === 'running') {
      btnPrimary.textContent = 'Pause';
      btnSecondary.hidden = false;
    } else if (state === 'paused') {
      btnPrimary.textContent = 'Weiter';
      btnSecondary.hidden = false;
    } else if (state === 'finished') {
      btnPrimary.textContent = 'Reset';
      btnSecondary.hidden = true;
    }
  }

  function tick() {
    if (state !== 'running') return;

    const remainingMs = endTimeMs - Date.now();
    if (remainingMs <= 0) {
      stopLoops();
      state = 'finished';
      pausedRemainingMs = 0;
      renderRingAndTime(0);
      syncUIState();
      playCompletionChime();
      return;
    }

    renderRingAndTime(remainingMs);
  }

  function scheduleAnimationFrame() {
    if (state !== 'running') return;
    rafId = requestAnimationFrame(function () {
      tick();
      if (state === 'running') {
        scheduleAnimationFrame();
      }
    });
  }

  function startLoops() {
    stopLoops();
    scheduleAnimationFrame();
    // Background fallback when requestAnimationFrame is throttled
    intervalId = setInterval(tick, 500);
  }

  function adjustMinutes(delta) {
    if (state !== 'idle') return;
    const next = clampMinutes(configuredMinutes + delta);
    if (next === configuredMinutes) return;

    configuredMinutes = next;
    totalDurationMs = configuredMinutes * MS_PER_MINUTE;
    pausedRemainingMs = totalDurationMs;
    renderRingAndTime(totalDurationMs);
    syncUIState();
  }

  function startTimer() {
    unlockAudio();
    totalDurationMs = configuredMinutes * MS_PER_MINUTE;
    endTimeMs = Date.now() + totalDurationMs;
    state = 'running';
    syncUIState();
    renderRingAndTime(totalDurationMs);
    startLoops();
  }

  function pauseTimer() {
    if (state !== 'running') return;
    pausedRemainingMs = Math.max(0, endTimeMs - Date.now());
    stopLoops();
    state = 'paused';
    renderRingAndTime(pausedRemainingMs);
    syncUIState();
  }

  function resumeTimer() {
    if (state !== 'paused') return;
    unlockAudio();
    endTimeMs = Date.now() + pausedRemainingMs;
    state = 'running';
    syncUIState();
    tick();
    startLoops();
  }

  function resetTimer() {
    stopLoops();
    state = 'idle';
    totalDurationMs = configuredMinutes * MS_PER_MINUTE;
    pausedRemainingMs = totalDurationMs;
    renderRingAndTime(totalDurationMs);
    syncUIState();
  }

  /**
   * Support both single clicks and press-and-hold repeat for + / - buttons.
   */
  function attachHoldButton(button, delta) {
    let holdTimeout = null;
    let repeatInterval = null;
    let pointerActive = false;

    function clearTimers() {
      if (holdTimeout !== null) {
        clearTimeout(holdTimeout);
        holdTimeout = null;
      }
      if (repeatInterval !== null) {
        clearInterval(repeatInterval);
        repeatInterval = null;
      }
      pointerActive = false;
    }

    button.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 || button.disabled || state !== 'idle') return;
      event.preventDefault();
      pointerActive = true;
      adjustMinutes(delta);

      holdTimeout = setTimeout(function () {
        if (!pointerActive || state !== 'idle') return;
        repeatInterval = setInterval(function () {
          if (!pointerActive || state !== 'idle') {
            clearTimers();
            return;
          }
          adjustMinutes(delta);
        }, 95);
      }, 360);
    });

    button.addEventListener('pointerup', clearTimers);
    button.addEventListener('pointercancel', clearTimers);
    button.addEventListener('pointerleave', clearTimers);

    // Keyboard activation (Enter / Space) triggers click without pointerdown
    button.addEventListener('click', function (event) {
      if (event.detail === 0) {
        adjustMinutes(delta);
      }
    });
  }

  attachHoldButton(btnMinus, -1);
  attachHoldButton(btnPlus, 1);

  btnPrimary.addEventListener('click', function () {
    if (state === 'idle') {
      startTimer();
    } else if (state === 'running') {
      pauseTimer();
    } else if (state === 'paused') {
      resumeTimer();
    } else if (state === 'finished') {
      resetTimer();
    }
  });

  btnSecondary.addEventListener('click', resetTimer);

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && state === 'running') {
      tick();
    }
  });

  global.addEventListener('focus', function () {
    if (state === 'running') {
      tick();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (state === 'idle') {
      if (event.key === 'ArrowUp' || event.key === 'ArrowRight' || event.key === '+') {
        event.preventDefault();
        adjustMinutes(1);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === '-') {
        event.preventDefault();
        adjustMinutes(-1);
      }
    }
  });

  // Initial render
  ringProgressEl.style.strokeDashoffset = '0';
  renderRingAndTime(totalDurationMs);
  syncUIState();
})(typeof window !== 'undefined' ? window : globalThis);
