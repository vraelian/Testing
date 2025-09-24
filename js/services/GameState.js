// js/services/GameState.js
import { LOCATION_IDS, SHIP_IDS, COMMODITY_IDS, NAV_IDS, SCREEN_IDS } from '../data/constants.js';

export class GameState {
    constructor() {
        this.state = {};
        this.subscribers = [];
        this.init();
    }

    init() {
        this.state = {
            player: {
                name: "Player",
                credits: 1000,
                age: 25,
                birthday: { month: 'January', day: 1, bonusGiven: false },
                ownedShipIds: [],
                activeShipId: null,
                shipStates: {},
                inventories: {},
                activePerks: {},
                licenses: {},
                birthdayProfitBonus: 0,
            },
            currentLocationId: LOCATION_IDS.MARS,
            gameDay: 1,
            activeNav: NAV_IDS.SHIP,
            activeScreen: SCREEN_IDS.STATUS,
            lastActiveScreen: {
                [NAV_IDS.SHIP]: SCREEN_IDS.STATUS,
                [NAV_IDS.STARPORT]: SCREEN_IDS.MARKET,
                [NAV_IDS.DATA]: SCREEN_IDS.MISSIONS
            },
            subNavCollapsed: false,
            market: {
                prices: {},
                inventory: {},
                galacticAverages: {},
                priceHistory: {},
                shipyardStock: {}
            },
            intel: {
                available: [],
                active: null,
                purchaseCost: 500,
            },
            finance: {
                loans: [],
                debt: 0,
                netWorthHistory: [],
                transactionHistory: [],
                loanTerms: {}
            },
            events: {
                nextEventDay: 0,
                triggeredEvents: {},
                activeGlobalEffects: {}
            },
            missions: {
                availableMissions: {},
                activeMissionId: null,
                missionProgress: {},
                completedMissions: {},
                activeMissionObjectivesMet: false
            },
            tutorials: {
                activeBatchId: null,
                activeStepId: null,
                completedBatches: {},
                seenBatchIds: [],
                navLock: null,
            },
            uiState: {
                marketCardMinimized: {},
                selectedShipId: { // To remember selection in Hangar/Shipyard
                    hangar: null,
                    shipyard: null,
                },
            },
            introSequenceActive: false,
            isGameOver: false,
            gameOverReason: ''
        };
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this._notifySubscribers();
    }

    getState() {
        return { ...this.state };
    }

    subscribe(callback) {
        this.subscribers.push(callback);
    }

    _notifySubscribers() {
        this.subscribers.forEach(callback => callback(this.state));
    }

    save() {
        try {
            localStorage.setItem('orbitalTradingSave', JSON.stringify(this.state));
            return true;
        } catch (error) {
            console.error("Error saving game state:", error);
            return false;
        }
    }

    load() {
        try {
            const savedState = localStorage.getItem('orbitalTradingSave');
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                const defaultState = new GameState().state;

                // Perform a shallow merge for top-level properties.
                this.state = { ...this.state, ...parsedState };

                // **Perform a deep merge for uiState to ensure new properties are not lost.**
                this.state.uiState = { 
                    ...defaultState.uiState, 
                    ...(parsedState.uiState || {}) 
                };
                
                // **Specifically merge the nested selectedShipId as well for safety.**
                this.state.uiState.selectedShipId = {
                    ...defaultState.uiState.selectedShipId,
                    ...(parsedState.uiState?.selectedShipId || {})
                };

                // Existing migration logic for other parts.
                this.state.missions = { ...(this.state.missions || {}) };
                this.state.tutorials = this.state.tutorials || { activeBatchId: null, activeStepId: null, completedBatches: {}, seenBatchIds:[], navLock: null };
            }
            this._notifySubscribers();
            return !!savedState;
        } catch (error) {
            console.error("Error loading game state:", error);
            return false;
        }
    }

    reset() {
        localStorage.removeItem('orbitalTradingSave');
        this.init();
        this._notifySubscribers();
    }
}