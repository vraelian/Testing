// js/services/UIManager.js
import { DB } from '../data/database.js';
import { formatCredits, calculateInventoryUsed, getDateFromDay } from '../utils.js';
import { SCREEN_IDS, NAV_IDS, ACTION_IDS, GAME_RULES, PERK_IDS, LOCATION_IDS, SHIP_IDS } from '../data/constants.js';

// Import all screen rendering components
import { renderHangarScreen } from '../ui/components/HangarScreen.js';
import { renderMarketScreen } from '../ui/components/MarketScreen.js';
import { renderStatusScreen } from '../ui/components/StatusScreen.js';
import { renderNavigationScreen } from '../ui/components/NavigationScreen.js';
import { renderServicesScreen } from '../ui/components/ServicesScreen.js';
import { renderCargoScreen } from '../ui/components/CargoScreen.js';
import { renderMissionsScreen } from '../ui/components/MissionsScreen.js';
import { renderFinanceScreen } from '../ui/components/FinanceScreen.js';
import { renderIntelScreen } from '../ui/components/IntelScreen.js';

export class UIManager {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.modalQueue = [];
        this.activeGraphAnchor = null;
        this.activeGenericTooltipAnchor = null;
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
            topBarContainer: document.getElementById('top-bar-container'),
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
        
        const location = DB.MARKETS.find(l => l.id === gameState.currentLocationId);
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
        this.cache.subNavBar.innerHTML = `<div class="flex justify-center w-full gap-2 md:gap-4 ${themeClass}">${subNavButtons}</div>`;
    }

    renderActiveScreen(gameState) {
        const activeScreenEl = document.getElementById(`${gameState.activeScreen}-screen`);
        if (this.lastActiveScreenEl && this.lastActiveScreenEl !== activeScreenEl) {
            this.lastActiveScreenEl.style.display = 'none';
        }

        if (activeScreenEl) {
            activeScreenEl.style.display = 'block';
            this.lastActiveScreenEl = activeScreenEl;
        }

        switch (gameState.activeScreen) {
            case SCREEN_IDS.STATUS:
                this.cache.statusScreen.innerHTML = renderStatusScreen(gameState);
                break;
            case SCREEN_IDS.NAVIGATION:
                this.cache.navigationScreen.innerHTML = renderNavigationScreen(gameState);
                break;
            case SCREEN_IDS.SERVICES:
                this.cache.servicesScreen.innerHTML = renderServicesScreen(gameState);
                break;
            case SCREEN_IDS.MARKET:
                this.cache.marketScreen.innerHTML = renderMarketScreen(gameState, this.isMobile);
                break;
            case SCREEN_IDS.CARGO:
                this.cache.cargoScreen.innerHTML = renderCargoScreen(gameState);
                break;
            case SCREEN_IDS.HANGAR:
                this.cache.hangarScreen.innerHTML = renderHangarScreen(gameState, this.isMobile);
                break;
            case SCREEN_IDS.MISSIONS:
                this.cache.missionsScreen.innerHTML = renderMissionsScreen(gameState, this.missionService);
                break;
            case SCREEN_IDS.FINANCE:
                this.cache.financeScreen.innerHTML = renderFinanceScreen(gameState);
                break;
            case SCREEN_IDS.INTEL:
                this.cache.intelScreen.innerHTML = renderIntelScreen();
                break;
        }
    }

    updateStickyBar(gameState) {
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
        const shipStatic = DB.SHIPS[player.activeShipId];
    
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
        if (this.cache.stickyBar.innerHTML.trim() !== '') {
            this.cache.topBarContainer.classList.add('has-sticky-bar');
        } else {
            this.cache.topBarContainer.classList.remove('has-sticky-bar');
        }
    }

    updateServicesScreen(gameState) {
        if (gameState.activeScreen !== SCREEN_IDS.SERVICES) return;
        const { player } = gameState;
        const shipStatic = DB.SHIPS[player.activeShipId];
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
    }

    updateMarketScreen(gameState) {
        if (gameState.activeScreen !== SCREEN_IDS.MARKET) return;
        const { player, market, currentLocationId } = gameState;
        const availableCommodities = DB.COMMODITIES.filter(c => c.unlockLevel <= player.unlockedCommodityLevel);
        const shipStatic = DB.SHIPS[player.activeShipId];
        const cargoUsed = calculateInventoryUsed(player.inventories[player.activeShipId]);
        const currentLocation = DB.MARKETS.find(m => m.id === currentLocationId);

        availableCommodities.forEach(good => {
            const goodId = good.id;
            const cardContainer = document.getElementById(`item-card-container-${goodId}`);
            if (!cardContainer) return;
    
            const playerItem = player.inventories[player.activeShipId][goodId];
            const marketStock = market.inventory[currentLocationId][goodId];
            const price = this.getItemPrice(gameState, goodId);
    
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
    }

    getItemPrice(gameState, goodId, isSelling = false) {
        let price = gameState.market.prices[gameState.currentLocationId][goodId];
        const market = DB.MARKETS.find(m => m.id === gameState.currentLocationId);
        if (isSelling && market.specialDemand && market.specialDemand[goodId]) {
            price *= market.specialDemand[goodId].bonus;
        }
        const intel = gameState.intel.active;
        if (intel && intel.targetMarketId === gameState.currentLocationId && intel.commodityId === goodId) {
            price *= (intel.type === 'demand') ? DB.CONFIG.INTEL_DEMAND_MOD : DB.CONFIG.INTEL_DEPRESSION_MOD;
        }
        return Math.max(1, Math.round(price));
    }
    showTravelAnimation(from, to, travelInfo, totalHullDamagePercent, finalCallback) {
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
        const fromEmoji = DB.LOCATION_VISUALS[from.id] || '❓';
        const toEmoji = DB.LOCATION_VISUALS[to.id] || '❓';
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
    }

    queueModal(modalId, title, description, callback = null, options = {}) {
        this.modalQueue.push({ modalId, title, description, callback, options });
        if (!document.querySelector('.modal-backdrop:not(.hidden)')) {
            this.processModalQueue();
        }
    }

    processModalQueue() {
        if (this.modalQueue.length === 0) return;
        const { modalId, title, description, callback, options } = this.modalQueue.shift();
        const modal = document.getElementById(modalId);
        if (!modal) {
            console.error(`UIManager Error: Modal element with ID '${modalId}' not found in the DOM. Aborting modal display.`);
            return this.processModalQueue();
        }

        const titleElId = modalId === 'mission-modal' ? 'mission-modal-title' : modalId.replace('-modal', '-title');
        const descElId = modalId === 'mission-modal' ? 'mission-modal-description' : modalId.replace('-modal', '-description');
        const titleEl = modal.querySelector(`#${titleElId}`);
        const descEl = modal.querySelector(`#${descElId}`) || modal.querySelector(`#${modalId.replace('-modal', '-scenario')}`);

        if (titleEl) titleEl.innerHTML = title;
        if (descEl) {
            descEl.innerHTML = description;
            descEl.className = 'my-4 text-gray-300'; 
            if(modalId !== 'mission-modal') descEl.classList.add('mb-6', 'text-lg');
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
    }

    showRandomEventModal(event, choicesCallback) {
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
    }

    showAgeEventModal(event, choiceCallback) {
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
    }

    hideModal(modalId) {
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
    }
    
    showProcessingAnimation(playerName, callback) {
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

    showToast(toastId, message, duration = 3000) {
        const toast = this.cache[toastId];
        if (!toast) return;
        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.style.opacity = '1';
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.classList.add('hidden'), 300);
        }, duration);
    }
    
    showGraph(anchorEl, gameState) {
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
    }

    hideGraph() {
        if (this.activeGraphAnchor) {
            this.cache.graphTooltip.style.display = 'none';
            this.activeGraphAnchor = null;
        }
    }
    
    updateGraphTooltipPosition() {
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
    }

    showGenericTooltip(anchorEl, content) {
        this.activeGenericTooltipAnchor = anchorEl;
        const tooltip = this.cache.genericTooltip;
        tooltip.innerHTML = content;
        tooltip.style.display = 'block';
        this.updateGenericTooltipPosition();
    }

    hideGenericTooltip() {
        if (this.activeGenericTooltipAnchor) {
            this.cache.genericTooltip.style.display = 'none';
            this.activeGenericTooltipAnchor = null;
        }
    }

    updateGenericTooltipPosition() {
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
    }

    _renderPriceGraph(goodId, gameState, playerItem) {
        const history = gameState.market.priceHistory[gameState.currentLocationId]?.[goodId];
        if (!history || history.length < 2) return `<div class="text-gray-400 text-sm p-4">Check back next week!!</div>`;
        const good = DB.COMMODITIES.find(c => c.id === goodId);
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
    }
    showTutorialToast({ step, onSkip, onNext, gameState }) {
        const toast = this.cache.tutorialToastContainer;
        
        let processedText = step.text;
        if (processedText.includes('{shipName}')) {
            const shipName = DB.SHIPS[gameState.player.activeShipId]?.name || 'your ship';
            processedText = processedText.replace(/{shipName}/g, shipName);
        }
        if (processedText.includes('{playerName}')) {
            processedText = processedText.replace(/{playerName}/g, gameState.player.name);
        }
        this.cache.tutorialToastText.innerHTML = processedText;

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

        const showSkipButton = false;
        this.cache.tutorialToastSkipBtn.style.display = showSkipButton ? 'block' : 'none';
        this.cache.tutorialToastSkipBtn.onclick = onSkip;
    }


    hideTutorialToast() {
        this.cache.tutorialToastContainer.classList.add('hidden');
        this.applyTutorialHighlight(null);
    }
    
    applyTutorialHighlight(step) {
        // This function is intentionally left empty to disable the highlighting feature.
    }

    showSkipTutorialModal(onConfirm) {
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
    }

    showTutorialLogModal({ seenBatches, onSelect }) {
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
                const batchData = DB.TUTORIAL_DATA[batchId];
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
    }

    showShipDetailModal(gameState, shipId, context) {
        const { player, tutorials } = gameState;
        const shipStatic = DB.SHIPS[shipId];
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
    }
    
    renderStickyBar(gameState) {
        const stickyBarEl = document.getElementById('mission-sticky-bar');
        const contentEl = stickyBarEl.querySelector('.sticky-content');
        const objectiveTextEl = document.getElementById('sticky-objective-text');
        const objectiveProgressEl = document.getElementById('sticky-objective-progress');
    
        if (gameState.missions.activeMissionId) {
            const mission = DB.MISSIONS[gameState.missions.activeMissionId];
            const progress = gameState.missions.missionProgress[mission.id] || { objectives: {} };
    
            const objective = mission.objectives[0];
            const current = progress.objectives[objective.goodId]?.current ?? 0;
            const target = objective.quantity;
            const goodName = DB.COMMODITIES.find(c => c.id === objective.goodId).name;
            const locationName = DB.MARKETS.find(m => m.id === mission.completion.locationId).name;
    
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
        const mission = DB.MISSIONS[missionId];
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
        const { missions, tutorials } = this.lastKnownState;
        const isActive = missions.activeMissionId === mission.id;
        const anotherMissionActive = missions.activeMissionId && !isActive;

        const isTutorialMissionOne = mission.id === 'mission_tutorial_01';

        let shouldBeDisabled = anotherMissionActive;
        if (isTutorialMissionOne) {
            shouldBeDisabled = false;
        }

        const options = {
            customSetup: (modal, closeHandler) => {
                
                const rewardsEl = modal.querySelector('#mission-modal-rewards');
                if (mission.rewards && mission.rewards.length > 0) {
                    const rewardsHtml = mission.rewards.map(r => {
                        if(r.type === 'credits') return `⌬ ${r.amount.toLocaleString()}`;
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
                    const isAbandonable = mission.isAbandonable !== false; // Default to true if undefined
                    buttonsEl.innerHTML = `<button class="btn w-full bg-red-800/80 hover:bg-red-700/80 border-red-500" data-action="abandon-mission" data-mission-id="${mission.id}" ${!isAbandonable ? 'disabled' : ''}>Abandon Mission</button>`;
                } else { 
                    buttonsEl.innerHTML = `<button class="btn w-full" data-action="accept-mission" data-mission-id="${mission.id}" ${shouldBeDisabled ? 'disabled' : ''}>Accept</button>`;
                }
            }
        };
        this.queueModal('mission-modal', mission.name, mission.description, null, options);
    }

    _showMissionCompletionModal(mission) {
        const options = {
            customSetup: (modal, closeHandler) => {
                const modalContent = modal.querySelector('.modal-content');
                modal.querySelector('#mission-modal-title').textContent = mission.completion.title;
                modal.querySelector('#mission-modal-type').textContent = "OBJECTIVES MET";
                modal.querySelector('#mission-modal-description').innerHTML = mission.completion.text;
                
                const rewardsEl = modal.querySelector('#mission-modal-rewards');
                if (mission.rewards && mission.rewards.length > 0) {
                    const rewardsHtml = mission.rewards.map(r => {
                        if(r.type === 'credits') return `⌬ ${r.amount.toLocaleString()}`;
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
        this.queueModal('mission-modal', mission.completion.title, mission.completion.text, null, options);
    }

    flashObjectiveProgress() {
        const progressEl = document.getElementById('sticky-objective-progress');
        if (progressEl) {
            progressEl.classList.add('objective-progress-flash');
            setTimeout(() => {
                progressEl.classList.remove('objective-progress-flash');
            }, 700);
        }
    }
}