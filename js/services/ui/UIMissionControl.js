// js/services/ui/UIMissionControl.js
import { DB } from '../../data/database.js';
import { INTEL_CONTENT } from '../../data/intelContent.js';
import { formatCredits } from '../../utils.js';

export class UIMissionControl {
    /**
     * @param {import('../UIManager.js').UIManager} manager
     */
    constructor(manager) {
        this.manager = manager;
    }

    /**
     * Renders the persistent "Sticky Bar" at the top of the UI for active missions.
     * @param {object} gameState 
     */
    renderStickyBar(gameState) {
        const stickyBarEl = this.manager.cache.missionStickyBar;
        const contentEl = stickyBarEl.querySelector('.sticky-content');
        const objectiveTextEl = this.manager.cache.stickyObjectiveText;
        const objectiveProgressEl = this.manager.cache.stickyObjectiveProgress;

        if (gameState.missions.activeMissionId) {
            const mission = DB.MISSIONS[gameState.missions.activeMissionId];
            if (!mission.objectives || mission.objectives.length === 0) {
                stickyBarEl.style.display = 'none';
                return;
            }
            const progress = gameState.missions.missionProgress[mission.id] || { objectives: {} };

            const objective = mission.objectives[0];
            const current = progress.objectives[objective.goodId]?.current ?? 0;
            const target = objective.quantity;
            const goodName = DB.COMMODITIES.find(c => c.id === objective.goodId).name;
            const locationName = DB.MARKETS.find(m => m.id === mission.completion.locationId).name;

            objectiveTextEl.textContent = `Deliver ${goodName} to ${locationName}`;
            objectiveProgressEl.textContent = `[${current}/${target}]`;

            const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-N]/g, '')}`;
            let turnInClass = gameState.missions.activeMissionObjectivesMet && mission.completion.locationId === gameState.currentLocationId ? 'mission-turn-in' : '';
            contentEl.className = `sticky-content sci-fi-frame ${hostClass} ${turnInClass}`;

            stickyBarEl.style.display = 'block';
        } else {
            stickyBarEl.style.display = 'none';
        }
    }

    /**
     * Visual effect for updating the sticky bar progress.
     */
    flashObjectiveProgress() {
        const progressEl = this.manager.cache.stickyObjectiveProgress;
        if (progressEl) {
            progressEl.classList.add('objective-progress-flash');
            setTimeout(() => {
                progressEl.classList.remove('objective-progress-flash');
            }, 700);
        }
    }

    /**
     * Orchestrates showing the correct mission modal (Details vs Completion).
     * @param {string} missionId 
     */
    showMissionModal(missionId) {
        const mission = DB.MISSIONS[missionId];
        if (!mission) return;

        const { missions, currentLocationId } = this.manager.lastKnownState;
        const { activeMissionId, activeMissionObjectivesMet } = missions;
        const isActive = activeMissionId === missionId;
        const canComplete = isActive && activeMissionObjectivesMet && mission.completion.locationId === currentLocationId;

        if (canComplete) {
            this._showMissionCompletionModal(mission);
        } else {
            this._showMissionDetailsModal(mission);
        }
    }

    _showMissionDetailsModal(mission) {
        const { missions, tutorials } = this.manager.lastKnownState;
        const isActive = missions.activeMissionId === mission.id;
        const anotherMissionActive = missions.activeMissionId && !isActive;
        let shouldBeDisabled = anotherMissionActive;
        if (mission.id === 'mission_tutorial_02' && tutorials.activeBatchId === 'intro_missions' && tutorials.activeStepId !== 'mission_2_4') {
            shouldBeDisabled = true;
        }

        const options = {
            dismissOutside: true, 
            customSetup: (modal, closeHandler) => {
                const modalContent = modal.querySelector('.modal-content');
                modalContent.className = 'modal-content sci-fi-frame flex flex-col items-center text-center';
                const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-N]/g, '')}`;
                modalContent.classList.add(hostClass);

                modal.querySelector('#mission-modal-type').textContent = mission.type;

                const objectivesEl = modal.querySelector('#mission-modal-objectives');
                const objectivesHtml = '<h6 class="font-bold text-sm uppercase tracking-widest text-gray-400 text-center">OBJECTIVES:</h6><ul class="list-disc list-inside text-gray-300">' + mission.objectives.map(obj => `<li>Deliver ${obj.quantity}x ${DB.COMMODITIES.find(c => c.id === obj.goodId).name}</li>`).join('') + '</ul>';
                objectivesEl.innerHTML = objectivesHtml;
                objectivesEl.style.display = 'block';

                const rewardsEl = modal.querySelector('#mission-modal-rewards');
                if (mission.rewards && mission.rewards.length > 0) {
                     const rewardsHtml = mission.rewards.map(r => {
                        if(r.type === 'credits') return `<span class="credits-text-pulsing">${formatCredits(r.amount, true)}</span>`;
                        return r.type.toUpperCase();
                     }).join(', ');
                     rewardsEl.innerHTML = `<p class="font-roboto-mono text-sm text-gray-400 mb-1">REWARDS:</p><p class="font-orbitron text-xl text-yellow-300">${rewardsHtml}</p>`;
                    rewardsEl.style.display = 'block';
                } else {
                    rewardsEl.innerHTML = '';
                    rewardsEl.style.display = 'none';
                }

                const buttonsEl = modal.querySelector('#mission-modal-buttons');
                if (isActive) {
                    const isAbandonable = mission.isAbandonable !== false;
                    buttonsEl.innerHTML = `<button class="btn w-full bg-red-800/80 hover:bg-red-700/80 border-red-500" data-action="abandon-mission" data-mission-id="${mission.id}" ${!isAbandonable ? 'disabled' : ''}>Abandon Mission</button>`;
                } else {
                     buttonsEl.innerHTML = `<button class="btn w-full" data-action="accept-mission" data-mission-id="${mission.id}" ${shouldBeDisabled ? 'disabled' : ''}>Accept</button>`;
                }
            }
        };
        if (mission.id === 'mission_tutorial_01' && tutorials.activeStepId === 'mission_1_1') {
            shouldBeDisabled = true;
        }
        this.manager.queueModal('mission-modal', mission.name, mission.description, null, options);
    }

    _showMissionCompletionModal(mission) {
        const options = {
           dismissOutside: true,
            customSetup: (modal, closeHandler) => {
               const modalContent = modal.querySelector('.modal-content');
               modalContent.className = 'modal-content sci-fi-frame flex flex-col items-center text-center';
               const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-N]/g, '')}`;
               modalContent.classList.add(hostClass);

               modal.querySelector('#mission-modal-title').textContent = mission.completion.title;
               modal.querySelector('#mission-modal-type').textContent = "OBJECTIVES MET";
               modal.querySelector('#mission-modal-description').innerHTML = mission.completion.text;

               const objectivesEl = modal.querySelector('#mission-modal-objectives');
               objectivesEl.style.display = 'none';

               const rewardsEl = modal.querySelector('#mission-modal-rewards');
               if (mission.rewards && mission.rewards.length > 0) {
                   const rewardsHtml = mission.rewards.map(r => {
                        if(r.type === 'credits') return `<span class="credits-text-pulsing">${formatCredits(r.amount, true)}</span>`;
                       return r.type.toUpperCase();
                   }).join(', ');
                   rewardsEl.innerHTML = `<p class="font-roboto-mono text-sm text-gray-400 mb-1">REWARDS:</p><p class="font-orbitron text-xl text-green-300">${rewardsHtml}</p>`;
                   rewardsEl.style.display = 'block';
               } else {
                   rewardsEl.innerHTML = '';
                   rewardsEl.style.display = 'none';
               }

               const buttonsEl = modal.querySelector('#mission-modal-buttons');
               buttonsEl.innerHTML = `<button class="btn w-full btn-pulse-green" data-action="complete-mission" data-mission-id="${mission.id}">${mission.completion.buttonText}</button>`;
           }
        };
       this.manager.queueModal('mission-modal', mission.completion.title, mission.completion.text, null, options);
    }

    /**
     * Handles switching tabs within the Intel Screen (Codex vs Market).
     * @param {HTMLElement} element 
     */
    handleSetIntelTab(element) {
        const targetId = element.dataset.target;
        if (!targetId) return;

        if (this.manager.simulationService) {
            this.manager.simulationService.setIntelTab(targetId);
        }
    }

    /**
     * Updates the active class for Intel tabs in the DOM.
     * @param {string} activeTabId 
     */
    updateIntelTab(activeTabId) {
        const screen = this.manager.cache.intelScreen;
        if (!screen) return;
        
        const subNavBar = screen.querySelector('.sub-nav-bar');
        if (!subNavBar) return;
        
        screen.querySelectorAll('.sub-nav-button').forEach(btn => btn.classList.remove('active'));
        screen.querySelectorAll('.intel-tab-content').forEach(content => content.classList.remove('active'));
        const activeTabButton = screen.querySelector(`.sub-nav-button[data-target="${activeTabId}"]`);
        const activeContent = screen.querySelector(`#${activeTabId}`);

        if (activeTabButton) activeTabButton.classList.add('active');
        if (activeContent) activeContent.classList.add('active');

        if (activeTabId === 'intel-market-content') {
            subNavBar.classList.add('market-active');
        } else {
            subNavBar.classList.remove('market-active');
        }
    }

    /**
     * Prepares and shows the "Buy Intel" confirmation modal.
     * @param {HTMLElement} element 
     */
    handleShowIntelOffer(element) {
        const { packetId, locationId, price } = element.dataset;
        const packet = this._findIntelPacket(packetId, locationId);
        if (!packet) return;
        
        const locationName = DB.MARKETS.find(m => m.id === packet.dealLocationId)?.name || 'a distant market';

        let msg;
        if (packet.messageKey) {
             msg = INTEL_CONTENT[packet.messageKey];
        } else if (packet.messageIndex !== undefined) {
            let msgArray = INTEL_CONTENT[packet.locationId]; 
            if (packet.fallbackMsg) { 
                msgArray = INTEL_CONTENT[packet.fallbackMsgSource];
            }
            if (!msgArray) {
                this.manager.logger.warn('UIMissionControl', `SaveCompat: No message array for ${packet.locationId}, using fallback.`);
                msgArray = INTEL_CONTENT["CORP_FAILURE_01"]; 
            }
            msg = msgArray ? msgArray[packet.messageIndex] : null;
        }

        const vagueText = (msg?.sample || "Intel available at [location name].")
            .replace('[location name]', locationName); 
        
        const priceNum = parseInt(price, 10);
        
        const purchaseButtonHTML = `
            <button class="btn btn-module btn-module-credit" 
                    data-action="buy_intel" 
                    data-packet-id="${packet.id}" 
                    data-location-id="${locationId}" 
                    data-price="${priceNum}">
                Purchase Intel (<span class="credits-text-pulsing">${formatCredits(priceNum, true)}</span>)
            </button>`;

        this.manager.queueModal('event-modal', 'Intel Offer', vagueText, null, {
            theme: locationId, 
            dismissOutside: true, 
            footer: purchaseButtonHTML 
        });
    }

    /**
     * Executes the purchase of an intel packet.
     * @param {HTMLElement} element 
     * @param {Event} e 
     */
    handleBuyIntel(element, e) {
        const { packetId, locationId, price } = element.dataset;
        const priceNum = parseInt(price, 10);
        const purchasedPacket = this.manager.intelService.purchaseIntel(packetId, locationId, priceNum);

        if (purchasedPacket) {
            this.manager.hideModal('event-modal'); 
            
             if(e) {
                this.manager.createFloatingText(`-${formatCredits(priceNum, false)}`, e.clientX, e.clientY, '#f87171');
            }

            const updatedPacket = this._findIntelPacket(packetId, locationId);
            if (updatedPacket) {
                this._showIntelDetailsModal(updatedPacket, updatedPacket.pricePaid, locationId);
            }

        } else {
            this.manager.hideModal('event-modal');
            this.manager.queueModal('event-modal', 'Purchase Failed', 'Unable to purchase intel. You may already have an active deal or insufficient credits.');
        }
    }

    handleShowIntelDetails(element) {
        const { packetId, locationId } = element.dataset;
        const packet = this._findIntelPacket(packetId, locationId);
        if (!packet) return;

        const price = packet.pricePaid || this.manager.intelService.calculateIntelPrice(packet);
        this._showIntelDetailsModal(packet, price, locationId);
    }

    _findIntelPacket(packetId, locationId) {
        const state = this.manager.lastKnownState;
        if (state.intelMarket[locationId]) {
            const packet = state.intelMarket[locationId].find(p => p.id === packetId);
            if (packet) return packet;
        }

        for (const locId of Object.keys(state.intelMarket)) {
            const packet = state.intelMarket[locId].find(p => p.id === packetId);
            if (packet) {
                return packet;
            }
        }
        
        this.manager.logger.error('UIMissionControl', `_findIntelPacket: Could not find packet ${packetId} anywhere.`);
        return null;
    }

    _showIntelDetailsModal(packet, price, locationId) {
        let detailsTemplate;
        let isNewFormat = false; 

        if (packet.messageKey) {
             detailsTemplate = INTEL_CONTENT[packet.messageKey]?.details || "No details found.";
            isNewFormat = true; 
        } else if (packet.messageIndex !== undefined) {
            this.manager.logger.warn('UIMissionControl', `SaveCompat: Found old packet with messageIndex ${packet.messageIndex}`);
            detailsTemplate = "Details for this expired intel packet are no longer available in the new system.";
        } else {
            // Legacy/Fallback support
            const originalContent = {
                "CORPORATE_LIQUIDATION": { "details": "PACKET DECRYPTED: A [commodity name] surplus at [location name] allows for purchase at [discount amount %] below galactic average. This price is locked for [durationDays] days. A minor Corporate State is quietly liquidating assets to meet quarterly quotas. This is a standard, low-risk procurement opportunity. This intel was secured for [⌬ credit price]." },
                 "SUPPLY_CHAIN_SHOCK": { "details": "DATA UNLOCKED: [commodity name] is available at [location name] for [discount amount %] off standard pricing. This window is open for [durationDays] days. A Merchant's Guild freighter was damaged, forcing them to offload their cargo here at a loss. Their misfortune is your gain. This access was [⌬ credit price]." }
            };
            detailsTemplate = originalContent[packet.messageKey]?.details || "Packet is corrupted. No message data found.";
        }

        const formattedDetails = this._formatIntelDetails(detailsTemplate, packet, price, isNewFormat);

        this.manager.queueModal('event-modal', 'Intel Unlocked', formattedDetails, null, {
            theme: locationId, 
            dismissInside: true, 
            dismissOutside: true,
            footer: null, 
            contentClass: 'text-left' 
        });
    }

    _formatIntelDetails(template, packet, price, isNewFormat) {
        const locationName = DB.MARKETS.find(m => m.id === packet.dealLocationId)?.name || 'an unknown location';
        const commodityName = DB.COMMODITIES.find(c => c.id === packet.commodityId)?.name || 'a mystery commodity';
        const discountStr = `${Math.floor(packet.discountPercent * 100)}%`;
        const priceStr = price ? formatCredits(-price, true) : '???';

        const currentDay = this.manager.intelService.getCurrentDay();
        const remainingDays = Math.max(0, (packet.expiryDay || 0) - currentDay);
        
        let durationStr;
        if (remainingDays === 0) {
            durationStr = "less than a day";
        } else if (remainingDays === 1) {
            durationStr = "1 day";
        } else {
            durationStr = `${remainingDays} days`;
        }
        
        let result = template
             .replace(/\[location name\]/g, locationName)
            .replace(/\[commodity name\]/g, commodityName)
            .replace(/\[discount amount %\]/g, discountStr);

        result = result.replace(/\[durationDays\]\s*days/g, durationStr); 
        result = result.replace(/\[durationDays\]/g, durationStr); 
        
        result = result.replace(/<span class="credits-text-pulsing">⌬ \[credit price\]<\/span>/g, `<span class="text-glow-red">${priceStr}</span>`);
        result = result.replace(/\[⌬ credit price\]/g, `<span class="text-glow-red">${priceStr}</span>`);

         return result;
    }
}