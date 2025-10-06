// js/services/player/PlayerActionService.js
/**
 * @fileoverview PlayerActionService handles direct, immediate player actions
 * such as buying, selling, refueling, and repairing. It is responsible for
 * the core logic and state mutations related to these actions.
 */
import GameState from '../GameState.js';
import { DB } from '../../data/database.js';
import { WEALTH_MILESTONES, LOCATION_IDS } from '../../data/constants.js';
import { formatNumber } from '../../utils.js';

class PlayerActionService {
    constructor() {
        this.gameState = GameState;
    }

    buyItem(goodId, amount) {
        const state = this.gameState.getState();
        const good = this.gameState.getCommodityById(goodId);
        const marketData = state.market[state.player.locationId][goodId];
        const price = marketData.price;
        const cost = price * amount;

        if (state.player.credits < cost) {
            this.gameState.addLog('Not enough credits to complete purchase.', 'warning');
            return;
        }

        const activeShip = state.activeShip;
        const currentCargo = Object.values(state.activeInventory).reduce((acc, item) => acc + item.quantity, 0);
        if (currentCargo + amount > activeShip.cargoCapacity) {
            this.gameState.addLog('Not enough cargo space.', 'warning');
            return;
        }

        const newCredits = state.player.credits - cost;
        const newInventory = { ...state.activeInventory };
        newInventory[goodId] = {
            ...newInventory[goodId],
            quantity: (newInventory[goodId]?.quantity || 0) + amount
        };

        this.gameState.setState({
            player: { ...state.player, credits: newCredits },
            activeInventory: newInventory
        });
        this.gameState.addLog(`Purchased ${amount} units of ${good.name} for ${formatNumber(cost)} credits.`, 'success');
        this.checkWealthMilestones();
    }

    sellItem(goodId, amount) {
        const state = this.gameState.getState();
        const good = this.gameState.getCommodityById(goodId);
        const marketData = state.market[state.player.locationId][goodId];
        const price = marketData.price;
        const revenue = price * amount;

        const currentAmount = state.activeInventory[goodId]?.quantity || 0;
        if (amount > currentAmount) {
            this.gameState.addLog('Not enough items to sell.', 'warning');
            return;
        }

        const newCredits = state.player.credits + revenue;
        const newInventory = { ...state.activeInventory };
        newInventory[goodId] = {
            ...newInventory[goodId],
            quantity: currentAmount - amount
        };

        if (newInventory[goodId].quantity === 0) {
            delete newInventory[goodId];
        }

        this.gameState.setState({
            player: { ...state.player, credits: newCredits },
            activeInventory: newInventory
        });
        this.gameState.addLog(`Sold ${amount} units of ${good.name} for ${formatNumber(revenue)} credits.`, 'success');
        this.checkWealthMilestones();
    }

    refuelShip(amount) {
        const state = this.gameState.getState();
        const activeShip = state.activeShip;
        if (!activeShip) return;

        const fuelNeeded = activeShip.maxFuel - activeShip.fuel;
        const fuelToBuy = Math.min(amount, fuelNeeded);

        let pricePerUnit = state.currentLocation.fuelPrice || 250;
        // Apply Jupiter's specialty discount
        if (state.currentLocation.id === LOCATION_IDS.JUPITER) {
            pricePerUnit *= 0.5;
        }

        const cost = Math.ceil(fuelToBuy * pricePerUnit);

        if (state.player.credits < cost) {
            this.gameState.addLog('Not enough credits to refuel.', 'warning');
            return;
        }

        activeShip.fuel += fuelToBuy;
        const newCredits = state.player.credits - cost;

        this.gameState.setState({
            player: { ...state.player, credits: newCredits },
            activeShip: { ...activeShip }
        });
        this.gameState.addLog(`Refueled ${fuelToBuy} units for ${formatNumber(cost)} credits.`, 'info');
    }

    repairShip() {
        const state = this.gameState.getState();
        const activeShip = state.activeShip;
        if (!activeShip || activeShip.health === activeShip.maxHealth) return;

        const damage = activeShip.maxHealth - activeShip.health;
        let cost = damage * 150; // Base cost

        // Apply Luna's specialty discount
        if (state.currentLocation.id === LOCATION_IDS.LUNA) {
            cost = Math.ceil(cost * 0.9);
        }

        if (state.player.credits < cost) {
            this.gameState.addLog('Not enough credits to repair.', 'warning');
            return;
        }

        activeShip.health = activeShip.maxHealth;
        const newCredits = state.player.credits - cost;

        this.gameState.setState({
            player: { ...state.player, credits: newCredits },
            activeShip: { ...activeShip }
        });
        this.gameState.addLog(`Repaired ship hull for ${formatNumber(cost)} credits.`, 'info');
    }

    buyShip(shipId) {
        const state = this.gameState.getState();
        const ship = this.gameState.getShipById(shipId);
        if (state.player.credits < ship.price) {
            this.gameState.addLog('Not enough credits to buy ship.', 'warning');
            return;
        }
        
        const newShipInstance = { ...ship, id: `${shipId}-${Date.now()}`, health: ship.maxHealth, fuel: ship.maxFuel };

        const newCredits = state.player.credits - ship.price;
        const newShips = [...state.player.ships, newShipInstance];
        this.gameState.setState({
            player: { ...state.player, credits: newCredits, ships: newShips }
        });
        this.gameState.addLog(`Purchased a new ${ship.class}-Class ship: The ${ship.name}.`, 'success');
    }

    sellShip(shipInstanceId) {
        const state = this.gameState.getState();
        const shipInstance = state.player.ships.find(s => s.id === shipInstanceId);
        if (!shipInstance) return;

        if (shipInstance.id === state.player.activeShipId) {
            this.gameState.addLog('Cannot sell your active ship.', 'warning');
            return;
        }

        const salePrice = Math.floor(shipInstance.price * 0.75); // Sell for 75% of base price
        const newCredits = state.player.credits + salePrice;
        const newShips = state.player.ships.filter(s => s.id !== shipInstanceId);

        this.gameState.setState({
            player: { ...state.player, credits: newCredits, ships: newShips }
        });
        this.gameState.addLog(`Sold The ${shipInstance.name} for ${formatNumber(salePrice)} credits.`, 'info');
    }

    boardShip(shipInstanceId) {
        const state = this.gameState.getState();
        const shipToBoard = state.player.ships.find(s => s.id === shipInstanceId);
        if (!shipToBoard) return;

        const currentActiveShip = state.activeShip;
        if (currentActiveShip && Object.keys(state.activeInventory).length > 0) {
            const currentCargoAmount = Object.values(state.activeInventory).reduce((sum, item) => sum + item.quantity, 0);
            if (currentCargoAmount > shipToBoard.cargoCapacity) {
                this.gameState.addLog(`Cannot board ${shipToBoard.name}. Its cargo hold (${shipToBoard.cargoCapacity}) is too small for your current cargo (${currentCargoAmount}).`, 'warning');
                return;
            }
        }
        
        this.gameState.setState({
            player: { ...state.player, activeShipId: shipInstanceId },
            activeShip: shipToBoard
        });
        this.gameState.addLog(`Boarded The ${shipToBoard.name}.`, 'info');
    }

    payDebt(amount) {
        const state = this.gameState.getState();
        if (amount > state.player.credits) {
            this.gameState.addLog("You don't have enough credits.", "warning");
            return;
        }
        if (amount > state.player.debt) {
            amount = state.player.debt;
        }
        this.gameState.setState({
            player: {
                ...state.player,
                credits: state.player.credits - amount,
                debt: state.player.debt - amount,
            },
        });
        this.gameState.addLog(`Paid ${formatNumber(amount)} credits towards your debt.`, 'success');
    }

    purchaseLicense(licenseId) {
        const state = this.gameState.getState();
        const license = DB.LICENSES[licenseId];
        if (!license || license.type !== 'purchase') return;

        if(state.player.licenses.includes(licenseId)) {
            this.gameState.addLog("You already own this license.", "info");
            return;
        }

        if (state.player.credits < license.cost) {
            this.gameState.addLog("Not enough credits to purchase license.", "warning");
            return;
        }

        const newCredits = state.player.credits - license.cost;
        const newLicenses = [...state.player.licenses, licenseId];

        this.gameState.setState({
            player: { ...state.player, credits: newCredits, licenses: newLicenses }
        });
        this.gameState.addLog(`Acquired: ${license.name}.`, 'success');
    }
    
    checkWealthMilestones() {
        const state = this.gameState.getState();
        const currentCredits = state.player.credits;
        let newMilestone = state.player.wealthMilestone;

        for (let i = 0; i < WEALTH_MILESTONES.length; i++) {
            if (currentCredits >= WEALTH_MILESTONES[i]) {
                newMilestone = i + 1;
            }
        }

        if (newMilestone > state.player.wealthMilestone) {
            this.gameState.setState({ player: { ...state.player, wealthMilestone: newMilestone } });
            this.gameState.addLog(`Wealth milestone reached! You can now trade Tier ${newMilestone + 1} commodities.`, 'milestone');
        }
    }
}

export default new PlayerActionService();