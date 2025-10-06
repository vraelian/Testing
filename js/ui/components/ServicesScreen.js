// js/ui/components/ServicesScreen.js
/**
 * @fileoverview ServicesScreen component responsible for rendering the services
 * available at the current location, such as refueling, repairs, and special services.
 */
import GameState from '../../services/GameState.js';
import { formatNumber } from '../../utils.js';
import { LOCATION_IDS } from '../../data/constants.js';

export class ServicesScreen {
    constructor() {
        this.gameState = GameState.getState();
        this.currentLocation = this.gameState.currentLocation;
        this.activeShip = this.gameState.activeShip;
    }

    getFuelPrice() {
        let price = this.currentLocation.fuelPrice || 250;
        // Apply Jupiter's specialty discount
        if (this.currentLocation.id === LOCATION_IDS.JUPITER) {
            price *= 0.5;
        }
        return price;
    }

    getRepairCost() {
        if (!this.activeShip) return 0;
        const damage = this.activeShip.maxHealth - this.activeShip.health;
        const baseCost = damage * 150; // Base cost per point of damage
        
        let multiplier = 1.0;
        // Apply Luna's specialty discount
        if (this.currentLocation.id === LOCATION_IDS.LUNA) {
            multiplier = 0.9;
        }

        return Math.ceil(baseCost * multiplier);
    }

    render() {
        const fuelPrice = this.getFuelPrice();
        const repairCost = this.getRepairCost();
        const canAffordRepair = this.gameState.player.credits >= repairCost;
        const needsRepair = this.activeShip && this.activeShip.health < this.activeShip.maxHealth;

        const services = [
            {
                id: 'refuel',
                icon: '⛽',
                title: 'Refuel Ship',
                description: `Replenish your ship's fuel reserves. The price is currently <span class="hl-yellow">${formatNumber(fuelPrice)} credits</span> per unit.`,
                buttonText: 'Refuel',
                action: 'refuel-ship',
                disabled: !this.activeShip || this.activeShip.fuel === this.activeShip.maxFuel,
            },
            {
                id: 'repair',
                icon: '🔧',
                title: 'Repair Hull',
                description: `Restore your ship's hull integrity. The total cost for repairs is <span class="hl-yellow">${formatNumber(repairCost)} credits</span>.`,
                buttonText: canAffordRepair ? 'Repair' : 'Insufficient Funds',
                action: 'repair-ship',
                disabled: !this.activeShip || !needsRepair || !canAffordRepair,
            },
            // Placeholder for future Bank service
            // {
            //     id: 'bank',
            //     icon: '🏦',
            //     title: 'Galactic Bank',
            //     description: 'Manage your finances, take out loans, or make investments across the system.',
            //     buttonText: 'Access Terminal',
            //     action: 'open-bank',
            //     disabled: true,
            // }
        ];

        // Add location-specific specialty services
        this.addSpecialtyServices(services);


        let servicesHtml = services.map(service => `
            <div class="service-item ${service.disabled ? 'service-item-disabled' : ''}">
                <div class="service-icon">${service.icon}</div>
                <div class="service-content">
                    <h3 class="service-title">${service.title}</h3>
                    <p class="service-description">${service.description}</p>
                </div>
                <button class="service-button" data-action="${service.action}" ${service.disabled ? 'disabled' : ''}>${service.buttonText}</button>
            </div>
        `).join('');

        return `
            <div id="services-screen" class="screen">
                <h2 class="screen-title">Station Services at ${this.currentLocation.name}</h2>
                <div class="services-container">
                    ${servicesHtml}
                </div>
            </div>
        `;
    }
    
    addSpecialtyServices(services) {
        const specialty = this.currentLocation.specialty;
        if (!specialty) return;

        if (this.currentLocation.id === LOCATION_IDS.VENUS) {
             services.push({
                id: 'intel',
                icon: '🤫',
                title: 'Venetian Syndicate',
                description: 'Purchase valuable market intel that reveals temporary, extreme price spikes in other systems. High risk, high reward.',
                buttonText: 'Buy Intel',
                action: 'navigate-to-intel', // This will be handled by the event manager
                disabled: false
            });
        }
        
        if (this.currentLocation.id === LOCATION_IDS.URANUS) {
            services.push({
                id: 'research',
                icon: '🔬',
                title: 'Research & Development',
                description: 'Invest commodities and credits to temporarily overclock your ship\'s components for a significant performance boost.',
                buttonText: 'Coming Soon',
                action: 'feature-coming-soon',
                disabled: true,
            });
        }
        
        if (this.currentLocation.id === LOCATION_IDS.NEPTUNE) {
            services.push({
                id: 'surplus',
                icon: '🛡️',
                title: 'Military Surplus',
                description: 'The military shipyard occasionally sells heavily damaged, high-tier frigates for a fraction of their market price.',
                buttonText: 'Coming Soon',
                action: 'feature-coming-soon',
                disabled: true,
            });
        }
    }
}