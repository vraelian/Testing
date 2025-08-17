// js/services/SimulationService.js
import { GAME_RULES, ACTION_IDS, SCREEN_IDS } from '../data/constants.js';
import { SHIPS, COMMODITIES, MARKETS } from '../data/gamedata.js';
import { skewedRandom } from '../utils.js';

/**
 * The SimulationService is the core engine of the game. It handles all state mutations
 * that are not direct UI interactions (like opening a modal). This includes advancing time,
 * processing market fluctuations, handling travel, and applying game rules.
 */
export class SimulationService {
    /**
     * @param {import('./GameState.js').GameState} gameState - The mutable state of the game.
     * @param {import('./UIManager.js').UIManager} uiManager - The UI manager for rendering updates.
     * @param {import('./TutorialService.js').TutorialService} tutorialService - The tutorial manager.
     */
    constructor(gameState, uiManager, tutorialService) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.tutorialService = tutorialService;
    }
    
    _advanceDay() {
        this.gameState.day++;
        this.uiManager.render(this.gameState.getState());
        
        const state = this.gameState.getState();
        if (state.day % 7 === 0 && state.player.debt > 0) {
            const interest = Math.floor(state.player.debt * (GAME_RULES.WEEKLY_INTEREST_RATE / 100));
            this.gameState.player.debt += interest;
            this.gameState.player.weeklyInterestAmount = interest;
        }

        if (state.day > this.gameState.lastMarketUpdateDay) {
            this._updateMarketPrices();
            this.gameState.lastMarketUpdateDay = state.day;
        }

        if (state.day - this.gameState.player.lastBirthdayYear * 365 >= 365) {
            this._processBirthday();
        }
        
        if (state.player.loanStartDate && (state.day - state.player.loanStartDate) >= GAME_RULES.LOAN_GARNISHMENT_DAYS) {
             if (state.player.debt > 0 && state.player.credits > 0 && !state.player.seenGarnishmentWarning) {
                this.uiManager.showToast('garnishmentToast', 'WARNING: Garnishment imminent! Pay your debt!', 5000);
                this.gameState.player.seenGarnishmentWarning = true;
            } else if (state.player.debt > 0 && state.player.credits > 0) {
                const garnishment = Math.min(state.player.credits, Math.floor(state.player.debt * 0.1));
                this.gameState.player.credits -= garnishment;
                this.gameState.player.debt -= garnishment;
                this.uiManager.showToast('garnishmentToast', `Your wages have been garnished for ${garnishment} credits.`, 5000);
            }
        }
    }
    
    _processBirthday() {
        this.gameState.player.playerAge++;
        const currentYear = Math.floor(this.gameState.day / 365);
        this.gameState.player.lastBirthdayYear = currentYear;
        const bonus = Math.floor(this.gameState.player.credits * 0.05);
        this.gameState.player.credits += bonus;
        this.gameState.player.birthdayProfitBonus = bonus;

        this.uiManager.queueModal('event-modal', 'Happy Birthday!', `You turned ${this.gameState.player.playerAge}! You received a bonus of ${bonus} credits.`);
    }

    _updateMarketPrices() {
        const state = this.gameState.getState();
        MARKETS.forEach(location => {
            COMMODITIES.forEach(good => {
                const currentPrice = state.market.prices[location.id][good.id];
                const galacticAvg = state.market.galacticAverages[good.id];
                const volatility = 0.1 + Math.random() * 0.4;
                
                // Nudge price towards galactic average, modified by location preferences
                let priceShift = (galacticAvg - currentPrice) * 0.1;
                priceShift *= (location.modifiers[good.id] || 1.0);
                let newPrice = currentPrice + priceShift;

                // Add random fluctuation
                newPrice *= (1 + (Math.random() - 0.5) * volatility);
                newPrice = Math.max(1, Math.round(newPrice));

                this.gameState.market.prices[location.id][good.id] = newPrice;
                
                const history = this.gameState.market.priceHistory[location.id][good.id];
                history.push({ day: state.day, price: newPrice });
                if (history.length > 14) history.shift();
            });
        });
    }

    setScreen(navId, screenId) {
        this.gameState.activeNav = navId;
        this.gameState.activeScreen = screenId;
        this.gameState.lastActiveScreen[navId] = screenId;
        this.gameState.setState(this.gameState);
        this.tutorialService.checkState({ type: 'SCREEN_LOAD', screenId });
    }

    travel(destinationId) {
        const state = this.gameState.getState();
        const from = MARKETS.find(l => l.id === state.currentLocationId);
        const to = MARKETS.find(l => l.id === destinationId);
        const travelInfo = this.gameState.TRAVEL_DATA[from.id][to.id];
        const shipState = state.player.shipStates[state.player.activeShipId];

        if (shipState.fuel < travelInfo.fuelCost) {
            this.uiManager.queueModal('event-modal', 'Insufficient Fuel', `You need ${travelInfo.fuelCost} fuel for this trip, but you only have ${Math.floor(shipState.fuel)}.`);
            return;
        }

        const hullDamagePercent = this._calculateHullDamage(travelInfo.time);

        this.uiManager.showTravelAnimation(from, to, travelInfo, hullDamagePercent, () => {
            shipState.fuel -= travelInfo.fuelCost;
            shipState.health -= hullDamagePercent;

            this.gameState.player.shipStates[state.player.activeShipId] = shipState;
            this.gameState.currentLocationId = destinationId;
            
            for (let i = 0; i < travelInfo.time; i++) {
                this._advanceDay();
            }

            this.gameState.setState(this.gameState);
            this.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.TRAVEL });
        });
    }

    _calculateHullDamage(days) {
        let decay = days * GAME_RULES.HULL_DECAY_PER_DAY;
        if (this.gameState.player.activePerks.navigator) {
            decay *= 0.9;
        }
        return decay;
    }

    buyItem(goodId, quantity) {
        const state = this.gameState.getState();
        const price = this.uiManager.getItemPrice(state, goodId);
        const totalCost = price * quantity;
        const shipStatic = SHIPS[state.player.activeShipId];
        const inventory = state.player.inventories[state.player.activeShipId];
        const cargoUsed = Object.values(inventory).reduce((sum, item) => sum + item.quantity, 0);
        
        if (state.player.credits < totalCost) return;
        if ((cargoUsed + quantity) > shipStatic.cargoCapacity) return;

        this.gameState.player.credits -= totalCost;
        
        const playerItem = this.gameState.player.inventories[state.player.activeShipId][goodId];
        const oldTotalValue = playerItem.avgCost * playerItem.quantity;
        const newTotalValue = oldTotalValue + totalCost;
        playerItem.quantity += quantity;
        playerItem.avgCost = newTotalValue / playerItem.quantity;

        const marketItem = this.gameState.market.inventory[state.currentLocationId][goodId];
        marketItem.quantity = Math.max(0, marketItem.quantity - quantity);

        this.gameState.setState(this.gameState);
        this.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.BUY_ITEM });
        
        // After state update, check for mission progress.
        if(this.gameState.missions.activeMissionId) {
            this.uiManager.missionService.updateMissionProgress();
        }
    }

    sellItem(goodId, quantity) {
        const state = this.gameState.getState();
        const playerItem = state.player.inventories[state.player.activeShipId][goodId];
        if (playerItem.quantity < quantity) return;
        
        const price = this.uiManager.getItemPrice(state, goodId, true);
        const totalGain = price * quantity;

        this.gameState.player.credits += totalGain;
        playerItem.quantity -= quantity;
        if (playerItem.quantity === 0) {
            playerItem.avgCost = 0;
        }

        const marketItem = this.gameState.market.inventory[state.currentLocationId][goodId];
        marketItem.quantity += quantity;
        
        this.gameState.setState(this.gameState);
        this.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.SELL_ITEM });
    }

    buyShip(shipId) {
        const ship = SHIPS[shipId];
        if (this.gameState.player.credits < ship.price) return;

        this.gameState.player.credits -= ship.price;
        this.gameState.player.ownedShipIds.push(shipId);
        this.gameState.player.shipStates[shipId] = { health: ship.maxHealth, fuel: ship.maxFuel, hullAlerts: { one: false, two: false } };
        this.gameState.player.inventories[shipId] = {};
        COMMODITIES.forEach(c => {
            this.gameState.player.inventories[shipId][c.id] = { quantity: 0, avgCost: 0 };
        });
        
        this.gameState.setState(this.gameState);
        this.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.BUY_SHIP });
    }

    sellShip(shipId) {
        const ship = SHIPS[shipId];
        const salePrice = Math.floor(ship.price * GAME_RULES.SHIP_SELL_MODIFIER);
        this.gameState.player.credits += salePrice;

        this.gameState.player.ownedShipIds = this.gameState.player.ownedShipIds.filter(id => id !== shipId);
        delete this.gameState.player.shipStates[shipId];
        delete this.gameState.player.inventories[shipId];
        
        this.gameState.setState(this.gameState);
        this.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.SELL_SHIP });
    }

    selectShip(shipId) {
        this.gameState.player.activeShipId = shipId;
        // The following line is the fix. We must commit the state *before*
        // checking the tutorial, otherwise the tutorial will run on the old state
        // where `activeShipId` was null, causing a crash.
        this.gameState.setState(this.gameState);
        this.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.SELECT_SHIP });
    }

    takeLoan(loanDetails) {
        if (this.gameState.player.debt > 0) return;
        
        const { amount, fee, interest } = loanDetails;
        if (this.gameState.player.credits < fee) return;

        this.gameState.player.credits += (amount - fee);
        this.gameState.player.debt += amount;
        this.gameState.player.weeklyInterestAmount = interest;
        this.gameState.player.loanStartDate = this.gameState.day;
        this.gameState.player.seenGarnishmentWarning = false;
        
        this.gameState.setState(this.gameState);
        this.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.TAKE_LOAN });
    }

    payDebt() {
        if (this.gameState.player.credits < this.gameState.player.debt) return;

        this.gameState.player.credits -= this.gameState.player.debt;
        this.gameState.player.debt = 0;
        this.gameState.player.weeklyInterestAmount = 0;
        this.gameState.player.loanStartDate = null;

        this.gameState.setState(this.gameState);
        this.tutorialService.checkState({ type: 'ACTION', action: ACTION_IDS.PAY_DEBT });
    }

    handleIntroSequence(step) {
        switch(step) {
            case 'charter':
                this.gameState.player.credits += 25000;
                this.gameState.player.debt += 25000;
                this.gameState.player.loanStartDate = this.gameState.day;
                this.gameState.player.weeklyInterestAmount = 325;
                break;
            case 'final':
                this.gameState.introSequenceActive = false;
                this.tutorialService.triggerBatch('intro_hangar');
                break;
        }
        this.gameState.setState(this.gameState);
    }
    
    /**
     * Continues the intro sequence after a tutorial batch is completed.
     * @param {string} completedBatchId - The ID of the tutorial batch that just finished.
     */
    _continueIntroSequence(completedBatchId) {
        switch(completedBatchId) {
            case 'intro_hangar':
                this.setScreen(SCREEN_IDS.FINANCE, SCREEN_IDS.FINANCE);
                this.tutorialService.triggerBatch('intro_finance');
                break;
            case 'intro_finance':
                 this.setScreen(SCREEN_IDS.MISSIONS, SCREEN_IDS.MISSIONS);
                 this.tutorialService.triggerBatch('intro_missions');
                break;
        }
        this.gameState.setState(this.gameState);
    }

    _updateShipyardStock() {
        MARKETS.forEach(location => {
            const stockData = this.gameState.market.shipyardStock[location.id];
            if (this.gameState.day - stockData.day >= 7) {
                stockData.day = this.gameState.day;
                stockData.shipsForSale = this._generateShipyardInventory(location);
            }
        });
    }

    _generateShipyardInventory(location) {
        const availableShips = Object.entries(SHIPS).filter(([id, ship]) => {
            return ship.saleLocationId === location.id || (ship.isRare && Math.random() < 0.1);
        });

        const numShips = 2 + Math.floor(Math.random() * 3);
        const inventory = [];
        for (let i = 0; i < numShips && availableShips.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * availableShips.length);
            const [shipId] = availableShips.splice(randomIndex, 1);
            inventory.push(shipId);
        }
        return inventory;
    }
}