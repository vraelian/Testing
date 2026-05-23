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
            const overlay = document.getElementById('fmv-cinematic-overlay');
            const container = document.getElementById('fmv-video-container');
            const skipBtn = document.getElementById('fmv-skip-btn');

            // Fail-safe: Prevent soft-locking the simulation if DOM elements are missing
            if (!overlay || !container || !skipBtn) {
                console.error('[CinematicService] Critical DOM infrastructure missing. Verify index.html injections.');
                resolve(); 
                return;
            }

            // 1. Construct the Video Element
            const video = document.createElement('video');
            video.src = videoPath;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.setAttribute('disablePictureInPicture', '');
            
            container.appendChild(video);

            // Mutex to prevent double-resolutions if multiple events fire concurrently
            let isResolved = false;

            // 2. Garbage Collection & Resolution Protocol (ADR-048)
            const cleanupAndResolve = () => {
                if (isResolved) return;
                isResolved = true;

                // Initiate CSS fade out sequence
                overlay.classList.remove('active');
                skipBtn.classList.remove('active');

                // Await CSS transition completion (0.5s mapped in modal-cinematics.css) before hardware wipe
                setTimeout(() => {
                    // Aggressive iOS WKWebView hardware decoder wipe
                    video.pause();
                    video.removeAttribute('src');
                    video.load(); // Flushes the active video buffer from RAM
                    video.remove(); // Severs the DOM node completely
                    
                    // Listener teardown to prevent memory leaks on the persistent parent DOM overlay
                    overlay.removeEventListener('pointerdown', handleOverlayTap);
                    skipBtn.removeEventListener('click', handleSkipClick);
                    
                    resolve();
                }, 500); 
            };

            // 3. Event Handlers
            const handleOverlayTap = (e) => {
                if (e.target !== skipBtn && !skipBtn.classList.contains('active')) {
                    skipBtn.classList.add('active');
                }
            };

            const handleSkipClick = (e) => {
                e.stopPropagation(); // Halt bubbling to prevent triggering handleOverlayTap
                e.preventDefault();  // Safety protocol (ADR-026)
                cleanupAndResolve();
            };

            // Bind contextual listeners
            overlay.addEventListener('pointerdown', handleOverlayTap);
            skipBtn.addEventListener('click', handleSkipClick);
            video.addEventListener('ended', cleanupAndResolve);
            
            // CRITICAL FIX: Prevent hanging at black if video asset is missing (404)
            video.addEventListener('error', (e) => {
                console.warn('[CinematicService] Video failed to load or encountered an error. Skipping.', e);
                cleanupAndResolve();
            });

            // 4. Execution Sequence
            overlay.classList.add('active');
            
            video.play().catch(error => {
                console.warn('[CinematicService] Playback rejected by OS.', error);
                cleanupAndResolve();
            });
        });
    }
}

export default CinematicService;