// js/services/UIManager.js
import { DB } from '../data/database.js';
import { formatCredits, calculateInventoryUsed, renderIndicatorPills, formatGameDateShort } from '../utils.js';
import { SCREEN_IDS, NAV_IDS, ACTION_IDS, GAME_RULES, PERK_IDS } from '../data/constants.js';
import { EffectsManager } from '../effects/EffectsManager.js';

// --- Screen Renderers ---
import { renderHangarScreen } from '../ui/components/HangarScreen.js';
import { renderMapScreen, initMap } from '../ui/components/MapScreen.js';
import { renderNavigationScreen } from '../ui/components/NavigationScreen.js';
import { renderServicesScreen } from '../ui/components/ServicesScreen.js';
import { renderCargoScreen } from '../ui/components/CargoScreen.js';
import { renderMissionsScreen } from '../ui/components/MissionsScreen.js';
import { renderFinanceScreen } from '../ui/components/FinanceScreen.js';
import { renderIntelScreen } from '../ui/components/IntelScreen.js';
import { IntelMarketRenderer } from '../ui/renderers/IntelMarketRenderer.js';

// --- Services & Logic ---
import { TravelAnimationService } from './ui/TravelAnimationService.js';
import { AssetService } from './AssetService.js';
import { GameAttributes } from './GameAttributes.js';

// --- [[NEW]] Domain Controllers ---
import { UIModalEngine } from './ui/UIModalEngine.js';
import { UITutorialManager } from './ui/UITutorialManager.js';
import { UIMarketControl } from './ui/UIMarketControl.js';
import { UIMissionControl } from './ui/UIMissionControl.js';
import { UIHangarControl } from './ui/UIHangarControl.js';
import { UIEventControl } from './ui/UIEventControl.js';
import { UISolStationControl } from './ui/UISolStationControl.js'; // NEW IMPORT

export class UIManager {
    /**
     * @param {import('./LoggingService.js').Logger} logger
     */
    constructor(logger) {
        this.logger = logger;
        this.isMobile = window.innerWidth <= 768;
        this.lastActiveScreenEl = null;
        this.lastKnownState = null;
        
        // --- Dependency Injection Placeholders ---
        this.missionService = null; 
        this.simulationService = null; 
        this.newsTickerService = null; 
        this.debugService = null; 
        this.intelService = null; 
        this.eventManager = null; 
        this.intelMarketRenderer = null;

        // --- Core Sub-Systems ---
        this.effectsManager = new EffectsManager();
        this.travelAnimationService = new TravelAnimationService(this.isMobile);

        // --- Domain Controllers (The Switchboard) ---
        this.modalEngine = new UIModalEngine(this);
        this.tutorialManager = new UITutorialManager(this);
        this.marketControl = new UIMarketControl(this);
        this.missionControl = new UIMissionControl(this);
        this.hangarControl = new UIHangarControl(this);
        this.eventControl = new UIEventControl(this);
        this.solStationControl = new UISolStationControl(this); // NEW CONTROLLER

        // --- Generic Tooltip State ---
        this.activeGraphAnchor = null;
        this.activeGenericTooltipAnchor = null;
        this.activeGenericTooltipPosition = 'right';

        this.navStructure = {
            [NAV_IDS.SHIP]: { label: 'Ship', screens: { [SCREEN_IDS.MAP]: 'Map', [SCREEN_IDS.NAVIGATION]: 'Navigation', [SCREEN_IDS.CARGO]: 'Cargo' } },
            [NAV_IDS.STARPORT]: { label: 'Starport', screens: { [SCREEN_IDS.MARKET]: 'Market', [SCREEN_IDS.SERVICES]: 'Services', [SCREEN_IDS.HANGAR]: 'Shipyard' } },
            [NAV_IDS.DATA]: { label: 'Data', screens: { [SCREEN_IDS.MISSIONS]: 'Missions', [SCREEN_IDS.FINANCE]: 'Finance', [SCREEN_IDS.INTEL]: 'Intel' } }
        };
        
        this._cacheDOM();
        
        // Bind Context for Market Renderer
        this.getItemPrice = this.marketControl.getItemPrice.bind(this.marketControl);
        
        window.addEventListener('resize', this._setAppHeight);
    }

    // --- Service Injection Methods ---
    setMissionService(service) { this.missionService = service; }
    setSimulationService(service) { this.simulationService = service; }
    setNewsTickerService(service) { this.newsTickerService = service; }
    setDebugService(service) { this.debugService = service; }
    setEventManager(service) { this.eventManager = service; }
    
    setIntelService(intelService) {
        this.intelService = intelService;
        this.intelMarketRenderer = new IntelMarketRenderer(intelService);
    }

    _setAppHeight() {
        document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    }

    _cacheDOM() {
        this.cache = {
            gameContainer: document.getElementById('game-container'),
            navBar: document.getElementById('nav-bar'),
            newsTickerBar: document.getElementById('news-ticker-bar'), 
            topBarContainer: document.getElementById('top-bar-container'),
            subNavBar: document.getElementById('sub-nav-bar'),
            stickyBar: document.getElementById('sticky-bar'),
            
            // Screen Containers
            mapScreen: document.getElementById(`${SCREEN_IDS.MAP}-screen`),
            navigationScreen: document.getElementById(`${SCREEN_IDS.NAVIGATION}-screen`),
            servicesScreen: document.getElementById(`${SCREEN_IDS.SERVICES}-screen`),
            marketScreen: document.getElementById(`${SCREEN_IDS.MARKET}-screen`),
            cargoScreen: document.getElementById(`${SCREEN_IDS.CARGO}-screen`),
            hangarScreen: document.getElementById(`${SCREEN_IDS.HANGAR}-screen`),
            missionsScreen: document.getElementById(`${SCREEN_IDS.MISSIONS}-screen`),
            financeScreen: document.getElementById(`${SCREEN_IDS.FINANCE}-screen`),
            intelScreen: document.getElementById(`${SCREEN_IDS.INTEL}-screen`),
            
            // Tooltips
            graphTooltip: document.getElementById('graph-tooltip'),
            genericTooltip: document.getElementById('generic-tooltip'),
            
            // Modals
            processingModal: document.getElementById('processing-modal'),
            shipDetailModal: document.getElementById('ship-detail-modal'),
            launchModal: document.getElementById('launch-modal'),
            launchModalContent: document.getElementById('launch-modal-content'),
            cargoDetailModal: document.getElementById('cargo-detail-modal'),
            cargoDetailContent: document.getElementById('cargo-detail-content'),
            mapDetailModal: document.getElementById('map-detail-modal'),
            loreModal: document.getElementById('lore-modal'),
            loreModalContent: document.getElementById('lore-modal-content'),
            eulaModal: document.getElementById('eula-modal'),
            eulaModalContent: document.getElementById('eula-modal-content'),

            // Tutorial Elements
            tutorialAnchorOverlay: document.getElementById('tutorial-anchor-overlay'), 
            tutorialToastContainer: document.getElementById('tutorial-toast-container'),
            tutorialToastText: document.getElementById('tutorial-toast-text'),
            tutorialToastSkipBtn: document.getElementById('tutorial-toast-skip-btn'),
            tutorialToastNextBtn: document.getElementById('tutorial-toast-next-btn'),
            skipTutorialModal: document.getElementById('skip-tutorial-modal'),
            skipTutorialConfirmBtn: document.getElementById('skip-tutorial-confirm-btn'),
            skipTutorialCancelBtn: document.getElementById('skip-tutorial-cancel-btn'),
            tutorialHighlightOverlay: document.getElementById('tutorial-highlight-overlay'),

            // Mission Elements
            missionStickyBar: document.getElementById('mission-sticky-bar'),
            stickyObjectiveText: document.getElementById('sticky-objective-text'),
            stickyObjectiveProgress: document.getElementById('sticky-objective-progress')
        };
    }

    // =========================================================================
    // MASTER RENDER LOOP
    // =========================================================================

    render(gameState) {
        if (!gameState || !gameState.player) return;

        const previousState = this.lastKnownState;
        this.lastKnownState = gameState;

        if (gameState.introSequenceActive && !gameState.tutorials.activeBatchId) {
            return;
        }

        this._applyTheme(gameState);
        this._renderNewsTicker(); 
        this.renderNavigation(gameState);
        this.renderActiveScreen(gameState, previousState);
        
        // Delegate: Mission Control (HUD)
        this.missionControl.renderStickyBar(gameState);
    }

    _applyTheme(gameState) {
        const location = DB.MARKETS.find(l => l.id === gameState.currentLocationId);
        if (location) {
            this.cache.topBarContainer.setAttribute('data-location-theme', location.id);
            this.cache.gameContainer.className = `game-container ${location.bg}`;
            if (location.navTheme && location.navTheme.borderColor) {
                document.documentElement.style.setProperty('--theme-border-color', location.navTheme.borderColor);
                document.documentElement.style.setProperty('--theme-gradient', location.navTheme.gradient);
                document.documentElement.style.setProperty('--theme-text-color', location.navTheme.textColor);

                if (this.cache.newsTickerBar) {
                    this.cache.newsTickerBar.style.backgroundImage = location.navTheme.gradient;
                    this.cache.newsTickerBar.style.borderTopColor = location.navTheme.borderColor;
                    this.cache.newsTickerBar.style.borderBottomColor = location.navTheme.borderColor;
                    this.cache.newsTickerBar.style.backgroundColor = 'transparent';
                }
            } else {
                this._resetTheme();
            }
        } else {
            this._resetTheme();
        }
    }

    _resetTheme() {
        document.documentElement.style.removeProperty('--theme-border-color');
        document.documentElement.style.removeProperty('--theme-gradient');
        document.documentElement.style.removeProperty('--theme-text-color');
        if (this.cache.newsTickerBar) {
            this.cache.newsTickerBar.style.backgroundImage = '';
            this.cache.newsTickerBar.style.borderTopColor = '';
            this.cache.newsTickerBar.style.borderBottomColor = '';
            this.cache.newsTickerBar.style.backgroundColor = '';
        }
    }

    _renderNewsTicker() {
        if (!this.newsTickerService || !this.cache.newsTickerBar) return;
        if (!this.newsTickerService.isDirty) return; 
    
        const singleContentHtml = this.newsTickerService.getTickerContentHtml();
        if (!singleContentHtml) {
            this.cache.newsTickerBar.innerHTML = '';
            this.newsTickerService.isDirty = false;
            return;
        }

        const wrappedContent = `<div class="ticker-block">${singleContentHtml}</div>`;
        this.cache.newsTickerBar.innerHTML = `<div class="news-ticker-content">${wrappedContent}</div>`;
        const contentElement = this.cache.newsTickerBar.querySelector('.news-ticker-content');
        
        if (contentElement) {
            const rect = contentElement.getBoundingClientRect();
            const blockWidth = rect.width;
            contentElement.innerHTML = wrappedContent + wrappedContent;
            const PIXELS_PER_SECOND = 50;
            const duration = Math.max(20, blockWidth / PIXELS_PER_SECOND); 
            contentElement.style.animationDuration = `${duration}s`;
        }
        
        this.newsTickerService.isDirty = false;
    }

    renderNavigation(gameState) {
        const { player, currentLocationId, activeNav, activeScreen, lastActiveScreen, introSequenceActive, tutorials, subNavCollapsed } = gameState;
        const { navLock } = tutorials;
        const location = DB.MARKETS.find(l => l.id === currentLocationId);
        const activeShipStatic = player.activeShipId ? DB.SHIPS[player.activeShipId] : null;
        const activeShipState = player.activeShipId ? player.shipStates[player.activeShipId] : null;
        const inventory = player.activeShipId ? player.inventories[player.activeShipId] : null;
        const theme = location?.navTheme || { gradient: 'linear-gradient(135deg, #4a5568, #2d3748)', textColor: '#f0f0f0' };

        const isMax = player.credits >= Number.MAX_SAFE_INTEGER;
        const creditText = isMax ? '⌬ MAXIMUM CREDITS ⌬' : formatCredits(player.credits);
        const creditClass = isMax ? 'text-glow-gold' : 'credits-text-pulsing';
        
        const containerClass = isMax ? 'context-bar max-credits-active' : 'context-bar';

        const dateText = formatGameDateShort(gameState.day);

        const contextBarHtml = `
            <div class="${containerClass}" style="background: ${theme.gradient}; color: ${theme.textColor};">
                <span class="location-name-text">${location?.name || 'In Transit'}</span>
                <span class="date-text">${dateText}</span>
                <span class="credit-text ${creditClass}">${creditText}</span>
            </div>`;

        const mainTabsHtml = Object.keys(this.navStructure).map(navId => {
            const isActive = navId === activeNav;
            const screenIdToLink = lastActiveScreen[navId] || Object.keys(this.navStructure[navId].screens)[0];
            const isDisabledByTutorial = navLock && navLock.navId !== navId;
            const isDisabled = introSequenceActive || isDisabledByTutorial;
            const activeStyle = isActive ? `background: ${theme.gradient}; color: ${theme.textColor};` : '';
             return `<div class="tab ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}" 
                          style="${activeStyle}" data-action="${ACTION_IDS.SET_SCREEN}" data-nav-id="${navId}" data-screen-id="${screenIdToLink}">${this.navStructure[navId].label}</div>`;
        }).join('');

        let statusPodHtml = '';
        if (activeShipStatic && activeShipState && inventory) {
            const cargoUsed = calculateInventoryUsed(inventory);
            const hullPct = (activeShipState.health / activeShipStatic.maxHealth) * 100;
            const fuelPct = (activeShipState.fuel / activeShipStatic.maxFuel) * 100;
            const cargoPct = (cargoUsed / activeShipStatic.cargoCapacity) * 100;

            statusPodHtml = `
                 <div class="status-pod">
                    <div class="status-bar-group hull-group" data-action="toggle-tooltip">
                        <span class="status-bar-label">H</span>
                        <div class="status-bar"><div class="fill hull-fill" style="width: ${hullPct}%;"></div></div>
                         <div class="status-tooltip">${Math.floor(activeShipState.health)}/${activeShipStatic.maxHealth} Hull</div>
                    </div>
                    <div class="status-bar-group fuel-group" data-action="toggle-tooltip">
                        <span class="status-bar-label">F</span>
                        <div class="status-bar"><div class="fill fuel-fill" style="width: ${fuelPct}%;"></div></div>
                         <div class="status-tooltip">${Math.floor(activeShipState.fuel)}/${activeShipStatic.maxFuel} Fuel</div>
                    </div>
                    <div class="status-bar-group cargo-group" data-action="toggle-tooltip">
                        <span class="status-bar-label">C</span>
                        <div class="status-bar"><div class="fill cargo-fill" style="width: ${cargoPct}%;"></div></div>
                        <div class="status-tooltip">${cargoUsed}/${activeShipStatic.cargoCapacity} Cargo</div>
                    </div>
                </div>`;
        }

        const navWrapperHtml = `<div class="nav-wrapper">${mainTabsHtml}${statusPodHtml}</div>`;

        const subNavsHtml = Object.keys(this.navStructure).map(navId => {
            const screens = this.navStructure[navId].screens;
            const isActive = navId === activeNav;
            const subNavButtons = Object.keys(screens).map(screenId => {
                 const isDisabledByTutorial = navLock && navLock.screenId !== screenId;
                 const isSubNavActive = screenId === activeScreen;
                 const isDisabled = introSequenceActive || isDisabledByTutorial;
                 const activeClass = isSubNavActive ? 'sub-nav-active' : '';
                 const action = ACTION_IDS.SET_SCREEN;
                 let subStyle = '';
                 if (isSubNavActive) {
                    subStyle = `style="background: ${theme.gradient}; color: ${theme.textColor}; opacity: 1; font-weight: 700;"`;
                 }
                 return `<a href="#" class="${isDisabled ? 'disabled' : ''} ${activeClass}" ${subStyle} data-action="${action}" data-nav-id="${navId}" data-screen-id="${screenId}" draggable="false">${screens[screenId]}</a>`;
            }).join('');
            return `<div class="nav-sub ${(!isActive || subNavCollapsed) ? 'hidden' : ''}" id="${navId}-sub">${subNavButtons}</div>`;
        }).join('');

        this.cache.navBar.innerHTML = contextBarHtml + navWrapperHtml;
        this.cache.subNavBar.innerHTML = subNavsHtml;
    }

    renderActiveScreen(gameState, previousState) {
        const activeScreenEl = this.cache[`${gameState.activeScreen}Screen`];
        if (this.lastActiveScreenEl && this.lastActiveScreenEl !== activeScreenEl) {
            this.lastActiveScreenEl.classList.remove('active-screen');
        }
        if (activeScreenEl) {
            activeScreenEl.classList.add('active-screen');
            this.lastActiveScreenEl = activeScreenEl;
        }

        switch (gameState.activeScreen) {
            case SCREEN_IDS.MAP:
                this.cache.mapScreen.innerHTML = renderMapScreen();
                requestAnimationFrame(() => initMap(this));
                break;
            case SCREEN_IDS.NAVIGATION:
                this.cache.navigationScreen.innerHTML = renderNavigationScreen(gameState);
                break;
            case SCREEN_IDS.SERVICES:
                this.cache.servicesScreen.innerHTML = renderServicesScreen(gameState, this.simulationService);
                if (this.eventManager) this.eventManager.holdEventHandler.bindHoldEvents();
                break;
            case SCREEN_IDS.MARKET:
                // Delegate: Market Control
                this.marketControl.updateMarketScreen(gameState);
                break;
            case SCREEN_IDS.CARGO:
                this.cache.cargoScreen.innerHTML = renderCargoScreen(gameState);
                break;
            case SCREEN_IDS.HANGAR:
                // Expanded Full Render condition for Boarding/Buy/Sell
                // Added check for tutorial step change to trigger refresh for button unlock
                const needsFullRender = !previousState || 
                    previousState.activeScreen !== SCREEN_IDS.HANGAR || 
                    previousState.uiState.hangarShipyardToggleState !== gameState.uiState.hangarShipyardToggleState ||
                    previousState.player.activeShipId !== gameState.player.activeShipId || 
                    previousState.player.ownedShipIds.length !== gameState.player.ownedShipIds.length ||
                    previousState.tutorials.activeStepId !== gameState.tutorials.activeStepId;

                if (needsFullRender) {
                    this.cache.hangarScreen.innerHTML = renderHangarScreen(gameState, this.simulationService);
                }
                // Delegate: Hangar Control (Updates)
                this.hangarControl.updateHangarScreen(gameState);
                break;
            case SCREEN_IDS.MISSIONS:
                this.cache.missionsScreen.innerHTML = renderMissionsScreen(gameState, this.missionService);
                break;
            case SCREEN_IDS.FINANCE:
                this.cache.financeScreen.innerHTML = renderFinanceScreen(gameState);
                break;
            case SCREEN_IDS.INTEL:
                if (!previousState || previousState.activeScreen !== SCREEN_IDS.INTEL) {
                     this.cache.intelScreen.innerHTML = renderIntelScreen();
                }
                // Delegate: Event Control (Lore Buttons)
                this.eventControl._renderCodexButtons(this.cache.intelScreen);

                if (this.intelMarketRenderer) {
                    const marketContentEl = this.cache.intelScreen.querySelector('#intel-market-content');
                    if (marketContentEl) this.intelMarketRenderer.render(marketContentEl, gameState);
                }
                // Delegate: Mission Control (Tabs)
                this.missionControl.updateIntelTab(gameState.uiState.activeIntelTab);
                break;
        }
    }

    updateServicesScreen(gameState) {
        if (gameState.activeScreen !== SCREEN_IDS.SERVICES) return;
        const { player } = gameState;
        const shipStatic = DB.SHIPS[player.activeShipId];
        const shipState = player.shipStates[player.activeShipId];

        const fuelBar = this.cache.servicesScreen.querySelector('#fuel-bar');
        const refuelBtn = this.cache.servicesScreen.querySelector('#refuel-btn');
        if (fuelBar && refuelBtn) {
             const fuelPct = (shipState.fuel / shipStatic.maxFuel) * 100;
            fuelBar.style.width = `${fuelPct}%`;
            refuelBtn.disabled = shipState.fuel >= shipStatic.maxFuel;
        }

        const repairBar = this.cache.servicesScreen.querySelector('#repair-bar');
        const repairBtn = this.cache.servicesScreen.querySelector('#repair-btn');
        if (repairBar && repairBtn) {
            const healthPct = (shipState.health / shipStatic.maxHealth) * 100;
            repairBar.style.width = `${healthPct}%`;
            repairBtn.disabled = shipState.health >= shipStatic.maxHealth;
        }
    }

    // =========================================================================
    // SWITCHBOARD PROXIES (Delegation to Controllers)
    // =========================================================================

    // --- Modal Engine ---
    queueModal(...args) { this.modalEngine.queueModal(...args); }
    hideModal(...args) { this.modalEngine.hideModal(...args); }
    processModalQueue(...args) { this.modalEngine.processModalQueue(...args); }
    getModalIdFromEvent(...args) { return this.modalEngine.getModalIdFromEvent(...args); }
    isClickInside(...args) { return this.modalEngine.isClickInside(...args); }
    showProcessingAnimation(...args) { this.modalEngine.showProcessingAnimation(...args); }

    // --- Tutorial Manager ---
    showTutorialToast(...args) { this.tutorialManager.showTutorialToast(...args); }
    hideTutorialToast(...args) { this.tutorialManager.hideTutorialToast(...args); }
    updateTutorialPopper(...args) { this.tutorialManager.updateTutorialPopper(...args); }
    applyTutorialHighlight(...args) { this.tutorialManager.applyTutorialHighlight(...args); }
    showSkipTutorialModal(...args) { this.tutorialManager.showSkipTutorialModal(...args); }
    showTutorialLogModal(...args) { this.tutorialManager.showTutorialLogModal(...args); }

    // --- Market Control ---
    updateMarketScreen(...args) { this.marketControl.updateMarketScreen(...args); }
    updateMarketCardPrice(...args) { this.marketControl.updateMarketCardPrice(...args); }
    updateMarketCardDisplay(...args) { this.marketControl.updateMarketCardDisplay(...args); }
    resetMarketTransactionState(...args) { this.marketControl.resetMarketTransactionState(...args); }
    _calculateSaleDetails(...args) { return this.marketControl._calculateSaleDetails(...args); }

    // --- Mission Control ---
    renderStickyBar(...args) { this.missionControl.renderStickyBar(...args); }
    flashObjectiveProgress(...args) { this.missionControl.flashObjectiveProgress(...args); }
    showMissionModal(...args) { this.missionControl.showMissionModal(...args); }
    handleSetIntelTab(...args) { this.missionControl.handleSetIntelTab(...args); }
    updateIntelTab(...args) { this.missionControl.updateIntelTab(...args); }
    handleShowIntelOffer(...args) { this.missionControl.handleShowIntelOffer(...args); }
    handleBuyIntel(...args) { this.missionControl.handleBuyIntel(...args); }
    handleShowIntelDetails(...args) { this.missionControl.handleShowIntelDetails(...args); }

    // --- Hangar Control ---
    updateHangarScreen(...args) { this.hangarControl.updateHangarScreen(...args); }
    showShipDetailModal(...args) { this.hangarControl.showShipDetailModal(...args); }
    showUpgradeInstallationModal(...args) { this.hangarControl.showUpgradeInstallationModal(...args); }
    runShipTransactionAnimation(...args) { this.hangarControl.runShipTransactionAnimation(...args); }

    // --- Event Control ---
    showRandomEventModal(...args) { this.eventControl.showRandomEventModal(...args); }
    showAgeEventModal(...args) { this.eventControl.showAgeEventModal(...args); }
    showLoreModal(...args) { this.eventControl.showLoreModal(...args); }
    showEulaModal(...args) { this.eventControl.showEulaModal(...args); }
    showLaunchModal(...args) { this.eventControl.showLaunchModal(...args); }
    showMapDetailModal(...args) { this.eventControl.showMapDetailModal(...args); }
    hideMapDetailModal(...args) { this.eventControl.hideMapDetailModal(...args); }
    showCargoDetailModal(...args) { this.eventControl.showCargoDetailModal(...args); }
    createFloatingText(...args) { this.eventControl.createFloatingText(...args); }
    showEventResultModal(...args) { this.eventControl.showEventResultModal(...args); }

    // --- Sol Station Control (NEW) ---
    showSolStationDashboard(...args) { this.solStationControl.showDashboard(...args); }
    showOfficerRoster(...args) { this.solStationControl.showOfficerRoster(...args); }

    // =========================================================================
    // GENERAL UI UTILITIES (Generic Tooltips & Effects)
    // =========================================================================

    triggerEffect(name, options) {
        this.effectsManager.trigger(name, options);
    }

    showTravelAnimation(from, to, travelInfo, totalHullDamagePercent, finalCallback) {
        this.travelAnimationService.play(from, to, travelInfo, totalHullDamagePercent, finalCallback);
    }
    
    showGameContainer() {
        this.cache.gameContainer.classList.remove('hidden');
        this._setAppHeight();
        requestAnimationFrame(() => this._setAppHeight());
    }
    
    getTooltipContent(e) {
        const tooltipTarget = e.target.closest('[data-tooltip]');
        if (tooltipTarget) return tooltipTarget.dataset.tooltip;
        return null;
    }

    // --- Generic Graph Tooltip Logic ---
    showGraph(anchorEl, gameState) {
        this.activeGraphAnchor = anchorEl;
        const tooltip = this.cache.graphTooltip;
        const action = anchorEl.dataset.action;

        if (action === ACTION_IDS.SHOW_PRICE_GRAPH) {
            const goodId = anchorEl.dataset.goodId;
            const playerItem = gameState.player.inventories[gameState.player.activeShipId][goodId];
            // Delegate SVG generation to MarketControl
            tooltip.innerHTML = this.marketControl.renderPriceGraph(goodId, gameState, playerItem);
        } else if (action === ACTION_IDS.SHOW_FINANCE_GRAPH) {
            tooltip.innerHTML = this.marketControl.renderFinanceGraph(gameState);
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
        const rect = this.activeGraphAnchor.closest('.item-card-container').getBoundingClientRect();
        const tooltipHeight = tooltip.offsetHeight;

        let topPos = rect.top - tooltipHeight - 10;
        let leftPos = rect.left;

        if (topPos < 10) {
            topPos = rect.bottom + 10;
        }

        tooltip.style.left = `${leftPos}px`;
        tooltip.style.top = `${topPos}px`;
    }

    // --- Generic Info Tooltip Logic ---
    showGenericTooltip(anchorEl, content, preferredPosition = 'right') {
        this.activeGenericTooltipAnchor = anchorEl;
        this.activeGenericTooltipPosition = preferredPosition;
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
        
        let leftPos, topPos;

        if (this.activeGenericTooltipPosition === 'top') {
            leftPos = rect.left + (rect.width / 2) - (tooltipWidth / 2);
            topPos = rect.top - tooltipHeight - 10;
            if (topPos < 10) topPos = rect.bottom + 10;
        } else {
            leftPos = rect.right + 10;
            topPos = rect.top + (rect.height / 2) - (tooltipHeight / 2);
            if (topPos < 10) topPos = rect.bottom + 10;
        }

        if (leftPos < 10) leftPos = 10;
        if (leftPos + tooltipWidth > window.innerWidth - 10) {
            leftPos = window.innerWidth - tooltipWidth - 10;
        }

        tooltip.style.left = `${leftPos}px`;
        tooltip.style.top = `${topPos}px`;
    }

    // =========================================================================
    // LEGACY / SAFEGUARD METHODS
    // =========================================================================

    showShipTransactionConfirmation(shipId, transactionType, onConfirm) {
        const ship = DB.SHIPS[shipId];
        if (!ship) return;

        const colorVar = `var(--class-${ship.class.toLowerCase()}-color)`;
        let shadowClass = '';
        if (ship.class === 'Z') shadowClass = 'glow-text-z';
        else if (ship.class === 'O') shadowClass = 'glow-text-o';
        else if (ship.class === 'S') shadowClass = 'glow-text-s';
        
        const shipNameSpan = `<span class="${shadowClass}" style="color: ${colorVar}; font-weight: bold;">${ship.name}</span>`;

        let title, description, price, amountStr;
        if (transactionType === 'buy') {
            title = "Confirm Purchase";
            price = ship.price;
            amountStr = formatCredits(price, true);
            description = `Are you sure you want to purchase the ${shipNameSpan}?`;
            description += `<br><br>Cost: <span class="credits-text-pulsing">${amountStr}</span>`;
        } else {
            title = "Confirm Sale";
            const shipState = this.lastKnownState.player.shipStates[shipId];
            let upgradeValue = 0;
            if (shipState && shipState.upgrades) {
                shipState.upgrades.forEach(uId => {
                    const def = GameAttributes.getDefinition(uId);
                    if (def) upgradeValue += def.value;
                });
            }
            price = Math.floor((ship.price + upgradeValue) * GAME_RULES.SHIP_SELL_MODIFIER);
            amountStr = formatCredits(price, true);
            description = `Are you sure you want to sell the ${shipNameSpan}?`;
            description += `<br><br>Income: <span class="credits-text-pulsing">+${amountStr}</span>`;
        }

        this.queueModal('event-modal', title, description, null, {
            dismissOutside: true,
            customSetup: (modal, closeHandler) => {
                const btnContainer = modal.querySelector('#event-button-container');
                btnContainer.innerHTML = `
                    <button id="confirm-transaction-btn" class="btn btn-pulse-green">Confirm</button>
                    <button id="cancel-transaction-btn" class="btn">Cancel</button>
                 `;
                
                const confirmBtn = modal.querySelector('#confirm-transaction-btn');
                const cancelBtn = modal.querySelector('#cancel-transaction-btn');
                
                confirmBtn.onclick = () => {
                    closeHandler();
                    setTimeout(onConfirm, 50); 
                };
                
                cancelBtn.onclick = closeHandler;
            }
        });
    }
}