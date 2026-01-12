// js/services/UIManager.js
import { DB } from '../data/database.js';
import { formatCredits, calculateInventoryUsed, getDateFromDay, renderIndicatorPills, getCommodityStyle } from '../utils.js';
import { SCREEN_IDS, NAV_IDS, ACTION_IDS, GAME_RULES, PERK_IDS, LOCATION_IDS, SHIP_IDS, COMMODITY_IDS } from '../data/constants.js';
import { EffectsManager } from '../effects/EffectsManager.js';

// Import all screen rendering components
import { renderHangarScreen } from '../ui/components/HangarScreen.js';
import { renderMarketScreen } from '../ui/components/MarketScreen.js';
import { renderMapScreen, initMap } from '../ui/components/MapScreen.js';
import { renderNavigationScreen } from '../ui/components/NavigationScreen.js';
import { renderServicesScreen } from '../ui/components/ServicesScreen.js';
import { renderCargoScreen, _renderMaxCargoModal } from '../ui/components/CargoScreen.js';
import { renderMissionsScreen } from '../ui/components/MissionsScreen.js';
import { renderFinanceScreen } from '../ui/components/FinanceScreen.js';
import { renderIntelScreen } from '../ui/components/IntelScreen.js';
import { TravelAnimationService } from './ui/TravelAnimationService.js';

// --- [[START]] PHASE 2 IMPORT ---
import { AssetService } from './AssetService.js';
// --- [[END]] PHASE 2 IMPORT ---

// --- VIRTUAL WORKBENCH: IMPORTS ---
import { IntelMarketRenderer } from '../ui/renderers/IntelMarketRenderer.js';
import { INTEL_CONTENT } from '../data/intelContent.js';
import { EULA_CONTENT } from '../data/eulaContent.js'; 
import { playBlockingAnimation } from './ui/AnimationService.js';
import { GameAttributes } from './GameAttributes.js'; // Added for Phase 3/4/5
// --- END VIRTUAL WORKBENCH ---

/**
 * Stores the lore text content in a structured format for dynamic rendering.
 * @private
 */
const LORE_CONTENT = {
    story_so_far: {
        title: "Story So Far...",
        content: `
            <p>The year 2140 is the result of a single, massive corporate takeover. A century ago, the "Ad Astra Initiative" released advanced technology to all of humanity, a gift from the new Human-AI Alliance on Earth designed to kickstart our expansion into the stars. It was a promise of a new beginning, an open-source key to the solar system, ensuring the survival of all Earth life, both organic and synthetic.</p>
        
            <p>But a gift to everyone is a business opportunity for the few. The hyper-corporations, already positioned in space, immediately patented the most efficient manufacturing processes and proprietary components for this new technology. This maneuver ensured that while anyone could build a Folded-Space Drive, only the corporations could supply the high-performance parts needed to make it truly effective, creating a system-wide technological dependency that persists to this day. This technological monopoly created the "Drive-Divide," the central pillar of the new class system. Nearly all ships run on older, less efficient hardware. Very few ships employ these coveted Folded-Space Drives.</p>
            <p>The major hubs beyond Earth are sovereign, corporate-run territories where law is policy and your rights are listed in an employment contract. These scattered colonies are fierce rivals, engaged in constant economic warfare, all propped up by the interstellar supply lines maintained by the Merchant's Guild. For them, you are just another cog in the great machine of commerce.</p>
            <p>In a system owned by corporations, possessing your own ship is the only true form of freedom. Every credit earned, every successful trade, is a bet on your own skill and a step toward true sovereignty on the razor's edge of a cargo manifest.</p>
        `
    }
};

export class UIManager {
    /**
     * @param {import('./LoggingService.js').Logger} logger The logging utility.
     */
    constructor(logger) {
         this.logger = logger;
        this.isMobile = window.innerWidth <= 768;
        this.modalQueue = [];
        this.activeGraphAnchor = null;
        this.activeGenericTooltipAnchor = null;
        this.lastActiveScreenEl = null;
        this.lastKnownState = null;
        this.missionService = null; 
        this.simulationService = null; 
        this.newsTickerService = null; 
        this.debugService = null; 
        this.marketTransactionState = {}; 
        this.activeHighlightConfig = null; 
        this.marketScrollPosition = 0;
        this.popperInstance = null; 
        // MODIFIED: Added property to hold injected EventManager
        this.eventManager = null; 

        // --- VIRTUAL WORKBENCH: TOOLTIP POSITIONING STATE ---
        this.activeGenericTooltipPosition = 'right';
        // --- END VIRTUAL WORKBENCH ---

        // --- VIRTUAL WORKBENCH: ADD INTEL SERVICE/RENDERER ---
        /** @type {import('./IntelService.js').IntelService | null} */
        this.intelService = null; 
        /** @type {IntelMarketRenderer | null} */
        this.intelMarketRenderer = null;
        // --- END VIRTUAL WORKBENCH ---

        this.effectsManager = new EffectsManager();

        this.travelAnimationService = new TravelAnimationService(this.isMobile);

        this.navStructure = {
            [NAV_IDS.SHIP]: { label: 'Ship', screens: { [SCREEN_IDS.MAP]: 'Map', [SCREEN_IDS.NAVIGATION]: 'Navigation', [SCREEN_IDS.CARGO]: 'Cargo' } },
            [NAV_IDS.STARPORT]: { label: 'Starport', screens: { [SCREEN_IDS.MARKET]: 'Market', [SCREEN_IDS.SERVICES]: 'Services', [SCREEN_IDS.HANGAR]: 'Shipyard' } },
            [NAV_IDS.DATA]: { label: 'Data', screens: { [SCREEN_IDS.MISSIONS]: 'Missions', [SCREEN_IDS.FINANCE]: 'Finance', [SCREEN_IDS.INTEL]: 'Intel' } }
         };
        this._cacheDOM();

        // --- VIRTUAL WORKBENCH: BIND 'this' CONTEXT ---
        this.getItemPrice = this.getItemPrice.bind(this);
        // --- END VIRTUAL WORKBENCH ---

        window.addEventListener('resize', this._setAppHeight);
    }

    /**
     * Sets the --app-height CSS variable to the actual window inner height.
     * This is the definitive fix for the mobile viewport height bug on iOS.
     * @private
     */
    _setAppHeight() {
        document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    }

    /**
     * @JSDoc
     * @method triggerEffect
     * @description Public method to trigger a registered visual effect.
     * @param {string} name - The name the effect was registered under.
     * @param {object} options - The configuration options for the effect.
     */
    triggerEffect(name, options) {
        this.effectsManager.trigger(name, options);
    }

    /**
     * Injects the MissionService after instantiation to avoid circular dependencies.
     * @param {import('./MissionService.js').MissionService} missionService
     */
    setMissionService(missionService) {
         this.missionService = missionService;
    }

    /**
     * Injects the SimulationService after instantiation.
     * @param {import('./SimulationService.js').SimulationService} simulationService
     */
    setSimulationService(simulationService) {
        this.simulationService = simulationService;
    }

    /**
     * Injects the NewsTickerService after instantiation.
     * @param {import('./NewsTickerService.js').NewsTickerService} newsTickerService
     */
    setNewsTickerService(newsTickerService) {
        this.newsTickerService = newsTickerService;
    }

    /**
     * Injects the DebugService after instantiation.
     * @param {import('./DebugService.js').DebugService} service
     */
    setDebugService(service) {
        this.debugService = service;
    }

    // --- VIRTUAL WORKBENCH: ADD INTELSERVICE SETTER ---
    /**
     * Injects the IntelService and instantiates the IntelMarketRenderer.
     * @param {import('./IntelService.js').IntelService} intelService
     * @JSDoc
     */
    setIntelService(intelService) {
        this.intelService = intelService;
        this.intelMarketRenderer = new IntelMarketRenderer(intelService);
    }
    // --- END VIRTUAL WORKBENCH ---

    /**
     * MODIFIED: Injects the EventManager after instantiation.
     * @param {import('./EventManager.js').EventManager} eventManager
     */
     setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    /**
    * Resets the state of the market transaction modules.
    */
    resetMarketTransactionState() {
        this.marketTransactionState = {};
    }

    _cacheDOM() {
        this.cache = {
            gameContainer: document.getElementById('game-container'),
            navBar: document.getElementById('nav-bar'),
            newsTickerBar: document.getElementById('news-ticker-bar'), 
            topBarContainer: document.getElementById('top-bar-container'),
            subNavBar: document.getElementById('sub-nav-bar'),
            stickyBar: document.getElementById('sticky-bar'),
            mapScreen: document.getElementById(`${SCREEN_IDS.MAP}-screen`),
            navigationScreen: document.getElementById(`${SCREEN_IDS.NAVIGATION}-screen`),
            servicesScreen: document.getElementById(`${SCREEN_IDS.SERVICES}-screen`),
            marketScreen: document.getElementById(`${SCREEN_IDS.MARKET}-screen`),
            cargoScreen: document.getElementById(`${SCREEN_IDS.CARGO}-screen`),
            hangarScreen: document.getElementById(`${SCREEN_IDS.HANGAR}-screen`),
            missionsScreen: document.getElementById(`${SCREEN_IDS.MISSIONS}-screen`),
            financeScreen: document.getElementById(`${SCREEN_IDS.FINANCE}-screen`),
            intelScreen: document.getElementById(`${SCREEN_IDS.INTEL}-screen`),
            graphTooltip: document.getElementById('graph-tooltip'),
            genericTooltip: document.getElementById('generic-tooltip'),
            processingModal: document.getElementById('processing-modal'),
            shipDetailModal: document.getElementById('ship-detail-modal'),
            launchModal: document.getElementById('launch-modal'),
             launchModalContent: document.getElementById('launch-modal-content'),
            cargoDetailModal: document.getElementById('cargo-detail-modal'),
            cargoDetailContent: document.getElementById('cargo-detail-content'),

            mapDetailModal: document.getElementById('map-detail-modal'),
            
            // Lore Modal
            loreModal: document.getElementById('lore-modal'),
            loreModalContent: document.getElementById('lore-modal-content'),

            // Cache EULA Modal
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

            missionStickyBar: document.getElementById('mission-sticky-bar'),
            stickyObjectiveText: document.getElementById('sticky-objective-text'),
            stickyObjectiveProgress: document.getElementById('sticky-objective-progress')
        };
    }

    render(gameState) {
        if (!gameState || !gameState.player) return;

        const previousState = this.lastKnownState;
        this.lastKnownState = gameState;

        if (gameState.introSequenceActive && !gameState.tutorials.activeBatchId) {
            return;
        }

        const location = DB.MARKETS.find(l => l.id === gameState.currentLocationId);
        if (location) {
            this.cache.topBarContainer.setAttribute('data-location-theme', location.id);
            this.cache.gameContainer.className = `game-container ${location.bg}`;
            if (location.navTheme && location.navTheme.borderColor) {
                document.documentElement.style.setProperty('--theme-border-color', location.navTheme.borderColor);
                // --- VIRTUAL WORKBENCH: THEME VARIABLES ---
                // Set all theme variables for CSS to use
                document.documentElement.style.setProperty('--theme-gradient', location.navTheme.gradient);
                document.documentElement.style.setProperty('--theme-text-color', location.navTheme.textColor);
                // --- END VIRTUAL WORKBENCH ---

                // --- [[START]] MODIFICATION ---
                // Apply theme to the news ticker bar
                if (this.cache.newsTickerBar) {
                    this.cache.newsTickerBar.style.backgroundImage = location.navTheme.gradient;
                    this.cache.newsTickerBar.style.borderTopColor = location.navTheme.borderColor;
                    this.cache.newsTickerBar.style.borderBottomColor = location.navTheme.borderColor;
                    // Also remove the default background color to let the gradient show
                    this.cache.newsTickerBar.style.backgroundColor = 'transparent';
                }
                // --- [[END]] MODIFICATION ---

            } else {
                 document.documentElement.style.removeProperty('--theme-border-color');
                // --- VIRTUAL WORKBENCH: THEME VARIABLES ---
                // Clear theme variables
                document.documentElement.style.removeProperty('--theme-gradient');
                document.documentElement.style.removeProperty('--theme-text-color');
                // --- END VIRTUAL WORKBENCH ---

                // --- [[START]] MODIFICATION (Reset) ---
                // Reset theme on the news ticker bar if no theme exists
                if (this.cache.newsTickerBar) {
                    this.cache.newsTickerBar.style.backgroundImage = '';
                    this.cache.newsTickerBar.style.borderTopColor = ''; // Will revert to CSS default
                    this.cache.newsTickerBar.style.borderBottomColor = ''; // Will revert to CSS default
                    this.cache.newsTickerBar.style.backgroundColor = ''; // Will revert to CSS default
                 }
                // --- [[END]] MODIFICATION (Reset) ---

            }
        } else {
            // --- [[START]] MODIFICATION (Reset) ---
            // Handle case where there is no location (e.g., in transit)
            if (this.cache.newsTickerBar) {
                this.cache.newsTickerBar.style.backgroundImage = '';
                this.cache.newsTickerBar.style.borderTopColor = '';
                this.cache.newsTickerBar.style.borderBottomColor = '';
                this.cache.newsTickerBar.style.backgroundColor = '';
            }
            // --- [[END]] MODIFICATION (Reset) ---
        }

        this._renderNewsTicker(); 
        this.renderNavigation(gameState);
        this.renderActiveScreen(gameState, previousState);
        this.updateStickyBar(gameState);
        this.renderStickyBar(gameState);
    }

    /**
     * Renders the content of the news ticker bar.
     * Includes "dirty" check for performance and dynamic animation speed.
     * @private
     */
    _renderNewsTicker() {
        if (!this.newsTickerService || !this.cache.newsTickerBar) return;
    
        // Only re-render if content has changed
        if (!this.newsTickerService.isDirty) return; 
    
        // 1. Get the content DIV string from the service
        const tickerHtml = this.newsTickerService.getTickerContentHtml();
        if (!tickerHtml) {
            this.cache.newsTickerBar.innerHTML = '';
            this.newsTickerService.isDirty = false;
            return;
        }

        // 2. Set it to measure the *single* width
        this.cache.newsTickerBar.innerHTML = tickerHtml;
        const contentElement = this.cache.newsTickerBar.querySelector('.news-ticker-content');
        
        if (contentElement) {
             const innerHtml = contentElement.innerHTML;
            
            // 3. Measure the width of the single block of content
            // We do this *before* duplicating
            const singleContentWidth = contentElement.scrollWidth;

            // 4. **Duplicate the inner HTML** for the seamless loop
            contentElement.innerHTML = innerHtml + innerHtml;
            
            // 5. Calculate duration based on the *single* width
            const PIXELS_PER_SECOND = 50;
            // The distance to scroll is one "block" of content
            const totalScrollDistance = singleContentWidth;
            
            // Set a minimum duration to prevent extremely fast scrolls on short text
            const duration = Math.max(20, totalScrollDistance / PIXELS_PER_SECOND); 
            
            contentElement.style.animationDuration = `${duration}s`;
        }
        
        this.newsTickerService.isDirty = false; // Reset flag
    }

    renderNavigation(gameState) {
        const { player, currentLocationId, activeNav, activeScreen, lastActiveScreen, introSequenceActive, tutorials, subNavCollapsed } = gameState;
        const { navLock } = tutorials;
        const location = DB.MARKETS.find(l => l.id === currentLocationId);
        const activeShipStatic = player.activeShipId ? DB.SHIPS[player.activeShipId] : null;
        const activeShipState = player.activeShipId ? player.shipStates[player.activeShipId] : null;
        const inventory = player.activeShipId ? player.inventories[player.activeShipId] : null;
        const theme = location?.navTheme || { gradient: 'linear-gradient(135deg, #4a5568, #2d3748)', textColor: '#f0f0f0' };

        // --- VIRTUAL WORKBENCH: APPLY MAX CREDITS DISPLAY ---
        const isMax = player.credits >= Number.MAX_SAFE_INTEGER;
        const creditText = isMax ? '⌬ MAXIMUM CREDITS ⌬' : formatCredits(player.credits);
        const creditClass = isMax ? 'text-glow-gold' : 'credits-text-pulsing';

        const contextBarHtml = `
            <div class="context-bar" style="background: ${theme.gradient}; color: ${theme.textColor};">
                <span class="location-name-text">${location?.name || 'In Transit'}</span>
                <span class="credit-text ${creditClass}">${creditText}</span>
            </div>`;
        // --- END VIRTUAL WORKBENCH ---

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
                this.cache.servicesScreen.innerHTML = renderServicesScreen(gameState);
                if (this.eventManager) {
                     this.eventManager.holdEventHandler.bindHoldEvents();
                }
                break;
            case SCREEN_IDS.MARKET:
                this.updateMarketScreen(gameState);
                break;
            case SCREEN_IDS.CARGO:
                this.cache.cargoScreen.innerHTML = renderCargoScreen(gameState);
                break;
            case SCREEN_IDS.HANGAR: {
                const needsFullRender = !previousState ||
                    previousState.activeScreen !== SCREEN_IDS.HANGAR ||
                    previousState.uiState.hangarShipyardToggleState !== gameState.uiState.hangarShipyardToggleState ||
                    previousState.player.activeShipId !== gameState.player.activeShipId ||
                    previousState.uiState.lastTransactionTimestamp !== gameState.uiState.lastTransactionTimestamp ||
                    (previousState && previousState.tutorials.activeBatchId !== gameState.tutorials.activeBatchId) ||
                    (previousState && previousState.tutorials.activeStepId !== gameState.tutorials.activeStepId);

                if (needsFullRender) {
                    this.cache.hangarScreen.innerHTML = renderHangarScreen(gameState, this.simulationService);
                }
                
                this._updateHangarScreen(gameState);
                break;
            }
            case SCREEN_IDS.MISSIONS:
                this.cache.missionsScreen.innerHTML = renderMissionsScreen(gameState, this.missionService);
                break;
            case SCREEN_IDS.FINANCE:
                 this.cache.financeScreen.innerHTML = renderFinanceScreen(gameState);
                break;
            case SCREEN_IDS.INTEL:
                const needsFullRender = !previousState || previousState.activeScreen !== SCREEN_IDS.INTEL;
                
                if (needsFullRender) {
                     this.cache.intelScreen.innerHTML = renderIntelScreen();
                }
                
                // --- VIRTUAL WORKBENCH: DYNAMIC CODEX POPULATION ---
                this._renderCodexButtons(this.cache.intelScreen);
                // --- END VIRTUAL WORKBENCH ---

                if (this.intelMarketRenderer) {
                    const marketContentEl = this.cache.intelScreen.querySelector('#intel-market-content');
                    if (marketContentEl) {
                        this.intelMarketRenderer.render(marketContentEl, gameState);
                    }
                }
                
                this.updateIntelTab(gameState.uiState.activeIntelTab);
                break;
        }
    }

    // --- VIRTUAL WORKBENCH: NEW HELPER METHOD ---
    /**
     * Dynamically populates the lore menu buttons from LORE_CONTENT.
     * @param {HTMLElement} screenContainer 
     * @private
     */
    _renderCodexButtons(screenContainer) {
        const loreContainer = screenContainer.querySelector('#lore-button-container');
        if (!loreContainer) return;
        
        loreContainer.innerHTML = Object.entries(LORE_CONTENT).map(([id, data]) => {
            return `<button class="btn btn-header" data-action="show_lore" data-lore-id="${id}">
                        ${data.title}
                    </button>`;
        }).join('');
    }
    // --- END VIRTUAL WORKBENCH ---

    _updateHangarScreen(gameState) {
        const { uiState, player } = gameState; // Added player for visualSeed
        const hangarScreenEl = this.cache.hangarScreen;
        if (!hangarScreenEl) return;

        const carousel = hangarScreenEl.querySelector('#hangar-carousel');
        if (!carousel) return;

        const isHangarMode = uiState.hangarShipyardToggleState === 'hangar';
        const activeIndex = isHangarMode ? (uiState.hangarActiveIndex || 0) : (uiState.shipyardActiveIndex || 0);

        carousel.style.transform = `translateX(-${activeIndex * 100}%)`;

        const SAFE_DISTANCE = 2;
        const pages = carousel.querySelectorAll('.carousel-page');

        pages.forEach((page, index) => {
            const distance = Math.abs(activeIndex - index);
            const img = page.querySelector('img');
            const placeholder = page.querySelector('span'); // The text placeholder

            if (!img) return;

            if (distance > SAFE_DISTANCE) {
                if (img.hasAttribute('src')) {
                    img.removeAttribute('src');
                    img.style.opacity = '0';
                    img.removeAttribute('data-tried-fallback'); 
                    if (placeholder) placeholder.style.display = 'flex';
                }
            } else {
                const shipId = page.dataset.shipId;
                if (shipId) {
                    const newSrc = AssetService.getShipImage(shipId, player.visualSeed);
                    if (!img.hasAttribute('src') || !img.src.includes(newSrc)) {
                        img.src = newSrc;
                        img.onload = () => { img.style.opacity = '1'; };
                        if (placeholder) placeholder.style.display = 'none';
                    }
                }
            }
        });

        this._renderHangarPagination(gameState);
        const paginationWrapper = hangarScreenEl.querySelector('#hangar-pagination-wrapper');
        const activeDot = hangarScreenEl.querySelector('.pagination-dot.active');

        if (paginationWrapper && activeDot) {
            const wrapperWidth = paginationWrapper.clientWidth;
            const dotOffsetLeft = activeDot.offsetLeft;
            const dotWidth = activeDot.offsetWidth;

            const scrollLeft = dotOffsetLeft - (wrapperWidth / 2) + (dotWidth / 2);

            paginationWrapper.scrollTo({
                left: scrollLeft,
                behavior: 'smooth'
            });
        }
    }

    _renderHangarPagination(gameState) {
        const { uiState, player, currentLocationId } = gameState;
        const hangarScreenEl = this.cache.hangarScreen;
        if (!hangarScreenEl) return;

        const paginationContainer = hangarScreenEl.querySelector('#hangar-pagination');
        if (!paginationContainer) return;

        const isHangarMode = uiState.hangarShipyardToggleState === 'hangar';
        const shipList = isHangarMode ? player.ownedShipIds : this.simulationService._getShipyardInventory().map(([id]) => id);
        const totalItems = shipList.length;

        if (totalItems <= 1) {
             paginationContainer.innerHTML = '';
            return;
        }

        const activeIndex = isHangarMode ? (uiState.hangarActiveIndex || 0) : (uiState.shipyardActiveIndex || 0);

        let boardedIndex = -1;
        if (isHangarMode) {
            boardedIndex = player.ownedShipIds.indexOf(player.activeShipId);
        }

        const location = DB.MARKETS.find(l => l.id === currentLocationId);
        const theme = location?.navTheme || { borderColor: '#7a9ac0' };

        const VISIBLE_FULL_DOTS = 6;
        let dots = [];

        if (totalItems <= VISIBLE_FULL_DOTS + 1) { 
            for (let i = 0; i < totalItems; i++) {
                 dots.push({ 
                    index: i, 
                    isActive: i === activeIndex, 
                    isHalf: false,
                    isBoarded: i === boardedIndex 
                });
            }
        } else {
            let start, end;
            const isNearStart = activeIndex < VISIBLE_FULL_DOTS - 1;
            const isNearEnd = activeIndex > totalItems - VISIBLE_FULL_DOTS;

            if (isNearStart) {
                start = 0;
                end = VISIBLE_FULL_DOTS;
            } else if (isNearEnd) {
                 start = totalItems - VISIBLE_FULL_DOTS;
                end = totalItems;
            } else {
                start = activeIndex - Math.floor(VISIBLE_FULL_DOTS / 2) + 1;
                end = activeIndex + Math.ceil(VISIBLE_FULL_DOTS / 2);
            }

            if (start > 0) {
                dots.push({ isHalf: true, jump: 'prev' });
            }

            for (let i = start; i < end; i++) {
                dots.push({ 
                    index: i, 
                    isActive: i === activeIndex, 
                    isHalf: false,
                    isBoarded: i === boardedIndex 
                });
            }

            if (end < totalItems) {
                dots.push({ isHalf: true, jump: 'next' });
            }
        }

        const dotsHtml = dots.map(dot => {
             const style = `
                --theme-color-primary: ${theme.borderColor};
                --theme-glow-color: ${theme.borderColor};
            `;
            if (dot.isHalf) {
                 return `<div class="pagination-dot half" style="${style}" data-action="${ACTION_IDS.SET_HANGAR_PAGE}" data-jump-direction="${dot.jump}"></div>`;
            } else {
                const boardedClass = dot.isBoarded ? 'boarded' : '';
                return `<div class="pagination-dot ${dot.isActive ? 'active' : ''} ${boardedClass}" style="${style}" data-action="${ACTION_IDS.SET_HANGAR_PAGE}" data-index="${dot.index}"></div>`;
            }
        }).join('');

        paginationContainer.innerHTML = dotsHtml;
    }


    updateStickyBar(gameState) {
        this.cache.stickyBar.innerHTML = '';
        this.cache.topBarContainer.classList.remove('has-sticky-bar');
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

    updateMarketScreen(gameState) {
 
        if (gameState.activeScreen !== SCREEN_IDS.MARKET) return;
        
        const marketScrollPanel = this.cache.marketScreen.querySelector('.market-scroll-panel'); 

        if (this.lastKnownState && this.lastKnownState.activeScreen === SCREEN_IDS.MARKET && this.lastKnownState.currentLocationId === gameState.currentLocationId && marketScrollPanel) {
            this.marketScrollPosition = marketScrollPanel.scrollTop;
        } else {
            this.marketScrollPosition = 0;
        }
    
         this._saveMarketTransactionState();
        this.cache.marketScreen.innerHTML = renderMarketScreen(gameState, this.isMobile, this.getItemPrice, this.marketTransactionState);
        this._restoreMarketTransactionState();
        
        const newMarketScrollPanel = this.cache.marketScreen.querySelector('.market-scroll-panel');

        if (newMarketScrollPanel) {
            newMarketScrollPanel.scrollTop = this.marketScrollPosition;
        }
    }

    _saveMarketTransactionState() {
        if (!this.lastKnownState || this.lastKnownState.activeScreen !== SCREEN_IDS.MARKET) return;
        const controls = this.cache.marketScreen.querySelectorAll('.transaction-controls');
        controls.forEach(control => {
             const goodId = control.dataset.goodId;
            const qtyInput = control.querySelector('input');
             const mode = control.dataset.mode;

            if (qtyInput) {
                this.marketTransactionState[goodId] = {
                    quantity: qtyInput.value,
                    mode: mode
                 };
            }
         });
    }

    _restoreMarketTransactionState() {
        for (const goodId in this.marketTransactionState) {
            const state = this.marketTransactionState[goodId];
            const control = this.cache.marketScreen.querySelector(`.transaction-controls[data-good-id="${goodId}"]`);
            if (control) {
                const qtyInput = control.querySelector('input');
                if (qtyInput) {
                     qtyInput.value = state.quantity;
                    control.setAttribute('data-mode', state.mode);
                    this.updateMarketCardDisplay(goodId, parseInt(state.quantity, 10) || 0, state.mode);
                }
            }
        }
    }

     getItemPrice(gameState, goodId, isSelling = false) {
        if (!this.simulationService || !this.simulationService.marketService) {
            return gameState.market.prices[gameState.currentLocationId]?.[goodId] || 0;
        }
        
        // Pass `true` to apply modifiers if `isSelling` implies a user-facing price check
        // However, MarketService.getPrice's 3rd arg is `applyModifiers`. 
        // We probably want to apply modifiers for display purposes here.
        // Let's pass `true` to show the modified price in the UI.
        return this.simulationService.marketService.getPrice(gameState.currentLocationId, goodId, true);
     }

    _calculateSaleDetails(goodId, quantity) {
        const state = this.lastKnownState;
        if (!state) return { totalPrice: 0, effectivePricePerUnit: 0, netProfit: 0 };

        const good = DB.COMMODITIES.find(c => c.id === goodId);
        const marketStock = state.market.inventory[state.currentLocationId][goodId].quantity;
        
        const basePrice = this.getItemPrice(state, goodId, true);

        const playerItem = state.player.inventories[state.player.activeShipId]?.[goodId];
        const avgCost = playerItem?.avgCost || 0;

        const effectivePrice = basePrice; 
        const totalPrice = Math.floor(effectivePrice * quantity);

         const totalCost = avgCost * quantity;
        let netProfit = totalPrice - totalCost;
        if (netProfit > 0) {
            let totalBonus = (state.player.activePerks[PERK_IDS.TRADEMASTER] ? DB.PERKS[PERK_IDS.TRADEMASTER].profitBonus : 0) + (state.player.birthdayProfitBonus || 0);
            netProfit += netProfit * totalBonus;
        }

        return {
            totalPrice,
            effectivePricePerUnit: effectivePrice, 
            netProfit
         };
    }


    updateMarketCardPrice(goodId, newPrice) {
        const priceEl = this.cache.marketScreen.querySelector(`#price-display-${goodId}`);
        if (priceEl) {
            priceEl.dataset.basePrice = newPrice;
            const controls = priceEl.closest('.item-card-container').querySelector('.transaction-controls');
            if (controls && controls.dataset.mode === 'buy') {
                priceEl.textContent = formatCredits(newPrice);
            }
        }
    }

    updateMarketCardDisplay(goodId, quantity, mode) {
        const priceEl = this.cache.marketScreen.querySelector(`#price-display-${goodId}`);
        const effectivePriceEl = this.cache.marketScreen.querySelector(`#effective-price-display-${goodId}`);
        const indicatorEl = this.cache.marketScreen.querySelector(`#indicators-${goodId}`);
        const avgCostEl = this.cache.marketScreen.querySelector(`#avg-cost-${goodId}`);

        if (!priceEl || !effectivePriceEl || !indicatorEl || !this.lastKnownState) return;

        const state = this.lastKnownState;
        const basePrice = parseInt(priceEl.dataset.basePrice, 10);
        const playerItem = state.player.inventories[state.player.activeShipId]?.[goodId];

        if (avgCostEl) {
            avgCostEl.classList.toggle('visible', mode === 'sell');
        }

        if (mode === 'buy') {
            priceEl.textContent = formatCredits(basePrice);
            priceEl.className = 'font-roboto-mono font-bold price-text';
             effectivePriceEl.textContent = '';
            
            indicatorEl.innerHTML = renderIndicatorPills({
                price: basePrice,
                sellPrice: this.getItemPrice(state, goodId, true),
                galacticAvg: state.market.galacticAverages[goodId],
                 playerItem: playerItem
            });

        } else { // 'sell' mode
            const { effectivePricePerUnit, netProfit } = this._calculateSaleDetails(goodId, quantity);

            if (quantity > 0) {
                let profitText = `⌬ ${netProfit >= 0 ? '+' : ''}${formatCredits(netProfit, false)}`;
                priceEl.textContent = profitText;
                effectivePriceEl.textContent = `(${formatCredits(basePrice, false)}/unit)`;
                priceEl.className = `font-roboto-mono font-bold ${netProfit >= 0 ? 'profit-text' : 'loss-text'}`;
            } else {
                priceEl.textContent = '⌬ +0';
                priceEl.className = 'font-roboto-mono font-bold profit-text';
                effectivePriceEl.textContent = '';
            }

            indicatorEl.innerHTML = renderIndicatorPills({
                 price: basePrice,
                sellPrice: effectivePricePerUnit || this.getItemPrice(state, goodId, true),
                galacticAvg: state.market.galacticAverages[goodId],
                playerItem: playerItem
             });
        }
    }

    showTravelAnimation(from, to, travelInfo, totalHullDamagePercent, finalCallback) {
        this.travelAnimationService.play(from, to, travelInfo, totalHullDamagePercent, finalCallback);
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
             this.logger.error('UIManager', `Modal element with ID '${modalId}' not found in the DOM. Aborting modal display.`);
            return this.processModalQueue();
        }

        if (options.specialClass) {
            modal.classList.add(options.specialClass);
        }
        if (options.nonDismissible) {
            modal.classList.add('dismiss-disabled');
        }
        
        if (options.theme) {
            modal.dataset.theme = options.theme;
        } else {
            delete modal.dataset.theme;
        }

         modal.dataset.dismissInside = options.dismissInside || 'false';
        modal.dataset.dismissOutside = options.dismissOutside || 'false';

        const titleElId = modalId === 'mission-modal' ? 'mission-modal-title' : modalId.replace('-modal', '-title');
        const descElId = modalId === 'mission-modal' ? 'mission-modal-description' : modalId.replace('-modal', '-description');
        const titleEl = modal.querySelector(`#${titleElId}`);
        const descEl = modal.querySelector(`#${descElId}`) || modal.querySelector(`#${modalId.replace('-modal', '-scenario')}`);

        if (titleEl) titleEl.innerHTML = title;
        if (descEl) {
            descEl.innerHTML = description;
            descEl.className = 'my-4 text-gray-300'; 

            if (modalId !== 'mission-modal') {
                 descEl.classList.add('mb-6', 'text-lg');
            }

            if (modalId === 'event-modal' || modalId === 'random-event-modal') {
                 descEl.classList.add('text-center');
            }

            if (options.contentClass) {
                if (options.contentClass.includes('text-left') || options.contentClass.includes('text-right') || options.contentClass.includes('text-justify')) {
                     descEl.classList.remove('text-center');
                }
                descEl.classList.add(...options.contentClass.split(' ').filter(Boolean));
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
            
            if (options.footer) {
                if (btnContainer) {
                    btnContainer.innerHTML = options.footer;
                     btnContainer.querySelectorAll('button[data-action]').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                             if (btn.dataset.action === 'buy_intel') {
                                 return; 
                            }
                            closeHandler();
                         });
                    });
                }
            } else if (options.footer === null) {
                if (btnContainer) btnContainer.innerHTML = '';
            } else {
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
        }

         modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
    }

    showRandomEventModal(event, choicesCallback) {
         this.queueModal('random-event-modal', event.title, event.scenario, null, {
            nonDismissible: true,
            customSetup: (modal, closeHandler) => {
                const choicesContainer = modal.querySelector('#random-event-choices-container');
                choicesContainer.innerHTML = '';
                event.choices.forEach((choice, index) => {
                    const button = document.createElement('button');
                     button.className = 'btn w-full text-center p-4 hover:bg-slate-700';
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
        modal.classList.add('dismiss-disabled');
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

    /**
     * Displays the new modal for showing lore text.
     * @param {string} loreId The ID of the lore to display (e.g., 'story_so_far').
     */
    showLoreModal(loreId) {
        const modal = this.cache.loreModal;
        const contentEl = this.cache.loreModalContent;
        
        if (!modal || !contentEl) {
             this.logger.error('UIManager', 'Lore modal elements not cached or found in DOM.');
            return;
        }

        const loreEntry = LORE_CONTENT[loreId];
        if (!loreEntry) {
            this.logger.error('UIManager', `No lore content found for ID: ${loreId}`);
            contentEl.innerHTML = '<p>Error: Lore content not found.</p>';
        } else {
            contentEl.innerHTML = loreEntry.content;
        }
        
        contentEl.scrollTop = 0;

        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
        const closeHandler = (e) => {
            if (e.target.closest('#lore-modal-content') || e.target.id === 'lore-modal') {
                this.hideModal('lore-modal');
                modal.removeEventListener('click', closeHandler);
            }
        };
        modal.addEventListener('click', closeHandler);
    }

    /**
     * Displays the new modal for showing the EULA.
     * Modeled after showLoreModal for scrollability and dismissal.
     */
     showEulaModal() {
        const modal = this.cache.eulaModal;
        const contentEl = this.cache.eulaModalContent;
        
        if (!modal || !contentEl) {
            this.logger.error('UIManager', 'EULA modal elements not cached or found in DOM.');
            return;
        }

        if (!EULA_CONTENT) {
            this.logger.error('UIManager', 'EULA_CONTENT is not defined or empty.');
            contentEl.innerHTML = '<p>Error: EULA content not found.</p>';
        } else {
            contentEl.innerHTML = EULA_CONTENT;
        }
        
        contentEl.scrollTop = 0;

        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
        
        const closeHandler = (e) => {
            if (e.target.closest('#eula-modal-content') || e.target.id === 'eula-modal') {
                 this.hideModal('eula-modal');
                modal.removeEventListener('click', closeHandler);
            }
        };
        modal.addEventListener('click', closeHandler);
    }
    
    /**
     * Shows a confirmation modal for buying or selling a ship.
     * @param {string} shipId - The ID of the ship.
     * @param {string} transactionType - 'buy' or 'sell'.
     * @param {Function} onConfirm - Callback to execute on confirmation.
     */
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
            // --- VIRTUAL WORKBENCH: PHASE 4 (DYNAMIC RESALE) ---
            // Calculate resale value including upgrades
            const shipState = this.lastKnownState.player.shipStates[shipId];
            let upgradeValue = 0;
            if (shipState && shipState.upgrades) {
                shipState.upgrades.forEach(uId => {
                    const def = GameAttributes.getDefinition(uId);
                    if (def) upgradeValue += def.value;
                });
            }
            price = Math.floor((ship.price + upgradeValue) * GAME_RULES.SHIP_SELL_MODIFIER);
            // --- END VIRTUAL WORKBENCH ---
            
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

    /**
     * --- VIRTUAL WORKBENCH: PHASE 5 (REPLACEMENT DIALOG SYSTEM) ---
     * Shows a robust modal flow for installing upgrades.
     * Handles both the simple "Buy" case and the "Overwrite" case if slots are full.
     * @param {string} upgradeId - ID of the new upgrade.
     * @param {number} cost - Cost of the upgrade (0 if free).
     * @param {object} shipState - The target ship's state object.
     * @param {Function} onConfirm - Callback(indexToReplace | -1).
     */
    showUpgradeInstallationModal(upgradeId, cost, shipState, onConfirm) {
        const upgradeDef = GameAttributes.getDefinition(upgradeId);
        if (!upgradeDef) return;

        const currentUpgrades = shipState.upgrades || [];
        const isFull = currentUpgrades.length >= 3;
        
        // Initial "Confirm Purchase" content
        let title = cost > 0 ? "Purchase Upgrade" : "Install Upgrade";
        let desc = `<p class="mb-2">Install <span class="text-cyan-300 font-bold">${upgradeDef.name}</span>?</p>`;
        
        if (cost > 0) {
            desc += `<p class="text-sm text-gray-400">Cost: <span class="credits-text-pulsing">${formatCredits(cost, true)}</span></p>`;
        }
        
        desc += `<p class="mt-4 italic text-sm text-gray-500">${upgradeDef.description}</p>`;

        this.queueModal('event-modal', title, desc, null, {
            dismissOutside: true,
            customSetup: (modal, closeHandler) => {
                const btnContainer = modal.querySelector('#event-button-container');
                const contentEl = modal.querySelector('#event-description'); // Dynamic content area

                // Helper to render standard Confirm/Cancel buttons
                const renderStandardButtons = () => {
                    btnContainer.innerHTML = `
                        <button id="confirm-install-btn" class="btn btn-pulse-green">Confirm</button>
                        <button id="cancel-install-btn" class="btn">Cancel</button>
                    `;
                    
                    const confirmBtn = modal.querySelector('#confirm-install-btn');
                    confirmBtn.onclick = () => {
                        if (isFull) {
                            // If full, transition to "Replacement Selection" mode
                            renderReplacementUI();
                        } else {
                            // If not full, just confirm installation (append)
                            closeHandler();
                            onConfirm(-1); 
                        }
                    };
                    
                    modal.querySelector('#cancel-install-btn').onclick = closeHandler;
                };

                // Helper to render the "Select Upgrade to Replace" UI
                const renderReplacementUI = () => {
                    const modalTitle = modal.querySelector('#event-title');
                    modalTitle.textContent = "Upgrade Capacity Full";
                    
                    contentEl.innerHTML = `
                        <p class="mb-4 text-orange-400">Ship systems are at maximum capacity (3/3).</p>
                        <p class="mb-4 text-sm text-gray-300">Select an existing upgrade to dismantle and replace:</p>
                        <div class="flex flex-col gap-2 w-full max-w-xs mx-auto">
                            ${currentUpgrades.map((uId, idx) => {
                                const def = GameAttributes.getDefinition(uId);
                                return `<button class="btn btn-sm border border-gray-600 hover:border-red-500 text-left px-4 py-3 bg-gray-800" data-idx="${idx}">
                                            <span class="font-bold text-gray-200">${def ? def.name : uId}</span>
                                            <span class="block text-xs text-red-400 mt-1">Click to Replace</span>
                                        </button>`;
                            }).join('')}
                        </div>
                    `;
                    
                    btnContainer.innerHTML = `<button id="cancel-replace-btn" class="btn w-full mt-2">Cancel</button>`;
                    modal.querySelector('#cancel-replace-btn').onclick = closeHandler;

                    // Bind clicks to replacement buttons
                    contentEl.querySelectorAll('button[data-idx]').forEach(btn => {
                        btn.onclick = () => {
                            const idx = parseInt(btn.dataset.idx, 10);
                            renderFinalConfirmation(idx);
                        };
                    });
                };

                // Helper to render "Are you sure you want to destroy X?" UI
                const renderFinalConfirmation = (indexToRemove) => {
                    const idToRemove = currentUpgrades[indexToRemove];
                    const defToRemove = GameAttributes.getDefinition(idToRemove);
                    
                    const modalTitle = modal.querySelector('#event-title');
                    modalTitle.textContent = "Confirm Replacement";
                    
                    contentEl.innerHTML = `
                        <p class="mb-4 text-red-400 font-bold">WARNING: Destructive Action</p>
                        <p class="mb-2">Replacing <span class="text-white">${defToRemove ? defToRemove.name : idToRemove}</span> will permanently destroy it.</p>
                        <p class="text-sm text-gray-400">You will receive no credits for the dismantled part.</p>
                    `;
                    
                    btnContainer.innerHTML = `
                        <button id="final-confirm-btn" class="btn bg-red-600 hover:bg-red-500 text-white w-full mb-2">Dismantle & Install</button>
                        <button id="final-cancel-btn" class="btn w-full">Cancel</button>
                    `;
                    
                    modal.querySelector('#final-confirm-btn').onclick = () => {
                        closeHandler();
                        onConfirm(indexToRemove);
                    };
                    modal.querySelector('#final-cancel-btn').onclick = closeHandler;
                };

                // Initial render
                renderStandardButtons();
            }
        });
    }
    // --- END VIRTUAL WORKBENCH ---

    hideModal(modalId) {
    
         const modal = document.getElementById(modalId);
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('modal-hiding');
            modal.addEventListener('animationend', () => {
                modal.classList.add('hidden');
                modal.classList.remove('modal-hiding', 'modal-visible', 'dismiss-disabled', 'intro-fade-in');
                
                delete modal.dataset.theme;
                delete modal.dataset.dismissInside;
                delete modal.dataset.dismissOutside;

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

    // --- VIRTUAL WORKBENCH MODIFICATION: Phase 1 ---
    /**
     * Shows a non-graph generic tooltip with customizable positioning.
     * @param {HTMLElement} anchorEl The element the tooltip should anchor to.
     * @param {string} content The HTML content to display.
     * @param {string} [preferredPosition='right'] 'right' or 'top'
     */
    showGenericTooltip(anchorEl, content, preferredPosition = 'right') {
        this.activeGenericTooltipAnchor = anchorEl;
        this.activeGenericTooltipPosition = preferredPosition;
        const tooltip = this.cache.genericTooltip;
        tooltip.innerHTML = content;
        tooltip.style.display = 'block';
        this.updateGenericTooltipPosition();
    }
    // --- END VIRTUAL WORKBENCH ---

    hideGenericTooltip() {
        if (this.activeGenericTooltipAnchor) {
            this.cache.genericTooltip.style.display = 'none';
            this.activeGenericTooltipAnchor = null;
        }
    }

    // --- VIRTUAL WORKBENCH MODIFICATION: Phase 1 ---
    /**
     * Updated position logic to handle 'top' centering with clamping.
     */
    updateGenericTooltipPosition() {
        if (!this.activeGenericTooltipAnchor) return;
        const tooltip = this.cache.genericTooltip;
        const rect = this.activeGenericTooltipAnchor.getBoundingClientRect();
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        
        let leftPos, topPos;

        if (this.activeGenericTooltipPosition === 'top') {
            // Position centered above the element
            leftPos = rect.left + (rect.width / 2) - (tooltipWidth / 2);
            topPos = rect.top - tooltipHeight - 10;

            // Clamp vertical position if it goes off the top
            if (topPos < 10) {
                topPos = rect.bottom + 10;
            }
        } else {
            // Standard 'right' positioning
            leftPos = rect.right + 10;
            topPos = rect.top + (rect.height / 2) - (tooltipHeight / 2);

            // Clamp vertical position if it goes off the top
            if (topPos < 10) {
                topPos = rect.bottom + 10;
            }
        }

        // Clamp horizontal position for both modes
        if (leftPos < 10) {
            leftPos = 10;
        }
        if (leftPos + tooltipWidth > window.innerWidth - 10) {
            leftPos = window.innerWidth - tooltipWidth - 10;
        }

        tooltip.style.left = `${leftPos}px`;
        tooltip.style.top = `${topPos}px`;
    }
    // --- END VIRTUAL WORKBENCH ---

    _renderPriceGraph(goodId, gameState, playerItem) {
        const history = gameState.market.priceHistory[gameState.currentLocationId]?.[goodId];
        if (!history || history.length < 2) return `<div class="text-gray-400 text-sm p-4">No Data Available!</div>`;
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        const staticAvg = (good.basePriceRange[0] + good.basePriceRange[1]) / 2;
        const width = 280, height = 140, padding = 35;
        const prices = history.map(p => p.price);
        const playerBuyPrice = playerItem?.avgCost > 0 ? playerItem.avgCost : null;

        let allValues = [...prices, staticAvg];
        if (playerBuyPrice) allValues.push(playerBuyPrice);
        const minVal = Math.min(...allValues), maxVal = Math.max(...allValues);
        const valueRange = maxVal - minVal > 0 ? maxVal - minVal : 1;

        const iToX = i => (i / (history.length - 1)) * (width - padding * 2) + padding;
        const vToY = v => height - padding - ((v - minVal) / valueRange) * (height - padding * 2.5);

        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0c101d" />`;
        svg += `<g class="grid-lines" stroke="#1f2937" stroke-width="1">`;
        svg += `<line x1="${padding}" y1="${vToY(maxVal)}" x2="${padding}" y2="${height - padding}" /><line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" />`;
        svg += `</g>`;

        const staticAvgY = vToY(staticAvg);
        svg += `<line x1="${padding}" y1="${staticAvgY}" x2="${width - padding}" y2="${staticAvgY}" stroke="#facc15" stroke-width="1" stroke-dasharray="3 3" />`;
        svg += `<text x="${width - padding + 4}" y="${staticAvgY + 3}" fill="#facc15" font-size="10" font-family="Roboto Mono" text-anchor="start">Avg: ${formatCredits(staticAvg, false)}</text>`;
        if (playerBuyPrice) {
             const buyPriceY = vToY(playerBuyPrice);
            svg += `<line x1="${padding}" y1="${buyPriceY}" x2="${width - padding}" y2="${buyPriceY}" stroke="#34d399" stroke-width="1" stroke-dasharray="3 3" />`;
            svg += `<text x="${width - padding + 4}" y="${buyPriceY + 3}" fill="#34d399" font-size="10" font-family="Roboto Mono" text-anchor="start">Paid: ${formatCredits(playerBuyPrice, false)}</text>`;
        }

        const pricePoints = history.map((p, i) => `${iToX(i)},${vToY(p.price)}`).join(' ');
        svg += `<polyline fill="none" stroke="#60a5fa" stroke-width="2" points="${pricePoints}" />`;

        const firstDay = history[0].day;
        const lastDay = history[history.length - 1].day;
        svg += `<text x="${padding}" y="${height - padding + 15}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="start">Day ${firstDay}</text>`;
        svg += `<text x="${width - padding}" y="${height - padding + 15}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">Day ${lastDay}</text>`;
        svg += `<text x="${padding - 8}" y="${vToY(minVal) + 3}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">${formatCredits(minVal, false)}</text>`;
        svg += `<text x="${padding - 8}" y="${vToY(maxVal) + 3}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">${formatCredits(maxVal, false)}</text>`;
        svg += `</svg>`;
        return svg;
    }

     showTutorialToast({ step, onSkip, onNext, gameState }) {
        const toast = this.cache.tutorialToastContainer;
        const arrow = toast.querySelector('#tt-arrow');
        const isOverlayAnchor = step.anchorElement === 'body';
        let referenceEl;
        
        if (isOverlayAnchor) {
            referenceEl = this.cache.tutorialAnchorOverlay; 
        } else {
            referenceEl = document.querySelector(step.anchorElement);
            if (!referenceEl) {
                 this.logger.error('TutorialService', `Anchor element "${step.anchorElement}" not found for step "${step.stepId}". Defaulting to overlay.`);
                referenceEl = this.cache.tutorialAnchorOverlay; 
            }
        }
        
        if (this.popperInstance) {
            this.popperInstance.destroy();
            this.popperInstance = null;
        }

        let processedText = step.text;
        if (processedText.includes('{shipName}')) {
            const activeShipId = gameState.player.activeShipId;
            const shipName = activeShipId ? DB.SHIPS[activeShipId].name : 'your ship'; 
            processedText = processedText.replace(/{shipName}/g, shipName);
        }

        if (processedText.includes('{playerName}')) {
             const playerName = gameState.player.name || 'Captain'; 
            processedText = processedText.replace(/{playerName}/g, playerName);
        }

        this.cache.tutorialToastText.innerHTML = processedText;

        const initialWidth = step.size?.width || 'auto';
        const initialHeight = step.size?.height || 'auto';
        toast.style.width = initialWidth;
        toast.style.height = initialHeight;
        
        if (isOverlayAnchor) {
            const posX = step.positionX ?? 50; 
            const posY = step.positionY ?? 50; 
            toast.style.left = `${posX}%`;
            toast.style.top = `${posY}%`;
            toast.style.transform = 'translate(-50%, -50%)'; 
            arrow.style.display = 'none'; 
            toast.removeAttribute('data-popper-placement'); 
            
        } else {
     
            toast.style.left = ''; 
            toast.style.top = '';
            toast.style.transform = ''; 
            
            arrow.style.display = 'block'; 

            const defaultOptions = { 
                placement: 'auto',
                modifiers: [
                    { name: 'offset', options: { offset: [0, 10] } }, 
                     { name: 'preventOverflow', options: { padding: { top: 60, bottom: 60, left: 10, right: 10 } } },
                    { name: 'flip', options: { fallbackPlacements: ['top', 'bottom', 'left', 'right'] } },
                    { name: 'arrow', options: { element: '#tt-arrow', padding: 5 } }
                ]
             };
            
            const stepOffsetMod = step.popperOptions?.modifiers?.find(m => m.name === 'offset');
            let baseModifiers = defaultOptions.modifiers.filter(mod => mod.name !== 'offset'); 
            if (stepOffsetMod) {
                  baseModifiers.push(stepOffsetMod); 
            } else {
                 baseModifiers.push(defaultOptions.modifiers.find(m => m.name === 'offset')); 
            }
     
            if (step.popperOptions?.modifiers) { /* ... merge other modifiers ... */ }

             const finalOptions = {
                placement: step.placement || step.popperOptions?.placement || defaultOptions.placement,
                modifiers: baseModifiers
            };

            this.popperInstance = Popper.createPopper(referenceEl, toast, finalOptions);
        }

        toast.classList.remove('hidden');
        const isInfoStep = step.completion.type === 'INFO';
        this.cache.tutorialToastNextBtn.classList.toggle('hidden', !isInfoStep);
        if (isInfoStep) {
            this.cache.tutorialToastNextBtn.onclick = onNext;
        }
        const showSkipButton = false; 
        this.cache.tutorialToastSkipBtn.style.display = showSkipButton ? 'block' : 'none';
        this.cache.tutorialToastSkipBtn.onclick = onSkip;
        this.cache.tutorialToastText.scrollTop = 0;
        
        if (this.debugService) {
            this.debugService.setActiveTutorialStep(step); 
        }
    }


    hideTutorialToast() {
        this.cache.tutorialToastContainer.classList.add('hidden');
        if (this.popperInstance) {
            this.popperInstance.destroy();
            this.popperInstance = null;
        }
         this.applyTutorialHighlight(null);
        
        if (this.debugService) {
            this.debugService.clearActiveTutorialStep();
        }
    }

    updateTutorialPopper(newOptions) {
        const toast = this.cache.tutorialToastContainer;
        const arrow = toast.querySelector('#tt-arrow');
        const { isOverlayAnchor, width, height, percentX, percentY, placement, distance, skidding } = newOptions;

        toast.style.width = width > 0 ? `${width}px` : 'auto';
        toast.style.height = height > 0 ? `${height}px` : 'auto';

        if (isOverlayAnchor) {
            if (this.popperInstance) {
                this.popperInstance.destroy();
                this.popperInstance = null;
                 toast.removeAttribute('data-popper-placement'); 
                 toast.style.transform = ''; 
            }
            
            toast.style.left = `${percentX}%`;
            toast.style.top = `${percentY}%`;
            toast.style.transform = 'translate(-50%, -50%)'; 
            arrow.style.display = 'none';

        } else {
            toast.style.left = ''; 
            toast.style.top = ''; 
            toast.style.transform = ''; 
            arrow.style.display = 'block';

            const popperUpdateOptions = {
                 placement: placement,
                modifiers: [
                    { name: 'offset', options: { offset: [skidding, distance] } },
                     { name: 'preventOverflow', options: { padding: { top: 60, bottom: 60, left: 10, right: 10 } } },
                    { name: 'flip', options: { fallbackPlacements: ['top', 'bottom', 'left', 'right'] } },
                    { name: 'arrow', options: { element: '#tt-arrow', padding: 5 } }
                ]
            };

            if (this.popperInstance) {
                 this.popperInstance.setOptions(popperUpdateOptions).catch(e => {
                      this.logger.error('UIManager', 'Error updating Popper options:', e);
                 });
            } else {
                 this.logger.warn('UIManager', 'Popper instance needed but not found during update. Re-trigger toast if anchor type changed.');
            }
        }
    }


    applyTutorialHighlight(highlightConfig) {
         this.activeHighlightConfig = highlightConfig;
        this._renderHighlightsFromConfig(this.activeHighlightConfig);
    }

     _renderHighlightsFromConfig(highlightConfig) {
        const overlay = this.cache.tutorialHighlightOverlay;
        if (!overlay) return;

        overlay.innerHTML = ''; 
        if (!highlightConfig) {
            overlay.classList.add('hidden');
            return;
        }

        overlay.classList.remove('hidden');

        highlightConfig.forEach(cue => {
            const el = document.createElement('div');
            el.className = 'tutorial-cue';
            el.style.left = `${cue.x}px`;
             el.style.top = `${cue.y}px`;
             el.style.width = `${cue.width}px`;
            el.style.height = `${cue.height}px`;
            el.style.transform = `rotate(${cue.rotation}deg)`;
            el.style.opacity = cue.style.opacity;

            if (cue.style.animation !== 'None') {
                el.classList.add(`anim-${cue.style.animation.toLowerCase()}`);
            }

             let content = '';
            if (cue.type === 'Shape') {
                content = `
                    <svg width="100%" height="100%" viewBox="0 0 ${cue.width} ${cue.height}" preserveAspectRatio="none" style="overflow: visible;">
                        ${cue.shapeType === 'Rectangle' ?
                             `<rect x="0" y="0" width="100%" height="100%" rx="${cue.style.borderRadius}" ry="${cue.style.borderRadius}" style="fill:${cue.style.fill}; stroke:${cue.style.stroke}; stroke-width:${cue.style.strokeWidth}px;" />` :
                             `<ellipse cx="50%" cy="50%" rx="50%" ry="50%" style="fill:${cue.style.fill}; stroke:${cue.style.stroke}; stroke-width:${cue.style.strokeWidth}px;" />`
                        }
                     </svg>`;
            } else if (cue.type === 'Arrow') {
                content = `
                     <svg width="100%" height="100%" viewBox="0 0 100 50" preserveAspectRatio="none" style="overflow: visible;">
                        <defs>
                             <marker id="arrowhead-player" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
                                <polygon points="0 0, 10 3.5, 0 7" fill="${cue.style.stroke}" />
                             </marker>
                        </defs>
                         <line x1="0" y1="25" x2="90" y2="25" stroke="${cue.style.stroke}" stroke-width="${cue.style.strokeWidth}" marker-end="url(#arrowhead-player)" />
                    </svg>
                `;
             } else if (cue.type === 'Spotlight') {
                el.style.borderRadius = '50%';
                 el.style.boxShadow = `0 0 0 9999px rgba(0,0,0,0.7), 0 0 ${cue.style.glowIntensity || 20}px ${cue.style.glowIntensity || 10}px ${cue.style.glowColor || cue.style.stroke}`;
            }

            el.innerHTML = content;
            const animatedChild = el.querySelector('svg');
            if (animatedChild && cue.style.animation !== 'None') {
                 animatedChild.classList.add(`anim-${cue.style.animation.toLowerCase()}`);
                 animatedChild.style.setProperty('--glow-color', cue.style.glowColor || cue.style.stroke);
                 animatedChild.style.setProperty('--anim-speed', `${cue.style.animationSpeed}s`);
                 animatedChild.style.setProperty('--glow-intensity', `${cue.style.glowIntensity}px`);
            }

             overlay.appendChild(el);
        });
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
            this.logger.error('UIManager', 'Tutorial log modal elements not found in DOM.');
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
            
            // --- VIRTUAL WORKBENCH: PHASE 4 (DYNAMIC RESALE & PILLS) ---
            let upgradeValue = 0;
            if (shipDynamic.upgrades) {
                shipDynamic.upgrades.forEach(uId => {
                    const def = GameAttributes.getDefinition(uId);
                    if (def) upgradeValue += def.value;
                });
            }
            const salePrice = Math.floor((shipStatic.price + upgradeValue) * GAME_RULES.SHIP_SELL_MODIFIER);

            const upgradesHtml = (shipDynamic.upgrades || []).map(id => {
                const def = GameAttributes.getDefinition(id);
                const label = def ? (def.shortLabel || def.name.substring(0, 4).toUpperCase()) : id;
                // Using cyan-400 equivalent for pills
                return `<span class="attribute-pill inline-block bg-cyan-400 text-slate-900 px-2 py-0.5 rounded text-xs font-bold mr-1 mb-1">${label}</span>`;
            }).join('');
            
            const upgradeSection = upgradesHtml ? `<div class="mt-2 flex flex-wrap justify-center">${upgradesHtml}</div>` : '';
            // --- END VIRTUAL WORKBENCH ---

            modalContentHtml = `
                 <div class="ship-card p-4 flex flex-col space-y-3 ${isActive ? 'border-yellow-400' : ''}">
                    <h3 class="text-xl font-orbitron text-center ${isActive ? 'text-yellow-300' : 'text-cyan-300'}">${shipStatic.name}</h3>
                    <p class="text-sm text-gray-400 text-center">Class ${shipStatic.class}</p>
                    <p class="text-sm text-gray-400 flex-grow text-left my-2">${shipStatic.lore}</p>
                    <div class="grid grid-cols-3 gap-x-4 text-sm font-roboto-mono text-center pt-2">
                        <div><span class="text-gray-500">Hull</span><div class="text-green-400">${Math.floor(shipDynamic.health)}/${shipStatic.maxHealth}</div></div>
                        <div><span class="text-gray-500">Fuel</span><div class="text-sky-400">${Math.floor(shipDynamic.fuel)}/${shipStatic.maxFuel}</div></div>
                        <div><span class="text-gray-500">Cargo</span><div class="text-amber-400">${cargoUsed}/${shipStatic.cargoCapacity}</div></div>
                    </div>
                    ${upgradeSection}
                      <div class="grid grid-cols-2 gap-2 mt-2">
                        ${isActive ? '<button class="btn" disabled>ACTIVE</button>' : `<button class="btn" data-action="${ACTION_IDS.SELECT_SHIP}" data-ship-id="${shipId}">Board</button>`}
                        <button class="btn" data-action="${ACTION_IDS.SELL_SHIP}" data-ship-id="${shipId}" ${!canSell ? 'disabled' : ''}>Sell<br>⌬ ${formatCredits(salePrice, false)}</button>
                    </div>
                 </div>`;
        }

        const modal = this.cache.shipDetailModal;
        const modalContent = modal.querySelector('#ship-detail-content');
        modalContent.innerHTML = modalContentHtml;
        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
    }

    showLaunchModal(locationId) {
        const state = this.lastKnownState;
        if (!state) return;

        const location = DB.MARKETS.find(l => l.id === locationId);
        if (!location) return;

        const theme = location.navTheme;
        const travelInfo = state.TRAVEL_DATA[state.currentLocationId]?.[locationId];
        const shipState = state.player.shipStates[state.player.activeShipId];

        if (!travelInfo) return;

        const modalContentHtml = `
            <div class="launch-modal-wrapper panel-border" style="background: ${theme.gradient}; color: ${theme.textColor}; border-color: ${theme.borderColor}; --theme-glow-color: ${theme.borderColor};">
                <div class="flex-shrink-0">
                    <h3 class="font-orbitron">${location.name}</h3>
                     <p class="flavor-text italic">${location.launchFlavor}</p>
                </div>

                <div class="flex-grow flex items-center justify-center">
                     <button class="btn-launch-glow" data-action="travel" data-location-id="${locationId}" style="--launch-glow-color: ${theme.borderColor};">Launch</button>
                </div>

                <div class="travel-info-text">
                     <p>Travel Time: ${travelInfo.time} Days</p>
                    <p>Fuel: ${Math.floor(shipState.fuel)} / ${travelInfo.fuelCost} required</p>
                </div>
            </div>`;

        const modal = this.cache.launchModal;
        this.cache.launchModalContent.innerHTML = modalContentHtml;
        modal.classList.remove('hidden');

        requestAnimationFrame(() => {
            modal.classList.add('modal-visible');
            const wrapper = modal.querySelector('.launch-modal-wrapper');
            if (wrapper) {
                 requestAnimationFrame(() => {
                     wrapper.classList.add('is-glowing');
                });
            }
        });

        const closeHandler = (e) => {
            if (e.target.id === 'launch-modal') {
                this.hideModal('launch-modal');
                modal.removeEventListener('click', closeHandler);
            }
        };
        modal.addEventListener('click', closeHandler);
    }

    
     showCargoDetailModal(gameState, goodId) {
        const good = DB.COMMODITIES.find(c => c.id === goodId);
        const item = gameState.player.inventories[gameState.player.activeShipId]?.[goodId];

        if (!good || !item) return;

        this.queueModal('cargo-detail-modal', null, null, null, {
            dismissInside: true,
            dismissOutside: true,
             footer: null, 

            customSetup: (modal, closeHandler) => {
                const modalContent = modal.querySelector('#cargo-detail-content');
                 if (modalContent) {
                    modalContent.innerHTML = _renderMaxCargoModal(good, item);
                 }
            }
        });
    }

    _getActiveShipTerminalElement() {
        const state = this.lastKnownState; 
        if (!state) return null;

        const hangarScreenEl = this.cache.hangarScreen;
        if (!hangarScreenEl) return null;

        const carousel = hangarScreenEl.querySelector('#hangar-carousel');
        if (!carousel) return null;

        const isHangarMode = state.uiState.hangarShipyardToggleState === 'hangar';
        const activeIndex = isHangarMode ? (state.uiState.hangarActiveIndex || 0) : (state.uiState.shipyardActiveIndex || 0);
        const pages = carousel.querySelectorAll('.carousel-page');
        const activePage = pages[activeIndex];
        return activePage ? activePage.querySelector('#ship-terminal') : null;
    }

    async runShipTransactionAnimation(shipId, animationClass = 'is-dematerializing') {
        const elementToAnimate = this._getActiveShipTerminalElement();

        if (!elementToAnimate) {
            this.logger.warn('UIManager', `No element to animate for ${shipId}. Skipping animation.`);
            return; 
        }

        await playBlockingAnimation(elementToAnimate, animationClass);
    }

    renderStickyBar(gameState) {
        const stickyBarEl = this.cache.missionStickyBar;
        const contentEl = stickyBarEl.querySelector('.sticky-content');
        const objectiveTextEl = this.cache.stickyObjectiveText;
        const objectiveProgressEl = this.cache.stickyObjectiveProgress;

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
        let shouldBeDisabled = anotherMissionActive;
        if (mission.id === 'mission_tutorial_02' && tutorials.activeBatchId === 'intro_missions' && tutorials.activeStepId !== 'mission_2_4') {
            shouldBeDisabled = true;
        }

        const options = {
            dismissOutside: true, // Phase 1: Allow dismissal
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
        this.queueModal('mission-modal', mission.name, mission.description, null, options);
    }

    _showMissionCompletionModal(mission) {
         const options = {
            dismissOutside: true, // Phase 1: Allow dismissal
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
        this.queueModal('mission-modal', mission.completion.title, mission.completion.text, null, options);
    }

     flashObjectiveProgress() {
        const progressEl = this.cache.stickyObjectiveProgress;
        if (progressEl) {
            progressEl.classList.add('objective-progress-flash');
            setTimeout(() => {
                progressEl.classList.remove('objective-progress-flash');
            }, 700);
        }
    }

    getModalIdFromEvent(e) {
        const modalBackdrop = e.target.closest('.modal-backdrop');
        if (!modalBackdrop || !modalBackdrop.id || modalBackdrop.classList.contains('dismiss-disabled')) {
            return null;
        }

         const dismissInside = modalBackdrop.dataset.dismissInside === 'true';
        const dismissOutside = modalBackdrop.dataset.dismissOutside === 'true';
        const isBackdropClick = !e.target.closest('.modal-content');
        const isContentClick = e.target.closest('.modal-content');

        if ((dismissOutside && isBackdropClick) || (dismissInside && isContentClick)) {
             if (modalBackdrop.id === 'lore-modal' && e.target.closest('#lore-modal-content')) {
                 return modalBackdrop.id;
            }
            if (modalBackdrop.id === 'eula-modal' && e.target.closest('#eula-modal-content')) {
                return modalBackdrop.id;
            }

            if (modalBackdrop.id !== 'lore-modal' &&  modalBackdrop.id !== 'eula-modal' && !e.target.closest('.modal-content')) {
                return modalBackdrop.id;
            }
            if (modalBackdrop.id === 'lore-modal' && !e.target.closest('.modal-content')) {
                 return modalBackdrop.id;
            }
            if (modalBackdrop.id === 'eula-modal' && !e.target.closest('.modal-content')) {
                return modalBackdrop.id;
            }
            
            return modalBackdrop.id;
        }
     
        return null;
    }

    isClickInside(e, selector) {
        return e.target.closest(selector) !== null;
    }

    getTooltipContent(e) {
        const tooltipTarget = e.target.closest('[data-tooltip]');
        if (tooltipTarget) {
            return tooltipTarget.dataset.tooltip;
        }
        return null;
    }

    showGameContainer() {
        this.cache.gameContainer.classList.remove('hidden');

        this._setAppHeight();

        requestAnimationFrame(() => {
            this._setAppHeight();
        });
    }

    /**
     * Shows the detail modal for a specific location on the map.
     * @param {string} locationId - The ID of the location to display details for.
     */
    showMapDetailModal(locationId) {
        const location = DB.MARKETS.find(l => l.id === locationId);
        if (!location) return;

        const modal = this.cache.mapDetailModal;
        const modalContent = modal.querySelector('.modal-content');
        const contentContainer = modal.querySelector('#map-modal-content-container');
        const theme = location.navTheme;

        // Apply theme styles
        modalContent.style.background = theme.gradient;
        modalContent.style.setProperty('--theme-glow-color', theme.borderColor);
        modal.dataset.theme = locationId;

        const imports = [];
        const exports = [];

        if (location.availabilityModifier) {
            for (const [commodityId, modifier] of Object.entries(location.availabilityModifier)) {
                  const commodity = DB.COMMODITIES.find(c => c.id === commodityId);
                if (commodity) {
                    const tag = {
                        name: commodity.name,
                        style: getCommodityStyle(commodity.styleClass)
                    };
                    if (modifier < 1.0) {
                         imports.push(tag);
                    } else if (modifier > 1.0) {
                        exports.push(tag);
                    }
                }
            }
        }

        const renderTags = (tagArray) => tagArray.map(tag =>
             `<span class="commodity-tag" style="border-color: ${tag.style.hex}; background-color: ${tag.style.hex}20; color: ${tag.style.hex};">${tag.name}</span>`
         ).join('');

        // --- VIRTUAL WORKBENCH: DYNAMIC STATION QUIRKS ---
        // Fetch quirks from GameAttributes instead of using hardcoded specialty
        const quirks = GameAttributes.getStationQuirks(locationId);
        let quirksHtml = '';
        if (quirks.length > 0) {
            quirksHtml = quirks.map(qId => {
                const def = GameAttributes.getDefinition(qId);
                // Use a slightly different style or color to highlight it's a quirk
                 return `<p class="font-roboto-mono imprinted-text-embedded" style="color: #facc15;">${def.description}</p>`;
            }).join('');
        } else {
            // Fallback to legacy specialty or "None reported"
            quirksHtml = `<p class="font-roboto-mono imprinted-text-embedded">${location.specialty || 'None reported'}</p>`;
        }
        // --- END VIRTUAL WORKBENCH ---

        const contentHtml = `
            <div class="text-center">
                <h3 class="text-3xl font-orbitron" style="color: ${theme.textColor};">${location.name}</h3>
                 <p class="text-lg italic imprinted-text">${location.launchFlavor}</p>
            </div>

            <div class="my-4 space-y-3">
                <div class="map-intel-block">
                    <h5 class="font-bold imprinted-text" style="color: ${theme.textColor}; opacity: 0.7;">Fuel</h5>
                    <p class="font-roboto-mono imprinted-text-embedded"><span class="credits-text-pulsing">${formatCredits(location.fuelPrice, true)}</span>/unit</p>
                 </div>
                <div class="map-intel-block">
                    <h5 class="font-bold imprinted-text" style="color: ${theme.textColor}; opacity: 0.7;">Station Details</h5>
                    ${quirksHtml}
                </div>
          </div>

            
             <div class="text-center">
                 <div>
                    <h5 class="font-bold imprinted-text">Exports:</h5>
                    <div>${exports.length > 0 ? renderTags(exports) : '<span class="text-gray-400">CLASSIFIED</span>'}</div>
                </div>
                <div class="mt-2">
                     <h5 class."font-bold imprinted-text">Needs:</h5>
                     <div>${imports.length > 0 ? renderTags(imports) : '<span class="text-gray-400">CLASSIFIED</span>'}</div>
                </div>
            </div>
        `;

        contentContainer.innerHTML = contentHtml;
        modal.classList.remove('hidden');
        modal.classList.remove('is-glowing');

        requestAnimationFrame(() => {
            modal.classList.add('modal-visible');
            modal.classList.add('is-glowing');
        });

        const closeHandler = (e) => {
            if (e.target.id === 'map-detail-modal' || e.target.closest('.modal-content')) {
                  this.hideMapDetailModal();
                modal.removeEventListener('click', closeHandler); 
            }
        };
        requestAnimationFrame(() => {
             modal.addEventListener('click', closeHandler);
        });
    }


    hideMapDetailModal() {
        const modal = this.cache.mapDetailModal;
        if (modal) {
             modal.classList.remove('is-glowing');
            delete modal.dataset.theme; 
            const existingHandler = modal.__mapDetailCloseHandler; 
            if(existingHandler) {
                modal.removeEventListener('click', existingHandler);
                delete modal.__mapDetailCloseHandler;
            }
    
        }
        this.hideModal('map-detail-modal');
    }

    handleSetIntelTab(element) {
        const targetId = element.dataset.target;
        if (!targetId) return;

        if (this.simulationService) {
            this.simulationService.setIntelTab(targetId);
        }
    }

    updateIntelTab(activeTabId) {
        const screen = this.cache.intelScreen;
        if (!screen) return;
        
        const subNavBar = screen.querySelector('.sub-nav-bar');
        if (!subNavBar) {
            return; 
        }
        
        screen.querySelectorAll('.sub-nav-button').forEach(btn => btn.classList.remove('active'));
        screen.querySelectorAll('.intel-tab-content').forEach(content => content.classList.remove('active'));
        const activeTabButton = screen.querySelector(`.sub-nav-button[data-target="${activeTabId}"]`);
        const activeContent = screen.querySelector(`#${activeTabId}`);

        if (activeTabButton) {
             activeTabButton.classList.add('active');
        }
  
         if (activeContent) {
            activeContent.classList.add('active');
        }

        if (activeTabId === 'intel-market-content') {
            subNavBar.classList.add('market-active');
        } else {
            subNavBar.classList.remove('market-active');
        }
    }


    _findIntelPacket(packetId, locationId) {
        const state = this.lastKnownState;
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
        
        this.logger.error('UIManager', `_findIntelPacket: Could not find packet ${packetId} anywhere.`);
        return null;
    }

    _formatIntelDetails(template, packet, price, isNewFormat) {
        const locationName = DB.MARKETS.find(m => m.id === packet.dealLocationId)?.name || 'an unknown location';
        const commodityName = DB.COMMODITIES.find(c => c.id === packet.commodityId)?.name || 'a mystery commodity';
        const discountStr = `${Math.floor(packet.discountPercent * 100)}%`;
        
        const priceStr = price ? formatCredits(-price, true) : '???';

        const currentDay = this.intelService.getCurrentDay();
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
                this.logger.warn('UIManager', `SaveCompat: No message array for ${packet.locationId}, using fallback.`);
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

        this.queueModal('event-modal', 'Intel Offer', vagueText, null, {
            theme: locationId, 
            dismissOutside: true, 
             footer: purchaseButtonHTML 
        });
    }

    handleBuyIntel(element, e) {
        const { packetId, locationId, price } = element.dataset;
        const priceNum = parseInt(price, 10);
        const purchasedPacket = this.intelService.purchaseIntel(packetId, locationId, priceNum);

        if (purchasedPacket) {
            this.hideModal('event-modal'); 
            
             if(e) {
                this.createFloatingText(`-${formatCredits(priceNum, false)}`, e.clientX, e.clientY, '#f87171');
            }

            const updatedPacket = this._findIntelPacket(packetId, locationId);
            if (updatedPacket) {
                this._showIntelDetailsModal(updatedPacket, updatedPacket.pricePaid, locationId);
            }

        } else {
            this.hideModal('event-modal');
            this.queueModal('event-modal', 'Purchase Failed', 'Unable to purchase intel. You may already have an active deal or insufficient credits.');
        }
     }

    handleShowIntelDetails(element) {
        const { packetId, locationId } = element.dataset;
        const packet = this._findIntelPacket(packetId, locationId);
        if (!packet) return;

        const price = packet.pricePaid || this.intelService.calculateIntelPrice(packet);

        this._showIntelDetailsModal(packet, price, locationId);
    }

    _showIntelDetailsModal(packet, price, locationId) {
        let detailsTemplate;
        let isNewFormat = false; 

        if (packet.messageKey) {
             detailsTemplate = INTEL_CONTENT[packet.messageKey]?.details || "No details found.";
            isNewFormat = true; 
        } else if (packet.messageIndex !== undefined) {
            this.logger.warn('UIManager', `SaveCompat: Found old packet with messageIndex ${packet.messageIndex}`);
            detailsTemplate = "Details for this expired intel packet are no longer available in the new system.";
        } else {
            const originalContent = {
                "CORPORATE_LIQUIDATION": { "details": "PACKET DECRYPTED: A [commodity name] surplus at [location name] allows for purchase at [discount amount %] below galactic average. This price is locked for [durationDays] days. A minor Corporate State is quietly liquidating assets to meet quarterly quotas. This is a standard, low-risk procurement opportunity. This intel was secured for [⌬ credit price]." },
                 "SUPPLY_CHAIN_SHOCK": { "details": "DATA UNLOCKED: [commodity name] is available at [location name] for [discount amount %] off standard pricing. This window is open for [durationDays] days. A Merchant's Guild freighter was damaged, forcing them to offload their cargo here at a loss. Their misfortune is your gain. This access was [⌬ credit price]." }
            };
            detailsTemplate = originalContent[packet.messageKey]?.details || "Packet is corrupted. No message data found.";
        }

        const formattedDetails = this._formatIntelDetails(detailsTemplate, packet, price, isNewFormat);

        this.queueModal('event-modal', 'Intel Unlocked', formattedDetails, null, {
            theme: locationId, 
            dismissInside: true, 
             dismissOutside: true,
            footer: null, 
            contentClass: 'text-left' 
        });
    }

    /**
     * --- VIRTUAL WORKBENCH: PHASE 5 (REPLACEMENT DIALOG SYSTEM) ---
     * Shows a robust modal flow for installing upgrades.
     * Handles both the simple "Buy" case and the "Overwrite" case if slots are full.
     * @param {string} upgradeId - ID of the new upgrade.
     * @param {number} cost - Cost of the upgrade (0 if free).
     * @param {object} shipState - The target ship's state object.
     * @param {Function} onConfirm - Callback(indexToReplace | -1).
     */
    showUpgradeInstallationModal(upgradeId, cost, shipState, onConfirm) {
        const upgradeDef = GameAttributes.getDefinition(upgradeId);
        if (!upgradeDef) return;

        const currentUpgrades = shipState.upgrades || [];
        const isFull = currentUpgrades.length >= 3;
        
        // Initial "Confirm Purchase" content
        let title = cost > 0 ? "Purchase Upgrade" : "Install Upgrade";
        let desc = `<p class="mb-2">Install <span class="text-cyan-300 font-bold">${upgradeDef.name}</span>?</p>`;
        
        if (cost > 0) {
            desc += `<p class="text-sm text-gray-400">Cost: <span class="credits-text-pulsing">${formatCredits(cost, true)}</span></p>`;
        }
        
        desc += `<p class="mt-4 italic text-sm text-gray-500">${upgradeDef.description}</p>`;

        this.queueModal('event-modal', title, desc, null, {
            dismissOutside: true,
            customSetup: (modal, closeHandler) => {
                const btnContainer = modal.querySelector('#event-button-container');
                const contentEl = modal.querySelector('#event-description'); // Dynamic content area

                // Helper to render standard Confirm/Cancel buttons
                const renderStandardButtons = () => {
                    btnContainer.innerHTML = `
                        <button id="confirm-install-btn" class="btn btn-pulse-green">Confirm</button>
                        <button id="cancel-install-btn" class="btn">Cancel</button>
                    `;
                    
                    const confirmBtn = modal.querySelector('#confirm-install-btn');
                    confirmBtn.onclick = () => {
                        if (isFull) {
                            // If full, transition to "Replacement Selection" mode
                            renderReplacementUI();
                        } else {
                            // If not full, just confirm installation (append)
                            closeHandler();
                            onConfirm(-1); 
                        }
                    };
                    
                    modal.querySelector('#cancel-install-btn').onclick = closeHandler;
                };

                // Helper to render the "Select Upgrade to Replace" UI
                const renderReplacementUI = () => {
                    const modalTitle = modal.querySelector('#event-title');
                    modalTitle.textContent = "Upgrade Capacity Full";
                    
                    contentEl.innerHTML = `
                        <p class="mb-4 text-orange-400">Ship systems are at maximum capacity (3/3).</p>
                        <p class="mb-4 text-sm text-gray-300">Select an existing upgrade to dismantle and replace:</p>
                        <div class="flex flex-col gap-2 w-full max-w-xs mx-auto">
                            ${currentUpgrades.map((uId, idx) => {
                                const def = GameAttributes.getDefinition(uId);
                                return `<button class="btn btn-sm border border-gray-600 hover:border-red-500 text-left px-4 py-3 bg-gray-800" data-idx="${idx}">
                                            <span class="font-bold text-gray-200">${def ? def.name : uId}</span>
                                            <span class="block text-xs text-red-400 mt-1">Click to Replace</span>
                                        </button>`;
                            }).join('')}
                        </div>
                    `;
                    
                    btnContainer.innerHTML = `<button id="cancel-replace-btn" class="btn w-full mt-2">Cancel</button>`;
                    modal.querySelector('#cancel-replace-btn').onclick = closeHandler;

                    // Bind clicks to replacement buttons
                    contentEl.querySelectorAll('button[data-idx]').forEach(btn => {
                        btn.onclick = () => {
                            const idx = parseInt(btn.dataset.idx, 10);
                            renderFinalConfirmation(idx);
                        };
                    });
                };

                // Helper to render "Are you sure you want to destroy X?" UI
                const renderFinalConfirmation = (indexToRemove) => {
                    const idToRemove = currentUpgrades[indexToRemove];
                    const defToRemove = GameAttributes.getDefinition(idToRemove);
                    
                    const modalTitle = modal.querySelector('#event-title');
                    modalTitle.textContent = "Confirm Replacement";
                    
                    contentEl.innerHTML = `
                        <p class="mb-4 text-red-400 font-bold">WARNING: Destructive Action</p>
                        <p class="mb-2">Replacing <span class="text-white">${defToRemove ? defToRemove.name : idToRemove}</span> will permanently destroy it.</p>
                        <p class="text-sm text-gray-400">You will receive no credits for the dismantled part.</p>
                    `;
                    
                    btnContainer.innerHTML = `
                        <button id="final-confirm-btn" class="btn bg-red-600 hover:bg-red-500 text-white w-full mb-2">Dismantle & Install</button>
                        <button id="final-cancel-btn" class="btn w-full">Cancel</button>
                    `;
                    
                    modal.querySelector('#final-confirm-btn').onclick = () => {
                        closeHandler();
                        onConfirm(indexToRemove);
                    };
                    modal.querySelector('#final-cancel-btn').onclick = closeHandler;
                };

                // Initial render
                renderStandardButtons();
            }
        });
    }
}