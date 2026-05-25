// js/services/ui/CinematicService.js

/**
 * CinematicService
 * Orchestrates the lifecycle, playback, and strict memory garbage collection of 
 * full-screen Full Motion Video (FMV) cinematic overlays.
 * * ARCHITECTURAL NOTE: This service operates completely outside the jurisdiction 
 * of the standard UIManager render cycle to prevent layout thrashing and 
 * state-driven DOM wipes during critical narrative sequences. It complies strictly 
 * with ADR-048 regarding memory leak prevention on iOS targets.
 */

/**
 * ////////////////////////////////////////////////
 * ============================================================================
 * FMV CINEMATIC ASSET GUIDELINES (iOS WKWebView Golden Standard)
 * ============================================================================
 * To ensure flawless playback, zero frame drops, and absolute compliance with 
 * iOS's strict WKWebView memory ceilings, all pre-rendered narrative videos 
 * must be exported using the following optimized, mobile-first profile:
 *
 * [1] Container / Format: .mp4
 * - Universally hardware-accelerated on iOS. Avoid .webm or .mkv.
 *
 * [2] Video Codec: H.264 (or H.265 / HEVC)
 * - H.264 is the safest bet for maximum compatibility and low latency. 
 * H.265 yields smaller files but is slightly heavier on initial decode.
 *
 * [3] Resolution: 1080 x 1920 (Vertical HD)
 * - Native 9:16 portrait ratio. Fits large screens perfectly. 
 * - CSS `object-fit: cover` handles graceful cropping on shorter devices.
 * - STRICT CONSTRAINT: Do NOT render in 4K (2160x3840). The visual gain 
 * is negligible, but it will bloat RAM and trigger a silent OS crash.
 *
 * [4] Framerate: 30 FPS (or 24 FPS)
 * - Provides a cinematic look while preserving processing power for the 
 * background simulation loop. Avoid 60 FPS for full-screen video.
 *
 * [5] Target Bitrate: VBR, 1 Pass @ ~3.0 to 5.0 Mbps
 * - Variable Bitrate ensures simple frames (deep space) save data. 
 * - At 5 Mbps, a 10-second clip weighs roughly 5MB to 8MB.
 *
 * [6] Audio Profile: AAC format, Stereo, 128 kbps, 48000 Hz
 * - Standard, highly compressed native web audio.
 *
 * [7] Standard File Pathing: 
 * - Store assets in: `assets/images/video/`
 * - Reference relatively (e.g., `cinematicPath: 'assets/images/video/scene1.mp4'`)
 * ============================================================================
 */ ////////////////////////////////////////////////

class CinematicService {
    /**
     * Initiates a blocking, full-screen video playback sequence.
     * The game loop should use 'await CinematicService.playVideo(path)' to halt logic 
     * until this promise resolves.
     * * @param {string} videoPath - The relative path to the .mp4 asset.
     * @returns {Promise<void>} Resolves when the video completes natively or is skipped.
     */
    static playVideo(videoPath) {
        return new Promise((resolve) => {
            // 1. Construct the Dynamic DOM Infrastructure
            const container = document.createElement('div');
            container.id = 'dynamic-cinematic-overlay';
            Object.assign(container.style, {
                position: 'fixed',
                inset: '0',
                zIndex: '100000', // Forces rendering over the EventControl blackout layer
                backgroundColor: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: '0',
                transition: 'opacity 0.5s ease-in-out'
            });

            // Dynamic CSS injection to aggressively suppress native OS media player controls bleeding into the UI
            const styleBlock = document.createElement('style');
            styleBlock.textContent = `
                #dynamic-cinematic-overlay video::-webkit-media-controls {
                    display: none !important;
                }
            `;
            container.appendChild(styleBlock);

            // Explicit WKWebView attributes force inline playback, preventing the native iOS 
            // media player from taking full-screen control and breaking the SPA context.
            const video = document.createElement('video');
            video.src = videoPath;
            video.controls = false; // Strictly enforce no native media controls
            video.playsInline = true; // Hard-lock property
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.setAttribute('disablePictureInPicture', '');
            Object.assign(video.style, {
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                pointerEvents: 'none' // Let interactions pass to the wrapper for skip detection
            });

            const skipBtn = document.createElement('button');
            skipBtn.innerHTML = 'SKIP SEQUENCE';
            skipBtn.className = 'btn';
            Object.assign(skipBtn.style, {
                position: 'absolute',
                bottom: 'calc(env(safe-area-inset-bottom, 20px) + 20px)',
                right: '20px',
                zIndex: '100001',
                opacity: '0',
                pointerEvents: 'none',
                transition: 'opacity 0.3s ease',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.8)',
                textTransform: 'uppercase'
            });

            container.appendChild(video);
            container.appendChild(skipBtn);
            document.body.appendChild(container);

            // Force reflow and initiate CSS fade-in
            void container.offsetWidth;
            container.style.opacity = '1';

            // Mutex to prevent double-resolutions if multiple events fire concurrently
            let isResolved = false;
            let skipTimeout;
            let lastTapTime = 0;
            let tapCount = 0;

            // 2. Garbage Collection & Resolution Protocol (ADR-048)
            const cleanupAndResolve = () => {
                if (isResolved) return;
                isResolved = true;

                clearTimeout(skipTimeout);

                // Initiate CSS fade out sequence
                container.style.opacity = '0';
                skipBtn.style.opacity = '0';

                // Await CSS transition completion before hardware wipe
                setTimeout(() => {
                    // Aggressive iOS WKWebView hardware decoder wipe
                    video.pause();
                    video.removeAttribute('src');
                    video.load(); // Flushes the active video buffer from RAM
                    video.remove(); // Severs the DOM node completely
                    
                    // Listener teardown to prevent memory leaks
                    container.removeEventListener('pointerdown', handleOverlayTap);
                    skipBtn.removeEventListener('click', handleSkipClick);
                    
                    if (container.parentNode) {
                        container.parentNode.removeChild(container);
                    }
                    
                    resolve();
                }, 500); 
            };

            // 3. Event Handlers
            const handleOverlayTap = (e) => {
                // Ignore taps directly on the skip button to prevent event overlap,
                // utilize a double-tap requirement to prevent accidental UI triggers.
                if (e.target !== skipBtn && skipBtn.style.opacity === '0') {
                    const now = Date.now();
                    if (now - lastTapTime < 3000) {
                        tapCount++;
                    } else {
                        tapCount = 1;
                    }
                    lastTapTime = now;

                    if (tapCount >= 2) {
                        skipBtn.style.opacity = '1';
                        skipBtn.style.pointerEvents = 'auto';
                        
                        skipTimeout = setTimeout(() => {
                            skipBtn.style.opacity = '0';
                            skipBtn.style.pointerEvents = 'none';
                            tapCount = 0; // Reset internal tap registry on fade
                        }, 3000);
                    }
                }
            };

            const handleSkipClick = (e) => {
                e.stopPropagation(); // Halt bubbling to prevent triggering handleOverlayTap
                e.preventDefault();  // Safety protocol (ADR-026)
                cleanupAndResolve();
            };

            // Bind contextual listeners
            container.addEventListener('pointerdown', handleOverlayTap);
            skipBtn.addEventListener('click', handleSkipClick);
            video.addEventListener('ended', cleanupAndResolve);
            video.addEventListener('error', () => {
                console.warn(`[CinematicService] Video failed to load or play: ${videoPath}`);
                cleanupAndResolve();
            });

            // 4. Execution Sequence
            // A catch block is mandatory; if iOS strictly blocks playback due to an unfulfilled 
            // user-gesture policy, it will throw an error. Resolving immediately prevents an infinite hang.
            video.play().catch(error => {
                console.warn('[CinematicService] Playback rejected by OS. Missing user gesture context?', error);
                cleanupAndResolve();
            });
        });
    }
}

export default CinematicService;