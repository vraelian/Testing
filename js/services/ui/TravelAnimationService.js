// js/services/ui/TravelAnimationService.js
import { DB } from '../../data/database.js';
import { AssetService } from '../AssetService.js';

export class TravelAnimationService {
    constructor(isMobile) {
        this.isMobile = isMobile;
        this.modal = document.getElementById('travel-animation-modal');
        this.gameContainer = document.getElementById('game-container');
        this.statusText = document.getElementById('travel-status-text');
        this.arrivalLore = document.getElementById('travel-arrival-lore');
        this.progressBar = document.getElementById('travel-progress-bar');
        this.progressContainer = document.getElementById('travel-progress-container');
        this.readoutContainer = document.getElementById('travel-readout-container');
        this.infoText = document.getElementById('travel-info-text');
        this.hullDamageText = document.getElementById('travel-hull-damage');
        this.confirmButton = document.getElementById('travel-confirm-button');
        
        // Canvas (Legacy) - Kept in DOM check but unused logic-wise
        this.canvas = document.getElementById('travel-canvas');
        
        this.animationFrame = null;

        // Ensure the DOM structure for the Cinematic Image view exists
        this._ensureDomStructure();
        
        this.imageElement = document.getElementById('travel-background-image');
        this.imageWrapper = document.getElementById('travel-image-wrapper');
    }

    /**
     * Injects the Cinematic Image DOM elements if they are missing from index.html.
     * This allows us to upgrade the visuals without modifying the monolithic HTML file directly.
     */
    _ensureDomStructure() {
        if (!document.getElementById('travel-image-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.id = 'travel-image-wrapper';
            
            const img = document.createElement('img');
            img.id = 'travel-background-image';
            img.alt = 'Destination';
            
            wrapper.appendChild(img);

            // Insert after the header panel, replacing/hiding the canvas visually
            const header = document.getElementById('travel-header-panel');
            if (header && header.nextSibling) {
                header.parentNode.insertBefore(wrapper, header.nextSibling);
            }
        }
    }

    play(from, to, travelInfo, totalHullDamagePercent, finalCallback) {
        this.modal.classList.remove('hidden');
        this.modal.classList.add('dismiss-disabled');

        const theme = to.navTheme || { gradient: 'linear-gradient(to right, #06b6d4, #67e8f9)', borderColor: '#06b6d4' };

        // Lighten the gradient for better visibility
        const lightenedGradient = this._lightenGradient(theme.gradient);
        this.progressBar.style.background = lightenedGradient;

        // Set the glow color for the progress bar
        this.progressBar.style.setProperty('--progress-glow-color', theme.borderColor);

        this._setupInitialState(to, travelInfo);
        this._startCinematicSequence(to);

        let startTime = null;
        const duration = 2500; // Duration of travel sequence

        const animate = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const elapsedTime = currentTime - startTime;
            let progress = Math.min(elapsedTime / duration, 1);

            // Ease-out cubic for the slow-down effect at the end
            if (progress > 0.8) {
                const normalized = (progress - 0.8) / 0.2;
                progress = 0.8 + (1 - Math.pow(1 - normalized, 3)) * 0.2;
            }

            // Only updating the progress bar width now; no canvas drawing
            this.progressBar.style.width = `${progress * 100}%`;

            if (progress < 1) {
                this.animationFrame = requestAnimationFrame(animate);
            } else {
                this._onArrival(to, travelInfo, totalHullDamagePercent, finalCallback);
            }
        };

        this.animationFrame = requestAnimationFrame(animate);

        this.confirmButton.onclick = () => {
            cancelAnimationFrame(this.animationFrame);
        
            this.modal.classList.add('modal-hiding');
            
            // Execute the callback to render the market screen *before* the fade-in starts.
            if (finalCallback) {
                finalCallback();
            }

            // A short delay to ensure the market screen is rendered before the fade-in starts.
            setTimeout(() => {
                this.gameContainer.classList.add('fade-in');
            }, 50); // Small buffer

            setTimeout(() => {
                this.modal.classList.add('hidden');
                this.modal.classList.remove('modal-hiding', 'dismiss-disabled');
                
                // Cleanup Cinematic State
                this.imageElement.classList.remove('travel-zoom-active');
                this.imageElement.style.opacity = 0;
            }, 1000); // 1s to match CSS transition
        };
    }

    _lightenGradient(gradientString) {
        const colorStops = gradientString.match(/#[0-9a-f]{6}|#[0-9a-f]{3}/ig);
        if (!colorStops) return gradientString;

        const lightenHex = (hex, percent) => {
            hex = hex.replace(/^#/, '');
            if (hex.length === 3) {
                hex = hex.split('').map(c => c + c).join('');
            }
            const num = parseInt(hex, 16);
            let r = (num >> 16) + percent;
            if (r > 255) r = 255;
            if (r < 0) r = 0;
            let b = ((num >> 8) & 0x00FF) + percent;
            if (b > 255) b = 255;
            if (b < 0) b = 0;
            let g = (num & 0x0000FF) + percent;
            if (g > 255) g = 255;
            if (g < 0) g = 0;
            return '#' + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
        };
        
        const lightenedColors = colorStops.map(color => lightenHex(color, 40));
        return `linear-gradient(to right, ${lightenedColors.join(', ')})`;
    }

    _setupInitialState(to, travelInfo) {
        this.statusText.textContent = `Traveling to ${to.name}...`;
        this.arrivalLore.textContent = '';
        this.arrivalLore.style.opacity = 0;
        this.readoutContainer.classList.add('hidden');
        this.readoutContainer.style.opacity = 0;
        this.confirmButton.style.opacity = 0;
        this.confirmButton.disabled = true;
        this.progressBar.style.width = '0%';
    }

    /**
     * Initializes the static artwork and triggers the zoom effect.
     * Replaces the old _setupAnimationElements method.
     */
    _startCinematicSequence(to) {
        // 1. Fetch the random variant image for this location
        // Example: 'loc_mars' -> 'assets/locations/mars_C.jpeg'
        const imagePath = AssetService.getLocationImage(to.id);
        
        if (imagePath) {
            this.imageElement.src = imagePath;
            
            // 2. Trigger Fade In and Zoom
            // Small delay to ensure the src is applied before opacity transition starts
            setTimeout(() => {
                this.imageElement.style.opacity = 1;
                this.imageElement.classList.add('travel-zoom-active');
            }, 50);
        } else {
            // Fallback if no image found (shouldn't happen with correct config)
            console.warn(`[TravelAnimation] No image found for ${to.id}`);
        }
    }

    _onArrival(to, travelInfo, totalHullDamagePercent, finalCallback) {
        this.statusText.textContent = `Arrived at ${to.name}`;
        this.arrivalLore.innerHTML = to.arrivalLore || "You have arrived.";
        this.infoText.innerHTML = `
            <div class="text-center">
                <div>Journey Time: ${travelInfo.time} Days</div>
                <div><span class="font-bold text-sky-300">Fuel Expended: ${travelInfo.fuelCost}</span></div>
            </div>`;
        this.hullDamageText.className = 'text-sm font-roboto-mono mt-1 font-bold text-red-400';
        if (totalHullDamagePercent > 0.01) {
            this.hullDamageText.innerHTML = `Hull Integrity -${totalHullDamagePercent.toFixed(2)}%`;
        } else {
            this.hullDamageText.innerHTML = '';
        }
        
        this.arrivalLore.style.opacity = 1;
        this.readoutContainer.classList.remove('hidden');
        setTimeout(() => {
            this.readoutContainer.style.opacity = 1;
            this.confirmButton.style.opacity = 1;
            this.confirmButton.disabled = false;
        }, 150);
    }
}
