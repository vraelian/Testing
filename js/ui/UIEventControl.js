// js/services/ui/UIEventControl.js
import { DB } from '../../data/database.js';
import { EULA_CONTENT } from '../../data/eulaContent.js';
import { formatCredits, getCommodityStyle } from '../../utils.js';
import { GameAttributes } from '../GameAttributes.js';
import { _renderMaxCargoModal } from '../../ui/components/CargoScreen.js';

const LORE_CONTENT = {
    story_so_far: {
        title: "Story So Far...",
        content: `
            <p>The year 2140 is the result of a single, massive corporate takeover. A century ago, the "Ad Astra Initiative" released advanced technology to all of humanity, a gift from the new Human-AI Alliance on Earth designed to kickstart our expansion into the stars. It was a promise of a new beginning, an open-source key to the solar system, ensuring the survival of all Earth life, both organic and synthetic.</p>
        
            <p>But a gift to everyone is a business opportunity for the few. The hyper-corporations, already positioned in space, immediately patented the most efficient manufacturing processes and proprietary components for this new technology. This maneuver ensured that while anyone could build a Folded-Space Drive, only the corporations could supply the high-performance parts needed to make it truly effective, creating a system-wide technological dependency that persists to this day. This technological monopoly created the "Drive-Divide," the central pillar of the new class system. Nearly all ships run on older, less efficient hardware. Very few ships employ these coveted Folded-Space Drives.</p>
            <p>The major hubs beyond Earth are sovereign, corporate-run territories where law is policy and your rights are listed in an employment contract. These scattered colonies are fierce rivals, engaged in constant economic warfare, all propped up by the interstellar supply lines maintained by the Merchant's Guild. For them, you are just another cog in the great machine of commerce.</p>
            <p>In a system owned by corporations, possessing your own ship is the only true form of freedom. Every credit earned, every successful trade, is a bet on your own skill and a step toward true sovereignty on the razor's edge of a cargo manifest.</p>
        `
    }
};

export class UIEventControl {
    /**
     * @param {import('../UIManager.js').UIManager} manager
     */
    constructor(manager) {
        this.manager = manager;
    }

    showRandomEventModal(event, choicesCallback) {
         const title = event.template?.title || event.title || 'Unknown Event';
         const description = event.template?.description || event.scenario || 'No description available.';

         this.manager.queueModal('random-event-modal', title, description, null, {
            nonDismissible: true,
            customSetup: (modal, closeHandler) => {
                const choicesContainer = modal.querySelector('#random-event-choices-container');
                choicesContainer.innerHTML = '';
                
                event.choices.forEach((choice) => {
                    const button = document.createElement('button');
                    button.className = 'btn w-full p-4 hover:bg-slate-700 mb-2 event-choice-btn';
                    
                    if (choice.disabled) {
                        button.disabled = true;
                        button.classList.add('opacity-50', 'cursor-not-allowed');
                    }
                    
                    const textMatch = (choice.text || choice.title || 'Option').match(/^(.*?)\s*(\(.*\))?$/);
                    const headerText = textMatch ? textMatch[1] : (choice.text || choice.title);
                    const subText = (textMatch && textMatch[2]) ? textMatch[2] : '';

                    let colorClass = 'text-gray-400'; 
                    if (subText) {
                        const lower = subText.toLowerCase();
                        if (lower.includes('space')) {
                            colorClass = 'text-req-yellow';
                        } else if (lower.includes('delay')) {
                            colorClass = 'text-delay-blue';
                        } else if (['credit', 'hull', 'fuel', 'ice', 'plasteel', 'processor', 'propellant', 'cybernetic', 'wealth', 'scrap', 'premium'].some(k => lower.includes(k))) {
                            colorClass = 'text-cost-orange';
                        }
                    }

                    button.innerHTML = `
                        <span class="choice-header">${headerText}</span>
                        ${subText ? `<span class="choice-subtext ${colorClass}">${subText}</span>` : ''}
                    `;
                    
                    if (choice.tooltip) {
                        button.setAttribute('title', choice.tooltip);
                    }

                    button.onclick = () => {
                        choicesCallback(choice.id);
                        closeHandler();
                     };
                    choicesContainer.appendChild(button);
                });
            }
        });
    }

    showAgeEventModal(event, choiceCallback) {
        const modal = document.getElementById('age-event-modal');
        modal.classList.add('dismiss-disabled');
        document.getElementById('age-event-title').innerHTML = event.title;
        document.getElementById('age-event-description').innerHTML = event.description;
        const btnContainer = document.getElementById('age-event-button-container');
        btnContainer.innerHTML = '';
        event.choices.forEach(choice => {
            const button = document.createElement('button');
             button.className = 'perk-button';
            button.innerHTML = `<h4>${choice.title}</h4><p>${choice.description}</p>`;
            button.onclick = () => {
                this.manager.hideModal('age-event-modal');
                choiceCallback(choice);
            };
            btnContainer.appendChild(button);
        });
        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
    }

    showLoreModal(loreId) {
        const modal = this.manager.cache.loreModal;
        const contentEl = this.manager.cache.loreModalContent;
        
        if (!modal || !contentEl) {
             this.manager.logger.error('UIEventControl', 'Lore modal elements not cached or found in DOM.');
            return;
        }

        const loreEntry = LORE_CONTENT[loreId];
        if (!loreEntry) {
            this.manager.logger.error('UIEventControl', `No lore content found for ID: ${loreId}`);
            contentEl.innerHTML = '<p>Error: Lore content not found.</p>';
        } else {
            contentEl.innerHTML = loreEntry.content;
        }
        
        contentEl.scrollTop = 0;

        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
        const closeHandler = (e) => {
            if (e.target.closest('#lore-modal-content') || e.target.id === 'lore-modal') {
                this.manager.hideModal('lore-modal');
                modal.removeEventListener('click', closeHandler);
            }
        };
        modal.addEventListener('click', closeHandler);
    }

    showEulaModal() {
        const modal = this.manager.cache.eulaModal;
        const contentEl = this.manager.cache.eulaModalContent;
        
        if (!modal || !contentEl) {
            this.manager.logger.error('UIEventControl', 'EULA modal elements not cached or found in DOM.');
            return;
        }

        if (!EULA_CONTENT) {
            this.manager.logger.error('UIEventControl', 'EULA_CONTENT is not defined or empty.');
            contentEl.innerHTML = '<p>Error: EULA content not found.</p>';
        } else {
            contentEl.innerHTML = EULA_CONTENT;
        }
        
        contentEl.scrollTop = 0;

        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
        
        const closeHandler = (e) => {
            if (e.target.closest('#eula-modal-content') || e.target.id === 'eula-modal') {
                 this.manager.hideModal('eula-modal');
                modal.removeEventListener('click', closeHandler);
            }
        };
        modal.addEventListener('click', closeHandler);
    }

    showLaunchModal(locationId) {
        const state = this.manager.lastKnownState;
        if (!state) return;

        const location = DB.MARKETS.find(l => l.id === locationId);
        if (!location) return;

        const theme = location.navTheme;
        const travelInfo = state.TRAVEL_DATA[state.currentLocationId]?.[locationId];
        const shipState = state.player.shipStates[state.player.activeShipId];

        if (!travelInfo) return;

        const modalContentHtml = `
            <div class="launch-modal-wrapper panel-border" style="background: ${theme.gradient}; color: ${theme.textColor}; border-color: ${theme.borderColor}; --theme-glow-color: ${theme.borderColor};">
                <div class="flex-shrink-0">
                    <h3 class="font-orbitron">${location.name}</h3>
                     <p class="flavor-text italic">${location.launchFlavor}</p>
                </div>

                <div class="flex-grow flex items-center justify-center">
                     <button class="btn-launch-glow" data-action="travel" data-location-id="${locationId}" style="--launch-glow-color: ${theme.borderColor};">Launch</button>
                </div>

                <div class="travel-info-text">
                     <p>Travel Time: ${travelInfo.time} Days</p>
                    <p>Fuel: ${Math.floor(shipState.fuel)} / ${travelInfo.fuelCost} required</p>
                </div>
            </div>`;

        const modal = this.manager.cache.launchModal;
        this.manager.cache.launchModalContent.innerHTML = modalContentHtml;
        modal.classList.remove('hidden');

        requestAnimationFrame(() => {
            modal.classList.add('modal-visible');
            const wrapper = modal.querySelector('.launch-modal-wrapper');
            if (wrapper) {
                 requestAnimationFrame(() => {
                     wrapper.classList.add('is-glowing');
                });
            }
        });

        const closeHandler = (e) => {
            if (e.target.id === 'launch-modal') {
                this.manager.hideModal('launch-modal');
                modal.removeEventListener('click', closeHandler);
            }
        };
        modal.addEventListener('click', closeHandler);
    }

    showMapDetailModal(locationId) {
        const location = DB.MARKETS.find(l => l.id === locationId);
        if (!location) return;

        const modal = this.manager.cache.mapDetailModal;
        const modalContent = modal.querySelector('.modal-content');
        const contentContainer = modal.querySelector('#map-modal-content-container');
        const theme = location.navTheme;

        modalContent.style.background = theme.gradient;
        modalContent.style.setProperty('--theme-glow-color', theme.borderColor);
        modal.dataset.theme = locationId;

        const imports = [];
        const exports = [];

        if (location.availabilityModifier) {
            for (const [commodityId, modifier] of Object.entries(location.availabilityModifier)) {
                  const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
                if (commodity) {
                    const tag = {
                        name: commodity.name,
                        style: getCommodityStyle(commodity.styleClass)
                    };
                    if (modifier < 1.0) {
                         imports.push(tag);
                    } else if (modifier > 1.0) {
                        exports.push(tag);
                    }
                }
            }
        }

        const renderTags = (tagArray) => tagArray.map(tag =>
             `<span class="commodity-tag" style="border-color: ${tag.style.hex}; background-color: ${tag.style.hex}20; color: ${tag.style.hex};">${tag.name}</span>`
         ).join('');

        const quirks = GameAttributes.getStationQuirks(locationId);
        let quirksHtml = '';
        if (quirks.length > 0) {
            quirksHtml = quirks.map(qId => {
                const def = GameAttributes.getDefinition(qId);
                 return `<p class="font-roboto-mono imprinted-text-embedded" style="color: #facc15;">${def.description}</p>`;
            }).join('');
        } else {
            quirksHtml = `<p class="font-roboto-mono imprinted-text-embedded">${location.specialty || 'None reported'}</p>`;
        }

        const navigateBtnHtml = `<div class="map-navigate-btn" data-action="navigate-to-poi" data-location-id="${locationId}">NAVIGATE ❯❯</div>`;

        const contentHtml = `
            ${navigateBtnHtml}
            <div class="text-center">
                <h3 class="text-3xl font-orbitron" style="color: ${theme.textColor};">${location.name}</h3>
                 <p class="text-lg italic imprinted-text">${location.launchFlavor}</p>
            </div>

            <div class="my-4 space-y-3">
                <div class="map-intel-block">
                    <h5 class="font-bold imprinted-text" style="color: ${theme.textColor}; opacity: 0.7;">Fuel Price</h5>
                    <p class="font-roboto-mono imprinted-text-embedded"><span class="credits-text-pulsing">${formatCredits(location.fuelPrice, true)}</span>/unit</p>
                 </div>
                <div class="map-intel-block">
                    <h5 class="font-bold imprinted-text" style="color: ${theme.textColor}; opacity: 0.7;">Station Details</h5>
                    ${quirksHtml}
                </div>
          </div>
            
             <div class="text-center">
                 <div>
                    <h5 class="font-bold imprinted-text">Exports:</h5>
                    <div>${exports.length > 0 ? renderTags(exports) : '<span class="text-gray-400">CLASSIFIED</span>'}</div>
                </div>
                <div class="mt-2">
                     <h5 class="font-bold imprinted-text">Needs:</h5>
                     <div>${imports.length > 0 ? renderTags(imports) : '<span class="text-gray-400">CLASSIFIED</span>'}</div>
                </div>
            </div>
        `;

        contentContainer.innerHTML = contentHtml;
        modal.classList.remove('hidden');
        modal.classList.remove('is-glowing');

        requestAnimationFrame(() => {
            modal.classList.add('modal-visible');
            modal.classList.add('is-glowing');
        });

        const closeHandler = (e) => {
            if (e.target.id === 'map-detail-modal' || e.target.closest('.modal-content')) {
                  this.hideMapDetailModal();
                modal.removeEventListener('click', closeHandler); 
            }
        };
        requestAnimationFrame(() => {
             modal.addEventListener('click', closeHandler);
        });
    }

    hideMapDetailModal() {
        const modal = this.manager.cache.mapDetailModal;
        if (modal) {
             modal.classList.remove('is-glowing');
            delete modal.dataset.theme; 
            const existingHandler = modal.__mapDetailCloseHandler; 
            if(existingHandler) {
                modal.removeEventListener('click', existingHandler);
                delete modal.__mapDetailCloseHandler;
            }
        }
        this.manager.hideModal('map-detail-modal');
    }

    showCargoDetailModal(gameState, goodId) {
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        const item = gameState.player.inventories[gameState.player.activeShipId]?.[goodId];

        if (!good || !item) return;

        this.manager.queueModal('cargo-detail-modal', null, null, null, {
            dismissInside: true,
            dismissOutside: true,
             footer: null, 
            customSetup: (modal, closeHandler) => {
                const modalContent = modal.querySelector('#cargo-detail-content');
                 if (modalContent) {
                    modalContent.innerHTML = _renderMaxCargoModal(good, item);
                 }
            }
        });
    }

    createFloatingText(text, x, y, color = '#fde047') {
        const el = document.createElement('div');
        el.textContent = text;
        el.className = 'floating-text';
        el.style.left = `${x - 20}px`;
        el.style.top = `${y - 40}px`;
        el.style.color = color;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2450);
    }

    showEventResultModal(text, effects) {
        let effectsHtml = '';
        if (effects && effects.length > 0) {
            effectsHtml = '<ul class="list-none text-sm text-gray-400 mt-4 space-y-1">';
            effects.forEach(eff => {
                let effectText = '';
                switch (eff.type) {
                    case 'EFF_CREDITS':
                        effectText = `Credits: ${eff.value > 0 ? '+' : ''}${formatCredits(eff.value)}`;
                        break;
                    case 'EFF_FUEL':
                        effectText = `Fuel: ${eff.value > 0 ? '+' : ''}${Math.round(eff.value)}`;
                        break;
                    case 'EFF_HULL':
                        effectText = `Hull: ${eff.value > 0 ? '+' : ''}${Math.round(eff.value)}`;
                        break;
                    case 'EFF_TRAVEL_TIME':
                    case 'EFF_MODIFY_TRAVEL':
                        effectText = `Travel Time: ${eff.value > 0 ? '+' : ''}${Math.round(eff.value)} Days`;
                        break;
                    case 'EFF_ADD_ITEM':
                        effectText = `Received: ${Math.round(eff.value)}x ${eff.target}`; 
                        break;
                    case 'EFF_REMOVE_ITEM':
                        effectText = `Removed: ${Math.round(eff.value)}x ${eff.target}`;
                        break;
                    default:
                        effectText = `Effect Applied`;
                }
                effectsHtml += `<li>${effectText}</li>`;
            });
            effectsHtml += '</ul>';
        }

        this.manager.queueModal('event-result-modal', 'Event Outcome', text + effectsHtml, null, {
            dismissOutside: true,
            buttonText: 'Continue'
        });
    }

    _renderCodexButtons(screenContainer) {
        const loreContainer = screenContainer.querySelector('#lore-button-container');
        if (!loreContainer) return;
        
        loreContainer.innerHTML = Object.entries(LORE_CONTENT).map(([id, data]) => {
            return `<button class="btn btn-header" data-action="show_lore" data-lore-id="${id}">
                        ${data.title}
                    </button>`;
        }).join('');
    }
}