// js/services/SimulationService.js
/**
 * @fileoverview This file contains the SimulationService class, which acts as the core game engine
 * facade. It instantiates all specialized game logic services and delegates calls to them,
 * providing a single, clean API for the EventManager.
 */
import { DB } from '../data/database.js';
import { calculateInventoryUsed, formatCredits } from '../utils.js';
import { GAME_RULES, SAVE_KEY, SHIP_IDS, PERK_IDS, ACTION_IDS, LOCATION_IDS } from '../data/constants.js';
import { playBlockingAnimation, playBlockingAnimationAndRemove } from './ui/AnimationService.js';
import { saveStorageService } from './SaveStorageService.js';
import { MarketService } from './simulation/MarketService.js';
import { IntroService } from './game/IntroService.js';
import { PlayerActionService } from './player/PlayerActionService.js';
import { TimeService } from './world/TimeService.js';
import { TravelService } from './world/TravelService.js';
import { IntelService } from './IntelService.js';
import { GameAttributes } from './GameAttributes.js'; 
import { RandomEventService } from './RandomEventService.js'; 
import { SolStationService } from './SolStationService.js'; 
import { BankruptcyService } from './BankruptcyService.js';
import { OFFICERS } from '../data/officers.js'; 
import { ToastService } from './ToastService.js';

export class SimulationService {
    /**
     * @param {import('./GameState.js').GameState} gameState - The central state object.
     * @param {import('./UIManager.js').UIManager} uiManager - The UI rendering service.
     * @param {import('./LoggingService.js').Logger} logger - The logging utility.
     * @param {import('./NewsTickerService.js').NewsTickerService} newsTickerService - The news ticker service.
     */
    constructor(gameState, uiManager, logger, newsTickerService) { 
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.logger = logger;
        this.newsTickerService = newsTickerService; 
        this.missionService = null;  
        this.intelService = null; 

        this.marketService = new MarketService(gameState);
        this.timeService = new TimeService(gameState, this.marketService, uiManager, logger, newsTickerService); 
        this.travelService = new TravelService(gameState, uiManager, this.timeService, logger, this);
        this.introService = new IntroService(gameState, uiManager, logger, this);
        this.playerActionService = new PlayerActionService(gameState, uiManager, null, this.marketService, this.timeService, logger, this);

        this.randomEventService = new RandomEventService();

        this.solStationService = new SolStationService(gameState, logger);
        this.timeService.solStationService = this.solStationService;
        this.solStationService.setTimeService(this.timeService);

        this.intelService = new IntelService(gameState, this.timeService, this.marketService, this.newsTickerService, logger);
        this.bankruptcyService = new BankruptcyService();
        this.toastService = new ToastService(gameState, uiManager, this);

        this.timeService.intelService = this.intelService;
        this.uiManager.setIntelService(this.intelService); 
        this.timeService.simulationService = this;
        this.uiManager.setSimulationService(this);
        this.newsTickerService.setServices(this, this.marketService);
        
        // Initialize Bankruptcy hooks
        this.bankruptcyService.setServices(this.gameState, this.timeService, this.marketService, this.solStationService, this.uiManager);

        if (this.gameState.currentLocationId === 'sol') {
            this.solStationService.startLocalLiveLoop();
        }
    }

    setMissionService(missionService) {
        this.missionService = missionService;
        this.playerActionService.missionService = missionService;
    }

    setNavigationLock(navIds = [], screenIds = []) {
        const nIds = Array.isArray(navIds) ? navIds : (navIds ? [navIds] : []);
        const sIds = Array.isArray(screenIds) ? screenIds : (screenIds ? [screenIds] : []);

        this.gameState.setState({
            tutorials: {
                ...this.gameState.tutorials,
                guidedNavPath: { active: true, navIds: nIds, screenIds: sIds }
            }
        });
    }

    clearNavigationLock() {
        this.gameState.setState({
            tutorials: {
                ...this.gameState.tutorials,
                guidedNavPath: { active: false, navIds: [], screenIds: [] }
            }
        });
    }

    async saveGame() {
        if (!this.gameState.slotId) return;

        try {
            const stateToSave = this.gameState.exportState();
            const activeShipId = stateToSave.player.activeShipId;
            const shipName = DB.SHIPS[activeShipId]?.name || "Unknown";
            
            const payload = {
                version: "36.10",
                slotId: this.gameState.slotId,
                metadata: {
                    realDate: new Date().toLocaleDateString(),
                    inGameDay: stateToSave.day,
                    creditsFormatted: formatCredits(stateToSave.player.credits),
                    shipName: shipName
                },
                state: stateToSave
            };

            await saveStorageService.saveGame(this.gameState.slotId, payload);
            this.logger.info.system('SimulationService', this.gameState.day, 'SAVE_COMPLETE', `Auto-saved to ${this.gameState.slotId}`);
        } catch (error) {
            this.logger.error('SimulationService', `Background auto-save failed: ${error.message}`);
        }
    }

    forceTriggerEvent(eventId) {
        const rawEventDef = this.randomEventService.getEventById(eventId);
        if (!rawEventDef) {
            this.logger.error('SimulationService', `Cannot force trigger event: ID '${eventId}' not found.`);
            return;
        }

        this.logger.info.system('SimulationService', this.gameState.day, 'EVENT_FORCE', `Debug forcing event: ${rawEventDef.template.title}`);
        
        const eventDef = { ...rawEventDef };
        if (eventDef.choices) {
            eventDef.choices = rawEventDef.choices.map(choice => {
                const isAllowed = this.randomEventService.evaluator.checkAll(
                    choice.requirements, 
                    this.gameState, 
                    this
                );
                return { ...choice, disabled: !isAllowed };
            });
        }
        
        this.uiManager.showRandomEventModal(eventDef, (choiceId) => {
            this.resolveEventChoice(eventId, choiceId);
        });
    }

    resolveEventChoice(eventId, choiceId) {
        const result = this.randomEventService.resolveChoice(eventId, choiceId, this.gameState, this);
        if (!result) return;

        this._applyEventEffects(result.effects);

        this.uiManager.showEventResultModal(
            result.title, 
            result.text, 
            result.effects, 
            () => this._handlePostForceEvent()
        );
    }

    _handlePostForceEvent() {
        const ship = this._getActiveShip();
        if (!ship) return;

        if (ship.health <= 0) {
            if (this.gameState.pendingTravel) this.gameState.pendingTravel = null;
            if (this.travelService) {
                this.travelService._handleShipDestruction(ship.id);
            }
            return;
        }

        if (ship.fuel <= 0) {
            if (this.gameState.pendingTravel) this.gameState.pendingTravel = null;
            this.gameState.player.shipStates[ship.id].fuel = 0;
            this.logger.info.player(this.gameState.day, 'EVENT_FAIL', `Ship ran out of fuel (Forced Event). Towed back to port.`);
            const locId = this.gameState.currentLocationId;
            const location = DB.MARKETS.find(m => m.id === locId);
            const locName = location ? location.name : "Port";
            
            this.uiManager.queueModal(
                'event-modal', 
                'Fuel Depleted', 
                `Your engines sputter and die. A passing freighter tows you back to <b>${locName}</b>.`
            );
            
            this.gameState.setState({});
        }
    }

    _applyEventEffects(effects) {
        effects.forEach(eff => {
            switch (eff.type) {
                case 'EFF_CREDITS':
                    this.gameState.player.credits += eff.value;
                    break;
                case 'EFF_FUEL':
                    const ship = this._getActiveShip();
                    if(ship) this.gameState.player.shipStates[ship.id].fuel = Math.max(0, Math.min(ship.maxFuel, ship.fuel + eff.value));
                    break;
                case 'EFF_HULL':
                    const s = this._getActiveShip();
                    if(s) this.gameState.player.shipStates[s.id].health = Math.max(0, Math.min(s.maxHealth, s.health + eff.value));
                    break;
                case 'EFF_TRAVEL_TIME':
                case 'EFF_MODIFY_TRAVEL':
                     if (this.gameState.pendingTravel) {
                        this.gameState.pendingTravel.travelTimeAdd = (this.gameState.pendingTravel.travelTimeAdd || 0) + eff.value;
                    }
                    break;
                case 'EFF_ADD_ITEM':
                    const invAdd = this._getActiveInventory();
                    if(invAdd && invAdd[eff.target]) {
                        invAdd[eff.target].quantity += eff.value;
                    }
                    break;
                case 'EFF_REMOVE_ITEM':
                    const invRem = this._getActiveInventory();
                    if(invRem && invRem[eff.target]) {
                        invRem[eff.target].quantity = Math.max(0, invRem[eff.target].quantity - eff.value);
                    }
                    break;
            }
        });
        this.gameState.setState({}); 
    }

    startIntroSequence() { this.introService.start(); }
    handleIntroClick(e) { this.introService.handleIntroClick(e); }
    _continueIntroSequence(batchId) { this.introService.continueAfterTutorial(batchId); }
    
    buyItem(goodId, quantity) { return this.playerActionService.buyItem(goodId, quantity); }
    sellItem(goodId, quantity) { return this.playerActionService.sellItem(goodId, quantity); }
    
    async buyShip(shipId, event) {
        const validation = this.playerActionService.validateBuyShip(shipId);
        if (!validation.success) {
            this.uiManager.queueModal('event-modal', validation.errorTitle, validation.errorMessage);
            return null;
        }

        const purchaseButton = event.target.closest('.action-button');
        if (purchaseButton) {
            await playBlockingAnimationAndRemove(purchaseButton, 'is-glowing-green');
        }
        await new Promise(resolve => requestAnimationFrame(resolve));

        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_START', `Starting buy animation for ${shipId}.`);
        await this.uiManager.runShipTransactionAnimation(shipId);
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_END', `Buy animation complete. Executing logic.`);

        return this.playerActionService.executeBuyShip(shipId, event);
    }

    async sellShip(shipId, event) {
        const validation = this.playerActionService.validateSellShip(shipId);
        if (!validation.success) {
            this.uiManager.queueModal('event-modal', validation.errorTitle, validation.errorMessage);
            return false;
        }

        const sellButton = event.target.closest('.action-button');
        if (sellButton) {
            await playBlockingAnimationAndRemove(sellButton, 'is-glowing-red');
        }
        await new Promise(resolve => requestAnimationFrame(resolve));

        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_START', `Starting sell animation for ${shipId}.`);
        await this.uiManager.runShipTransactionAnimation(shipId);
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_END', `Sell animation complete. Executing logic.`);

        return this.playerActionService.executeSellShip(shipId, event);
    }

    async boardShip(shipId, event) {
        const validation = this.playerActionService.validateSetActiveShip(shipId);
        if (!validation.success) {
            if (validation.errorTitle !== "Action Redundant") {
                 this.uiManager.queueModal('event-modal', validation.errorTitle, validation.errorMessage);
            }
            return false;
        }

        const boardButton = event.target.closest('.action-button');
        if (boardButton) {
            const sellButton = boardButton.closest('.grid').querySelector('[data-action="sell-ship"]');
            if (sellButton) {
                sellButton.disabled = true;
            }
        }

         if (boardButton) {
            await playBlockingAnimationAndRemove(boardButton, 'is-glowing-button');
        }

        this.playerActionService.executeSetActiveShip(shipId);
           
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_START', `Starting board animation for ${shipId}.`);
        await this.uiManager.runShipTransactionAnimation(shipId, 'is-boarding');
        this.logger.info.system('SimService', this.gameState.day, 'SHIP_ANIMATION_END', `Board animation complete.`);
        
        return true;
    }

    payOffDebt(event) { this.playerActionService.payOffDebt(event); }
    takeLoan(loanData, event) { this.playerActionService.takeLoan(loanData, event); }
    purchaseLicense(licenseId) { return this.playerActionService.purchaseLicense(licenseId); }
    refuelTick() { return this.playerActionService.refuelTick(); }
    repairTick() { return this.playerActionService.repairTick(); }
    travelTo(locationId, useFoldedDrive = false) { this.travelService.travelTo(locationId, useFoldedDrive); }
    resumeTravel() { this.travelService.resumeTravel(); }

    pushNewsMessage(text, type, isPriority = false) {
        if (this.newsTickerService) {
            this.newsTickerService.pushMessage(text, type, isPriority);
        }
    }

    pulseNewsTicker() {
        if (this.newsTickerService) {
            this.newsTickerService.pulse();
        }
    }

    // --- CORE & SHARED METHODS ---
    setScreen(navId, screenId) {
        const newLastActive = { ...this.gameState.lastActiveScreen, [navId]: screenId };
        
        // --- PHASE 3 FIX: Atomic execution ---
        // 1. Mutate raw state instantly
        this.gameState.activeNav = navId;
        this.gameState.activeScreen = screenId;
        this.gameState.lastActiveScreen = newLastActive;

        // 2. Evaluate objectives silently against the fresh raw state
        if (this.missionService) {
            this.missionService.checkTriggers(true);
        }

        // 3. Commit state change and broadcast UI render
        this.gameState.setState({});
    }

    setIntelTab(tabId) {
        if (this.gameState.uiState.activeIntelTab !== tabId) {
            this.gameState.uiState.activeIntelTab = tabId;
            this.gameState.setState({ 
                uiState: this.gameState.uiState 
            });
        }
    }

    setHangarShipyardMode(mode) {
        if (this.gameState.uiState.hangarShipyardToggleState !== mode) {
            this.gameState.uiState.hangarShipyardToggleState = mode;
            this.gameState.setState({});
        }
    }
    
    setHangarCarouselIndex(index, mode) {
        if (mode === 'hangar') {
            this.gameState.uiState.hangarActiveIndex = index;
        } else {
            this.gameState.uiState.shipyardActiveIndex = index;
        }
        this.gameState.setState({});
    }

    cycleHangarCarousel(direction) {
        const { uiState, player } = this.gameState;
        const isHangarMode = uiState.hangarShipyardToggleState === 'hangar';
        const shipList = isHangarMode ? player.ownedShipIds : this._getShipyardInventory().map(([id]) => id);
        
        if (shipList.length <= 1) return;

        let currentIndex = isHangarMode ? (uiState.hangarActiveIndex || 0) : (uiState.shipyardActiveIndex || 0);

        if (direction === 'next') {
            currentIndex = (currentIndex + 1) % shipList.length;
        } else {
            currentIndex = (currentIndex - 1 + shipList.length) % shipList.length;
        }

        this.setHangarCarouselIndex(currentIndex, isHangarMode ? 'hangar' : 'shipyard');
    }

    _gameOver(message) {
        if (this.gameState.isGameOver) return; 
        this.logger.info.state(this.gameState.day, 'GAME_OVER', message);
        this.gameState.setState({ isGameOver: true });
        this.uiManager.queueModal('event-modal', "Game Over", message, () => {
            localStorage.removeItem(SAVE_KEY);
            window.location.reload();
        }, { buttonText: 'Restart' });
    }

    /**
     * Hook into the core loop to evaluate if the player is fundamentally bankrupt.
     * Triggers the "Indentured Servitude" time-skip mechanic to avoid a hard game over.
     */
    _checkGameOverConditions() {
        if (this.bankruptcyService && this.bankruptcyService.isPlayerBankrupt(this.gameState.getState())) {
            this.bankruptcyService.triggerBankruptcyFlow();
        }
    }

    getEffectiveShipStats(shipId) {
        const ship = DB.SHIPS[shipId];
        if (!ship) return null;

        const state = this.gameState.getState();
        const shipState = state.player.shipStates[shipId];
        
        if (!shipState || !shipState.upgrades) return { ...ship };

        const upgrades = [
            ...(ship.mechanicIds || []), 
            ...(shipState.upgrades || [])
        ];

        const hullMod = GameAttributes.getMaxHullModifier(upgrades);
        const fuelMod = GameAttributes.getMaxFuelModifier(upgrades);
        const cargoMod = GameAttributes.getMaxCargoModifier(upgrades);

        return {
            ...ship,
            maxHealth: Math.round(ship.maxHealth + hullMod),
            maxFuel: Math.round(ship.maxFuel + fuelMod),
            cargoCapacity: Math.round(ship.cargoCapacity + cargoMod)
        };
    }

    addShipToHangar(shipId) {
        const ship = DB.SHIPS[shipId];
        if (!ship) return;
        this.gameState.player.ownedShipIds.push(shipId);
        
        this.gameState.player.shipStates[shipId] = { 
            health: ship.maxHealth, 
            fuel: ship.maxFuel, 
            hullAlerts: { one: false, two: false },
            upgrades: [] 
        };
        
        if (!this.gameState.player.inventories[shipId]) {
            this.gameState.player.inventories[shipId] = {};
            DB.COMMODITIES.forEach(c => {
                this.gameState.player.inventories[shipId][c.id] = { quantity: 0, avgCost: 0 };
            });
        }
    }

    _applyPerk(choice) {
        this.logger.info.player(this.gameState.day, 'PERK_APPLIED', `Gained perk: ${choice.title}`);
        if (choice.perkId) this.gameState.player.activePerks[choice.perkId] = true;
        if (choice.playerTitle) this.gameState.player.playerTitle = choice.playerTitle;
        if (choice.perkId === PERK_IDS.MERCHANT_GUILD_SHIP) {
            this.addShipToHangar(SHIP_IDS.STALWART);
            this.uiManager.queueModal('event-modal', 'Vessel Delivered', `The Merchant's Guild has delivered a new ${DB.SHIPS[SHIP_IDS.STALWART].name} to your hangar.`);
        }
        this.gameState.setState({});
    }
    
    _getActiveShip() {
        const state = this.gameState;
        const activeId = state.player.activeShipId;
        if (!activeId) return null;
        
        const effectiveStats = this.getEffectiveShipStats(activeId);
        return { 
            id: activeId, 
            ...effectiveStats, 
            ...state.player.shipStates[activeId] 
        };
    }

    _getActiveInventory() {
        if (!this.gameState.player.activeShipId) return null;
        return this.gameState.player.inventories[this.gameState.player.activeShipId];
    }
    
    _checkHullWarnings(shipId) {
        const shipState = this.gameState.player.shipStates[shipId];
        const effectiveStats = this.getEffectiveShipStats(shipId);
        
        if (!shipState.hullAlerts) {
            shipState.hullAlerts = { one: false, two: false };
        }
        
        const healthPct = (shipState.health / effectiveStats.maxHealth) * 100;
        
        if (healthPct <= 15 && !shipState.hullAlerts.two) { shipState.hullAlerts.two = true; } 
        else if (healthPct <= 30 && !shipState.hullAlerts.one) { shipState.hullAlerts.one = true; }
        if (healthPct > 30) shipState.hullAlerts.one = false;
        if (healthPct > 15) shipState.hullAlerts.two = false;
    }

    _logTransaction(type, amount, description) {
        this.gameState.player.financeLog.push({ 
            day: this.gameState.day,
            type: type, 
            amount: amount,
            balance: this.gameState.player.credits,
            description: description
        });
        while (this.gameState.player.financeLog.length > GAME_RULES.FINANCE_HISTORY_LENGTH) {
            this.gameState.player.financeLog.shift();
        }
    }

    _logConsolidatedTrade(goodName, quantity, transactionValue) {
        const log = this.gameState.player.financeLog;
        const isBuy = transactionValue < 0;
        const actionWord = isBuy ? 'Bought' : 'Sold';
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
                existingEntry.description = `${actionWord} ${currentQty + quantity}x ${goodName}`;
            }
        } else {
             this._logTransaction('trade', transactionValue, `${actionWord} ${quantity}x ${goodName}`);
        }
    }

    _logConsolidatedTransaction(type, amount, description) {
        const log = this.gameState.player.financeLog;
        const lastEntry = log.length > 0 ? log[log.length - 1] : null;
        if (lastEntry && lastEntry.day === this.gameState.day && lastEntry.type === type) {
            lastEntry.amount += amount;
            lastEntry.balance = this.gameState.player.credits;
        } else {
            this._logTransaction(type, amount, description);
        }
    }

    _getShipyardInventory() {
        const { player, currentLocationId, market, introSequenceActive } = this.gameState;
        if (introSequenceActive) {
            return player.ownedShipIds.length > 0 ? [] : [SHIP_IDS.WANDERER, SHIP_IDS.STALWART, SHIP_IDS.MULE].map(id => [id, DB.SHIPS[id]]);
        } else {
            const shipsForSaleIds = market.shipyardStock[currentLocationId]?.shipsForSale || [];
            return shipsForSaleIds.map(id => [id, DB.SHIPS[id]]).filter(([id]) => !player.ownedShipIds.includes(id));
        }
    }

    advanceDay() {
        this.gameState.day++;
        this.logger.info.system(this.gameState.day, 'DAY_START', `Day ${this.gameState.day} started.`);

        this._updateMarkets();
        this._processFinancials();

        if (this.randomEventService) {
            this.randomEventService.checkForRandomEvents();
        }
        
        if (this.missionService) {
             this.missionService.checkTriggers();
        }
        
        this.gameState.setState({}); 
    }

    grantMissionCargo(missionId) {
        const mission = DB.MISSIONS[missionId];
        if (!mission || !mission.providedCargo) return;

        const inventory = this._getActiveInventory();
        if (!inventory) {
            this.logger.error('SimulationService', 'Cannot grant mission cargo: No active inventory found.');
            return;
        }

        mission.providedCargo.forEach(item => {
            if (!inventory[item.goodId]) {
                inventory[item.goodId] = { quantity: 0, avgCost: 0 };
            }
            if (inventory[item.goodId]) {
                inventory[item.goodId].quantity += item.quantity;
            }
        });
        
        this.logger.info.player(this.gameState.day, 'MISSION_CARGO', `Received mission cargo for ${missionId}`);
        
        if (this.missionService) {
            this.missionService.checkTriggers();
        }
    }

    _grantRewards(rewards, sourceName) {
        if (!rewards || rewards.length === 0) return;

        rewards.forEach(reward => {
            const rewardType = reward.type.toLowerCase();
            switch (rewardType) {
                case 'credits':
                    this.gameState.player.credits = Math.min(Number.MAX_SAFE_INTEGER, this.gameState.player.credits + reward.amount);
                    this._logTransaction('mission', reward.amount, `Reward: ${sourceName}`);
                    this.uiManager.createFloatingText(`+${formatCredits(reward.amount, false)}`, window.innerWidth / 2, window.innerHeight / 2, '#34d399');
                    break;
                case 'item':
                case 'commodity':
                    const shipId = this.gameState.player.activeShipId;
                    const inventory = this.gameState.player.inventories[shipId];
                    if (inventory && inventory[reward.goodId]) {
                        inventory[reward.goodId].quantity += reward.quantity;
                    }
                    break;
                case 'unlock_location':
                    if (!this.gameState.player.unlockedLocationIds.includes(reward.target)) {
                        this.gameState.player.unlockedLocationIds.push(reward.target);
                        this.logger.info.player(this.gameState.day, 'UNLOCK', `Unlocked location: ${reward.target}`);
                    }
                    break;
                case 'unlock_tier':
                    const newTier = Math.max(this.gameState.player.revealedTier, reward.value);
                    if (newTier > this.gameState.player.revealedTier) {
                        this.gameState.player.revealedTier = newTier;
                        this.logger.info.player(this.gameState.day, 'UNLOCK', `Clearance Tier increased to ${newTier}`);
                    }
                    break;
                case 'license': 
                    if (!this.gameState.player.unlockedLicenseIds.includes(reward.licenseId)) {
                        this.gameState.player.unlockedLicenseIds.push(reward.licenseId);
                        const license = DB.LICENSES[reward.licenseId];
                        this.uiManager.triggerEffect('systemSurge', { theme: 'tan' });
                        this.logger.info.player(this.gameState.day, 'LICENSE_GRANTED', `Received ${license ? license.name : reward.licenseId}.`);
                    }
                    break;
                case 'ship':
                    const targetShipId = reward.target;
                    if (!this.gameState.player.ownedShipIds.includes(targetShipId)) {
                        this.gameState.player.ownedShipIds.push(targetShipId);
                        this.gameState.player.shipStates[targetShipId] = this._initializeShipState(targetShipId);
                        this.logger.info.player(this.gameState.day, 'REWARD_SHIP', `Acquired ship: ${targetShipId}`);
                    }
                    break;
                case 'teleport':
                    this.gameState.currentLocationId = reward.target;
                    this.gameState.pendingTravel = null; 
                    this.logger.info.player(this.gameState.day, 'TELEPORT', `Teleported to ${reward.target}`);
                    break;
                case 'repair':
                    const activeShip = this.gameState.player.activeShipId;
                    if (this.gameState.player.shipStates[activeShip]) {
                        this.gameState.player.shipStates[activeShip].health = DB.SHIPS[activeShip].maxHealth;
                    }
                    break;
                case 'refuel':
                    const currentShip = this.gameState.player.activeShipId;
                    if (this.gameState.player.shipStates[currentShip]) {
                        this.gameState.player.shipStates[currentShip].fuel = DB.SHIPS[currentShip].maxFuel;
                    }
                    break;
                case 'upgrade':
                     const shipState = this.gameState.player.shipStates[this.gameState.player.activeShipId];
                     if (shipState && shipState.upgrades) {
                         if (shipState.upgrades.length < 3) {
                             shipState.upgrades.push(reward.target || reward.id);
                         } else {
                             shipState.upgrades[2] = reward.target || reward.id; // overwrite last if full, to guarantee receipt
                         }
                         this.logger.info.player(this.gameState.day, 'REWARD_UPGRADE', `Installed upgrade: ${reward.target || reward.id}`);
                     }
                     break;
                case 'officer':
                    const officerId = reward.officerId;
                    const officer = OFFICERS[officerId];
                    if (officer && !this.gameState.solStation.roster.includes(officerId)) {
                        this.gameState.solStation.roster.push(officerId);
                        this.logger.info.player(this.gameState.day, 'OFFICER_RECRUIT', `Recruited ${officer.name} (${officer.role})`);
                        this.uiManager.queueModal('event-modal', 
                            'New Officer Recruited', 
                            `<b>${officer.name}</b> has joined your staff roster.\n\nRole: ${officer.role}\nEffect: ${officer.description}`
                        );
                    }
                    break;
                default:
                    console.warn(`Unknown reward type: ${reward.type}`);
            }
        });
    }

    _initializeShipState(shipId) {
        const ship = DB.SHIPS[shipId];
        return {
            health: ship ? ship.maxHealth : 100,
            fuel: ship ? ship.maxFuel : 40,
            hullAlerts: { one: false, two: false },
            upgrades: [] 
        };
    }

    _updateMarkets() {
        const { market } = this.gameState;
        
        DB.MARKETS.forEach(loc => {
            DB.COMMODITIES.forEach(good => {
                if (!market.priceHistory[loc.id][good.id]) {
                    market.priceHistory[loc.id][good.id] = [];
                }
                const history = market.priceHistory[loc.id][good.id];
                history.push(market.prices[loc.id][good.id]);
                if (history.length > 30) history.shift();
            });
        });

        DB.MARKETS.forEach(loc => {
            DB.COMMODITIES.forEach(good => {
                const currentPrice = market.prices[loc.id][good.id];
                const avg = market.galacticAverages[good.id];
                const volatility = 0.05; 
                
                let change = 1 + (Math.random() * volatility * 2 - volatility);
                let newPrice = Math.round(currentPrice * change);
                
                const min = avg * 0.5;
                const max = avg * 1.5;
                if (newPrice < min) newPrice = Math.round(min + Math.random() * 5);
                if (newPrice > max) newPrice = Math.round(max - Math.random() * 5);

                market.prices[loc.id][good.id] = newPrice;
            });
            
            if (this.gameState.day % 7 === 0) {
                // Shipyard stock logic...
            }
        });

        this.gameState.lastMarketUpdateDay = this.gameState.day;
    }

    _processFinancials() {
        if (this.gameState.player.debt > 0) {
            const dailyRate = 0.001; 
            const interest = Math.ceil(this.gameState.player.debt * dailyRate);
            this.gameState.player.debt += interest;
            this.gameState.player.monthlyInterestAmount += interest;
        }
    }
}