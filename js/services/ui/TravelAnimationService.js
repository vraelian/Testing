// js/services/ui/TravelAnimationService.js
import { DB } from '../../data/database.js';

export class TravelAnimationService {
    /**
     * @param {boolean} isMobile - Flag to determine layout adjustments.
     */
    constructor(isMobile) {
        this.isMobile = isMobile;
    }

    /**
     * Renders and controls the entire travel animation sequence.
     * @param {object} from - The starting location object.
     * @param {object} to - The destination location object.
     * @param {object} travelInfo - Contains travel time and fuel cost.
     * @param {number} totalHullDamagePercent - The hull damage percentage to display.
     * @param {function} finalCallback - The function to call when the animation is complete.
     */
    play(from, to, travelInfo, totalHullDamagePercent, finalCallback) {
        const modal = document.getElementById('travel-animation-modal');
        const statusText = document.getElementById('travel-status-text');
        const arrivalLore = document.getElementById('travel-arrival-lore');
        const canvas = document.getElementById('travel-canvas');
        const ctx = canvas.getContext('2d');
        const progressContainer = document.getElementById('travel-progress-container');
        const progressBar = document.getElementById('travel-progress-bar');
        const readoutContainer = document.getElementById('travel-readout-container');
        const infoText = document.getElementById('travel-info-text');
        const hullDamageText = document.getElementById('travel-hull-damage');
        const confirmButton = document.getElementById('travel-confirm-button');
        let animationFrameId = null;

        statusText.textContent = `Traveling to ${to.name}...`;
        arrivalLore.textContent = '';
        arrivalLore.style.opacity = 0;
        readoutContainer.classList.add('hidden');
        readoutContainer.style.opacity = 0;
        confirmButton.classList.add('hidden');
        confirmButton.style.opacity = 0;
        progressContainer.classList.remove('hidden');
        progressBar.style.width = '0%';
        modal.classList.remove('hidden');
        
        const duration = 2500;
        let startTime = null;
        const fromEmoji = DB.LOCATION_VISUALS[from.id] || '❓';
        const toEmoji = DB.LOCATION_VISUALS[to.id] || '❓';
        const shipEmoji = '🚀';

        let stars = [];
        const numStars = 150;
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        for (let i = 0; i < numStars; i++) {
            stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, radius: Math.random() * 1.5, speed: 0.2 + Math.random() * 0.8, alpha: 0.5 + Math.random() * 0.5 });
        }

        const animationLoop = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const elapsedTime = currentTime - startTime;
            let progress = Math.min(elapsedTime / duration, 1);
            progress = 1 - Math.pow(1 - progress, 3);

            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#FFF';
            for (let i = 0; i < numStars; i++) {
                const star = stars[i];
                if (progress < 1) {
                    star.x -= star.speed;
                    if (star.x < 0) star.x = canvas.width;
                }
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                ctx.globalAlpha = star.alpha;
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;

            const padding = 60;
            const startX = padding;
            const endX = canvas.width - padding;
            const y = canvas.height / 2;
            ctx.font = '42px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(fromEmoji, startX, y);
            ctx.fillText(toEmoji, endX, y);
            const shipX = startX + (endX - startX) * progress;
            ctx.save();
            ctx.translate(shipX, y);
            ctx.font = '17px sans-serif';
            ctx.fillText(shipEmoji, 0, 0);
            ctx.restore();

            progressBar.style.width = `${progress * 100}%`;

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animationLoop);
            } else {
                statusText.textContent = `Arrived at ${to.name}`;
                arrivalLore.innerHTML = to.arrivalLore || "You have arrived.";
                infoText.innerHTML = `
                    <div class="text-center ${this.isMobile ? 'travel-info-mobile' : ''}">
                        <div>Journey Time: ${travelInfo.time} Days</div>
                        <div><span class="font-bold text-sky-300">Fuel Expended: ${travelInfo.fuelCost}</span></div>
                    </div>`;
                hullDamageText.className = 'text-sm font-roboto-mono mt-1 font-bold text-red-400';
                if (totalHullDamagePercent > 0.01) {
                    hullDamageText.innerHTML = `Hull Integrity -${totalHullDamagePercent.toFixed(2)}%`;
                    if (this.isMobile) {
                        infoText.querySelector('div').appendChild(hullDamageText);
                    }
                } else {
                    hullDamageText.innerHTML = '';
                }
                
                arrivalLore.style.opacity = 1;
                progressContainer.classList.add('hidden');
                readoutContainer.classList.remove('hidden');
                confirmButton.classList.remove('hidden');
                setTimeout(() => {
                    readoutContainer.style.opacity = 1;
                    confirmButton.style.opacity = 1;
                }, 50);
            }
        }

        animationFrameId = requestAnimationFrame(animationLoop);
        confirmButton.onclick = () => {
            cancelAnimationFrame(animationFrameId);
            modal.classList.add('hidden');
            if (finalCallback) finalCallback();
        };
    }
}