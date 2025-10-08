// js/services/ui/TravelAnimationService.js
import { DB } from '../../data/database.js';

export class TravelAnimationService {
    constructor(isMobile) {
        this.isMobile = isMobile;
        this.modal = document.getElementById('travel-animation-modal');
        this.canvas = document.getElementById('travel-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.statusText = document.getElementById('travel-status-text');
        this.arrivalLore = document.getElementById('travel-arrival-lore');
        this.progressBar = document.getElementById('travel-progress-bar');
        this.progressContainer = document.getElementById('travel-progress-container');
        this.readoutContainer = document.getElementById('travel-readout-container');
        this.infoText = document.getElementById('travel-info-text');
        this.hullDamageText = document.getElementById('travel-hull-damage');
        this.confirmButton = document.getElementById('travel-confirm-button');
        
        this.animationFrame = null;
    }

    play(from, to, travelInfo, totalHullDamagePercent, finalCallback) {
        this.statusText.textContent = `Traveling to ${to.name}...`;
        this.arrivalLore.textContent = '';
        this.arrivalLore.style.opacity = 0;
        this.readoutContainer.classList.add('hidden');
        this.readoutContainer.style.opacity = 0;
        this.confirmButton.classList.add('hidden');
        this.confirmButton.style.opacity = 0;
        this.progressContainer.classList.remove('hidden');
        this.progressBar.style.width = '0%';
        this.modal.classList.remove('hidden');
        
        const duration = 2500;
        let startTime = null;
        const fromEmoji = DB.LOCATION_VISUALS[from.id] || '❓';
        const toEmoji = DB.LOCATION_VISUALS[to.id] || '❓';
        const shipEmoji = '🚀';

        let stars = [];
        const numStars = 150;
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        for (let i = 0; i < numStars; i++) {
            stars.push({ x: Math.random() * this.canvas.width, y: Math.random() * this.canvas.height, radius: Math.random() * 1.5, speed: 0.2 + Math.random() * 0.8, alpha: 0.5 + Math.random() * 0.5 });
        }

        const animationLoop = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const elapsedTime = currentTime - startTime;
            let progress = Math.min(elapsedTime / duration, 1);
            progress = 1 - Math.pow(1 - progress, 3);

            this.canvas.width = this.canvas.clientWidth;
            this.canvas.height = this.canvas.clientHeight;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#FFF';
            for (let i = 0; i < numStars; i++) {
                const star = stars[i];
                if (progress < 1) {
                    star.x -= star.speed;
                    if (star.x < 0) star.x = this.canvas.width;
                }
                this.ctx.beginPath();
                this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                this.ctx.globalAlpha = star.alpha;
                this.ctx.fill();
            }
            this.ctx.globalAlpha = 1.0;

            const padding = 60;
            const startX = padding;
            const endX = this.canvas.width - padding;
            const y = this.canvas.height / 2;
            this.ctx.font = '42px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(fromEmoji, startX, y);
            this.ctx.fillText(toEmoji, endX, y);
            const shipX = startX + (endX - startX) * progress;
            this.ctx.save();
            this.ctx.translate(shipX, y);
            this.ctx.font = '17px sans-serif';
            this.ctx.fillText(shipEmoji, 0, 0);
            this.ctx.restore();

            this.progressBar.style.width = `${progress * 100}%`;

            if (progress < 1) {
                this.animationFrame = requestAnimationFrame(animationLoop);
            } else {
                this.statusText.textContent = `Arrived at ${to.name}`;
                this.arrivalLore.innerHTML = to.arrivalLore || "You have arrived.";
                this.infoText.innerHTML = `
                    <div class="text-center ${this.isMobile ? 'travel-info-mobile' : ''}">
                        <div>Journey Time: ${travelInfo.time} Days</div>
                        <div><span class="font-bold text-sky-300">Fuel Expended: ${travelInfo.fuelCost}</span></div>
                    </div>`;
                this.hullDamageText.className = 'text-sm font-roboto-mono mt-1 font-bold text-red-400';
                if (totalHullDamagePercent > 0.01) {
                    this.hullDamageText.innerHTML = `Hull Integrity -${totalHullDamagePercent.toFixed(2)}%`;
                    if (this.isMobile) {
                        this.infoText.querySelector('div').appendChild(this.hullDamageText);
                    }
                } else {
                    this.hullDamageText.innerHTML = '';
                }
                
                this.arrivalLore.style.opacity = 1;
                this.progressContainer.classList.add('hidden');
                this.readoutContainer.classList.remove('hidden');
                this.confirmButton.classList.remove('hidden');
                setTimeout(() => {
                    this.readoutContainer.style.opacity = 1;
                    this.confirmButton.style.opacity = 1;
                }, 50);
            }
        }

        this.animationFrame = requestAnimationFrame(animationLoop);
        this.confirmButton.onclick = () => {
            cancelAnimationFrame(this.animationFrame);
            this.modal.classList.add('hidden');
            if (finalCallback) finalCallback();
        };
    }
}