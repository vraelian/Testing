// js/services/ui/TravelAnimationService.js
import { DB } from '../../data/database.js';

export class TravelAnimationService {
    constructor(isMobile) {
        this.isMobile = isMobile;
        this.modal = document.getElementById('travel-animation-modal');
        this.content = document.getElementById('travel-animation-content');
        this.canvas = document.getElementById('travel-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.statusText = document.getElementById('travel-status-text');
        this.arrivalLore = document.getElementById('travel-arrival-lore');
        this.progressBar = document.getElementById('travel-progress-bar');
        this.readoutContainer = document.getElementById('travel-readout-container');
        this.infoText = document.getElementById('travel-info-text');
        this.hullDamageText = document.getElementById('travel-hull-damage');
        this.confirmButton = document.getElementById('travel-confirm-button');
        this.animationFrame = null;
        this.stars = [];
    }

    play(fromLocationId, toLocationId, travelInfo, totalHullDamagePercent, finalCallback) {
        this.modal.classList.remove('hidden');
        this.modal.classList.add('dismiss-disabled');
        const fromLocation = DB.MARKETS.find(m => m.id === fromLocationId);
        const toLocation = DB.MARKETS.find(m => m.id === toLocationId);

        this.statusText.textContent = `Departing ${fromLocation.name}...`;
        this.arrivalLore.textContent = toLocation.arrivalFlavor;
        this.arrivalLore.style.opacity = '0';
        this.readoutContainer.classList.add('hidden');
        this.infoText.textContent = '';
        this.hullDamageText.textContent = '';
        this.confirmButton.style.opacity = '0';
        this.confirmButton.disabled = true;
        this.progressBar.style.width = '0%';

        const duration = travelInfo.time * 200;
        let startTime = null;

        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            this.progressBar.style.width = `${progress * 100}%`;
            this._drawStars(progress);

            if (progress >= 1) {
                this._onArrival(toLocation, travelInfo, totalHullDamagePercent, finalCallback);
            } else {
                this.animationFrame = requestAnimationFrame(animate);
            }
        };
        
        this._setupCanvas(fromLocation.navTheme.gradient, toLocation.navTheme.gradient);
        this.animationFrame = requestAnimationFrame(animate);
    }

    _onArrival(toLocation, travelInfo, totalHullDamagePercent, finalCallback) {
        this.statusText.textContent = `Arrived at ${toLocation.name}`;
        this.arrivalLore.style.opacity = '1';
        this.readoutContainer.classList.remove('hidden');
        this.infoText.textContent = `Distance: ${travelInfo.distance.toFixed(2)} AU | Time: ${travelInfo.time} Days`;

        if (totalHullDamagePercent > 0) {
            this.hullDamageText.textContent = `Hull integrity compromised by ${totalHullDamagePercent.toFixed(2)}% during transit.`;
            this.hullDamageText.classList.add('warning-text');
        } else {
            this.hullDamageText.textContent = 'Transit successful. No hull damage detected.';
            this.hullDamageText.classList.remove('warning-text');
        }
        
        this.readoutContainer.style.opacity = '1';

        setTimeout(() => {
            this.confirmButton.style.opacity = '1';
            this.confirmButton.disabled = false;
        }, 750);

        this.confirmButton.onclick = () => {
            cancelAnimationFrame(this.animationFrame);
            this.modal.classList.add('hidden');
            this.modal.classList.remove('dismiss-disabled');
            finalCallback();
        };
    }

    _setupCanvas(fromGradient, toGradient) {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.stars = [];
        for (let i = 0; i < 150; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                z: Math.random() * this.canvas.width
            });
        }
        this.fromGradient = this._createGradient(fromGradient);
        this.toGradient = this._createGradient(toGradient);
    }

    _createGradient(cssGradient) {
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, 0);
        const colors = cssGradient.match(/#[0-9a-f]{6}|#[0-9a-f]{3}/ig);
        if (colors && colors.length > 1) {
            gradient.addColorStop(0, colors[0]);
            gradient.addColorStop(1, colors[1]);
        } else {
            gradient.addColorStop(0, '#0c101d');
            gradient.addColorStop(1, '#1a2030');
        }
        return gradient;
    }

    _drawStars(progress) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Interpolate background gradient
        const r1 = parseInt(this.fromGradient.colorStops[0].color.slice(1,3), 16);
        const g1 = parseInt(this.fromGradient.colorStops[0].color.slice(3,5), 16);
        const b1 = parseInt(this.fromGradient.colorStops[0].color.slice(5,7), 16);
        const r2 = parseInt(this.toGradient.colorStops[0].color.slice(1,3), 16);
        const g2 = parseInt(this.toGradient.colorStops[0].color.slice(3,5), 16);
        const b2 = parseInt(this.toGradient.colorStops[0].color.slice(5,7), 16);

        const r = Math.round(r1 + (r2 - r1) * progress);
        const g = Math.round(g1 + (g2 - g1) * progress);
        const b = Math.round(b1 + (b2 - b1) * progress);

        const r1_end = parseInt(this.fromGradient.colorStops[1].color.slice(1,3), 16);
        const g1_end = parseInt(this.fromGradient.colorStops[1].color.slice(3,5), 16);
        const b1_end = parseInt(this.fromGradient.colorStops[1].color.slice(5,7), 16);
        const r2_end = parseInt(this.toGradient.colorStops[1].color.slice(1,3), 16);
        const g2_end = parseInt(this.toGradient.colorStops[1].color.slice(3,5), 16);
        const b2_end = parseInt(this.toGradient.colorStops[1].color.slice(5,7), 16);

        const r_end = Math.round(r1_end + (r2_end - r1_end) * progress);
        const g_end = Math.round(g1_end + (g2_end - g1_end) * progress);
        const b_end = Math.round(b1_end + (b2_end - b1_end) * progress);

        const currentGradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, 0);
        currentGradient.addColorStop(0, `rgb(${r},${g},${b})`);
        currentGradient.addColorStop(1, `rgb(${r_end},${g_end},${b_end})`);

        this.ctx.fillStyle = currentGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);


        this.ctx.fillStyle = 'white';
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);

        this.stars.forEach(star => {
            star.z -= 2;
            if (star.z <= 0) {
                star.z = this.canvas.width;
            }

            const k = 128 / star.z;
            const px = star.x * k;
            const py = star.y * k;
            const size = (1 - star.z / this.canvas.width) * 2.5;

            this.ctx.beginPath();
            this.ctx.arc(px, py, size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.restore();
    }
}