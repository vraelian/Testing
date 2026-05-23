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
            // 1. NATIVE IOS BRIDGE PRIORITY
            // Perfectly mirrors the proven architecture of the Intro Cinematic.
            if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.iosPlayCinematic) {
                console.log(`[CinematicService] Delegating playback to native iOS layer: ${videoPath}`);
                
                // Extract filename without extension to match Swift AVPlayer expectations
                // e.g., 'assets/images/video/act_0_audita.mp4' -> 'act_0_audita'
                const filename = videoPath.split('/').pop().split('.')[0];
                
                window.onCinematicComplete = () => {
                    delete window.onCinematicComplete;
                    resolve();
                };
                
                window.webkit.messageHandlers.iosPlayCinematic.postMessage(filename);
                return;
            }

            // 2. HTML5 BROWSER FALLBACK
            const overlay = document.getElementById('fmv-cinematic-overlay');
            const container = document.getElementById('fmv-video-container');
            const skipBtn = document.getElementById('fmv-skip-btn');

            // Fail-safe: Prevent soft-locking the simulation if DOM elements are missing
            if (!overlay || !container || !skipBtn) {
                console.error('[CinematicService] Critical DOM infrastructure missing. Verify index.html injections.');
                resolve(); 
                return;
            }

            const video = document.createElement('video');
            video.src = videoPath;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.setAttribute('disablePictureInPicture', '');
            
            container.appendChild(video);

            let isResolved = false;

            const cleanupAndResolve = () => {
                if (isResolved) return;
                isResolved = true;

                // Initiate CSS fade out sequence
                overlay.classList.remove('active');
                skipBtn.classList.remove('active');

                // Await CSS transition completion (0.5s mapped in modal-cinematics.css) before hardware wipe
                setTimeout(() => {
                    video.pause();
                    video.removeAttribute('src');
                    video.load(); 
                    video.remove(); 
                    
                    overlay.removeEventListener('pointerdown', handleOverlayTap);
                    skipBtn.removeEventListener('click', handleSkipClick);
                    
                    resolve();
                }, 500); 
            };

            const handleOverlayTap = (e) => {
                if (e.target !== skipBtn && !skipBtn.classList.contains('active')) {
                    skipBtn.classList.add('active');
                }
            };

            const handleSkipClick = (e) => {
                e.stopPropagation(); 
                e.preventDefault();  
                cleanupAndResolve();
            };

            overlay.addEventListener('pointerdown', handleOverlayTap);
            skipBtn.addEventListener('click', handleSkipClick);
            video.addEventListener('ended', cleanupAndResolve);
            
            // CRITICAL FIX: Prevent hanging at black if video asset is missing (404)
            video.addEventListener('error', (e) => {
                console.warn('[CinematicService] Video failed to load or encountered an error. Skipping.', e);
                cleanupAndResolve();
            });

            overlay.classList.add('active');
            
            video.play().catch(error => {
                console.warn('[CinematicService] Playback rejected by OS.', error);
                cleanupAndResolve();
            });
        });
    }
}

export default CinematicService;