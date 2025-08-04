// js/services/GameState.js
import { GAME_RULES, SAVE_KEY, SHIP_IDS, LOCATION_IDS, NAV_IDS, SCREEN_IDS } from '../data/constants.js';
import { SHIPS, COMMODITIES, MARKETS } from '../data/gamedata.js';
import { DATE_CONFIG } from '../data/dateConfig.js';

function procedurallyGenerateTravelData(markets) {
    const travelData = {};
    const fuelScalar = 3;
    markets.forEach((fromMarket, i) => {
        travelData[fromMarket.id] = {};
        markets.forEach((toMarket, j) => {
            if (i === j) return;
            const distance = Math.abs(i - j);
            const fuelTime = distance * 2 + Math.floor(Math.random() * 3);
            let fuelCost = Math.round(fuelTime * fuelScalar * (1 + (j / markets.length) * 0.5));
            let travelTime;
            if ((fromMarket.id === LOCATION_IDS.EARTH && toMarket.id === LOCATION_IDS.LUNA) || (fromMarket.id === LOCATION_IDS.LUNA && toMarket.id === LOCATION_IDS.EARTH)) {
                travelTime = 1 + Math.floor(Math.random() * 3);
            } else {
                travelTime = 15 + (distance * 10) + Math.floor(Math.random() * 5);
            }
            travelData[fromMarket.id][toMarket.id] = { time: travelTime, fuelCost: Math.max(1, fuelCost) };
         });
    });
    return travelData;
}

export class GameState {
    constructor() {
        this.state = {};
        this.subscribers = [];
        this.TRAVEL_DATA = procedurallyGenerateTravelData(MARKETS);
    }

    subscribe(callback) {
        this.subscribers.push(callback);
    }

    _notify() {
        this.subscribers.forEach(callback => callback(this));
    }

    setState(partialState) {
        Object.assign(this, partialState);
        this._notify();
        // this.saveGame();
    }
    
    getState() {
        return JSON.parse(JSON.stringify(this));
    }

    saveGame() {
        // try {
        //     const stateToSave = { ...this };
        //     delete stateToSave.subscribers;
        //     localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
        // } catch (error) {
        //     console.error("Error saving game state:", error);
        // }
    }

    loadGame() {
        return false;
        // try {
        //     const serializedState = localStorage.getItem(SAVE_KEY);
        //     if (serializedState === null) return false;
            
        //     const loadedState = JSON.parse(serializedState);
        //     Object.assign(this, loadedState);
        //     this.TRAVEL_DATA = procedurallyGenerateTravelData(MARKETS);
        //     this._notify();
        //     return true;
        // } catch (error) {
        //     console.warn("Could not parse save data. Starting new game.", error);
        //     localStorage.removeItem(SAVE_KEY);
        //     return false;
        // }
    }

    startNewGame(playerName) {
        const initialState = {
            day: 1, lastInterestChargeDay: 1, lastMarketUpdateDay: 1, currentLocationId: LOCATION_IDS.MARS, activeNav: NAV_IDS.SHIP, activeScreen: SCREEN_IDS.NAVIGATION, isGameOver: false, popupsDisabled: false,
            lastActiveScreen: {
                [NAV_IDS.SHIP]: SCREEN_IDS.STATUS,
                [NAV_IDS.STARPORT]: SCREEN_IDS.MARKET,
                [NAV_IDS.ADMIN]: SCREEN_IDS.MISSIONS,
            },
            pendingTravel: null,
            player: {
                name: playerName, playerTitle: 'Captain', playerAge: 24, lastBirthdayYear: DATE_CONFIG.START_YEAR, birthdayProfitBonus: 0,
                credits: GAME_RULES.STARTING_CREDITS, debt: 0, weeklyInterestAmount: 0,
                loanStartDate: null, seenGarnishmentWarning: false,
                unlockedCommodityLevel: 1, unlockedLocationIds: [LOCATION_IDS.EARTH, LOCATION_IDS.LUNA, LOCATION_IDS.MARS, LOCATION_IDS.VENUS, LOCATION_IDS.BELT, LOCATION_IDS.SATURN],
                seenCommodityMilestones: [], financeLog: [],
                activePerks: {}, seenEvents: [], activeShipId: SHIP_IDS.WANDERER, ownedShipIds: [SHIP_IDS.WANDERER],
                shipStates: { [SHIP_IDS.WANDERER]: { health: SHIPS[SHIP_IDS.WANDERER].maxHealth, fuel: SHIPS[SHIP_IDS.WANDERER].maxFuel, hullAlerts: { one: false, two: false } } },
                inventories: { [SHIP_IDS.WANDERER]: {} }
             },
            market: { prices: {}, inventory: {}, galacticAverages: {}, priceHistory: {}, },
            intel: { active: null, available: {} },
            tutorials: {
                activeBatchId: null,
                activeStepId: null,
                seenBatchIds: [],
                skippedTutorialBatches: []
            }
        };

        COMMODITIES.forEach(c => { initialState.player.inventories.starter[c.id] = { quantity: 0, avgCost: 0 }; });
        
        MARKETS.forEach(m => {
            initialState.intel.available[m.id] = (Math.random() < 0.3);
        });
        
        Object.assign(this, initialState);
        this.setState({});
    }
}