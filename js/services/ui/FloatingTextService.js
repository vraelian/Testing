// js/services/ui/FloatingTextService.js
/**
 * @fileoverview Floating Transaction Vectors (Sample #20 WAAPI Implementation)
 * Provides GPU-accelerated floating HUD telemetry text for credit events and rewards.
 * 
 * Profiles:
 * - 'mission': Slower (2.0s), majestic upward drift (56px, [-31deg, +31deg]), deep +Z forward scale (0.60x -> 0.94x).
 * - 'regular': Snappy (1.0s), responsive drift (40px, [-45deg, +45deg]), tighter scale (0.50x -> 0.86x).
 */

/**
 * Configuration profiles for Orbital Trading floating text.
 */
export const TRANSACTION_PROFILES = {
  mission: {
    duration: 2000,
    distance: 56,
    coneHalfAngle: 31,     // [-31deg, +31deg] around Zenith
    startScale: 0.60,
    inScale: 0.668,
    sustainScale: 0.872,
    endScale: 0.94,
    inOffset: 0.20,        // 0.4s fade-in (20%)
    sustainOffset: 0.80    // 0.4s fade-out begins at 80%
  },
  regular: {
    duration: 1000,
    distance: 40,
    coneHalfAngle: 45,     // [-45deg, +45deg] around Zenith
    startScale: 0.50,
    inScale: 0.536,
    sustainScale: 0.698,
    endScale: 0.86,
    inOffset: 0.10,        // 0.1s fade-in (10%)
    sustainOffset: 0.55    // 0.45s fade-out begins at 55%
  }
};

/**
 * Parses color strings into RGB components.
 * Supports #hex, rgb(), rgba(), and key named color fallbacks.
 * 
 * @param {string} color 
 * @returns {{r: number, g: number, b: number} | null}
 */
export function parseColorToRgb(color) {
  if (!color || typeof color !== 'string') return null;
  const str = color.trim();

  // Hex formats (#rgb, #rrggbb, #rrggbbaa)
  if (str.startsWith('#')) {
    let hex = str.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        return { r, g, b };
      }
    }
  }

  // Functional rgb() or rgba()
  const rgbMatch = str.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10)
    };
  }

  // Common semantic named color mappings
  const namedColors = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    red: { r: 239, g: 68, b: 68 },
    green: { r: 74, g: 222, b: 128 },
    blue: { r: 96, g: 165, b: 250 },
    yellow: { r: 250, g: 204, b: 21 },
    purple: { r: 192, g: 132, b: 252 },
    cyan: { r: 77, g: 207, b: 213 }
  };
  const lower = str.toLowerCase();
  if (namedColors[lower]) {
    return namedColors[lower];
  }

  return null;
}

/**
 * Dynamically computes the Calibrated Sample #20 text shadow:
 * - 2-layer dark occlusion backing
 * - Crisp white core
 * - 1/3 glow baseline matching the specified color
 * 
 * @param {string} [color] 
 * @returns {string} CSS text-shadow value
 */
export function computeGlowShadow(color) {
  const rgb = parseColorToRgb(color);
  if (!rgb) {
    // Default Calibrated Cyan (#00f3ff) 1/3 glow baseline
    return '0 2px 4px rgba(0, 0, 0, 0.70), 0 4px 10px rgba(0, 0, 0, 0.70), 0 0 3px rgba(255, 255, 255, 1.00), 0 0 8px rgba(0, 243, 255, 1.00), 0 0 16px rgba(0, 243, 255, 0.47)';
  }
  return `0 2px 4px rgba(0, 0, 0, 0.70), 0 4px 10px rgba(0, 0, 0, 0.70), 0 0 3px rgba(255, 255, 255, 1.00), 0 0 8px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1.00), 0 0 16px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.47)`;
}

/**
 * Spawns a floating transaction credit text vector on the HUD.
 * 
 * @param {Object} options
 * @param {HTMLElement} [options.container] - Parent container element.
 * @param {string} [options.text='+1,234 C'] - Formatted currency or telemetry text.
 * @param {number} [options.x] - Spawn X coordinate in viewport pixels.
 * @param {number} [options.y] - Spawn Y coordinate in viewport pixels.
 * @param {string} [options.color] - Custom text color (retains color spec with adapted glow).
 * @param {'mission' | 'regular'} [options.type='regular'] - Transaction profile type.
 * @param {number} [options.duration] - Optional override duration in ms.
 * @param {boolean} [options.isHtml=false] - Whether text contains HTML formatting.
 * @returns {HTMLDivElement} The spawned element (auto-removes on finish).
 */
export function spawnFloatingTransaction({
  container = null,
  text = '+1,234 C',
  x = undefined,
  y = undefined,
  color = null,
  type = 'regular',
  duration = null,
  isHtml = false
} = {}) {
  const profileKey = (type === 'mission') ? 'mission' : 'regular';
  const cfg = TRANSACTION_PROFILES[profileKey];
  const animDuration = (typeof duration === 'number' && duration > 0) ? duration : cfg.duration;

  // Resolve target container defensively
  const targetContainer = container || document.getElementById('orbital-hud-overlay') || document.body;

  // Defensive coordinates with viewport clamping and NaN protection
  const winW = (typeof window !== 'undefined' && window.innerWidth) ? window.innerWidth : 800;
  const winH = (typeof window !== 'undefined' && window.innerHeight) ? window.innerHeight : 600;

  let spawnX = (typeof x === 'number' && !isNaN(x)) ? x : (winW / 2);
  let spawnY = (typeof y === 'number' && !isNaN(y)) ? y : (winH / 2);

  // Clamp within viewport margins so vector never clips outside boundaries
  spawnX = Math.max(30, Math.min(winW - 30, spawnX));
  spawnY = Math.max(40, Math.min(winH - 30, spawnY));

  // Compute stochastic launch angle within calibrated cone
  // 0 deg is zenith (straight up); negative is Port (left), positive is Starboard (right)
  const angle = (Math.random() * (cfg.coneHalfAngle * 2)) - cfg.coneHalfAngle;
  const rad = (angle * Math.PI) / 180;

  const totalDx = Math.sin(rad) * cfg.distance;
  const totalDy = -Math.cos(rad) * cfg.distance;

  // Intermediate displacement values at transition milestones
  const inDx = (totalDx * cfg.inOffset).toFixed(1);
  const inDy = (totalDy * cfg.inOffset).toFixed(1);
  const outDx = (totalDx * cfg.sustainOffset).toFixed(1);
  const outDy = (totalDy * cfg.sustainOffset).toFixed(1);
  const finalDx = totalDx.toFixed(1);
  const finalDy = totalDy.toFixed(1);

  // Instantiate lightweight DOM element
  const el = document.createElement('div');
  el.className = 'floating-credit-vector';
  
  if (isHtml) {
    el.innerHTML = text;
  } else {
    el.textContent = text;
  }

  el.style.left = `${spawnX}px`;
  el.style.top = `${spawnY}px`;

  // Preserve caller color specification while injecting Sample #20 calibrated 1/3 glow
  if (color) {
    el.style.color = color;
    el.style.textShadow = computeGlowShadow(color);
  }

  // Hardware-accelerated WAAPI Keyframe Pipeline
  const anim = el.animate(
    [
      {
        opacity: 0,
        transform: `translate3d(-50%, -50%, 0) scale(${cfg.startScale})`,
        offset: 0
      },
      {
        opacity: 1,
        transform: `translate3d(calc(-50% + ${inDx}px), calc(-50% + ${inDy}px), 0) scale(${cfg.inScale})`,
        offset: cfg.inOffset
      },
      {
        opacity: 1,
        transform: `translate3d(calc(-50% + ${outDx}px), calc(-50% + ${outDy}px), 0) scale(${cfg.sustainScale})`,
        offset: cfg.sustainOffset
      },
      {
        opacity: 0,
        transform: `translate3d(calc(-50% + ${finalDx}px), calc(-50% + ${finalDy}px), 0) scale(${cfg.endScale})`,
        offset: 1.0
      }
    ],
    {
      duration: animDuration,
      easing: 'linear',
      fill: 'forwards'
    }
  );

  targetContainer.appendChild(el);

  // Defensive idempotent garbage collection
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      if (anim) anim.cancel();
    } catch (_) {}
    if (el && el.parentNode) {
      el.remove();
    }
  };

  anim.onfinish = cleanup;
  anim.oncancel = cleanup;

  // Fallback cleanup in case WAAPI is throttled or tab is backgrounded
  setTimeout(cleanup, animDuration + 300);

  return el;
}
