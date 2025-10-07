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
        this.readoutContainer = document.getElementById('travel-readout-container');
        this.infoText = document.getElementById('travel-info-text');
        this.hullDamageText = document.getElementById('travel-hull-damage');
        this.confirmButton = document.getElementById('travel-confirm-button');
        
        this.animationFrame = null;
        this.starLayers = [];
        this.engineParticles = [];
        this.celestialObjects = [];
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
        this._setupAnimationElements(from, to);

        let startTime = null;
        const duration = 2500;

        const animate = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const elapsedTime = currentTime - startTime;
            let progress = Math.min(elapsedTime / duration, 1);

            if (progress > 0.8) {
                const normalized = (progress - 0.8) / 0.2;
                progress = 0.8 + (1 - Math.pow(1 - normalized, 3)) * 0.2;
            }

            this._draw(progress, from, to);
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
            this.modal.classList.add('hidden');
            this.modal.classList.remove('dismiss-disabled');
            if (finalCallback) finalCallback();
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

    _setupAnimationElements(from, to) {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        this.starLayers = [
            this._createStarLayer(80, 0.5, 0.8),
            this._createStarLayer(50, 1.2, 1.2),
            this._createStarLayer(20, 1.8, 2.0)
        ];

        this.engineParticles = [];

        this.backgroundGradient = this._getBackgroundGradient(from, to);
        this.celestialObjects = this._getCelestialObjects(from.id, to.id);
    }

    _createStarLayer(count, minSpeed, maxSpeed) {
        let stars = [];
        for (let i = 0; i < count; i++) {
            stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                radius: Math.random() * 1.5,
                speed: minSpeed + Math.random() * (maxSpeed - minSpeed),
                alpha: 0.5 + Math.random() * 0.5
            });
        }
        return stars;
    }

    _getBackgroundGradient(from, to) {
        const getZone = (location) => {
            for (const zoneName in DB.TRAVEL_VISUALS.zones) {
                if (DB.TRAVEL_VISUALS.zones[zoneName].locations.includes(location.id)) {
                    return DB.TRAVEL_VISUALS.zones[zoneName];
                }
            }
            return DB.TRAVEL_VISUALS.zones.inner_sphere;
        };
        const toZone = getZone(to);
        
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, toZone.gradient[0]);
        gradient.addColorStop(1, toZone.gradient[1]);
        return gradient;
    }

    _getCelestialObjects(fromId, toId) {
        const routeKey = `${fromId}_to_${toId}`;
        const objects = DB.TRAVEL_VISUALS.objects[routeKey] || [];
        return objects.map(obj => ({
            ...obj,
            x: this.canvas.width + Math.random() * 200,
            y: obj.position.y * this.canvas.height,
        }));
    }

    _draw(progress, from, to) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = this.backgroundGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.starLayers.forEach((layer, index) => {
            const speedMultiplier = progress < 0.8 ? 1 : 1 - ((progress - 0.8) / 0.2);
            
            layer.forEach(star => {
                star.x -= star.speed * speedMultiplier;
                if (star.x < 0) star.x = this.canvas.width;
                this.ctx.beginPath();
                this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                this.ctx.globalAlpha = star.alpha;
                this.ctx.fillStyle = '#FFF';
                this.ctx.fill();
            });

            if (index === 1) {
                this.celestialObjects.forEach(obj => {
                    obj.x -= obj.speed * speedMultiplier;
                    this.ctx.font = `${40 * (obj.scale || 1)}px sans-serif`;
                    this.ctx.globalAlpha = 0.5;
                    this.ctx.fillText(obj.emoji, obj.x, obj.y);
                });
            }
        });
        this.ctx.globalAlpha = 1.0;

        const padding = 60;
        const startX = padding;
        const endX = this.canvas.width - padding;
        const y = this.canvas.height / 2;
        this.ctx.font = '42px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(DB.LOCATION_VISUALS[from.id] || '❓', startX, y);
        this.ctx.fillText(DB.LOCATION_VISUALS[to.id] || '❓', endX, y);
        
        const shipX = startX + (endX - startX) * progress;
        this.ctx.save();
        this.ctx.translate(shipX, y);
        this.ctx.font = '17px sans-serif';
        this.ctx.fillText('🚀', 0, 0);
        this.ctx.restore();

        this._updateEngineParticles(shipX, y);
        this._drawEngineParticles();
    }
    
    _updateEngineParticles(shipX, shipY) {
        if(Math.random() > 0.5) {
            this.engineParticles.push({
                x: shipX - 15,
                y: shipY + (Math.random() - 0.5) * 8,
                life: 1,
                speedX: -2 - Math.random() * 2,
                speedY: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 1
            });
        }
        
        for (let i = this.engineParticles.length - 1; i >= 0; i--) {
            const p = this.engineParticles[i];
            p.x += p.speedX;
            p.y += p.speedY;
            p.life -= 0.05;
            if (p.life <= 0) {
                this.engineParticles.splice(i, 1);
            }
        }
    }
    
    _drawEngineParticles() {
        this.engineParticles.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = `rgba(255, 220, 180, ${p.life})`;
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1.0;
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