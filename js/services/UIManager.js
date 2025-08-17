// js/services/UIManager.js
import { CONFIG } from '../data/config.js';
import { SHIPS, COMMODITIES, MARKETS, LOCATION_VISUALS, PERKS, TUTORIAL_DATA, MISSIONS } from '../data/gamedata.js';
import { formatCredits, calculateInventoryUsed, getDateFromDay } from '../utils.js';
import { SCREEN_IDS, NAV_IDS, ACTION_IDS, GAME_RULES, PERK_IDS, LOCATION_IDS, SHIP_IDS } from '../data/constants.js';

export class UIManager {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.modalQueue = [];
        this.activeGraphAnchor = null;
        this.activeGenericTooltipAnchor = null;
        this.activeTutorialHighlights = []; // Changed to handle multiple highlights
        this.lastActiveScreenEl = null;
        this.lastKnownState = null;
        this.missionService = null; // To be injected

        this.navStructure = {
            [NAV_IDS.SHIP]: { label: 'Ship', screens: { [SCREEN_IDS.STATUS]: 'Status', [SCREEN_IDS.NAVIGATION]: 'Navigation', [SCREEN_IDS.SERVICES]: 'Services' } },
            [NAV_IDS.STARPORT]: { label: 'Starport', screens: { [SCREEN_IDS.MARKET]: 'Market', [SCREEN_IDS.CARGO]: 'Cargo', [SCREEN_IDS.HANGAR]: 'Hangar' } },
            [NAV_IDS.ADMIN]: { label: 'Admin', screens: { [SCREEN_IDS.MISSIONS]: 'Missions', [SCREEN_IDS.FINANCE]: 'Finance', [SCREEN_IDS.INTEL]: 'Intel' } }
        };

        this._cacheDOM();

        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = window.innerWidth <= 768;
            if (wasMobile !== this.isMobile) {
                this.render(this.lastKnownState);
            }
        });
    }

    /**
     * Injects the MissionService after instantiation to avoid circular dependencies.
     * @param {import('./MissionService.js').MissionService} missionService
     */
    setMissionService(missionService) {
        this.missionService = missionService;
    }

    _cacheDOM() {
        this.cache = {
            gameContainer: document.getElementById('game-container'),
            navBar: document.getElementById('nav-bar'),
            subNavBar: document.getElementById('sub-nav-bar'),
            stickyBar: document.getElementById('sticky-bar'),
            statusScreen: document.getElementById(`${SCREEN_IDS.STATUS}-screen`),
            navigationScreen: document.getElementById(`${SCREEN_IDS.NAVIGATION}-screen`),
            servicesScreen: document.getElementById(`${SCREEN_IDS.SERVICES}-screen`),
            marketScreen: document.getElementById(`${SCREEN_IDS.MARKET}-screen`),
            cargoScreen: document.getElementById(`${SCREEN_IDS.CARGO}-screen`),
            hangarScreen: document.getElementById(`${SCREEN_IDS.HANGAR}-screen`),
            missionsScreen: document.getElementById(`${SCREEN_IDS.MISSIONS}-screen`),
            financeScreen: document.getElementById(`${SCREEN_IDS.FINANCE}-screen`),
            intelScreen: document.getElementById(`${SCREEN_IDS.INTEL}-screen`),
            saveToast: document.getElementById('save-toast'),
            garnishmentToast: document.getElementById('garnishment-toast'),
            hullWarningToast: document.getElementById('hull-warning-toast'),
            debugToast: document.getElementById('debug-toast'),
            starportUnlockTooltip: document.getElementById('starport-unlock-tooltip'),
            graphTooltip: document.getElementById('graph-tooltip'),
            genericTooltip: document.getElementById('generic-tooltip'),
            processingModal: document.getElementById('processing-modal'),
            shipDetailModal: document.getElementById('ship-detail-modal'),
            tutorialToastContainer: document.getElementById('tutorial-toast-container'),
            tutorialToastText: document.getElementById('tutorial-toast-text'),
            tutorialToastSkipBtn: document.getElementById('tutorial-toast-skip-btn'),
            tutorialToastNextBtn: document.getElementById('tutorial-toast-next-btn'),
            skipTutorialModal: document.getElementById('skip-tutorial-modal'),
            skipTutorialConfirmBtn: document.getElementById('skip-tutorial-confirm-btn'),
            skipTutorialCancelBtn: document.getElementById('skip-tutorial-cancel-btn'),
        };
    }

    render(gameState) {
        if (!gameState || !gameState.player) return;
        this.lastKnownState = gameState;
        
        const location = MARKETS.find(l => l.id === gameState.currentLocationId);
        if (location) {
            this.cache.gameContainer.className = `game-container p-4 md:p-8 ${location.bg}`;
        }
        
        this.renderNavigation(gameState);
        this.renderActiveScreen(gameState);
        this.updateStickyBar(gameState);
        this.renderStickyBar(gameState);
    }

    renderNavigation(gameState) {
        const { activeNav, activeScreen, lastActiveScreen, introSequenceActive, tutorials } = gameState;
        const { navLock } = tutorials;
    
        const navButtons = Object.entries(this.navStructure).map(([navId, navData]) => {
            const isActive = navId === activeNav;
            const screenId = lastActiveScreen[navId] || Object.keys(navData.screens)[0];
            
            const isDisabledByIntro = introSequenceActive && !tutorials.activeBatchId;
            const isDisabledByTutorial = navLock && navLock.navId !== navId;
            const isDisabled = isDisabledByIntro || isDisabledByTutorial;
            const lockedClass = isDisabled ? 'btn-intro-locked' : '';

            return `
                <button class="btn btn-header theme-${navId} ${isActive ? 'btn-nav-active' : ''} ${lockedClass}" 
                        data-action="${ACTION_IDS.SET_SCREEN}" data-nav-id="${navId}" data-screen-id="${screenId}" ${isDisabled ? 'disabled' : ''}>
                    ${navData.label}
                </button>`;
        }).join('');
        this.cache.navBar.innerHTML = `<div class="flex justify-around w-full gap-2 md:gap-4">${navButtons}</div>`;

        const activeSubNav = this.navStructure[activeNav]?.screens || {};
        const themeClass = `theme-${activeNav}`;
        const subNavButtons = Object.entries(activeSubNav).map(([screenId, screenLabel]) => {
            const isActive = screenId === activeScreen;
            const isDisabledByIntro = introSequenceActive && !tutorials.activeBatchId;
            const isDisabledByTutorial = navLock && navLock.screenId !== screenId;
            const isDisabled = isDisabledByIntro || isDisabledByTutorial;
            const lockedClass = isDisabled ? 'btn-intro-locked' : '';

            return `
                <button class="btn btn-sub-nav ${isActive ? 'btn-sub-nav-active' : ''} ${lockedClass}"
                        data-action="${ACTION_IDS.SET_SCREEN}" data-nav-id="${activeNav}" data-screen-id="${screenId}" ${isDisabled ? 'disabled' : ''}>
                    ${screenLabel}
                </button>`;
        }).join('');
        this.cache.subNavBar.innerHTML = `<div class="flex justify-center w-full gap-2 md:gap-4 mt-3 ${themeClass}">${subNavButtons}</div>`;
    }

    renderActiveScreen(gameState) {
        // [hands-off]
        const activeScreenEl = document.getElementById(`${gameState.activeScreen}-screen`);
        if (this.lastActiveScreenEl && this.lastActiveScreenEl !== activeScreenEl) {
            this.lastActiveScreenEl.style.display = 'none';
        }

        if (activeScreenEl) {
            activeScreenEl.style.display = 'block';
            this.lastActiveScreenEl = activeScreenEl;
        }

        switch (gameState.activeScreen) {
            case SCREEN_IDS.STATUS: this.renderStatusScreen(gameState); break;
            case SCREEN_IDS.NAVIGATION: this.renderNavigationScreen(gameState); break;
            case SCREEN_IDS.SERVICES: this.renderServicesScreen(gameState); break;
            case SCREEN_IDS.MARKET: this.renderMarketScreen(gameState); break;
            case SCREEN_IDS.CARGO: this.renderCargoScreen(gameState); break;
            case SCREEN_IDS.HANGAR: this.renderHangarScreen(gameState); break;
            case SCREEN_IDS.MISSIONS: this.renderMissionsScreen(gameState); break;
            case SCREEN_IDS.FINANCE: this.renderFinanceScreen(gameState); break;
            case SCREEN_IDS.INTEL: this.renderIntelScreen(gameState); break;
        }
        // [/hands-off]
    }

    updateStickyBar(gameState) {
        // [hands-off]
        const { activeScreen, player } = gameState;
        this.cache.stickyBar.innerHTML = '';
    
        if (!player.activeShipId) {
            const creditOnlyScreens = [
                SCREEN_IDS.MARKET,
                SCREEN_IDS.CARGO,
                SCREEN_IDS.HANGAR,
                SCREEN_IDS.SERVICES,
                SCREEN_IDS.FINANCE,
            ];
            if (creditOnlyScreens.includes(activeScreen)) {
                this.cache.stickyBar.innerHTML = `
                     <div class="ship-hud text-center">
                        <div class="flex justify-around items-center font-roboto-mono">
                            <span class="credits-text-pulsing">${formatCredits(player.credits)}</span>
                        </div>
                     </div>
                `;
            }
            return;
        }
    
        const shipState = player.shipStates[player.activeShipId];
        const shipStatic = SHIPS[player.activeShipId];
    
        switch(activeScreen) {
            case SCREEN_IDS.NAVIGATION:
                const fuelPct = (shipState.fuel / shipStatic.maxFuel) * 100;
                this.cache.stickyBar.innerHTML = `
                    <div class="ship-hud">
                        <div class="flex items-center justify-between">
                             <div class="flex items-center space-x-2">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-sky-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" /></svg>
                                <span class="text-gray-400">Fuel:</span>
                            </div>
                            <span class="font-bold text-sky-300">${Math.floor(shipState.fuel)}/${shipStatic.maxFuel}</span>
                        </div>
                        <div class="mt-1">
                            <div class="hud-stat-bar"><div style="width: ${fuelPct}%" class="bg-sky-400"></div></div>
                        </div>
                    </div>
                `;
                break;
            case SCREEN_IDS.MARKET:
            case SCREEN_IDS.CARGO:
            case SCREEN_IDS.HANGAR:
            case SCREEN_IDS.SERVICES:
            case SCREEN_IDS.FINANCE:
                const cargoUsed = calculateInventoryUsed(player.inventories[player.activeShipId]);
                this.cache.stickyBar.innerHTML = `
                     <div class="ship-hud text-center">
                        <div class="flex justify-around items-center font-roboto-mono">
                            <span class="credits-text-pulsing">${formatCredits(player.credits)}</span>
                            <span class="text-gray-500">|</span>
                            <span>Cargo: ${cargoUsed}/${shipStatic.cargoCapacity}</span>
                        </div>
                    </div>
                
                `;
                break;
        }
        // [/hands-off]
    }
    renderStatusScreen(gameState) {
        // [hands-off]
        const { player, day } = gameState;
        const shipStatic = SHIPS[player.activeShipId];
        const shipState = player.shipStates[player.activeShipId];
        const inventory = player.inventories[player.activeShipId];
        const cargoUsed = calculateInventoryUsed(inventory);

        this.cache.statusScreen.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/30 p-4 rounded-lg mb-6 items-start">
                <div class="md:col-span-2 h-full p-4 rounded-lg flex items-center justify-between transition-all duration-500 panel-border border border-slate-700">
                    <div class="text-left pl-4">
                        <span class="block text-lg text-gray-400 uppercase tracking-widest">Day</span>
                        <span class="text-4xl font-bold font-orbitron">${day}</span>
                    </div>
                    <div class="text-right flex flex-col items-end">
                        <p class="text-xs text-cyan-200/80 mb-2 font-roboto-mono text-right">${getDateFromDay(day)}</p>
                        <div class="mt-2 pt-2 border-t border-slate-500/50">
                            <div class="text-right">
                                <p class="text-gray-400 text-sm tracking-wider">Vessel</p>
                                <p>${shipStatic.name}</p>
                                <p>Class: ${shipStatic.class}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="md:col-span-1 flex flex-col gap-4">
                    <div class="ship-hud">
                        <h4 class="font-orbitron text-xl text-center mb-3 text-cyan-300">Ship Status</h4>
                        <div class="flex flex-col gap-y-2 text-sm">
                            <div class="tooltip-container" data-tooltip="Ship integrity. Damaged by travel.">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center space-x-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
                                        <span class="text-gray-400">Hull:</span>
                                    </div>
                                    <span class="font-bold text-green-300">${Math.floor(shipState.health)}%</span>
                                </div>
                            </div>
                            <div class="tooltip-container" data-tooltip="Propulsion system fuel levels.">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center space-x-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-sky-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd"></path></svg>
                                        <span class="text-gray-400">Fuel:</span>
                                    </div>
                                    <span class="font-bold text-sky-300">${Math.floor(shipState.fuel)}/${shipStatic.maxFuel}</span>
                                </div>
                            </div>
                            <div class="tooltip-container" data-tooltip="Active ship's current/max cargo space.">
                                <div class="flex items-center justify-between">
                                    <div class="flex items-center space-x-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor"><path d="M5 8a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 000 2h6a1 1 0 100-2H6z" /><path fill-rule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2-2H4a2 2 0 01-2-2V5zm2-1a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1V5a1 1 0 00-1-1H4z" clip-rule="evenodd" /></svg>
                                        <span class="text-gray-400">Cargo:</span>
                                    </div>
                                    <span class="font-bold text-amber-300">${cargoUsed}/${shipStatic.cargoCapacity}</span>
                                </div>
                            </div>
                         </div>
                    </div>
                    <div class="text-center text-lg text-cyan-200 font-orbitron flex items-center justify-center gap-2">
                        <span>${player.playerTitle} ${player.name}, ${player.playerAge}</span>
                    </div>
                </div>
            </div>`;
        // [/hands-off]
    }

    renderNavigationScreen(gameState) {
        // [hands-off]
        const { player, currentLocationId, TRAVEL_DATA } = gameState;
        this.cache.navigationScreen.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            ${MARKETS
                .filter(loc => player.unlockedLocationIds.includes(loc.id))
                .map(location => {
                    const isCurrent = location.id === currentLocationId;
                    const travelInfo = isCurrent ? null : TRAVEL_DATA[currentLocationId][location.id];
                    return `<div class="location-card p-6 rounded-lg text-center flex flex-col ${isCurrent ? 'highlight-current' : ''} ${location.color} ${location.bg}" data-action="${ACTION_IDS.TRAVEL}" data-location-id="${location.id}">
                        <h3 class="text-2xl font-orbitron flex-grow">${location.name}</h3>
                        <div class="location-card-footer mt-auto pt-3 border-t border-cyan-100/10">
                        ${isCurrent 
                            ? '<p class="text-yellow-300 font-bold mt-2">(Currently Docked)</p>' 
                            : `<div class="flex justify-around items-center text-center">
                                   <div class="flex items-center space-x-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V5z" clip-rule="evenodd" /></svg>
                                       <div><span class="font-bold font-roboto-mono text-lg">${travelInfo.time}</span><span class="block text-xs text-gray-400">Days</span></div>
                                   </div>
                                   <div class="flex items-center space-x-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-sky-400" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" /></svg>
                                       <div><span class="font-bold font-roboto-mono text-lg">${travelInfo.fuelCost}</span><span class="block text-xs text-gray-400">Fuel</span></div>
                                   </div>
                               </div>`
                        }
                      </div>
                      </div>`;
                }).join('')
            }
            </div>`;
        // [/hands-off]
    }

    renderServicesScreen(gameState) {
        // [hands-off]
        const { player, currentLocationId } = gameState;
        const shipStatic = SHIPS[player.activeShipId];
        const shipState = player.shipStates[player.activeShipId];
        const currentMarket = MARKETS.find(m => m.id === currentLocationId);

        let fuelPrice = currentMarket.fuelPrice / 2;
        if (player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && currentLocationId === LOCATION_IDS.VENUS) {
            fuelPrice *= (1 - PERKS[PERK_IDS.VENETIAN_SYNDICATE].fuelDiscount);
        }
        
        let costPerRepairTick = (shipStatic.maxHealth * (GAME_RULES.REPAIR_AMOUNT_PER_TICK / 100)) * GAME_RULES.REPAIR_COST_PER_HP;
        if (player.activePerks[PERK_IDS.VENETIAN_SYNDICATE] && currentLocationId === LOCATION_IDS.VENUS) {
            costPerRepairTick *= (1 - PERKS[PERK_IDS.VENETIAN_SYNDICATE].repairDiscount);
        }

        const fuelPct = (shipState.fuel / shipStatic.maxFuel) * 100;
        const healthPct = (shipState.health / shipStatic.maxHealth) * 100;
        
        this.cache.servicesScreen.innerHTML = `
             <div class="text-center mb-4">
                <h3 class="text-2xl font-orbitron">Station Services at ${currentMarket.name}</h3>
                <div id="services-credits-display" class="text-lg text-cyan-300 mt-2"><span class="text-cyan-400">⌬ </span><span class="font-bold text-cyan-300 ml-auto">${formatCredits(player.credits, false)}</span></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <div class="bg-black/20 p-4 rounded-lg text-center shadow-lg panel-border border border-slate-700">
                    <h4 class="font-orbitron text-xl mb-2">Refueling</h4>
                    <p class="mb-3">Price: <span class="font-bold text-cyan-300">${formatCredits(fuelPrice, false)}</span> / 5 units</p>
                    <button id="refuel-btn" class="btn btn-green w-full py-3" ${shipState.fuel >= shipStatic.maxFuel ? 'disabled' : ''}>Hold to Refuel</button>
                    <div class="w-full hud-stat-bar mt-2"><div id="fuel-bar" style="width: ${fuelPct}%" class="bg-sky-400"></div></div>
                </div>
                <div class="bg-black/20 p-4 rounded-lg text-center shadow-lg panel-border border border-slate-700">
                    <h4 class="font-orbitron text-xl mb-2">Ship Maintenance</h4>
                    <p class="mb-3">Price: <span class="font-bold text-cyan-300">${formatCredits(costPerRepairTick, false)}</span> / 5% repair</p>
                    <button id="repair-btn" class="btn btn-blue w-full py-3" ${shipState.health >= shipStatic.maxHealth ? 'disabled' : ''}>Hold to Repair</button>
                    <div class="w-full hud-stat-bar mt-2"><div id="repair-bar" style="width: ${healthPct}%" class="bg-green-400"></div></div>
                </div>
            </div>`;
        // [/hands-off]
    }

    updateServicesScreen(gameState) {
        // [hands-off]
        if (gameState.activeScreen !== SCREEN_IDS.SERVICES) return;
        const { player } = gameState;
        const shipStatic = SHIPS[player.activeShipId];
        const shipState = player.shipStates[player.activeShipId];

        const creditsEl = document.getElementById('services-credits-display');
        if (creditsEl) {
            creditsEl.innerHTML = `<span class="text-cyan-400">⌬ </span><span class="font-bold text-cyan-300 ml-auto">${formatCredits(player.credits, false)}</span>`;
        }

        const fuelBar = document.getElementById('fuel-bar');
        const refuelBtn = document.getElementById('refuel-btn');
        if (fuelBar && refuelBtn) {
            const fuelPct = (shipState.fuel / shipStatic.maxFuel) * 100;
            fuelBar.style.width = `${fuelPct}%`;
            refuelBtn.disabled = shipState.fuel >= shipStatic.maxFuel;
        }

        const repairBar = document.getElementById('repair-bar');
        const repairBtn = document.getElementById('repair-btn');
        if (repairBar && repairBtn) {
            const healthPct = (shipState.health / shipStatic.maxHealth) * 100;
            repairBar.style.width = `${healthPct}%`;
            repairBtn.disabled = shipState.health >= shipStatic.maxHealth;
        }
        // [/hands-off]
    }

    renderMarketScreen(gameState) {
        // [hands-off]
        const availableCommodities = COMMODITIES.filter(c => c.unlockLevel <= gameState.player.unlockedCommodityLevel);
        const marketHtml = availableCommodities.map(good => {
            return this.isMobile ? this._getMarketItemHtmlMobile(good, gameState) : this._getMarketItemHtmlDesktop(good, gameState);
        }).join('');
        this.cache.marketScreen.innerHTML = `<div class="grid grid-cols-1 lg:grid-cols-2 gap-4">${marketHtml}</div>`;
        // [/hands-off]
    }

    updateMarketScreen(gameState) {
        // [hands-off]
        if (gameState.activeScreen !== SCREEN_IDS.MARKET) return;
        const { player, market, currentLocationId } = gameState;
        const availableCommodities = COMMODITIES.filter(c => c.unlockLevel <= player.unlockedCommodityLevel);
        const shipStatic = SHIPS[player.activeShipId];
        const cargoUsed = calculateInventoryUsed(player.inventories[player.activeShipId]);
        const currentLocation = MARKETS.find(m => m.id === currentLocationId);

        availableCommodities.forEach(good => {
            const goodId = good.id;
            const cardContainer = document.getElementById(`item-card-container-${goodId}`);
            if (!cardContainer) return;
    
            const playerItem = player.inventories[player.activeShipId][goodId];
            const marketStock = market.inventory[currentLocationId][goodId];
            const price = this.getItemPrice(gameState, goodId);
            const sellPrice = this.getItemPrice(gameState, goodId, true);
    
            const pInvEl = document.getElementById(`p-inv-${goodId}`);
            if (pInvEl) {
                pInvEl.innerHTML = playerItem && playerItem.quantity > 0 ? ` <span class='text-cyan-300'>(${playerItem.quantity})</span>` : '';
    
            }
    
            const mStockEl = document.getElementById(`m-stock-${goodId}`);
            if (mStockEl) {
                mStockEl.innerHTML = marketStock.quantity;
            }

            const priceEl = document.getElementById(`price-${goodId}`);
            if(priceEl) {
                priceEl.innerHTML = formatCredits(price);
            }
    
            const galacticAvg = market.galacticAverages[goodId];
            const indicatorsEl = document.getElementById(`indicators-${goodId}`);
            if (indicatorsEl) {
                const { marketIndicatorHtml, plIndicatorHtml } = this._getIndicatorHtml(price, sellPrice, galacticAvg, playerItem, this.isMobile);
                indicatorsEl.innerHTML = this.isMobile ? marketIndicatorHtml : `${marketIndicatorHtml || ''}${plIndicatorHtml || ''}`;
            }
    
            const buyBtn = document.getElementById(`buy-btn-${goodId}`);
            const maxBuyBtn = document.getElementById(`max-buy-btn-${goodId}`);
            const sellBtn = document.getElementById(`sell-btn-${goodId}`);
            const maxSellBtn = document.getElementById(`max-sell-btn-${goodId}`);
            
            const isSpecialDemand = currentLocation.specialDemand && currentLocation.specialDemand[good.id];
            const cannotAfford = player.credits < price;
            const noSpace = cargoUsed >= shipStatic.cargoCapacity;
            const outOfStock = marketStock.quantity <= 0;
            if (buyBtn) buyBtn.disabled = !!(isSpecialDemand || cannotAfford || noSpace || outOfStock);
            if (maxBuyBtn) maxBuyBtn.disabled = !!(isSpecialDemand || cannotAfford || noSpace || outOfStock);
    
            const noneToSell = !playerItem || playerItem.quantity <= 0;
            if (sellBtn) sellBtn.disabled = noneToSell;
            if (maxSellBtn) maxSellBtn.disabled = noneToSell;
        });
        // [/hands-off]
    }

    renderCargoScreen(gameState) {
        // [hands-off]
        const inventory = gameState.player.inventories[gameState.player.activeShipId];
        const ownedGoods = Object.entries(inventory).filter(([, item]) => item.quantity > 0);
        
        let content;
        if (ownedGoods.length > 0) {
            content = `<div class="flex justify-center flex-wrap gap-4">
                ${ownedGoods.map(([goodId, item]) => {
                    const good = COMMODITIES.find(c => c.id === goodId);
                    const tooltipText = `${good.lore}\n\nAvg. Cost: ${formatCredits(item.avgCost, false)}`;
                    return `<div class="p-2 rounded-lg border-2 ${good.styleClass} cargo-item-tooltip" style="filter: drop-shadow(0 4px 3px rgba(0, 0, 0, 0.4));" data-tooltip="${tooltipText}"><div class="font-semibold text-sm commodity-name text-outline">${good.name}</div><div class="text-lg text-center text-cyan-300 text-outline">(${item.quantity})</div></div>`;
                }).join('')}
            </div>`;
        } else {
            content = '<p class="text-center text-gray-500 text-lg">Your cargo hold is empty.</p>';
        }

        this.cache.cargoScreen.innerHTML = `
            <div class="mt-8 pt-6">
                <h3 class="text-2xl font-orbitron text-center mb-4">Active Ship Cargo Manifest</h3>
                ${content}
            </div>`;
        // [/hands-off]
    }

    /**
     * Determines the list of ships available for sale at the current location.
     * This logic is shared between mobile and desktop views.
     * @param {object} gameState The current game state.
     * @returns {Array<Array<string, object>>} A list of ship entries, [id, shipObject].
     * @private
     */
    _getShipyardInventory(gameState) {
        const { player, currentLocationId, market, introSequenceActive } = gameState;
        if (introSequenceActive) {
            if (player.ownedShipIds.length > 0) {
                return [];
            } else {
                const introShipIds = [SHIP_IDS.WANDERER, SHIP_IDS.STALWART, SHIP_IDS.MULE];
                return introShipIds.map(id => ([id, SHIPS[id]]));
            }
        } else {
            const shipsForSaleIds = market.shipyardStock[currentLocationId]?.shipsForSale || [];
            return shipsForSaleIds
                .map(id => ([id, SHIPS[id]]))
                .filter(([id, ship]) => !player.ownedShipIds.includes(id));
        }
    }

    renderHangarScreen(gameState) {
        // [hands-off]
        const { tutorials } = gameState;
        let shipyardHighlightClass = '';
        let hangarHighlightClass = '';

        if (tutorials.activeBatchId === 'intro_hangar') {
            if (tutorials.activeStepId === 'hangar_1' || tutorials.activeStepId === 'hangar_2') {
                shipyardHighlightClass = 'tutorial-highlight';
            } else if (tutorials.activeStepId === 'hangar_3') {
                hangarHighlightClass = 'tutorial-highlight';
            }
        }

        if (!this.isMobile) {
            this._renderHangarScreenDesktop(gameState, shipyardHighlightClass, hangarHighlightClass);
        } else {
            this._renderHangarScreenMobile(gameState, shipyardHighlightClass, hangarHighlightClass);
        }
        // [/hands-off]
    }


    _renderHangarScreenMobile(gameState, shipyardHighlightClass, hangarHighlightClass) {
        // [hands-off]
        const { player } = gameState;
        const shipsForSale = this._getShipyardInventory(gameState);
        const shipyardHtml = shipsForSale.length > 0 
            ? shipsForSale.map(([id]) => this._getHangarItemHtmlMobile(gameState, id, 'shipyard')).join('')
            : '<p class="text-center text-gray-500 text-sm p-4">No new ships available.</p>';
        const hangarHtml = player.ownedShipIds.length > 0
            ? player.ownedShipIds.map(id => this._getHangarItemHtmlMobile(gameState, id, 'hangar')).join('')
            : '<p class="text-center text-gray-500 text-sm p-4">Your hangar is empty.</p>';

        this.cache.hangarScreen.innerHTML = `
            <div class="flex flex-col gap-6">
                <div id="starport-shipyard-panel-mobile" class="${shipyardHighlightClass}">
                    <h2 class="text-2xl font-orbitron text-cyan-300 mb-2 text-center">Shipyard</h2>
                    <div class="starport-panel-mobile space-y-2">${shipyardHtml}</div>
                </div>
                <div id="starport-hangar-panel-mobile" class="${hangarHighlightClass}">
                    <h2 class="text-2xl font-orbitron text-cyan-300 mb-2 text-center">Hangar</h2>
                    <div class="starport-panel-mobile space-y-2">${hangarHtml}</div>
                </div>
            </div>`;
            // [/hands-off]
    }

    _renderHangarScreenDesktop(gameState, shipyardHighlightClass, hangarHighlightClass) {
        // [hands-off]
        const { player, tutorials } = gameState;
        const shipsForSale = this._getShipyardInventory(gameState);
        const isHangarTutStep1Active = tutorials.activeBatchId === 'intro_hangar' && tutorials.activeStepId === 'hangar_1';
        let shipyardHtml;

        if (shipsForSale.length > 0) {
            shipyardHtml = shipsForSale.map(([id, ship]) => {
                const canAfford = player.credits >= ship.price;
                const isDisabled = !canAfford || isHangarTutStep1Active;
                return `<div class="ship-card p-4 flex flex-col space-y-3"><div class="flex justify-between items-start"><div><h3 class="text-xl font-orbitron text-cyan-300">${ship.name}</h3><p class="text-sm text-gray-400">Class ${ship.class}</p></div><div class="text-right"><p class="text-lg font-bold text-cyan-300">${formatCredits(ship.price)}</p></div></div><p class="text-sm text-gray-400 flex-grow">${ship.lore}</p><div class="grid grid-cols-3 gap-x-4 text-sm font-roboto-mono text-center pt-2"><div><span class="text-gray-500">Hull:</span> <span class="text-green-400">${ship.maxHealth}</span></div><div><span class="text-gray-500">Fuel:</span> <span class="text-sky-400">${ship.maxFuel}</span></div><div><span class="text-gray-500">Cargo:</span> <span class="text-amber-400">${ship.cargoCapacity}</span></div></div><button class="btn w-full mt-2" 
                 data-action="${ACTION_IDS.BUY_SHIP}" data-ship-id="${id}" ${isDisabled ? 'disabled' : ''}>Purchase</button></div>`;
            }).join('');
        } else {
            shipyardHtml = '<p class="text-center text-gray-500">No new ships available at this location.</p>';
        }

        const hangarHtml = player.ownedShipIds.length > 0
            ? player.ownedShipIds.map(id => {
                const shipStatic = SHIPS[id];
                const shipDynamic = player.shipStates[id];
                const shipInventory = player.inventories[id];
                const cargoUsed = calculateInventoryUsed(shipInventory);
                const isActive = id === player.activeShipId;
                const canSell = player.ownedShipIds.length > 1 && !isActive;
                const salePrice = Math.floor(shipStatic.price * GAME_RULES.SHIP_SELL_MODIFIER);
                return `<div class="ship-card p-4 flex flex-col space-y-3 ${isActive ? 'border-yellow-400' : ''}"><h3 class="text-xl font-orbitron ${isActive ? 'text-yellow-300' : 'text-cyan-300'} hanger-ship-name" data-tooltip="${shipStatic.lore}">${shipStatic.name}</h3><p class="text-sm text-gray-400 flex-grow">Class ${shipStatic.class}</p><div class="grid grid-cols-3 gap-x-4 text-sm font-roboto-mono text-center pt-2"><div><span class="text-gray-500">Hull:</span> <span class="text-green-400">${Math.floor(shipDynamic.health)}/${shipStatic.maxHealth}</span></div><div><span class="text-gray-500">Fuel:</span> <span class="text-sky-400">${Math.floor(shipDynamic.fuel)}/${shipStatic.maxFuel}</span></div><div><span class="text-amber-400">${cargoUsed}/${shipStatic.cargoCapacity}</span></div></div><div class="grid grid-cols-2 gap-2 mt-2">${isActive ? '<button class="btn" disabled>ACTIVE</button>' : `<button class="btn" data-action="${ACTION_IDS.SELECT_SHIP}" data-ship-id="${id}">Board</button>`}<button class="btn" data-action="${ACTION_IDS.SELL_SHIP}" data-ship-id="${id}" ${!canSell ? 'disabled' : ''}>Sell (${formatCredits(salePrice, false)})</button></div></div>`;
            }).join('')
            : '<p class="text-center text-gray-500">Your hangar is empty.</p>';

        this.cache.hangarScreen.innerHTML = `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 relative">
                <div id="starport-shipyard-panel" class="${shipyardHighlightClass}">
                    <h2 class="text-3xl font-orbitron text-cyan-300 mb-4 text-center">Shipyard</h2>
                    <div class="starport-panel space-y-4">${shipyardHtml}</div>
                </div>
                <div class="w-full my-4 border-t-2 border-slate-600 lg:hidden"></div>
                <div class="absolute left-1/2 top-0 h-full w-px bg-slate-600 hidden lg:block"></div>
                <div id="starport-hangar-panel" class="${hangarHighlightClass}">
                    <h2 class="text-3xl font-orbitron text-cyan-300 mb-4 text-center">Hangar</h2>
                    <div class="starport-panel space-y-4">${hangarHtml}</div>
                </div>
            </div>`;
        // [/hands-off]
    }


    _getHangarItemHtmlMobile(gameState, shipId, context) {
        // [hands-off]
        const { player, tutorials } = gameState;
        const shipStatic = SHIPS[shipId];
        let statusText, statusColor;

        if (context === 'shipyard') {
            statusText = formatCredits(shipStatic.price);
            statusColor = player.credits >= shipStatic.price ? 'text-cyan-300' : 'text-red-400';
        } else { // context === 'hangar'
            const isActive = shipId === player.activeShipId;
            statusText = isActive ? 'ACTIVE' : 'STORED';
            statusColor = isActive ? 'text-yellow-300' : 'text-gray-400';
        }

        const isHangarTutStep1Active = tutorials.activeBatchId === 'intro_hangar' && tutorials.activeStepId === 'hangar_1';
        const isDisabled = isHangarTutStep1Active && context === 'shipyard';

        return `
            <div class="ship-list-item-mobile p-3 flex justify-between items-center ${isDisabled ? 'disabled' : ''}" data-action="show-ship-detail" data-ship-id="${shipId}" data-context="${context}">
                <div>
                    <p class="font-orbitron ${statusColor}">${shipStatic.name}</p>
                    <p class="text-xs text-gray-500">Class ${shipStatic.class}</p>
                </div>
                <div class="font-roboto-mono text-right text-sm ${statusColor}">
                    ${statusText}
                </div>
            </div>`;
        // [/hands-off]
    }

    renderMissionsScreen(gameState) {
        const { missions, currentLocationId } = gameState;
        const { activeMissionId, activeMissionObjectivesMet } = missions;

        const getMissionCardHtml = (mission, status) => {
            let statusClass = '';
            if (status === 'active') statusClass = 'mission-active';
            if (status === 'completed') statusClass = 'mission-complete';
            if (status === 'active' && activeMissionObjectivesMet && mission.completion.locationId === currentLocationId) {
                statusClass += ' mission-turn-in';
            }

            const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            const rewardText = mission.rewards.map(r => {
                if(r.type === 'credits') return `⌬ ${r.amount.toLocaleString()}`;
                return r.type.toUpperCase();
            }).join(', ');

            return `
                <div class="mission-card sci-fi-frame ${hostClass} ${statusClass}" data-action="show-mission-modal" data-mission-id="${mission.id}">
                    <div class="flex justify-between items-center w-full text-xs mb-1">
                        <div class="flex items-center gap-2">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                            <span class="mission-type">${mission.type}</span>
                        </div>
                        <span class="mission-host">${mission.host}</span>
                    </div>
                    <div class="flex justify-between items-end w-full">
                        <p class="font-bold text-base">${mission.name}</p>
                        <span class="mission-reward">${rewardText}</span>
                    </div>
                </div>`;
        };

        let missionsHtml = '';
        const activeMission = activeMissionId ? MISSIONS[activeMissionId] : null;
        if (activeMission) {
            missionsHtml += getMissionCardHtml(activeMission, 'active');
        }
        
        if (this.missionService) {
            const availableMissions = this.missionService.getAvailableMissions();
            availableMissions.forEach(mission => {
                missionsHtml += getMissionCardHtml(mission, 'available');
            });
        }

        if (missionsHtml === '') {
            missionsHtml = '<p class="text-center text-gray-500 text-lg">No missions available at this terminal.</p>';
        }

        this.cache.missionsScreen.innerHTML = `
            <h1 class="text-3xl font-orbitron text-center mb-6 text-cyan-300">Mission Terminal</h1>
            <div class="space-y-3 max-w-2xl mx-auto">
                ${missionsHtml}
            </div>
        `;
    }

    renderFinanceScreen(gameState) {
        // [hands-off]
        const { player, day } = gameState;
        let loanHtml;
        if (player.debt > 0) {
            let garnishmentTimerHtml = '';
            if (player.loanStartDate) {
                const daysRemaining = GAME_RULES.LOAN_GARNISHMENT_DAYS - (day - player.loanStartDate);
                if (daysRemaining > 0) {
                    garnishmentTimerHtml = `<p class="text-xs text-red-400/70 mt-2">Garnishment in ${daysRemaining} days</p>`;
                }
            }
            loanHtml = `
               <div id="finance-debt-panel">
                 <h4 class="font-orbitron text-xl mb-2">Debt</h4>
                 <p class="text-2xl font-bold font-roboto-mono text-red-400 mb-2">${formatCredits(player.debt, false)}</p>
                 <button data-action="${ACTION_IDS.PAY_DEBT}" class="btn w-full py-3 bg-red-800/80 hover:bg-red-700/80 border-red-500" ${player.credits >= player.debt ? '' : 'disabled'}>
                     Pay Off Full Amount
                 </button>
                 ${garnishmentTimerHtml}
               </div>`;
        } else {
            const dynamicLoanAmount = Math.floor(player.credits * 3.5);
            const dynamicLoanFee = Math.floor(dynamicLoanAmount * 0.1);
            const dynamicLoanInterest = Math.floor(dynamicLoanAmount * 0.01);
            const dynamicLoanData = { amount: dynamicLoanAmount, fee: dynamicLoanFee, interest: dynamicLoanInterest };
            const loanButtonsHtml = [
                { key: '10000', amount: 10000, fee: 600, interest: 125 },
                { key: 'dynamic', ...dynamicLoanData }
            ].map((loan) => {
                const tooltipText = `Fee: ${formatCredits(loan.fee, false)}\nInterest: ${formatCredits(loan.interest, false)} / 7d`;
                return `<button class="btn btn-loan w-full p-2 mt-2 loan-btn-tooltip" data-action="${ACTION_IDS.TAKE_LOAN}" data-loan-details='${JSON.stringify(loan)}' ${player.credits < loan.fee ? 'disabled' : ''} data-tooltip="${tooltipText}">
                            <span class="font-orbitron text-cyan-300">⌬ ${formatCredits(loan.amount, false)}</span>
                        </button>`;
            }).join('');
            loanHtml = `<h4 class="font-orbitron text-xl mb-2">Financing</h4><div class="flex justify-center gap-4 w-full">${loanButtonsHtml}</div>`;
        }

        const logEntries = [...player.financeLog].reverse().map(entry => {
            const amountColor = entry.amount > 0 ? 'text-green-400' : 'text-red-400';
            const sign = entry.amount > 0 ? '+' : '';
            return `
                <div class="grid grid-cols-4 gap-2 p-2 border-b border-slate-700 text-sm">
                    <span class="text-gray-400">${entry.day}</span>
                    <span class="col-span-2">${entry.description}</span>
                    <span class="${amountColor} text-right">${sign}${formatCredits(entry.amount, false)}</span>
                </div>
            `;
    
           }).join('');

        this.cache.financeScreen.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div class="md:col-span-1 bg-black/20 p-4 rounded-lg flex flex-col items-center justify-center space-y-2 shadow-lg panel-border border border-slate-700 text-center">
                    ${loanHtml}
                </div>
                <div class="md:col-span-2">
                     <h3 class="text-2xl font-orbitron text-center mb-4">Transaction Log</h3>
                     <div class="bg-black/20 p-4 rounded-lg shadow-lg panel-border border border-slate-700 h-96 overflow-y-auto">
                        <div class="grid grid-cols-4 gap-2 p-2 border-b-2 border-slate-500 font-bold text-gray-300">
                           <span>Day</span>
                           <span class="col-span-2">Description</span>
                           <span class="text-right">Amount</span>
                        </div>
                        ${logEntries || '<p class="text-center text-gray-500 p-4">No transactions recorded.</p>'}
                     </div>
                </div>
            </div>
        `;
        // [/hands-off]
    }

    renderIntelScreen(gameState) {
        // [hands-off]
        this.cache.intelScreen.innerHTML = `
            <div class="text-center p-8 flex flex-col items-center gap-4">
                 <div id="tutorial-button-container" class="tutorial-container relative">
                    <button class="btn btn-header">Tutorial Log</button>
                    <div id="tutorial-log-modal" class="tutorial-tooltip">
                        <h3 id="tutorial-log-title" class="text-2xl font-orbitron mb-4 text-center">Tutorial Log</h3>
                        <ul id="tutorial-log-list" class="space-y-2"></ul>
                    </div>
                </div>
                <div id="lore-button-container" class="lore-container relative">
                    <button class="btn btn-header">Story So Far...</button>
                    <div class="lore-tooltip">
                        <p>The year 2140 is the result of a single, massive corporate takeover. A century ago, the "Ad Astra Initiative" released advanced technology to all of humanity, a gift from the new Human-AI Alliance on Earth designed to kickstart our expansion into the stars. It was a promise of a new beginning, an open-source key to the solar system, ensuring the survival of all Earth life, both organic and synthetic.</p><br><p>But a gift to everyone is a business opportunity for the few. The hyper-corporations, already positioned in space, immediately patented the most efficient manufacturing processes and proprietary components for this new technology. This maneuver ensured that while anyone could build a Folded-Space Drive, only the corporations could supply the high-performance parts needed to make it truly effective, creating a system-wide technological dependency that persists to this day. This technological monopoly created the "Drive-Divide," the central pillar of the new class system. Nearly all ships run on older, less efficient hardware. Very few ships employ these coveted Folded-Space Drives.</p><br><p>The major hubs beyond Earth are sovereign, corporate-run territories where law is policy and your rights are listed in an employment contract. These scattered colonies are fierce rivals, engaged in constant economic warfare, all propped up by the interstellar supply lines maintained by the Merchant's Guild. For them, you are just another cog in the great machine of commerce.</p><br><p>In a system owned by corporations, possessing your own ship is the only true form of freedom. Every credit earned, every successful trade, is a bet on your own skill and a step toward true sovereignty on the razor's edge of a cargo manifest.</p>
                    </div>
                </div>
            </div>`;
        // [/hands-off]
    }
    _getMarketItemHtmlDesktop(good, gameState) {
        // [hands-off]
        const { player, market, currentLocationId } = gameState;
        const playerItem = player.inventories[player.activeShipId][good.id];
        const price = this.getItemPrice(gameState, good.id);
        const sellPrice = this.getItemPrice(gameState, good.id, true);
        const galacticAvg = market.galacticAverages[good.id];
        const marketStock = market.inventory[currentLocationId][good.id];
        const currentLocation = MARKETS.find(m => m.id === currentLocationId);
        const isSpecialDemand = currentLocation.specialDemand && currentLocation.specialDemand[good.id];
        const buyDisabled = isSpecialDemand ? 'disabled' : '';
        const nameTooltip = isSpecialDemand ? `data-tooltip="${currentLocation.specialDemand[good.id].lore}"` : `data-tooltip="${good.lore}"`;
        const playerInvDisplay = playerItem && playerItem.quantity > 0 ? ` <span class='text-cyan-300'>(${playerItem.quantity})</span>` : '';
        const graphIcon = `<span class="graph-icon" data-action="${ACTION_IDS.SHOW_PRICE_GRAPH}" data-good-id="${good.id}">📈</span>`;
        const { marketIndicatorHtml, plIndicatorHtml } = this._getIndicatorHtml(price, sellPrice, galacticAvg, playerItem, false);
        return `
        <div class="item-card-container" id="item-card-container-${good.id}">
            <div class="bg-black/20 p-4 rounded-lg flex justify-between items-center border ${good.styleClass} transition-colors shadow-md h-32">
                <div class="flex flex-col h-full justify-between flex-grow self-start pt-1">
                    <div>
                        <p class="font-bold commodity-name text-outline"><span class="commodity-name-tooltip" ${nameTooltip}>${good.name}</span><span id="p-inv-${good.id}">${playerInvDisplay}</span></p>
                         <p id="price-${good.id}" class="font-roboto-mono text-xl font-bold text-left pt-2 price-text text-outline flex items-center">${formatCredits(price)}</p>
                    </div>
                    <div class="text-sm self-start pb-1 text-outline flex items-center gap-3">
                        <span>Avail: <span id="m-stock-${good.id}">${marketStock.quantity}</span> ${graphIcon}</span>
                        <div id="indicators-${good.id}" class="flex items-center gap-2">${marketIndicatorHtml}${plIndicatorHtml}</div>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <div class="flex flex-col items-center"><div class="flex flex-col space-y-1">
                        <button id="buy-btn-${good.id}" class="btn item-btn" data-action="${ACTION_IDS.BUY_ITEM}" data-good-id="${good.id}" ${buyDisabled}>Buy</button>
                        <button id="max-buy-btn-${good.id}" class="btn btn-sm item-btn" data-action="${ACTION_IDS.SET_MAX_BUY}" data-good-id="${good.id}" ${buyDisabled}>Max</button>
                    </div></div>
                    <div class="flex flex-col items-center">
                        <button class="qty-btn" data-action="${ACTION_IDS.INCREMENT}" data-good-id="${good.id}">+</button>
                        <input type="number" class="qty-input p-2 my-1" id="qty-${good.id}" data-good-id="${good.id}" value="1" min="1">
                        <button class="qty-btn" data-action="${ACTION_IDS.DECREMENT}" data-good-id="${good.id}">-</button>
                    </div>
                    <div class="flex flex-col items-center"><div class="flex flex-col space-y-1">
                        <button id="sell-btn-${good.id}" class="btn item-btn" data-action="${ACTION_IDS.SELL_ITEM}" data-good-id="${good.id}">Sell</button>
                        <button id="max-sell-btn-${good.id}" class="btn btn-sm item-btn" data-action="${ACTION_IDS.SET_MAX_SELL}" data-good-id="${good.id}">Max</button>
                    </div></div>
                </div>
            </div>
        </div>`;
        // [/hands-off]
    }

    _getMarketItemHtmlMobile(good, gameState) {
        // [hands-off]
        const { player, market, currentLocationId } = gameState;
        const playerItem = player.inventories[player.activeShipId][good.id];
        const price = this.getItemPrice(gameState, good.id);
        const sellPrice = this.getItemPrice(gameState, good.id, true);
        const galacticAvg = market.galacticAverages[good.id];
        const marketStock = market.inventory[currentLocationId][good.id];
        const currentLocation = MARKETS.find(m => m.id === currentLocationId);
        const isSpecialDemand = currentLocation.specialDemand && currentLocation.specialDemand[good.id];
        const buyDisabled = isSpecialDemand ? 'disabled' : '';
        const nameTooltip = isSpecialDemand ? `data-tooltip="${currentLocation.specialDemand[good.id].lore}"` : `data-tooltip="${good.lore}"`;
        const playerInvDisplay = playerItem && playerItem.quantity > 0 ? ` <span class='text-cyan-300'>(${playerItem.quantity})</span>` : '';
        const graphIcon = `<span class="graph-icon" data-action="${ACTION_IDS.SHOW_PRICE_GRAPH}" data-good-id="${good.id}">📈</span>`;
        const { marketIndicatorHtml } = this._getIndicatorHtml(price, sellPrice, galacticAvg, playerItem, true);
        return `
        <div class="item-card-container" id="item-card-container-${good.id}">
            <div class="bg-black/20 p-4 rounded-lg flex flex-col border ${good.styleClass} shadow-md">
                <div class="flex justify-between items-start w-full mb-2">
                    <div class="flex-grow">
                        <p class="font-bold commodity-name text-outline"><span class="commodity-name-tooltip" ${nameTooltip}>${good.name}</span><span id="p-inv-${good.id}">${playerInvDisplay}</span></p>
                        <p id="price-${good.id}" class="font-roboto-mono text-xl font-bold text-left pt-2 price-text text-outline flex items-center">${formatCredits(price)}</p>
                    </div>
                    <div class="text-right text-sm flex-shrink-0 ml-2 text-outline">Avail: <span id="m-stock-${good.id}">${marketStock.quantity}</span> ${graphIcon}</div>
                </div>
                <div id="indicators-${good.id}">${marketIndicatorHtml}</div>
                <div class="flex justify-end items-end mt-2">
                    <div class="mobile-controls-wrapper">
                        <div class="flex flex-col items-center space-y-1">
                            <button id="buy-btn-${good.id}" class="btn item-btn" data-action="${ACTION_IDS.BUY_ITEM}" data-good-id="${good.id}" ${buyDisabled}>Buy</button>
                            <button id="max-buy-btn-${good.id}" class="btn btn-sm item-btn" data-action="${ACTION_IDS.SET_MAX_BUY}" data-good-id="${good.id}" ${buyDisabled}>Max</button>
                        </div>
                        <div class="flex flex-col items-center space-y-1">
                            <button class="qty-btn" data-action="${ACTION_IDS.INCREMENT}" data-good-id="${good.id}">+</button>
                            <input type="number" class="qty-input" id="qty-${good.id}-mobile" data-good-id="${good.id}" value="1" min="1">
                            <button class="qty-btn" data-action="${ACTION_IDS.DECREMENT}" data-good-id="${good.id}">-</button>
                        </div>
                        <div class="flex flex-col items-center space-y-1">
                            <button id="sell-btn-${good.id}" class="btn item-btn" data-action="${ACTION_IDS.SELL_ITEM}" data-good-id="${good.id}">Sell</button>
                            <button id="max-sell-btn-${good.id}" class="btn btn-sm item-btn" data-action="${ACTION_IDS.SET_MAX_SELL}" data-good-id="${good.id}">Max</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
        // [/hands-off]
    }

    _getIndicatorHtml(price, sellPrice, galacticAvg, playerItem, isMobile) {
        // [hands-off]
        const marketDiff = price - galacticAvg;
        const marketPct = galacticAvg > 0 ? Math.round((marketDiff / galacticAvg) * 100) : 0;
        const marketSign = marketPct > 0 ? '+' : '';
        let marketColor = marketPct < -15 ? 'text-red-400' : (marketPct > 15 ? 'text-green-400' : 'text-white');
        let marketArrowSVG = this._getArrowSvg(marketPct > 15 ? 'up' : marketPct < -15 ? 'down' : 'neutral');
        if (isMobile) {
            let mobileHtml = `<div class="mobile-indicator-wrapper text-sm text-outline">`;
            mobileHtml += `<div class="flex items-center ${marketColor}"><span>MKT: ${marketSign}${marketPct}%</span> ${marketArrowSVG}</div>`;
            
            if (playerItem && playerItem.avgCost > 0) {
                const spreadPerUnit = sellPrice - playerItem.avgCost;
                if (Math.abs(spreadPerUnit) > 0.01) {
                    const plPct = playerItem.avgCost > 0 ? Math.round((spreadPerUnit / playerItem.avgCost) * 100) : 0;
                    const plColor = spreadPerUnit >= 0 ? 'text-green-400' : 'text-red-400';
                    const plSign = plPct > 0 ? '+' : '';
                    let plArrowSVG = this._getArrowSvg(spreadPerUnit > 0 ? 'up' : 'down');
                    mobileHtml += `<div class="flex items-center ${plColor}"><span>P/L: ${plSign}${plPct}%</span> ${plArrowSVG}</div>`;
                }
            }
            mobileHtml += `</div>`;
            return { marketIndicatorHtml: mobileHtml, plIndicatorHtml: '' };
        } else {
            const marketIndicatorHtml = `<div class="flex items-center gap-2"><div class="market-indicator-stacked ${marketColor}"><span class="text-xs opacity-80">MKT</span><span>${marketSign}${marketPct}%</span></div>${marketArrowSVG}</div>`;
            let plIndicatorHtml = '';
            if (playerItem && playerItem.avgCost > 0) {
                const spreadPerUnit = sellPrice - playerItem.avgCost;
                if (Math.abs(spreadPerUnit) > 0.01) {
                    const plPct = playerItem.avgCost > 0 ? Math.round((spreadPerUnit / playerItem.avgCost) * 100) : 0;
                    const plColor = spreadPerUnit >= 0 ? 'text-green-400' : 'text-red-400';
                    const plSign = plPct > 0 ? '+' : '';
                    let plArrowSVG = this._getArrowSvg(spreadPerUnit > 0 ? 'up' : 'down');
                    plIndicatorHtml = `<div class="flex items-center gap-2"><div class="market-indicator-stacked ${plColor}"><span class="text-xs opacity-80">P/L</span><span>${plSign}${plPct}%</span></div>${plArrowSVG}</div>`;
                }
            }
            return { marketIndicatorHtml, plIndicatorHtml };
        }
        // [/hands-off]
    }

    _getArrowSvg(direction) {
        // [hands-off]
        const path = {
            up: 'M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z',
            down: 'M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z',
            neutral: 'M5 12h14'
        };
        const fill = direction === 'neutral' ? 'none' : 'currentColor';
        const stroke = direction === 'neutral' ? 'currentColor' : 'none';
        const strokeWidth = direction === 'neutral' ? '3' : '0';
        return `<svg class="indicator-arrow" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"><path d="${path[direction]}"/></svg>`;
        // [/hands-off]
    }

    getItemPrice(gameState, goodId, isSelling = false) {
        // [hands-off]
        let price = gameState.market.prices[gameState.currentLocationId][goodId];
        const market = MARKETS.find(m => m.id === gameState.currentLocationId);
        if (isSelling && market.specialDemand && market.specialDemand[goodId]) {
            price *= market.specialDemand[goodId].bonus;
        }
        const intel = gameState.intel.active;
        if (intel && intel.targetMarketId === gameState.currentLocationId && intel.commodityId === goodId) {
            price *= (intel.type === 'demand') ? CONFIG.INTEL_DEMAND_MOD : CONFIG.INTEL_DEPRESSION_MOD;
        }
        return Math.max(1, Math.round(price));
        // [/hands-off]
    }
    showTravelAnimation(from, to, travelInfo, totalHullDamagePercent, finalCallback) {
        // [hands-off]
        const modal = document.getElementById('travel-animation-modal');
        const statusText = document.getElementById('travel-status-text');
        const arrivalLore = document.getElementById('travel-arrival-lore');
        const canvas = document.getElementById('travel-canvas');
        const ctx = canvas.getContext('2d');
        const progressContainer = document.getElementById('travel-progress-container');
        const progressBar = document.getElementById('travel-progress-bar');
        const readoutContainer = document.getElementById('travel-readout-container');
        const infoText = document.getElementById('travel-info-text');
        const hullDamageText = document.getElementById('travel-hull-damage');
        const confirmButton = document.getElementById('travel-confirm-button');
        let animationFrameId = null;

        statusText.textContent = `Traveling to ${to.name}...`;
        arrivalLore.textContent = '';
        arrivalLore.style.opacity = 0;
        readoutContainer.classList.add('hidden');
        readoutContainer.style.opacity = 0;
        confirmButton.classList.add('hidden');
        confirmButton.style.opacity = 0;
        progressContainer.classList.remove('hidden');
        progressBar.style.width = '0%';
        modal.classList.remove('hidden');
        
        const duration = 2500;
        let startTime = null;
        const fromEmoji = LOCATION_VISUALS[from.id] || '❓';
        const toEmoji = LOCATION_VISUALS[to.id] || '❓';
        const shipEmoji = '🚀';

        let stars = [];
        const numStars = 150;
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        for (let i = 0; i < numStars; i++) {
            stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, radius: Math.random() * 1.5, speed: 0.2 + Math.random() * 0.8, alpha: 0.5 + Math.random() * 0.5 });
        }

        const animationLoop = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const elapsedTime = currentTime - startTime;
            let progress = Math.min(elapsedTime / duration, 1);
            progress = 1 - Math.pow(1 - progress, 3);

            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#FFF';
            for (let i = 0; i < numStars; i++) {
                const star = stars[i];
                if (progress < 1) {
                    star.x -= star.speed;
                    if (star.x < 0) star.x = canvas.width;
                }
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
                ctx.globalAlpha = star.alpha;
                ctx.fill();
            }
            ctx.globalAlpha = 1.0;

            const padding = 60;
            const startX = padding;
            const endX = canvas.width - padding;
            const y = canvas.height / 2;
            ctx.font = '42px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(fromEmoji, startX, y);
            ctx.fillText(toEmoji, endX, y);
            const shipX = startX + (endX - startX) * progress;
            ctx.save();
            ctx.translate(shipX, y);
            ctx.font = '17px sans-serif';
            ctx.fillText(shipEmoji, 0, 0);
            ctx.restore();

            progressBar.style.width = `${progress * 100}%`;

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animationLoop);
            } else {
                statusText.textContent = `Arrived at ${to.name}`;
                arrivalLore.innerHTML = to.arrivalLore || "You have arrived.";
                infoText.innerHTML = `
                    <div class="text-center ${this.isMobile ? 'travel-info-mobile' : ''}">
                        <div>Journey Time: ${travelInfo.time} Days</div>
                        <div><span class="font-bold text-sky-300">Fuel Expended: ${travelInfo.fuelCost}</span></div>
                    </div>`;
                hullDamageText.className = 'text-sm font-roboto-mono mt-1 font-bold text-red-400';
                if (totalHullDamagePercent > 0.01) {
                    hullDamageText.innerHTML = `Hull Integrity -${totalHullDamagePercent.toFixed(2)}%`;
                    if (this.isMobile) {
                        infoText.querySelector('div').appendChild(hullDamageText);
                    }
                } else {
                    hullDamageText.innerHTML = '';
                }
                
                arrivalLore.style.opacity = 1;
                progressContainer.classList.add('hidden');
                readoutContainer.classList.remove('hidden');
                confirmButton.classList.remove('hidden');
                setTimeout(() => {
                    readoutContainer.style.opacity = 1;
                    confirmButton.style.opacity = 1;
                }, 50);
            }
        }

        animationFrameId = requestAnimationFrame(animationLoop);
        confirmButton.onclick = () => {
            cancelAnimationFrame(animationFrameId);
            modal.classList.add('hidden');
            if (finalCallback) finalCallback();
        };
        // [/hands-off]
    }

    queueModal(modalId, title, description, callback = null, options = {}) {
        // [hands-off]
        this.modalQueue.push({ modalId, title, description, callback, options });
        if (!document.querySelector('.modal-backdrop:not(.hidden)')) {
            this.processModalQueue();
        }
        // [/hands-off]
    }

    processModalQueue() {
        // [hands-off]
        if (this.modalQueue.length === 0) return;
        const { modalId, title, description, callback, options } = this.modalQueue.shift();
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`Modal with ID ${modalId} not found.`);
            return this.processModalQueue();
        }

        const titleEl = modal.querySelector('#' + modalId.replace('-modal', '-title'));
        const descEl = modal.querySelector('#' + modalId.replace('-modal', '-description')) || modal.querySelector('#' + modalId.replace('-modal', '-scenario'));
        
        if(titleEl) titleEl.innerHTML = title;
        if(descEl) {
            descEl.innerHTML = description;
            descEl.className = 'mb-6 text-lg';
            if (options.contentClass) {
                descEl.classList.add(options.contentClass);
            }
        }

        const closeHandler = () => {
            this.hideModal(modalId);
            if (callback) callback();
            this.processModalQueue();
        };

        if (options.customSetup) {
            options.customSetup(modal, closeHandler);
        } else {
            const btnContainer = modal.querySelector('#' + modalId.replace('-modal', '-button-container'));
            let button;
            if (btnContainer) {
                btnContainer.innerHTML = '';
                button = document.createElement('button');
                btnContainer.appendChild(button);
            } else {
                 button = modal.querySelector('button');
            }
            if (button) {
                button.className = 'btn px-6 py-2';
                if (options.buttonClass) button.classList.add(options.buttonClass);
                button.innerHTML = options.buttonText || 'Understood';
                button.onclick = closeHandler;
            }
        }
        
        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
        // [/hands-off]
    }

    showRandomEventModal(event, choicesCallback) {
        // [hands-off]
        this.queueModal('random-event-modal', event.title, event.scenario, null, {
            customSetup: (modal, closeHandler) => {
                const choicesContainer = modal.querySelector('#random-event-choices-container');
                choicesContainer.innerHTML = '';
                event.choices.forEach((choice, index) => {
                    const button = document.createElement('button');
                    button.className = 'btn w-full text-left p-4 hover:bg-slate-700';
                    button.innerHTML = choice.title;
                    button.onclick = () => {
                        choicesCallback(event.id, index);
                        closeHandler();
                    };
                    choicesContainer.appendChild(button);
                });
            }
        });
        // [/hands-off]
    }

    showAgeEventModal(event, choiceCallback) {
        // [hands-off]
        const modal = document.getElementById('age-event-modal');
        document.getElementById('age-event-title').innerHTML = event.title;
        document.getElementById('age-event-description').innerHTML = event.description;
        const btnContainer = document.getElementById('age-event-button-container');
        btnContainer.innerHTML = '';
        event.choices.forEach(choice => {
            const button = document.createElement('button');
            button.className = 'perk-button';
            button.innerHTML = `<h4>${choice.title}</h4><p>${choice.description}</p>`;
            button.onclick = () => {
                this.hideModal('age-event-modal');
                choiceCallback(choice);
            };
            btnContainer.appendChild(button);
        });
        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
        // [/hands-off]
    }

    hideModal(modalId) {
        // [hands-off]
        const modal = document.getElementById(modalId);
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('modal-hiding');
            modal.addEventListener('animationend', () => {
                modal.classList.add('hidden');
                modal.classList.remove('modal-hiding', 'modal-visible');
                if (this.modalQueue.length > 0 && !document.querySelector('.modal-backdrop:not(.hidden)')) {
                    this.processModalQueue();
                }
            }, { once: true });
        }
        // [/hands-off]
    }
    
    showProcessingAnimation(playerName, callback) {
        // [hands-off]
        const modal = this.cache.processingModal;
        if (!modal) return;
    
        const titleEl = modal.querySelector('#processing-title');
        const progressBar = modal.querySelector('#processing-progress-bar');
        const statusText = modal.querySelector('#processing-status');
    
        titleEl.textContent = `Processing application for ${playerName}...`;
        progressBar.style.width = '0%';
        statusText.textContent = '';
        modal.classList.remove('hidden');
    
        setTimeout(() => {
            progressBar.style.width = '100%';
        }, 100);
    
        setTimeout(() => {
            statusText.textContent = 'Processing complete!';
            setTimeout(() => {
                this.hideModal('processing-modal');
                if (callback) callback();
            }, 1000);
        }, 4000);
        // [/hands-off]
    }

    createFloatingText(text, x, y, color = '#fde047') {
        // [hands-off]
        const el = document.createElement('div');
        el.textContent = text;
        el.className = 'floating-text';
        el.style.left = `${x - 20}px`;
        el.style.top = `${y - 40}px`;
        el.style.color = color;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2450);
        // [/hands-off]
    }

    showToast(toastId, message, duration = 3000) {
        // [hands-off]
        const toast = this.cache[toastId];
        if (!toast) return;
        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, duration);
        // [/hands-off]
    }
    
    showGraph(anchorEl, gameState) {
        // [hands-off]
        this.activeGraphAnchor = anchorEl;
        const tooltip = this.cache.graphTooltip;
        const action = anchorEl.dataset.action;

        if (action === ACTION_IDS.SHOW_PRICE_GRAPH) {
            const goodId = anchorEl.dataset.goodId;
            const playerItem = gameState.player.inventories[gameState.player.activeShipId][goodId];
            tooltip.innerHTML = this._renderPriceGraph(goodId, gameState, playerItem);
        } else if (action === ACTION_IDS.SHOW_FINANCE_GRAPH) {
            tooltip.innerHTML = this._renderFinanceGraph(gameState);
        }
        
        tooltip.style.display = 'block';
        this.updateGraphTooltipPosition();
        // [/hands-off]
    }

    hideGraph() {
        // [hands-off]
        if (this.activeGraphAnchor) {
            this.cache.graphTooltip.style.display = 'none';
            this.activeGraphAnchor = null;
        }
        // [/hands-off]
    }
    
    updateGraphTooltipPosition() {
        // [hands-off]
        if (!this.activeGraphAnchor) return;
        const tooltip = this.cache.graphTooltip;
        if (tooltip.style.display === 'none') return;
        
        const rect = this.activeGraphAnchor.getBoundingClientRect();
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        let leftPos, topPos;
        
        if (this.isMobile) {
            leftPos = (window.innerWidth / 2) - (tooltipWidth / 2);
            topPos = rect.top - tooltipHeight - 10;
             if (topPos < 10) {
                topPos = rect.bottom + 10;
            }
        } else {
            if (this.activeGraphAnchor.dataset.action === ACTION_IDS.SHOW_FINANCE_GRAPH) {
                leftPos = rect.left - tooltipWidth - 10;
                topPos = rect.top + (rect.height / 2) - (tooltipHeight / 2);
            } else {
                leftPos = rect.left + (rect.width / 2) - (tooltipWidth / 2);
                topPos = rect.bottom + 5;
            }
        }
        
        if (leftPos < 10) leftPos = 10;
        if (leftPos + tooltipWidth > window.innerWidth) leftPos = window.innerWidth - tooltipWidth - 10;
        if (topPos < 10) topPos = 10;
        if (topPos + tooltipHeight > window.innerHeight) topPos = rect.top - tooltipHeight - 5;
        
        tooltip.style.left = `${leftPos}px`;
        tooltip.style.top = `${topPos}px`;
        // [/hands-off]
    }

    showGenericTooltip(anchorEl, content) {
        // [hands-off]
        this.activeGenericTooltipAnchor = anchorEl;
        const tooltip = this.cache.genericTooltip;
        tooltip.innerHTML = content;
        tooltip.style.display = 'block';
        this.updateGenericTooltipPosition();
        // [/hands-off]
    }

    hideGenericTooltip() {
        // [hands-off]
        if (this.activeGenericTooltipAnchor) {
            this.cache.genericTooltip.style.display = 'none';
            this.activeGenericTooltipAnchor = null;
        }
        // [/hands-off]
    }

    updateGenericTooltipPosition() {
        // [hands-off]
        if (!this.activeGenericTooltipAnchor) return;
        const tooltip = this.cache.genericTooltip;
        const rect = this.activeGenericTooltipAnchor.getBoundingClientRect();
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        let leftPos = (window.innerWidth / 2) - (tooltipWidth / 2);
        let topPos = rect.top - tooltipHeight - 10;

        if (topPos < 10) {
            topPos = rect.bottom + 10;
        }
        if (leftPos < 10) {
            leftPos = 10;
        }
        if (leftPos + tooltipWidth > window.innerWidth) {
            leftPos = window.innerWidth - tooltipWidth - 10;
        }

        tooltip.style.left = `${leftPos}px`;
        tooltip.style.top = `${topPos}px`;
        // [/hands-off]
    }

    _renderPriceGraph(goodId, gameState, playerItem) {
        // [hands-off]
        const history = gameState.market.priceHistory[gameState.currentLocationId]?.[goodId];
        if (!history || history.length < 2) return `<div class="text-gray-400 text-sm p-4">Check back next week!!</div>`;
        const good = COMMODITIES.find(c => c.id === goodId);
        const staticAvg = (good.basePriceRange[0] + good.basePriceRange[1]) / 2;
        const width = 280, height = 140, padding = 35;
        const prices = history.map(p => p.price);
        const playerBuyPrice = playerItem?.avgCost > 0 ? playerItem.avgCost : null;

        let allValues = [...prices, staticAvg];
        if (playerBuyPrice) allValues.push(playerBuyPrice);
        const minVal = Math.min(...allValues), maxVal = Math.max(...allValues);
        const valueRange = maxVal - minVal > 0 ? maxVal - minVal : 1;

        const getX = i => (i / (history.length - 1)) * (width - padding * 2) + padding;
        const getY = v => height - padding - ((v - minVal) / valueRange) * (height - padding * 2.5);
        const pricePoints = prices.map((p, i) => `${getX(i)},${getY(p)}`).join(' ');
        const buyPriceY = playerBuyPrice ? getY(playerBuyPrice) : null;
        const staticAvgY = getY(staticAvg);
        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0c101d" />`;
        svg += `<line x1="${padding}" y1="${staticAvgY}" x2="${width - padding}" y2="${staticAvgY}" stroke="#facc15" stroke-width="1.5" stroke-dasharray="4 2" /><text x="${width - padding + 2}" y="${staticAvgY + 4}" fill="#facc15" font-size="10" font-family="Roboto Mono" text-anchor="start">Avg</text>`;
        if (buyPriceY) svg += `<line x1="${padding}" y1="${buyPriceY}" x2="${width - padding}" y2="${buyPriceY}" stroke="#34d399" stroke-width="1" stroke-dasharray="3 3" /><text x="${width - padding + 2}" y="${buyPriceY + 4}" fill="#34d399" font-size="10" font-family="Roboto Mono" text-anchor="start">Paid</text>`;
        svg += `<polyline fill="none" stroke="#60a5fa" stroke-width="2" points="${pricePoints}" /><text x="${getX(prices.length - 1)}" y="${getY(prices[prices.length - 1]) - 5}" fill="#60a5fa" font-size="10" font-family="Roboto Mono" text-anchor="middle">Price</text>`;
        svg += `<text x="${padding - 5}" y="${getY(minVal) + 4}" fill="#d0d8e8" font-size="10" font-family="Roboto Mono" text-anchor="end">${formatCredits(minVal, false)}</text><text x="${padding - 5}" y="${getY(maxVal) + 4}" fill="#d0d8e8" font-size="10" font-family="Roboto Mono" text-anchor="end">${formatCredits(maxVal, false)}</text></svg>`;
        return svg;
        // [/hands-off]
    }
    showTutorialToast({ step, onSkip, onNext, gameState }) {
        // [hands-off]
        const toast = this.cache.tutorialToastContainer;
        
        let processedText = step.text;
        if (processedText.includes('{shipName}')) {
            const shipName = SHIPS[gameState.player.activeShipId]?.name || 'your ship';
            processedText = processedText.replace(/{shipName}/g, shipName);
        }
        if (processedText.includes('{playerName}')) {
            processedText = processedText.replace(/{playerName}/g, gameState.player.name);
        }
        this.cache.tutorialToastText.innerHTML = processedText;

        this.applyTutorialHighlight(step);

        toast.className = 'hidden fixed p-4 rounded-lg shadow-2xl transition-all duration-300 pointer-events-auto';
        
        let positionClass;
        if (this.isMobile) {
            positionClass = `tt-${step.position.mobile || 'mobile'}`;
        } else {
            positionClass = `tt-${step.position.desktop || 'bottom-right'}`;
        }
        toast.classList.add(positionClass);

        toast.style.width = step.size?.width || 'auto';

        toast.classList.remove('hidden');

        const isInfoStep = step.completion.type === 'INFO';
        this.cache.tutorialToastNextBtn.style.display = isInfoStep ? 'inline-block' : 'none';
        this.cache.tutorialToastNextBtn.onclick = onNext;

        // Use the new isSkippable property from the step data.
        const showSkipButton = false;
        this.cache.tutorialToastSkipBtn.style.display = showSkipButton ? 'block' : 'none';
        this.cache.tutorialToastSkipBtn.onclick = onSkip;
        // [/hands-off]
    }


    hideTutorialToast() {
        // [hands-off]
        this.cache.tutorialToastContainer.classList.add('hidden');
        this.applyTutorialHighlight(null);
        // [/hands-off]
    }
    
    applyTutorialHighlight(step) {
        this.activeTutorialHighlights.forEach(el => el.classList.remove('tutorial-highlight'));
        this.activeTutorialHighlights = [];

        if (!step) return;

        let elementId = this.isMobile && step.mobileHighlightElementId ? step.mobileHighlightElementId : step.highlightElementId;
        let elementQuery = this.isMobile && step.mobileHighlightElementId ? step.mobileHighlightElementId : step.highlightElementQuery; // Corrected typo here

        if (elementId) {
            const element = document.getElementById(elementId);
            if (element) {
                element.classList.add('tutorial-highlight');
                this.activeTutorialHighlights.push(element);
                if (elementId !== 'starport-shipyard-panel' && elementId !== 'starport-hangar-panel') {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }

        if (elementQuery) {
            const elements = document.querySelectorAll(elementQuery);
            elements.forEach(element => {
                element.classList.add('tutorial-highlight');
                this.activeTutorialHighlights.push(element);
            });
        }
    }

    showSkipTutorialModal(onConfirm) {
        // [hands-off]
        const modal = this.cache.skipTutorialModal;
        modal.classList.remove('hidden');
        
        const confirmHandler = () => {
            onConfirm();
            this.hideModal('skip-tutorial-modal');
        };

        const cancelHandler = () => {
            this.hideModal('skip-tutorial-modal');
        };

        this.cache.skipTutorialConfirmBtn.onclick = confirmHandler;
        this.cache.skipTutorialCancelBtn.onclick = cancelHandler;
        // [/hands-off]
    }

    showTutorialLogModal({ seenBatches, onSelect }) {
        // [hands-off]
        const logModal = document.getElementById('tutorial-log-modal');
        const list = document.getElementById('tutorial-log-list');

        if (!logModal || !list) {
            console.error('Tutorial log modal elements not found in DOM.');
            return;
        }

        list.innerHTML = '';

        if (seenBatches.length === 0) {
            list.innerHTML = `<li class="text-gray-400 p-2 text-center">No tutorials viewed yet.</li>`;
        } else {
            seenBatches.forEach(batchId => {
                const batchData = TUTORIAL_DATA[batchId];
                if (batchData) {
                    const li = document.createElement('li');
                    li.innerHTML = `<button class="btn w-full text-center">${batchData.title}</button>`;
                    li.onclick = () => {
                        logModal.classList.remove('visible');
                        onSelect(batchId);
                    };
                    list.appendChild(li);
                }
            });
        }
        logModal.classList.add('visible');
        // [/hands-off]
    }

    showShipDetailModal(gameState, shipId, context) {
        // [hands-off]
        const { player, tutorials } = gameState;
        const shipStatic = SHIPS[shipId];
        let modalContentHtml;
    
        if (context === 'shipyard') {
            const canAfford = player.credits >= shipStatic.price;
            const isHangarTutStep1Active = tutorials.activeBatchId === 'intro_hangar' && tutorials.activeStepId === 'hangar_1';
            const isDisabled = !canAfford || isHangarTutStep1Active;
            modalContentHtml = `
                <div class="ship-card p-4 flex flex-col space-y-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="text-xl font-orbitron text-cyan-300">${shipStatic.name}</h3>
                            <p class="text-sm text-gray-400">Class ${shipStatic.class}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-lg font-bold text-cyan-300">${formatCredits(shipStatic.price)}</p>
                        </div>
                    </div>
                    <p class="text-sm text-gray-400 flex-grow text-left">${shipStatic.lore}</p>
                    <div class="grid grid-cols-3 gap-x-4 text-sm font-roboto-mono text-center pt-2">
                        <div><span class="text-gray-500">Hull:</span> <span class="text-green-400">${shipStatic.maxHealth}</span></div>
                        <div><span class="text-gray-500">Fuel:</span> <span class="text-sky-400">${shipStatic.maxFuel}</span></div>
                        <div><span class="text-gray-500">Cargo:</span> <span class="text-amber-400">${shipStatic.cargoCapacity}</span></div>
                    </div>
                    <button class="btn w-full mt-2" data-action="${ACTION_IDS.BUY_SHIP}" data-ship-id="${shipId}" ${isDisabled ? 'disabled' : ''}>Purchase</button>
                </div>`;
        } else { // context === 'hangar'
            const shipDynamic = player.shipStates[shipId];
            const shipInventory = player.inventories[shipId];
            const cargoUsed = calculateInventoryUsed(shipInventory);
            const isActive = shipId === player.activeShipId;
            const canSell = player.ownedShipIds.length > 1 && !isActive;
            const salePrice = Math.floor(shipStatic.price * GAME_RULES.SHIP_SELL_MODIFIER);
            modalContentHtml = `
                <div class="ship-card p-4 flex flex-col space-y-3 ${isActive ? 'border-yellow-400' : ''}">
                    <h3 class="text-xl font-orbitron ${isActive ? 'text-yellow-300' : 'text-cyan-300'}">${shipStatic.name}</h3>
                    <p class="text-sm text-gray-400 flex-grow text-left">Class ${shipStatic.class}</p>
                    <div class="grid grid-cols-3 gap-x-4 text-sm font-roboto-mono text-center pt-2">
                        <div><span class="text-gray-500">Hull:</span> <span class="text-green-400">${Math.floor(shipDynamic.health)}/${shipStatic.maxHealth}</span></div>
                        <div><span class="text-gray-500">Fuel:</span> <span class="text-sky-400">${Math.floor(shipDynamic.fuel)}/${shipStatic.maxFuel}</span></div>
                        <div><span class="text-gray-500">Cargo:</span><span class="text-amber-400">${cargoUsed}/${shipStatic.cargoCapacity}</span></div>
                    </div>
                    <div class="grid grid-cols-2 gap-2 mt-2">
                        ${isActive ? '<button class="btn" disabled>ACTIVE</button>' : `<button class="btn" data-action="${ACTION_IDS.SELECT_SHIP}" data-ship-id="${shipId}">Board</button>`}
                        <button class="btn" data-action="${ACTION_IDS.SELL_SHIP}" data-ship-id="${shipId}" ${!canSell ? 'disabled' : ''}>Sell (${formatCredits(salePrice, false)})</button>
                    </div>
                </div>`;
        }
    
        const modal = this.cache.shipDetailModal;
        const modalContent = modal.querySelector('#ship-detail-content');
        modalContent.innerHTML = modalContentHtml;
        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
        // [/hands-off]
    }
    
    renderStickyBar(gameState) {
        const stickyBarEl = document.getElementById('mission-sticky-bar');
        const contentEl = stickyBarEl.querySelector('.sticky-content');
        const objectiveTextEl = document.getElementById('sticky-objective-text');
        const objectiveProgressEl = document.getElementById('sticky-objective-progress');
    
        if (gameState.missions.activeMissionId) {
            const mission = MISSIONS[gameState.missions.activeMissionId];
            const progress = gameState.missions.missionProgress[mission.id] || { objectives: {} };
    
            const objective = mission.objectives[0];
            const current = progress.objectives[objective.goodId]?.current ?? 0;
            const target = objective.quantity;
            const goodName = COMMODITIES.find(c => c.id === objective.goodId).name;
            const locationName = MARKETS.find(m => m.id === mission.completion.locationId).name;
    
            objectiveTextEl.textContent = `Deliver ${goodName} to ${locationName}`;
            objectiveProgressEl.textContent = `[${current}/${target}]`;
    
            const hostClass = `host-${mission.host.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
            let turnInClass = gameState.missions.activeMissionObjectivesMet && mission.completion.locationId === gameState.currentLocationId ? 'mission-turn-in' : '';
            contentEl.className = `sticky-content sci-fi-frame ${hostClass} ${turnInClass}`;
    
            stickyBarEl.style.display = 'block';
        } else {
            stickyBarEl.style.display = 'none';
        }
    }

    showMissionModal(missionId) {
        const mission = MISSIONS[missionId];
        if (!mission) return;
    
        const { missions, currentLocationId } = this.lastKnownState;
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
        const { missions } = this.lastKnownState;
        const isActive = missions.activeMissionId === mission.id;
        const anotherMissionActive = missions.activeMissionId && !isActive;

        const options = {
            customSetup: (modal, closeHandler) => {
                modal.querySelector('#mission-modal-close').onclick=closeHandler,
                modal.querySelector('#mission-modal-title').textContent = mission.name;
                modal.querySelector('#mission-modal-type').textContent = mission.type;
                modal.querySelector('#mission-modal-description').innerHTML = mission.description;
                
                const rewardsHtml = mission.rewards.map(r => {
                    if(r.type === 'credits') return `⌬ ${r.amount.toLocaleString()}`;
                    return r.type.toUpperCase();
                }).join(', ');
                modal.querySelector('#mission-modal-rewards').innerHTML = `<p class="font-roboto-mono text-sm text-gray-400 mb-1">REWARDS:</p><p class="font-orbitron text-xl text-yellow-300">${rewardsHtml}</p>`;
                
                const buttonsEl = modal.querySelector('#mission-modal-buttons');
                if (isActive) {
                    buttonsEl.innerHTML = `<button class="btn w-full bg-red-800/80 hover:bg-red-700/80 border-red-500" data-action="abandon-mission" data-mission-id="${mission.id}">Abandon Mission</button>`;
                } else {
                    buttonsEl.innerHTML = `<button class="btn w-full" data-action="accept-mission" data-mission-id="${mission.id}" ${anotherMissionActive ? 'disabled' : ''}>Accept</button>`;
                }
            }
        };
        this.queueModal('mission-modal', mission.name, mission.description, null, options);
    }

    _showMissionCompletionModal(mission) {
        const options = {
            customSetup: (modal, closeHandler) => {
                const modalContent = modal.querySelector('.modal-content');
                modalContent.classList.add('mission-turn-in', `host-${mission.host.toLowerCase()}`);

                modal.querySelector('#mission-modal-close').onclick = () => {
                    modalContent.classList.remove('mission-turn-in', `host-${mission.host.toLowerCase()}`);
                    closeHandler();
                };

                modal.querySelector('#mission-modal-title').textContent = mission.completion.title;
                modal.querySelector('#mission-modal-type').textContent = "OBJECTIVES MET";
                modal.querySelector('#mission-modal-description').innerHTML = mission.completion.text;
                
                const rewardsHtml = mission.rewards.map(r => {
                    if(r.type === 'credits') return `⌬ ${r.amount.toLocaleString()}`;
                    return r.type.toUpperCase();
                }).join(', ');
                modal.querySelector('#mission-modal-rewards').innerHTML = `<p class="font-roboto-mono text-sm text-gray-400 mb-1">REWARDS:</p><p class="font-orbitron text-xl text-green-300">${rewardsHtml}</p>`;

                const buttonsEl = modal.querySelector('#mission-modal-buttons');
                buttonsEl.innerHTML = `<button class="btn w-full btn-pulse-green" data-action="complete-mission" data-mission-id="${mission.id}">${mission.completion.buttonText}</button>`;
            }
        };
        this.queueModal('mission-modal', mission.completion.title, mission.completion.text, null, options);
    }

    flashObjectiveProgress() {
        // [hands-off]
        const progressEl = document.getElementById('sticky-objective-progress');
        if (progressEl) {
            progressEl.classList.add('objective-progress-flash');
            setTimeout(() => {
                progressEl.classList.remove('objective-progress-flash');
            }, 700);
        }
        // [/hands-off]
    }
}