// js/services/SimulationService.js
/**
 * @fileoverview This file contains the SimulationService class, which acts as the core game engine.
 * It is responsible for all primary game logic, including player actions (travel, trade, etc.),
 * time progression, and event triggers. It is the only service that should directly modify the GameState.
 */
import { DB } from '../data/database.js';
import { calculateInventoryUsed, formatCredits } from '../utils.js';
import { GAME_RULES, SAVE_KEY, SHIP_IDS, LOCATION_IDS, NAV_IDS, SCREEN_IDS, PERK_IDS, COMMODITY_IDS, ACTION_IDS, WEALTH_MILESTONES, MARKET_IMPACT_RULES } from '../data/constants.js';
import { applyEffect } from './eventEffectResolver.js';
import { MarketService } from './simulation/MarketService.js';

/**
 * @class SimulationService
 * @description Manages the core game loop, player actions, and state changes.
 */
export class SimulationService {
    /**
     * @param {import('./GameState.js').GameState} gameState - The central state object.
     * @param {import('./UIManager.js').UIManager} uiManager - The UI rendering service.
     */
    constructor(gameState, uiManager) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.tutorialService = null; // Injected post-instantiation.
        this.missionService = null;  // Injected post-instantiation.
        this.marketService = new MarketService(gameState);
    }

    /**
     * Injects the TutorialService after all services have been instantiated.
     * @param {import('./TutorialService.js').TutorialService} tutorialService - The tutorial management service.
     */
    setTutorialService(tutorialService) {
        this.tutorialService = tutorialService;
    }

    /**
     * Injects the MissionService after all services have been instantiated.
     * @param {import('./MissionService.js').MissionService} missionService - The mission management service.
     */
    setMissionService(missionService) {
        this.missionService = missionService;
    }

    /**
     * Kicks off the interactive new game introduction sequence.
     */
    startIntroSequence() {
        if (!this.gameState.introSequenceActive) return;
        this.gameState.player.introStep = 0;
        this._showNextIntroModal();
    }

    /**
     * Displays the next modal in the introduction sequence based on the current step in the game state.
     * @private
     */
    _showNextIntroModal() {
        const step = DB.INTRO_SEQUENCE_V1.modals[this.gameState.player.introStep];
        if (!step) {
            this._endIntroSequence();
            return;
        }

        const options = {
            buttonClass: step.buttonClass,
            contentClass: step.contentClass,
        };
        let modalId = 'event-modal';

        // Use specialized modals for steps that require unique layouts or inputs.
        if (step.id === 'charter' || step.id === 'signature') {
            modalId = `${step.id}-modal`;
            options.customSetup = (modal, closeHandler) => { this._setupIntroModal(modal, step, closeHandler) };
        } else {
            options.customSetup = (modal, closeHandler) => {
                const btnContainer = modal.querySelector('#event-button-container');
                if (!btnContainer) return;
                btnContainer.innerHTML = '';

                const button = document.createElement('button');
                button.className = 'btn px-6 py-2';
                if(step.buttonClass) button.classList.add(step.buttonClass);
                button.id = 'intro-next-btn';
                button.innerHTML = step.buttonText;
                button.onclick = (e) => {
                    e.target.disabled = true; // Prevent spamming.
                    closeHandler();
                };
                btnContainer.appendChild(button);
            };
        }

        this.uiManager.queueModal(modalId, step.title, step.description, null, options);
    }

    /**
     * Performs custom setup for interactive modals in the intro, like the signature input.
     * @param {HTMLElement} modal - The modal element to be configured.
     * @param {object} step - The current intro step data from the database.
     * @param {function} closeHandler - The function to call to close the modal and continue the sequence.
     * @private
     */
    _setupIntroModal(modal, step, closeHandler) {
        const buttonContainer = modal.querySelector(`#${step.id}-button-container`);
        buttonContainer.innerHTML = '';
        const button = document.createElement('button');
        button.className = 'btn px-6 py-2';
        button.innerHTML = step.buttonText;
        button.onclick = (e) => {
            e.target.disabled = true;
            closeHandler();
        };
        buttonContainer.appendChild(button);

        if (step.id === 'signature') {
            const input = modal.querySelector('#signature-input');
            input.value = '';
            button.id = 'intro-submit-btn';
            button.disabled = true;
            
            // The actual logic is in handleIntroClick; this just closes the modal.
            button.onclick = closeHandler;

            input.oninput = () => {
                button.disabled = input.value.trim() === '';
            };
        } else {
            button.id = 'intro-next-btn';
        }
    }

    /**
     * Handles all delegated click events during the intro sequence to manage its flow.
     * @param {Event} e - The click event object.
     */
    handleIntroClick(e) {
        const button = e.target.closest('button');
        if (!button) return;
        const targetId = button.id;
        
        if (targetId === 'intro-next-btn') {
            button.disabled = true;
            this.gameState.player.introStep++;
            this._showNextIntroModal();
        } else if (targetId === 'intro-submit-btn') {
            button.disabled = true;
            const input = document.getElementById('signature-input');
            let playerName = input.value.trim().replace(/[^a-zA-Z0-9 ]/g, '');
            if (!playerName) {
                this.uiManager.queueModal('event-modal', 'Invalid Signature', "The Merchant's Guild requires a name on the contract. Please provide your legal mark.");
                button.disabled = false;
                this._showNextIntroModal(); // Re-show signature modal.
            } else {
                this.gameState.player.name = playerName;
                this.gameState.player.debt = 25000;
                this.gameState.player.loanStartDate = this.gameState.day;
                this.gameState.player.monthlyInterestAmount = 1300;

                // Remove the default starter ship to prepare for the tutorial purchase.
                this.gameState.player.ownedShipIds = [];
                delete this.gameState.player.shipStates[SHIP_IDS.WANDERER];
                delete this.gameState.player.inventories[SHIP_IDS.WANDERER];
                this.gameState.player.activeShipId = null;

                this._startProcessingSequence();
            }
        }
    }

    /**
     * Manages the animated sequence for loan processing and transitions to the main game UI.
     * @private
     */
    _startProcessingSequence() {
        const showApprovalModal = () => {
            const title = 'Loan Approved';
            const description = `Dear ${this.gameState.player.name},<br><br>Your line of credit has been approved.<br><br><span class="credits-text-pulsing">⌬25,000</span> is ready to transfer to your account.`;
            const hangarTransition = (event) => {
                const button = event.target;
                if(button) button.disabled = true;
                
                this.uiManager.createFloatingText(`+${formatCredits(25000, false)}`, event.clientX, event.clientY, '#34d399');
                
                this.gameState.player.credits += 25000;

                setTimeout(() => {
                    document.getElementById('game-container').classList.remove('hidden');
                    this.uiManager.render(this.gameState.getState()); // Initial render of main UI.
                    this.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.HANGAR);
                    this.tutorialService.checkState({ type: 'ACTION', action: 'INTRO_START_HANGAR' });
                }, 2000);
            };

            this.uiManager.queueModal('event-modal', title, description, null, {
                contentClass: 'text-center',
                customSetup: (modal, closeHandler) => {
                    modal.querySelector('.modal-content').classList.add('modal-theme-admin');
                    const btnContainer = modal.querySelector('#event-button-container');

                    btnContainer.innerHTML = '';
                    const button = document.createElement('button');
                    button.className = 'btn px-6 py-2';
                    button.innerHTML = 'Accept Transfer';
                    button.onclick = (event) => {
                        hangarTransition(event);
                        closeHandler();
                    };
                    btnContainer.appendChild(button);
                }
            });
        };
        
        this.uiManager.showProcessingAnimation(this.gameState.player.name, showApprovalModal);
    }
    
    /**
     * Continues the intro sequence after a tutorial batch (e.g., Hangar) is completed.
     * @param {string} completedBatchId - The ID of the tutorial batch that just finished.
     * @private
     */
    _continueIntroSequence(completedBatchId) {
        if (completedBatchId === 'intro_hangar') {
            this.setScreen(NAV_IDS.DATA, SCREEN_IDS.FINANCE);
            this.tutorialService.checkState({ type: 'ACTION', action: 'INTRO_START_FINANCE' });
        } else if (completedBatchId === 'intro_finance') {
            this._endIntroSequence();
        }
    }

    /**
     * Finalizes the intro sequence, unlocks the UI, and shows the final introductory modal.
     * @private
     */
    _endIntroSequence() {
        this.gameState.introSequenceActive = false;
        const finalStep = DB.INTRO_SEQUENCE_V1.modals.find(s => s.id === 'final');
        const shipName = DB.SHIPS[this.gameState.player.activeShipId].name;
        const buttonText = finalStep.buttonText.replace('{shipName}', shipName);
    
        // Temporarily re-apply a navLock for the final modal to guide the player.
        this.gameState.tutorials.navLock = { navId: NAV_IDS.DATA, screenId: SCREEN_IDS.FINANCE };
    
        this.uiManager.queueModal('event-modal', finalStep.title, finalStep.description, () => {
             this.setScreen(NAV_IDS.DATA, SCREEN_IDS.MISSIONS);
             this.tutorialService.checkState({ type: 'ACTION', action: 'INTRO_START_MISSIONS' });
        }, { buttonText: buttonText });
        
        // Force a full re-render to unlock all UI elements now that the intro is over.
        this.uiManager.render(this.gameState.getState());
    }

    /**
     * Sets the active navigation tab and screen, triggering a full UI re-render.
     * @param {string} navId - The ID of the main navigation tab (e.g., 'ship', 'starport').
     * @param {string} screenId - The ID of the sub-navigation screen to display.
     */
    setScreen(navId, screenId) {
        const newLastActive = { ...this.gameState.lastActiveScreen, [navId]: screenId };
        this.gameState.setState({ 
            activeNav: navId, 
            activeScreen: screenId,
            lastActiveScreen: newLastActive 
        });
        if (this.tutorialService) {
            this.tutorialService.checkState({ type: 'SCREEN_LOAD', screenId: screenId });
        }
    }

    /**
     * Initiates travel to a new location after validating fuel and other conditions.
     * @param {string} locationId - The ID of the destination market.
     */
    travelTo(locationId) {
        const { tutorials } = this.gameState;
        const { navLock } = tutorials;

        // Prevent travel if a tutorial has locked navigation to a specific destination.
        if (navLock && navLock.screenId === SCREEN_IDS.NAVIGATION && navLock.enabledElementQuery) {
            if (!navLock.enabledElementQuery.includes(`[data-location-id='${locationId}']`)) {
                return; // Exit if it's not the required destination.
            }
        }

        const state = this.gameState.getState();
        if (state.isGameOver || state.pendingTravel) return;
        if (state.currentLocationId === locationId) {
            this.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.MARKET);
            return;
        }

        const activeShip = this._getActiveShip();
        if (!activeShip) {
            this.uiManager.queueModal('event-modal', "No Active Ship", "You must have an active vessel to travel.");
            return;
        }
        const travelInfo = state.TRAVEL_DATA[state.currentLocationId][locationId];
        let requiredFuel = travelInfo.fuelCost;
        if (state.player.activePerks[PERK_IDS.NAVIGATOR]) {
            requiredFuel = Math.round(requiredFuel * DB.PERKS[PERK_IDS.NAVIGATOR].fuelMod);
        }

        if (activeShip.maxFuel < requiredFuel) {
            this.uiManager.queueModal('event-modal', "Fuel Capacity Insufficient", `Your ship's fuel tank is too small. This trip requires ${requiredFuel} fuel, but you can only hold ${activeShip.maxFuel}.`);
            return;
        }
        if (activeShip.fuel < requiredFuel) {
            this.uiManager.queueModal('event-modal', "Insufficient Fuel", `You need ${requiredFuel} fuel but only have ${Math.floor(activeShip.fuel)}.`);
            return;
        }

        // Skip random event check during the first tutorial flight for a smoother experience.
        const isFirstTutorialFlight = state.tutorials.activeBatchId === 'intro_missions' && state.tutorials.activeStepId === 'mission_1_6';
        if (!isFirstTutorialFlight) {
            if (this._checkForRandomEvent(locationId)) {
                return; // Pause travel if a random event is triggered.
            }
        }

        this.initiateTravel(locationId);
    }

    /**
     * Executes the core travel logic: applies fuel costs and hull damage, advances time, and shows the animation.
     * @param {string} locationId - The destination location ID.
     * @param {object} [eventMods={}] - Modifications to travel parameters from a random event.
     */
    initiateTravel(locationId, eventMods = {}) {
        const state = this.gameState.getState();
        const fromId = state.currentLocationId;
        let travelInfo = { ...state.TRAVEL_DATA[fromId][locationId] };

        // Apply perk-based travel modifiers.
        if (state.player.activePerks[PERK_IDS.NAVIGATOR]) {
            travelInfo.time = Math.round(travelInfo.time * DB.PERKS[PERK_IDS.NAVIGATOR].travelTimeMod);
            travelInfo.fuelCost = Math.round(travelInfo.fuelCost * DB.PERKS[PERK_IDS.NAVIGATOR].fuelMod);
        }

        // Apply event-based travel modifiers.
        if (eventMods.travelTimeAdd) travelInfo.time += eventMods.travelTimeAdd;
        if (eventMods.travelTimeAddPercent) travelInfo.time *= (1 + eventMods.travelTimeAddPercent);
        if (eventMods.setTravelTime) travelInfo.time = eventMods.setTravelTime;
        travelInfo.time = Math.max(1, Math.round(travelInfo.time));

        const activeShip = this._getActiveShip();
        const activeShipState = this.gameState.player.shipStates[activeShip.id];
        
        if (activeShip.fuel < travelInfo.fuelCost) {
            this.uiManager.queueModal('event-modal', "Insufficient Fuel", `Trip modifications left you without enough fuel. You need ${travelInfo.fuelCost} but only have ${Math.floor(activeShip.fuel)}.`);
            return;
        }

        // Trigger a specific debug event if forced.
        if (eventMods.forceEvent) {
            if (this._checkForRandomEvent(locationId, true)) {
                return;
            }
        }


        let travelHullDamage = travelInfo.time * GAME_RULES.HULL_DECAY_PER_TRAVEL_DAY;
        if (state.player.activePerks[PERK_IDS.NAVIGATOR]) travelHullDamage *= DB.PERKS[PERK_IDS.NAVIGATOR].hullDecayMod;
        const eventHullDamageValue = activeShip.maxHealth * ((eventMods.eventHullDamagePercent || 0) / 100);
        const totalHullDamageValue = travelHullDamage + eventHullDamageValue;
        
        activeShipState.health -= totalHullDamageValue;
        this._checkHullWarnings(activeShip.id);

        if (activeShipState.health <= 0) {
            this._handleShipDestruction(activeShip.id);
            return;
        }
        
        activeShipState.fuel -= travelInfo.fuelCost;
        this._advanceDays(travelInfo.time);
        if (this.gameState.isGameOver) return;
        
        this.gameState.setState({ currentLocationId: locationId, pendingTravel: null });

        const fromLocation = DB.MARKETS.find(m => m.id === fromId);
        const destination = DB.MARKETS.find(m => m.id === locationId);
        const totalHullDamagePercentForDisplay = (totalHullDamageValue / activeShip.maxHealth) * 100;
        
        const finalCallback = () => {
            if (this.gameState.tutorials.activeBatchId === 'intro_missions' && this.gameState.tutorials.activeStepId === 'mission_1_7' && locationId === LOCATION_IDS.LUNA) {
                this.setScreen(NAV_IDS.DATA, SCREEN_IDS.MISSIONS);
            } else {
                this.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.MARKET);
            }
        };
        
        this.uiManager.showTravelAnimation(fromLocation, destination, travelInfo, totalHullDamagePercentForDisplay, finalCallback);
    }
    
    /**
     * Resumes a pending travel action after it was interrupted by an event.
     */
    resumeTravel() {
        if (!this.gameState.pendingTravel) return;
        const { destinationId, ...eventMods } = this.gameState.pendingTravel;
        this.initiateTravel(destinationId, eventMods);
    }

    /**
     * Calculates the effect of diminishing returns on a sale.
     * @param {string} goodId The ID of the commodity being sold.
     * @param {number} quantity The amount being sold.
     * @param {string} locationId The ID of the market location.
     * @returns {{totalPrice: number, effectivePricePerUnit: number}}
     * @private
     */
    _calculateDiminishingReturns(goodId, quantity, locationId) {
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        const marketStock = this.gameState.market.inventory[locationId][goodId].quantity;
        const basePrice = this.uiManager.getItemPrice(this.gameState.getState(), goodId, true);
        
        const threshold = marketStock * 0.1;
        if (quantity <= threshold) {
            return { totalPrice: basePrice * quantity, effectivePricePerUnit: basePrice };
        }

        const excessRatio = quantity / marketStock;
        let reduction = 0;

        if (good.tier <= 2) { // Low-Tier
            reduction = Math.min(0.10, (excessRatio - 0.1) * 0.2);
        } else if (good.tier <= 5) { // Mid-Tier
            reduction = Math.min(0.25, (excessRatio - 0.1) * 0.5);
        } else { // High-Tier
            reduction = Math.min(0.40, (excessRatio - 0.1) * 0.8);
        }
        
        const effectivePrice = basePrice * (1 - reduction);
        return {
            totalPrice: Math.floor(effectivePrice * quantity),
            effectivePricePerUnit: effectivePrice
        };
    }

    /**
     * Handles the purchase of a specified quantity of a commodity from the current market.
     * @param {string} goodId - The COMMODITY_ID of the item to purchase.
     * @param {number} quantity - The integer amount to buy.
     * @returns {boolean} - True if the purchase was successful, false otherwise.
     */
    buyItem(goodId, quantity) {
        const state = this.gameState.getState();
        if (state.isGameOver || quantity <= 0) return false;
        
        const good = DB.COMMODITIES.find(c=>c.id===goodId);
        if (good.licenseId && !state.player.unlockedLicenseIds.includes(good.licenseId)) {
            this.uiManager.queueModal('event-modal', "License Required", `You do not have the required license to trade ${good.name}.`);
            return false;
        }

        const price = this.uiManager.getItemPrice(state, goodId);
        const totalCost = price * quantity;
        const marketStock = state.market.inventory[state.currentLocationId][goodId].quantity;

        if (marketStock <= 0) { this.uiManager.queueModal('event-modal', "Sold Out", `This station has no more ${good.name} available.`); return false; }
        if (quantity > marketStock) { this.uiManager.queueModal('event-modal', "Limited Stock", `This station only has ${marketStock} units available.`); return false; }
        
        const activeShip = this._getActiveShip();
        const activeInventory = this._getActiveInventory();
        if (calculateInventoryUsed(activeInventory) + quantity > activeShip.cargoCapacity) {
             this.uiManager.queueModal('event-modal', "Cargo Hold Full", "You don't have enough space.");
            return false;
        }
        if (state.player.credits < totalCost) { this.uiManager.queueModal('event-modal', "Insufficient Funds", "Your credit balance is too low."); return false; }

        const inventoryItem = this.gameState.market.inventory[state.currentLocationId][goodId];
        inventoryItem.quantity -= quantity;

        const playerInvItem = activeInventory[goodId];
        playerInvItem.avgCost = ((playerInvItem.quantity * playerInvItem.avgCost) + totalCost) / (playerInvItem.quantity + quantity);
        playerInvItem.quantity += quantity;
        
        this.gameState.player.credits -= totalCost;
        this._logConsolidatedTrade(good.name, quantity, -totalCost);
        this._checkMilestones();
        this.missionService.checkTriggers();
        
        this._applyMarketImpact(goodId, quantity, 'buy');
        this.gameState.setState({});

        return true;
    }

    /**
     * Sells a specified quantity of a commodity to the current market.
     * @param {string} goodId - The COMMODITY_ID of the item to sell.
     * @param {number} quantity - The integer amount to sell.
     * @returns {number} - The total value of the sale, or 0 if failed.
     */
    sellItem(goodId, quantity) {
        const state = this.gameState.getState();
        if (state.isGameOver || quantity <= 0) return 0;
        
        const good = DB.COMMODITIES.find(c=>c.id===goodId);
        if (good.licenseId && !state.player.unlockedLicenseIds.includes(good.licenseId)) {
            this.uiManager.queueModal('event-modal', "License Required", `You do not have the required license to trade ${good.name}.`);
            return 0;
        }

        const activeInventory = this._getActiveInventory();
        const item = activeInventory[goodId];
        if (!item || item.quantity < quantity) {
            this.uiManager.queueModal('event-modal', "Insufficient Inventory", `You do not have ${quantity} units of ${good.name} to sell.`);
            return 0;
        }

        const { totalPrice } = this._calculateDiminishingReturns(goodId, quantity, state.currentLocationId);
        let totalSaleValue = totalPrice;
        
        const profit = totalSaleValue - (item.avgCost * quantity);
        if (profit > 0) {
            let totalBonus = (state.player.activePerks[PERK_IDS.TRADEMASTER] ? DB.PERKS[PERK_IDS.TRADEMASTER].profitBonus : 0) + (state.player.birthdayProfitBonus || 0);
            totalSaleValue += profit * totalBonus;
        }
        
        totalSaleValue = Math.floor(totalSaleValue);
        this.gameState.player.credits += totalSaleValue;
        item.quantity -= quantity;
        if (item.quantity === 0) item.avgCost = 0;

        const inventoryItem = this.gameState.market.inventory[state.currentLocationId][goodId];
        inventoryItem.quantity += quantity;
        
        this._logConsolidatedTrade(good.name, quantity, totalSaleValue);
        
        this._checkMilestones();
        this.missionService.checkTriggers();
        
        this._applyMarketImpact(goodId, quantity, 'sell');
        this.gameState.setState({});
        
        return totalSaleValue;
    }

    /**
     * Applies a dynamic price adjustment to a commodity based on the volume of a player's transaction.
     * @param {string} goodId - The ID of the commodity traded.
     * @param {number} quantity - The amount traded.
     * @param {string} transactionType - 'buy' or 'sell'.
     * @private
     */
    _applyMarketImpact(goodId, quantity, transactionType) {
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        if (good.tier < MARKET_IMPACT_RULES.TIER_THRESHOLD) return;

        const marketDepth = good.canonicalAvailability[1];
        if (marketDepth === 0) return;

        const significance = quantity / marketDepth;
        const impact = Math.min(significance * MARKET_IMPACT_RULES.SENSITIVITY, MARKET_IMPACT_RULES.MAX_IMPACT);

        const price = this.gameState.market.prices[this.gameState.currentLocationId][goodId];
        const priceChange = price * impact * (transactionType === 'buy' ? 1 : -1);

        this.gameState.market.prices[this.gameState.currentLocationId][goodId] = Math.max(1, Math.round(price + priceChange));
    }


    /**
     * Purchases a new ship and adds it to the player's hangar.
     * @param {string} shipId - The ID of the ship to buy.
     * @returns {boolean} - True if the purchase was successful.
     */
    buyShip(shipId) {
        const ship = DB.SHIPS[shipId];
        if (this.gameState.player.credits < ship.price) {
            this.uiManager.queueModal('event-modal', "Insufficient Funds", "You cannot afford this ship.");
            return false;
        }
        
        this.gameState.player.credits -= ship.price;
        this._logTransaction('ship', -ship.price, `Purchased ${ship.name}`);
        this.addShipToHangar(shipId);
        this.uiManager.queueModal('event-modal', "Acquisition Complete", `The ${ship.name} has been transferred to your hangar.`);

        if (this.gameState.introSequenceActive) {
            this.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.BUY_SHIP });
        }

        this.gameState.setState({});
        return true;
    }

    /**
     * Sells a ship from the player's hangar.
     * @param {string} shipId - The ID of the ship to sell.
     * @returns {number|false} - The sale price, or false if the sale is not allowed.
     */
    sellShip(shipId) {
        const state = this.gameState.getState();
        if (state.player.ownedShipIds.length <= 1) {
            this.uiManager.queueModal('event-modal', "Action Blocked", "You cannot sell your last remaining ship.");
            return false;
        }
        if (shipId === state.player.activeShipId) {
            this.uiManager.queueModal('event-modal', "Action Blocked", "You cannot sell your active ship.");
            return false;
        }
        if (calculateInventoryUsed(state.player.inventories[shipId]) > 0) {
            this.uiManager.queueModal('event-modal', 'Cannot Sell Ship', 'This vessel\'s cargo hold is not empty.');
            return false;
        }

        const ship = DB.SHIPS[shipId];
        const salePrice = Math.floor(ship.price * GAME_RULES.SHIP_SELL_MODIFIER);
        this.gameState.player.credits += salePrice;
        this._logTransaction('ship', salePrice, `Sold ${ship.name}`);
        
        this.gameState.player.ownedShipIds = this.gameState.player.ownedShipIds.filter(id => id !== shipId);
        delete this.gameState.player.shipStates[shipId];
        delete this.gameState.player.inventories[shipId];

        this.uiManager.queueModal('event-modal', "Vessel Sold", `You sold the ${ship.name} for ${formatCredits(salePrice)}.`);
        this.gameState.setState({});
        return salePrice;
    }

    /**
     * Sets the player's currently active ship.
     * @param {string} shipId - The ID of the ship to make active.
     */
    setActiveShip(shipId) {
        if (!this.gameState.player.ownedShipIds.includes(shipId)) return;
        this.gameState.player.activeShipId = shipId;

        if (this.gameState.introSequenceActive) {
            this.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.SELECT_SHIP });
        }

        this.gameState.setState({});
    }

    /**
     * Pays off the player's entire outstanding debt.
     */
    payOffDebt() {
        if (this.gameState.isGameOver) return;
        const { player } = this.gameState;
        if (player.credits < player.debt) {
            this.uiManager.queueModal('event-modal', "Insufficient Funds", "You can't afford to pay off your entire debt.");
            return;
        }

        const debtAmount = player.debt;
        player.credits -= debtAmount;
        this._logTransaction('loan', -debtAmount, `Paid off ${formatCredits(debtAmount)} debt`);
        player.debt = 0;
        player.monthlyInterestAmount = 0;
        player.loanStartDate = null;

        this._checkMilestones();
        this.gameState.setState({});
    }
    
    /**
     * Allows the player to take out a loan, adding to their debt.
     * @param {object} loanData - Contains amount, fee, and interest for the loan.
     */
    takeLoan(loanData) {
        const { player, day } = this.gameState;
        if (player.debt > 0) {
            this.uiManager.queueModal('event-modal', "Loan Unavailable", `You must pay off your existing debt first.`);
            return;
        }
        if (player.credits < loanData.fee) {
            this.uiManager.queueModal('event-modal', "Unable to Secure Loan", `The financing fee is ${formatCredits(loanData.fee)}, but you only have ${formatCredits(player.credits)}.`);
            return;
        }

        player.credits -= loanData.fee;
        this._logTransaction('loan', -loanData.fee, `Financing fee for ${formatCredits(loanData.amount)} loan`);
        player.credits += loanData.amount;
        this._logTransaction('loan', loanData.amount, `Acquired ${formatCredits(loanData.amount)} loan`);

        player.debt += loanData.amount;
        player.monthlyInterestAmount = loanData.interest;
        player.loanStartDate = day;
        player.seenGarnishmentWarning = false;

        const loanDesc = `You've acquired a loan of <span class="hl-blue">${formatCredits(loanData.amount)}</span>.<br>A financing fee of <span class="hl-red">${formatCredits(loanData.fee)}</span> was deducted.`;
        this.uiManager.queueModal('event-modal', "Loan Acquired", loanDesc);
        this.gameState.setState({});
    }

    /**
     * Purchases a trade license for a specific commodity tier.
     * @param {string} licenseId - The ID of the license to purchase.
     * @returns {object} A structured object indicating success or failure with a specific error code.
     */
    purchaseLicense(licenseId) {
        const license = DB.LICENSES[licenseId];
        const { player } = this.gameState;

        if (!license) return { success: false, error: 'INVALID_LICENSE' };
        if (license.type !== 'purchase') return { success: false, error: 'NOT_FOR_PURCHASE' };
        if (player.unlockedLicenseIds.includes(licenseId)) return { success: false, error: 'ALREADY_OWNED' };
        if (player.credits < license.cost) return { success: false, error: 'INSUFFICIENT_FUNDS' };
        
        player.credits -= license.cost;
        player.unlockedLicenseIds.push(licenseId);
        this._logTransaction('license', -license.cost, `Purchased ${license.name}`);
        this.gameState.setState({});
        
        return { success: true };
    }

    /**
     * Purchases market intel, providing a temporary trade advantage.
     * @param {number} cost - The credit cost of the intel.
     */
    purchaseIntel(cost) {
        const { player, currentLocationId, day } = this.gameState;
        if (player.credits < cost) {
            this.uiManager.queueModal('event-modal', "Insufficient Funds", "You can't afford this intel.");
            return;
        }
        
        player.credits -= cost;
        this._logTransaction('intel', -cost, 'Purchased market intel');
        this.gameState.intel.available[currentLocationId] = false;

        const otherMarkets = DB.MARKETS.filter(m => m.id !== currentLocationId && player.unlockedLocationIds.includes(m.id));
        if (otherMarkets.length === 0) return;

        const targetMarket = otherMarkets[Math.floor(Math.random() * otherMarkets.length)];
        const availableCommodities = DB.COMMODITIES.filter(c => c.unlockLevel <= player.unlockedCommodityLevel);
        const commodity = availableCommodities[Math.floor(Math.random() * availableCommodities.length)];
        
        if (commodity) {
            this.gameState.intel.active = { 
                targetMarketId: targetMarket.id,
                commodityId: commodity.id, 
                type: 'demand',
                startDay: day,
                endDay: day + 100 
            };
        }
        this.gameState.setState({});
    }

    /**
     * Processes one "tick" of refueling while the button is held, costing credits and adding fuel.
     * @returns {number} - The cost of the fuel tick, or 0 if no fuel was added.
     */
    refuelTick() {
        const state = this.gameState;
        const ship = this._getActiveShip();
        if (ship.fuel >= ship.maxFuel) return 0;

        let costPerTick = DB.MARKETS.find(m => m.id === state.currentLocationId).fuelPrice / 2;
        if (state.player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && state.currentLocationId === LOCATION_IDS.VENUS) {
            costPerTick *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
        }
        if (state.player.credits < costPerTick) return 0;

        state.player.credits -= costPerTick;
        state.player.shipStates[ship.id].fuel = Math.min(ship.maxFuel, state.player.shipStates[ship.id].fuel + 5);
        this._logConsolidatedTransaction('fuel', -costPerTick, 'Fuel Purchase');
        this.gameState.setState({});
        return costPerTick;
    }

    /**
     * Processes one "tick" of repairing while the button is held, costing credits and restoring health.
     * @returns {number} - The cost of the repair tick, or 0 if no repairs were made.
     */
    repairTick() {
        const state = this.gameState;
        const ship = this._getActiveShip();
        if (ship.health >= ship.maxHealth) return 0;
        
        let costPerTick = (ship.maxHealth * (GAME_RULES.REPAIR_AMOUNT_PER_TICK / 100)) * GAME_RULES.REPAIR_COST_PER_HP;
        if (state.player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && state.currentLocationId === LOCATION_IDS.VENUS) {
            costPerTick *= (1 - DB.PERKS[PERK_IDS.VENETIAN_SYNDICATE].repairDiscount);
        }
        if (state.player.credits < costPerTick) return 0;
        
        state.player.credits -= costPerTick;
        state.player.shipStates[ship.id].health = Math.min(ship.maxHealth, state.player.shipStates[ship.id].health + (ship.maxHealth * (GAME_RULES.REPAIR_AMOUNT_PER_TICK / 100)));
        this._logConsolidatedTransaction('repair', -costPerTick, 'Hull Repairs');
        this._checkHullWarnings(ship.id);
        this.gameState.setState({});
        return costPerTick;
    }

    /**
     * Advances game time by a specified number of days, triggering daily, weekly, and monthly events.
     * @param {number} days - The integer number of days to advance.
     * @private
     */
    _advanceDays(days) {
        let marketUpdated = false;

        for (let i = 0; i < days; i++) {
            if (this.gameState.isGameOver) return;
            this.gameState.day++;

            const dayOfYear = (this.gameState.day - 1) % 365;
            const currentYear = DB.DATE_CONFIG.START_YEAR + Math.floor((this.gameState.day - 1) / 365);

            // Check for player's birthday to grant an experience bonus.
            if (dayOfYear === 11 && currentYear > this.gameState.player.lastBirthdayYear) {
                this.gameState.player.playerAge++;
                this.gameState.player.birthdayProfitBonus += 0.01;
                this.gameState.player.lastBirthdayYear = currentYear;
                this.uiManager.queueModal('event-modal', `Captain ${this.gameState.player.name}`, `You are now ${this.gameState.player.playerAge}. You feel older and wiser.<br><br>Your experience now grants you an additional 1% profit on all trades.`);
            }

            this._checkAgeEvents();

            // The main weekly "tick" for updating market prices and stock.
            if ((this.gameState.day - this.gameState.lastMarketUpdateDay) >= 7) {
                this.marketService.checkForSystemStateChange();
                this.marketService.evolveMarketPrices();
                this.marketService.replenishMarketInventory();
                this._updateShipyardStock();
                this.gameState.lastMarketUpdateDay = this.gameState.day;
                marketUpdated = true;
            }

            // Expire old intel.
            if (this.gameState.intel.active && this.gameState.day > this.gameState.intel.active.endDay) {
                this.gameState.intel.active = null;
            }
            
            // Passively repair any ships the player owns but is not currently flying.
            this.gameState.player.ownedShipIds.forEach(shipId => {
                if (shipId !== this.gameState.player.activeShipId) {
                    const ship = DB.SHIPS[shipId];
                    const repairAmount = ship.maxHealth * GAME_RULES.PASSIVE_REPAIR_RATE;
                    this.gameState.player.shipStates[shipId].health = Math.min(ship.maxHealth, this.gameState.player.shipStates[shipId].health + repairAmount);
                }
            });

            // Apply monthly interest to any outstanding debt.
            if (this.gameState.player.debt > 0 && (this.gameState.day - this.gameState.lastInterestChargeDay) >= GAME_RULES.INTEREST_INTERVAL) {
                const interest = this.gameState.player.monthlyInterestAmount;
                this.gameState.player.debt += interest;
                this._logTransaction('loan', interest, 'Monthly interest charge');
                this.gameState.lastInterestChargeDay = this.gameState.day;
            }
        }
        
        this.gameState.setState({});
    }
    
    /**
     * Checks for and triggers a random event based on a probability roll.
     * @param {string} destinationId - The intended travel destination, used to resume travel after the event.
     * @param {boolean|number} [force=false] - If true, bypasses the chance roll. If a number, triggers a specific event by index.
     * @returns {boolean} - True if an event was triggered, false otherwise.
     * @private
     */
    _checkForRandomEvent(destinationId, force = false) {
        if (force === false && Math.random() > GAME_RULES.RANDOM_EVENT_CHANCE) return false;

        const activeShip = this._getActiveShip();
        let event;

        if (typeof force === 'number') {
            event = DB.RANDOM_EVENTS[force];
        } else {
             const validEvents = DB.RANDOM_EVENTS.filter(event => 
                event.precondition(this.gameState.getState(), activeShip, this._getActiveInventory.bind(this))
            );
            if (validEvents.length === 0) return false;
            event = validEvents[Math.floor(Math.random() * validEvents.length)];
        }
        
        if (!event) {
            console.warn(`Debug event trigger failed for index: ${force}`);
            this.gameState.player.debugEventIndex = 0; // Reset index if out of bounds.
            return false;
        }

        this.gameState.setState({ pendingTravel: { destinationId } });
        this.uiManager.showRandomEventModal(event, (eventId, choiceIndex) => this._resolveEventChoice(eventId, choiceIndex));
        return true;
    }

    /**
     * Resolves the player's choice in a random event and applies the outcome.
     * @param {string} eventId - The ID of the event being resolved.
     * @param {number} choiceIndex - The index of the choice the player made.
     * @private
     */
    _resolveEventChoice(eventId, choiceIndex) {
        const event = DB.RANDOM_EVENTS.find(e => e.id === eventId);
        const choice = event.choices[choiceIndex];
        let random = Math.random();
        const chosenOutcome = choice.outcomes.find(o => (random -= o.chance) < 0) || choice.outcomes[choice.outcomes.length - 1];
    
        const effectResult = this._applyEventEffects(chosenOutcome);
    
        let description = chosenOutcome.description;
        // If the effect returned a dynamic description key, use it.
        if (effectResult && chosenOutcome.descriptions) {
            description = chosenOutcome.descriptions[effectResult.key];
            if (effectResult.amount) {
                description = description.replace('{amount}', effectResult.amount);
            }
        }
    
        this.uiManager.queueModal('event-modal', event.title, description, () => this.resumeTravel(), { buttonText: 'Continue Journey' });
    }

    /**
     * Applies a list of effects from a chosen event outcome by calling the effect resolver.
     * @param {object} outcome - The outcome object from the database containing an array of effects.
     * @private
     */
    _applyEventEffects(outcome) {
        let result = null;
        outcome.effects.forEach(effect => {
            const effectResult = applyEffect(this.gameState, this, effect, outcome);
            if (effectResult) {
                result = effectResult;
            }
        });
        this.gameState.setState({});
        return result;
    }

    /**
     * Checks for and triggers age-based narrative events based on game progression.
     * @private
     */
    _checkAgeEvents() {
        DB.AGE_EVENTS.forEach(event => {
            if (this.gameState.player.seenEvents.includes(event.id)) return;
            if ((event.trigger.day && this.gameState.day >= event.trigger.day) || (event.trigger.credits && this.gameState.player.credits >= event.trigger.credits)) {
                this.gameState.player.seenEvents.push(event.id);
                this.uiManager.showAgeEventModal(event, (choice) => this._applyPerk(choice));
            }
        });
    }

    /**
     * Applies a perk or special reward from an Age Event choice.
     * @param {object} choice - The choice object from the event data in the database.
     * @private
     */
    _applyPerk(choice) {
        if (choice.perkId) this.gameState.player.activePerks[choice.perkId] = true;
        if (choice.playerTitle) this.gameState.player.playerTitle = choice.playerTitle;
        if (choice.perkId === PERK_IDS.MERCHANT_GUILD_SHIP) {
            this.addShipToHangar(SHIP_IDS.STALWART);
            this.uiManager.queueModal('event-modal', 'Vessel Delivered', `The Merchant's Guild has delivered a new ${DB.SHIPS[SHIP_IDS.STALWART].name} to your hangar.`);
        }
        this.gameState.setState({});
    }

    /**
     * Retrieves a composite object of the player's active ship, combining static and dynamic data.
     * @returns {object|null} - The active ship's data, or null if no ship is active.
     * @private
     */
    _getActiveShip() {
        const state = this.gameState;
        const activeId = state.player.activeShipId;
        if (!activeId) return null;
        return { id: activeId, ...DB.SHIPS[activeId], ...state.player.shipStates[activeId] };
    }

    /**
     * Retrieves the inventory object of the currently active ship.
     * @returns {object|null} - The active ship's inventory object, or null.
     * @private
     */
    _getActiveInventory() {
        if (!this.gameState.player.activeShipId) return null;
        return this.gameState.player.inventories[this.gameState.player.activeShipId];
    }

    /**
     * Adds a new entry to the financial transaction log.
     * @param {string} type - The category of the transaction (e.g., 'trade', 'loan').
     * @param {number} amount - The credit amount (positive for income, negative for expense).
     * @param {string} description - A brief description of the transaction.
     * @private
     */
    _logTransaction(type, amount, description) {
        this.gameState.player.financeLog.push({ 
            day: this.gameState.day,
            type: type, 
            amount: amount,
            balance: this.gameState.player.credits,
            description: description
        });
    }

    /**
     * Logs a trade transaction, consolidating multiple trades of the same item on the same day.
     * @param {string} goodName - The name of the commodity traded.
     * @param {number} quantity - The amount of the commodity traded.
     * @param {number} transactionValue - The total credit value of the transaction.
     * @private
     */
    _logConsolidatedTrade(goodName, quantity, transactionValue) {
        const log = this.gameState.player.financeLog;
        const isBuy = transactionValue < 0;
        const actionWord = isBuy ? 'Bought' : 'Sold';

        // Find a matching entry from today for the same item and action type.
        const existingEntry = log.find(entry => 
            entry.day === this.gameState.day &&
            entry.type === 'trade' &&
            entry.description.startsWith(`${actionWord}`) &&
            entry.description.endsWith(` ${goodName}`) &&
            ((isBuy && entry.amount < 0) || (!isBuy && entry.amount > 0))
        );

        if (existingEntry) {
            existingEntry.amount += transactionValue;
            existingEntry.balance = this.gameState.player.credits;
            const match = existingEntry.description.match(/\s(\d+)x\s/);
            if (match) {
                const currentQty = parseInt(match[1], 10);
                const newQty = currentQty + quantity;
                existingEntry.description = `${actionWord} ${newQty}x ${goodName}`;
            }
        } else {
            // No existing entry for this item today, so push a new one.
            this._logTransaction('trade', transactionValue, `${actionWord} ${quantity}x ${goodName}`);
        }
    }

    /**
     * Consolidates recurring transactions like fuel or repairs on the same day into one log entry.
     * @param {string} type - The category of transaction (e.g., 'fuel', 'repair').
     * @param {number} amount - The amount to add to the existing entry.
     * @param {string} description - The description for a new entry if one doesn't exist.
     * @private
     */
    _logConsolidatedTransaction(type, amount, description) {
        const log = this.gameState.player.financeLog;
        const lastEntry = log.length > 0 ? log[log.length - 1] : null;
        
        if (lastEntry && lastEntry.day === this.gameState.day && lastEntry.type === type) {
            // Update the last entry if it matches.
            lastEntry.amount += amount;
            lastEntry.balance = this.gameState.player.credits;
        } else {
            // Otherwise, push a new entry.
            this._logTransaction(type, amount, description);
        }
    }

    /**
     * Checks if the player's wealth has reached a new milestone, revealing the next tier of commodities.
     * @private
     */
    _checkMilestones() {
        const { credits, revealedTier } = this.gameState.player;
        const nextMilestone = WEALTH_MILESTONES.find(m => m.revealsTier === revealedTier + 1);
    
        if (nextMilestone && credits >= nextMilestone.threshold) {
            this.gameState.player.revealedTier = nextMilestone.revealsTier;
            this.uiManager.queueModal('event-modal', 'New Opportunities', `Your financial success has drawn attention! New Tier ${nextMilestone.revealsTier} trading opportunities are now available.`);
            this.gameState.setState({});
        }
    }

    /**
     * Shows toast warnings to the player if their active ship's hull health is low.
     * @param {string} shipId - The ID of the ship to check.
     * @private
     */
    _checkHullWarnings(shipId) {
        const shipState = this.gameState.player.shipStates[shipId];
        const shipStatic = DB.SHIPS[shipId];
        const healthPct = (shipState.health / shipStatic.maxHealth) * 100;

        if (healthPct <= 15 && !shipState.hullAlerts.two) {
            shipState.hullAlerts.two = true;
        } else if (healthPct <= 30 && !shipState.hullAlerts.one) {
            shipState.hullAlerts.one = true;
        }

        if (healthPct > 30) shipState.hullAlerts.one = false;
        if (healthPct > 15) shipState.hullAlerts.two = false;
    }

    /**
     * Handles the destruction of a player ship and the potential game over condition.
     * @param {string} shipId - The ID of the destroyed ship.
     * @private
     */
    _handleShipDestruction(shipId) {
        const shipName = DB.SHIPS[shipId].name;
        this.gameState.player.ownedShipIds = this.gameState.player.ownedShipIds.filter(id => id !== shipId);
        delete this.gameState.player.shipStates[shipId];
        delete this.gameState.player.inventories[shipId];

        if (this.gameState.player.ownedShipIds.length === 0) {
            this._gameOver(`Your last ship, the ${shipName}, was destroyed. Your trading career ends here.`);
        } else {
            this.gameState.player.activeShipId = this.gameState.player.ownedShipIds[0];
            const newShipName = DB.SHIPS[this.gameState.player.activeShipId].name;
            const message = `The ${shipName} suffered a catastrophic hull breach and was destroyed. All cargo was lost.<br><br>You now command your backup vessel, the ${newShipName}.`;
            this.uiManager.queueModal('event-modal', 'Vessel Lost', message);
        }
        this.gameState.setState({});
    }

    /**
     * Ends the game, sets the gameOver flag, and displays a final message to the player.
     * @param {string} message - The game over message to display.
     * @private
     */
    _gameOver(message) {
        this.gameState.setState({ isGameOver: true });
        this.uiManager.queueModal('event-modal', "Game Over", message, () => {
            localStorage.removeItem(SAVE_KEY);
            window.location.reload();
        }, { buttonText: 'Restart' });
    }
    
    /**
     * Applies a monthly credit garnishment if the player's loan is delinquent.
     * @private
     */
    _applyGarnishment() {
        const { player, day } = this.gameState;
        if (player.debt > 0 && player.loanStartDate && (day - player.loanStartDate) >= GAME_RULES.LOAN_GARNISHMENT_DAYS) {
            const garnishedAmount = Math.floor(player.credits * GAME_RULES.LOAN_GARNISHMENT_PERCENT);
            if (garnishedAmount > 0) {
                player.credits -= garnishedAmount;
                this._logTransaction('debt', -garnishedAmount, 'Monthly credit garnishment');
            }

            if (!player.seenGarnishmentWarning) {
                const msg = "Your loan is delinquent. Your lender is now garnishing 14% of your credits monthly until the debt is paid.";
                this.uiManager.queueModal('event-modal', "Credit Garnishment Notice", msg, null, { buttonClass: 'bg-red-800/80' });
                player.seenGarnishmentWarning = true;
            }
        }
    }
    
    /**
     * Updates the shipyard stock for all unlocked locations on a weekly basis.
     * @private
     */
    _updateShipyardStock() {
        const { player } = this.gameState;

        player.unlockedLocationIds.forEach(locationId => {
            const stock = this.gameState.market.shipyardStock[locationId];
            
            if (stock && stock.day === this.gameState.day) {
                return; // Stock has already been generated for this day.
            }

            // Filter ships that can be sold at this location and are not already owned.
            const commonShips = Object.entries(DB.SHIPS).filter(([id, ship]) => !ship.isRare && ship.saleLocationId === locationId && !player.ownedShipIds.includes(id));
            const rareShips = Object.entries(DB.SHIPS).filter(([id, ship]) => ship.isRare && ship.saleLocationId === locationId && !player.ownedShipIds.includes(id));
            
            const shipsForSaleIds = [...commonShips.map(entry => entry[0])];
            
            // Add rare ships based on a chance roll.
            rareShips.forEach(([id, ship]) => {
                if (Math.random() < GAME_RULES.RARE_SHIP_CHANCE) {
                    shipsForSaleIds.push(id);
                }
            });

            this.gameState.market.shipyardStock[locationId] = {
                day: this.gameState.day,
                shipsForSale: shipsForSaleIds
            };
        });
    }

    /**
     * Applies a list of reward objects to the player's state from a source like a mission.
     * @param {Array<object>} rewards - An array of reward objects, e.g., [{ type: 'credits', amount: 10000 }].
     * @param {string} sourceName - The name of the source of the rewards (e.g., mission name).
     * @private
     */
    _grantRewards(rewards, sourceName) {
        rewards.forEach(reward => {
            if (reward.type === 'credits') {
                this.gameState.player.credits += reward.amount;
                this._logTransaction('mission', reward.amount, `Reward: ${sourceName}`);
                this.uiManager.createFloatingText(`+${formatCredits(reward.amount, false)}`, window.innerWidth / 2, window.innerHeight / 2, '#34d399');
            }
            // Grant license rewards
            if (reward.type === 'license') {
                if (!this.gameState.player.unlockedLicenseIds.includes(reward.licenseId)) {
                    this.gameState.player.unlockedLicenseIds.push(reward.licenseId);
                    const license = DB.LICENSES[reward.licenseId];
                    this.uiManager.queueModal('event-modal', 'License Granted', `You have been granted the ${license.name}.`);
                }
            }
        });
    }

    /**
     * Grants specific cargo items to the player's active ship inventory as part of a mission.
     * @param {string} missionId - The ID of the mission providing the cargo.
     */
    grantMissionCargo(missionId) {
        const mission = DB.MISSIONS[missionId];
        if (!mission || !mission.providedCargo) {
            return;
        }

        const inventory = this._getActiveInventory();
        if (!inventory) {
            console.error("Cannot grant mission cargo: No active inventory found.");
            return;
        }

        mission.providedCargo.forEach(cargo => {
            if (!inventory[cargo.goodId]) {
                inventory[cargo.goodId] = { quantity: 0, avgCost: 0 };
            }
            inventory[cargo.goodId].quantity += cargo.quantity;
        });

        if (this.missionService) {
            this.missionService.checkTriggers();
        }
    }

    // --- Debugging and Development Tools ---

    /**
     * Utility function to add a specified ship to the player's hangar.
     * @param {string} shipId - The ID of the ship to add.
     */
    addShipToHangar(shipId) {
        const ship = DB.SHIPS[shipId];
        if (!ship) return;

        this.gameState.player.ownedShipIds.push(shipId);
        this.gameState.player.shipStates[shipId] = { health: ship.maxHealth, fuel: ship.maxFuel, hullAlerts: { one: false, two: false } };
        this.gameState.player.inventories[shipId] = {};
        DB.COMMODITIES.forEach(c => { this.gameState.player.inventories[shipId][c.id] = { quantity: 0, avgCost: 0 }; });
    }

    /**
     * Debug function to skip the intro and set up a standard play state.
     */
    debugMarketSkip() {
        this.gameState.introSequenceActive = false;
        this.tutorialService.activeBatchId = null;
        this.tutorialService.activeStepId = null;
        this.gameState.tutorials.activeBatchId = null;
        this.gameState.tutorials.activeStepId = null; 
        this.gameState.tutorials.skippedTutorialBatches = Object.keys(DB.TUTORIAL_DATA);
        
        this.gameState.player.credits = 45000;
        this.gameState.player.ownedShipIds = [];
        this.addShipToHangar(SHIP_IDS.WANDERER);
        this.gameState.player.activeShipId = SHIP_IDS.WANDERER;
        this.gameState.player.unlockedLocationIds = DB.MARKETS.map(m => m.id);

        document.getElementById('game-container').classList.remove('hidden');
        this.setScreen(NAV_IDS.STARPORT, SCREEN_IDS.MARKET);
    }
    
    /**
     * Debug function to cycle through and trigger all random events in order.
     */
    debugTriggerRandomEvent() {
        const state = this.gameState.getState();
        const otherMarkets = DB.MARKETS.filter(m => m.id !== state.currentLocationId);
        if (otherMarkets.length > 0) {
            const destinationId = otherMarkets[Math.floor(Math.random() * otherMarkets.length)].id;
            this._checkForRandomEvent(destinationId, this.gameState.player.debugEventIndex);
            this.gameState.player.debugEventIndex = (this.gameState.player.debugEventIndex + 1) % DB.RANDOM_EVENTS.length;
        }
    }
}