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

// --- VIRTUAL WORKBENCH: IMPORTS ---
import { IntelMarketRenderer } from '../ui/renderers/IntelMarketRenderer.js';
import { INTEL_CONTENT } from '../data/intelContent.js';
// --- END VIRTUAL WORKBENCH ---

/**
 * Stores the lore text content.
 * @private
 */
const LORE_CONTENT = {
    story_so_far: `
        <p>The year 2140 is the result of a single, massive corporate takeover. A century ago, the "Ad Astra Initiative" released advanced technology to all of humanity, a gift from the new Human-AI Alliance on Earth designed to kickstart our expansion into the stars. It was a promise of a new beginning, an open-source key to the solar system, ensuring the survival of all Earth life, both organic and synthetic.</p>
    
        <p>But a gift to everyone is a business opportunity for the few. The hyper-corporations, already positioned in space, immediately patented the most efficient manufacturing processes and proprietary components for this new technology. This maneuver ensured that while anyone could build a Folded-Space Drive, only the corporations could supply the high-performance parts needed to make it truly effective, creating a system-wide technological dependency that persists to this day. This technological monopoly created the "Drive-Divide," the central pillar of the new class system. Nearly all ships run on older, less efficient hardware. Very few ships employ these coveted Folded-Space Drives.</p>
        <p>The major hubs beyond Earth are sovereign, corporate-run territories where law is policy and your rights are listed in an employment contract. These scattered colonies are fierce rivals, engaged in constant economic warfare, all propped up by the interstellar supply lines maintained by the Merchant's Guild. For them, you are just another cog in the great machine of commerce.</p>
        <p>In a system owned by corporations, possessing your own ship is the only true form of freedom. Every credit earned, every successful trade, is a bet on your own skill and a step toward true sovereignty on the razor's edge of a cargo manifest.</p>
    `
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
        this.missionService = null; // To be injected
        this.simulationService = null; // To be injected
        this.newsTickerService = null; // ADDED
        this.debugService = null; // To be injected
        this.marketTransactionState = {}; // To store quantity and mode
        this.activeHighlightConfig = null; // Stores the config for currently visible highlights
        this.marketScrollPosition = 0;
        this.popperInstance = null; // Instance for Popper.js
        // MODIFIED: Added property to hold injected EventManager
        this.eventManager = null; // To be injected

        // --- VIRTUAL WORKBENCH: ADD INTEL SERVICE/RENDERER ---
        /** @type {import('./IntelService.js').IntelService | null} */
        this.intelService = null; // To be injected
        /** @type {IntelMarketRenderer | null} */
        this.intelMarketRenderer = null; // To be instantiated
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

        // This remains the correct way to handle orientation changes or desktop resizing.
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
        this.intelMarketRenderer = new IntelMarketRenderer(this.gameState, intelService);
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
            newsTickerBar: document.getElementById('news-ticker-bar'), // ADDED
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

            // Tutorial Elements
            tutorialAnchorOverlay: document.getElementById('tutorial-anchor-overlay'), // NEW
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

        this._renderNewsTicker(); // ADDED
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

        const contextBarHtml = `
            <div class="context-bar" style="background: ${theme.gradient}; color: ${theme.textColor};">
                <span class="location-name-text">${location?.name || 'In Transit'}</span>
                <span class="credit-text">${formatCredits(player.credits)}</span>
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
                 
                 // --- VIRTUAL WORKBENCH: BUG FIX ---
                 // The 'set-intel-tab' action is for the *internal* tabs on the intel screen.
                 // The *main sub-nav* button must use 'set-screen' to navigate *to* the intel screen.
                 const action = ACTION_IDS.SET_SCREEN;
                 // --- END VIRTUAL WORKBENCH ---

                 let subStyle = '';
                 if (isSubNavActive) {
                    subStyle = `style="background: ${theme.gradient}; color: ${theme.textColor}; opacity: 1; font-weight: 700;"`;
                 }
                 // --- VIRTUAL WORKBENCH: Remove data-target from this button ---
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
                // Defer map initialization until after the browser has painted the new DOM elements,
                // ensuring the map container has a valid clientHeight for D3 to use.
                requestAnimationFrame(() => initMap(this));
                break;
            case SCREEN_IDS.NAVIGATION:
                this.cache.navigationScreen.innerHTML = renderNavigationScreen(gameState);
                break;
            case SCREEN_IDS.SERVICES:
                this.cache.servicesScreen.innerHTML = renderServicesScreen(gameState);
                // MODIFIED: Bind hold events after rendering the services screen
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
                // --- VIRTUAL WORKBENCH: RENDER INTEL SCREEN ---
                this.cache.intelScreen.innerHTML = renderIntelScreen();
                // After rendering the shell, immediately populate the (default) active tab
                // The renderer will handle showing the correct content (Codex or Market)
                if (this.intelMarketRenderer) {
                    // Find the container for the market tab content
                    const marketContentEl = this.cache.intelScreen.querySelector('#intel-market-content');
                    if (marketContentEl) {
                        this.intelMarketRenderer.render(marketContentEl);
                    }
                }
                // --- END VIRTUAL WORKBENCH ---
                break;
        }
    }

    /**
     * Surgically updates the Hangar screen for smooth transitions without a full re-render.
     * @param {object} gameState The current game state.
     * @private
     */
    _updateHangarScreen(gameState) {
        const { uiState } = gameState;
        const hangarScreenEl = this.cache.hangarScreen;
        if (!hangarScreenEl) return;

        const carousel = hangarScreenEl.querySelector('#hangar-carousel');
        if (!carousel) return;

        const isHangarMode = uiState.hangarShipyardToggleState === 'hangar';
        const activeIndex = isHangarMode ? (uiState.hangarActiveIndex || 0) : (uiState.shipyardActiveIndex || 0);

        // Update carousel position
        carousel.style.transform = `translateX(-${activeIndex * 100}%)`;

        // RENDER VIRTUAL PAGINATION
        this._renderHangarPagination(gameState);

        // Scroll the pagination container to center the active dot
        const paginationWrapper = hangarScreenEl.querySelector('#hangar-pagination-wrapper');
        const activeDot = hangarScreenEl.querySelector('.pagination-dot.active');

        if (paginationWrapper && activeDot) {
            const wrapperWidth = paginationWrapper.clientWidth;
            const dotOffsetLeft = activeDot.offsetLeft;
            const dotWidth = activeDot.offsetWidth;

            // Calculate the target scroll position to center the active dot
            const scrollLeft = dotOffsetLeft - (wrapperWidth / 2) + (dotWidth / 2);

            paginationWrapper.scrollTo({
                left: scrollLeft,
                behavior: 'smooth'
            });
        }
    }

    /**
     * Renders the virtualized pagination for the hangar/shipyard screen.
     * It shows a maximum of 6 full dots and up to 2 half-dots as indicators for more items.
     * @param {object} gameState The current game state.
     * @private
     */
    _renderHangarPagination(gameState) {
        const { uiState, player, currentLocationId } = gameState;
        const hangarScreenEl = this.cache.hangarScreen;
        if (!hangarScreenEl) return;

        const paginationContainer = hangarScreenEl.querySelector('#hangar-pagination');
        if (!paginationContainer) return;

        const isHangarMode = uiState.hangarShipyardToggleState === 'hangar';
        const shipList = isHangarMode ? player.ownedShipIds : this.simulationService._getShipyardInventory().map(([id]) => id);
        const totalItems = shipList.length;

        // Hide pagination if there is only one or zero ships.
        if (totalItems <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        const activeIndex = isHangarMode ? (uiState.hangarActiveIndex || 0) : (uiState.shipyardActiveIndex || 0);

        const location = DB.MARKETS.find(l => l.id === currentLocationId);
        const theme = location?.navTheme || { borderColor: '#7a9ac0' };

        const VISIBLE_FULL_DOTS = 6;
        let dots = [];

        if (totalItems <= VISIBLE_FULL_DOTS + 1) { // If 7 or fewer items, show all as full dots
            for (let i = 0; i < totalItems; i++) {
                dots.push({ index: i, isActive: i === activeIndex, isHalf: false });
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

            // Add previous indicator if needed
            if (start > 0) {
                dots.push({ isHalf: true, jump: 'prev' });
            }

            // Add the main window of full dots
            for (let i = start; i < end; i++) {
                dots.push({ index: i, isActive: i === activeIndex, isHalf: false });
            }

            // Add next indicator if needed
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
                return `<div class="pagination-dot ${dot.isActive ? 'active' : ''}" style="${style}" data-action="${ACTION_IDS.SET_HANGAR_PAGE}" data-index="${dot.index}"></div>`;
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
        
        // --- [[START]] MODIFICATION ---
        // Changed '.scroll-panel' to '.market-scroll-panel' to match MarketScreen.js
        const marketScrollPanel = this.cache.marketScreen.querySelector('.market-scroll-panel'); 
        // --- [[END]] MODIFICATION ---

        if (this.lastKnownState && this.lastKnownState.activeScreen === SCREEN_IDS.MARKET && this.lastKnownState.currentLocationId === gameState.currentLocationId && marketScrollPanel) {
            this.marketScrollPosition = marketScrollPanel.scrollTop;
        } else {
            this.marketScrollPosition = 0;
        }
    
        this._saveMarketTransactionState();
        this.cache.marketScreen.innerHTML = renderMarketScreen(gameState, this.isMobile, this.getItemPrice, this.marketTransactionState);
        this._restoreMarketTransactionState();
        
        // --- [[START]] MODIFICATION ---
        // Changed '.scroll-panel' to '.market-scroll-panel' to match MarketScreen.js
        const newMarketScrollPanel = this.cache.marketScreen.querySelector('.market-scroll-panel');
        // --- [[END]] MODIFICATION ---

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
                    // After restoring state, immediately update the display to reflect it.
                    this.updateMarketCardDisplay(goodId, parseInt(state.quantity, 10) || 0, state.mode);
                }
            }
        }
    }

    getItemPrice(gameState, goodId, isSelling = false) {
        // --- VIRTUAL WORKBENCH: USE INTEL-AWARE GETPRICE ---
        // Use the simulationService (which now points to MarketService's getPrice)
        // to ensure intel overrides are checked.
        if (!this.simulationService || !this.simulationService.marketService) {
            // Fallback for early load
            return gameState.market.prices[gameState.currentLocationId]?.[goodId] || 0;
        }
        
        // Note: The isSelling logic for specialDemand is handled inside the
        // UIManager's _calculateSaleDetails, not here.
        // This function just needs to get the *base* price, which
        // MarketService.getPrice() now does (checking for intel overrides).
        return this.simulationService.marketService.getPrice(gameState.currentLocationId, goodId);
        // --- END VIRTUAL WORKBENCH ---
    }

    _calculateSaleDetails(goodId, quantity) {
        const state = this.lastKnownState;
        if (!state) return { totalPrice: 0, effectivePricePerUnit: 0, netProfit: 0 };

        const good = DB.COMMODITIES.find(c => c.id === goodId);
        const marketStock = state.market.inventory[state.currentLocationId][goodId].quantity;
        
        // --- VIRTUAL WORKBENCH: USE INTEL-AWARE GETPRICE ---
        // Pass `true` for isSelling to get the correct base price
        const basePrice = this.getItemPrice(state, goodId, true);
        // --- END VIRTUAL WORKBENCH ---

        const playerItem = state.player.inventories[state.player.activeShipId]?.[goodId];
        const avgCost = playerItem?.avgCost || 0;

        // Guard against division by zero if market stock is depleted.
        if (marketStock <= 0) {
            return { totalPrice: 0, effectivePricePerUnit: 0, netProfit: 0 };
        }

        const threshold = marketStock * 0.1;
        if (quantity <= threshold) {
            const totalPrice = basePrice * quantity;
            const totalCost = avgCost * quantity;
            let netProfit = totalPrice - totalCost;
            if (netProfit > 0) {
                let totalBonus = (state.player.activePerks[PERK_IDS.TRADEMASTER] ? DB.PERKS[PERK_IDS.TRADEMASTER].profitBonus : 0) + (state.player.birthdayProfitBonus || 0);
                netProfit += netProfit * totalBonus;
            }
            return { totalPrice, effectivePricePerUnit: basePrice, netProfit };
        }

        const excessRatio = quantity / marketStock;
        let reduction = 0;

        if (good.tier <= 2) {
            reduction = Math.min(0.10, (excessRatio - 0.1) * 0.2);
        } else if (good.tier <= 5) {
            reduction = Math.min(0.25, (excessRatio - 0.1) * 0.5);
        } else {
            reduction = Math.min(0.40, (excessRatio - 0.1) * 0.8);
        }

        const effectivePrice = basePrice * (1 - reduction);
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
                // --- VIRTUAL WORKBENCH: USE INTEL-AWARE GETPRICE ---
                sellPrice: this.getItemPrice(state, goodId, true),
                // --- END VIRTUAL WORKBENCH ---
                galacticAvg: state.market.galacticAverages[goodId],
                playerItem: playerItem
            });

        } else { // 'sell' mode
            const { effectivePricePerUnit, netProfit } = this._calculateSaleDetails(goodId, quantity);

            if (quantity > 0) {
                let profitText = `⌬ ${netProfit >= 0 ? '+' : ''}${formatCredits(netProfit, false)}`;
                priceEl.textContent = profitText;
                effectivePriceEl.textContent = `(${formatCredits(effectivePricePerUnit, false)}/unit)`;
                priceEl.className = `font-roboto-mono font-bold ${netProfit >= 0 ? 'profit-text' : 'loss-text'}`;
            } else {
                priceEl.textContent = '⌬ +0';
                priceEl.className = 'font-roboto-mono font-bold profit-text';
                effectivePriceEl.textContent = '';
            }

            indicatorEl.innerHTML = renderIndicatorPills({
                price: basePrice,
                // --- VIRTUAL WORKBENCH: USE INTEL-AWARE GETPRICE ---
                sellPrice: effectivePricePerUnit || this.getItemPrice(state, goodId, true),
                // --- END VIRTUAL WORKBENCH ---
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
        
        // --- VIRTUAL WORKBENCH: GDD MODAL THEMING ---
        // Apply theme data attribute for CSS-based theming (e.g., glowing borders)
        if (options.theme) {
            modal.dataset.theme = options.theme;
        } else {
            // Remove old theme to avoid stale borders
            delete modal.dataset.theme;
        }
        
        // GDD: Control dismissal behavior
        modal.dataset.dismissInside = options.dismissInside || 'false';
        modal.dataset.dismissOutside = options.dismissOutside || 'false';
        // --- END VIRTUAL WORKBENCH ---

        const titleElId = modalId === 'mission-modal' ? 'mission-modal-title' : modalId.replace('-modal', '-title');
        const descElId = modalId === 'mission-modal' ? 'mission-modal-description' : modalId.replace('-modal', '-description');
        const titleEl = modal.querySelector(`#${titleElId}`);
        const descEl = modal.querySelector(`#${descElId}`) || modal.querySelector(`#${modalId.replace('-modal', '-scenario')}`);

        if (titleEl) titleEl.innerHTML = title;
        if (descEl) {
            descEl.innerHTML = description;
            descEl.className = 'my-4 text-gray-300'; // Reset classes

            if (modalId !== 'mission-modal') {
                descEl.classList.add('mb-6', 'text-lg');
            }

            // Default to centered text for generic event modals, which are mostly short notices.
            if (modalId === 'event-modal' || modalId === 'random-event-modal') {
                descEl.classList.add('text-center');
            }

            if (options.contentClass) {
                // Allow `contentClass` to override the default alignment.
                if (options.contentClass.includes('text-left') || options.contentClass.includes('text-right') || options.contentClass.includes('text-justify')) {
                    descEl.classList.remove('text-center');
                }
                // Add all provided custom classes.
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
            
            // --- VIRTUAL WORKBENCH: GDD FOOTER LOGIC ---
            if (options.footer) {
                // If a custom footer is provided, inject it and attach handlers
                if (btnContainer) {
                    btnContainer.innerHTML = options.footer;
                    // Find any buttons *inside* the new footer and attach close/callback logic
                    btnContainer.querySelectorAll('button[data-action]').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            // Let the main EventManager handle the action first
                            // But also ensure the modal closes
                            closeHandler();
                        });
                    });
                }
            } else if (options.footer === null) {
                // GDD: Explicitly no footer/buttons
                if (btnContainer) btnContainer.innerHTML = '';
            } else {
            // --- END VIRTUAL WORKBENCH ---
                // Original default button logic
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
            // --- VIRTUAL WORKBENCH ---
            }
            // --- END VIRTUAL WORKBENCH ---
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

        const contentHtml = LORE_CONTENT[loreId];
        if (!contentHtml) {
            this.logger.error('UIManager', `No lore content found for ID: ${loreId}`);
            contentEl.innerHTML = '<p>Error: Lore content not found.</p>';
        } else {
            contentEl.innerHTML = contentHtml;
        }
        
        // Ensure scroll position is at the top
        contentEl.scrollTop = 0;

        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
        // Add a one-time click listener to the backdrop *and* content area to close the modal.
        const closeHandler = (e) => {
            if (e.target.closest('#lore-modal-content') || e.target.id === 'lore-modal') {
                this.hideModal('lore-modal');
                modal.removeEventListener('click', closeHandler);
            }
        };
        modal.addEventListener('click', closeHandler);
    }

    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal && !modal.classList.contains('hidden')) {
            modal.classList.add('modal-hiding');
            modal.addEventListener('animationend', () => {
                modal.classList.add('hidden');
                modal.classList.remove('modal-hiding', 'modal-visible', 'dismiss-disabled', 'intro-fade-in');
                
                // --- VIRTUAL WORKBENCH: CLEANUP GDD ATTRIBUTES ---
                delete modal.dataset.theme;
                delete modal.dataset.dismissInside;
                delete modal.dataset.dismissOutside;
                // --- END VIRTUAL WORKBENCH ---

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
        let leftPos = rect.right + 10;
        let topPos = rect.top + (rect.height / 2) - (tooltipHeight / 2);

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

        const getX = i => (i / (history.length - 1)) * (width - padding * 2) + padding;
        const getY = v => height - padding - ((v - minVal) / valueRange) * (height - padding * 2.5);

        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0c101d" />`;
        svg += `<g class="grid-lines" stroke="#1f2937" stroke-width="1">`;
        svg += `<line x1="${padding}" y1="${getY(maxVal)}" x2="${padding}" y2="${height - padding}" /><line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" />`;
        svg += `</g>`;

        const staticAvgY = getY(staticAvg);
        svg += `<line x1="${padding}" y1="${staticAvgY}" x2="${width - padding}" y2="${staticAvgY}" stroke="#facc15" stroke-width="1" stroke-dasharray="3 3" />`;
        svg += `<text x="${width - padding + 4}" y="${staticAvgY + 3}" fill="#facc15" font-size="10" font-family="Roboto Mono" text-anchor="start">Avg: ${formatCredits(staticAvg, false)}</text>`;

        if (playerBuyPrice) {
            const buyPriceY = getY(playerBuyPrice);
            svg += `<line x1="${padding}" y1="${buyPriceY}" x2="${width - padding}" y2="${buyPriceY}" stroke="#34d399" stroke-width="1" stroke-dasharray="3 3" />`;
            svg += `<text x="${width - padding + 4}" y="${buyPriceY + 3}" fill="#34d399" font-size="10" font-family="Roboto Mono" text-anchor="start">Paid: ${formatCredits(playerBuyPrice, false)}</text>`;
        }

        const pricePoints = history.map((p, i) => `${getX(i)},${getY(p.price)}`).join(' ');
        svg += `<polyline fill="none" stroke="#60a5fa" stroke-width="2" points="${pricePoints}" />`;

        const firstDay = history[0].day;
        const lastDay = history[history.length - 1].day;
        svg += `<text x="${padding}" y="${height - padding + 15}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="start">Day ${firstDay}</text>`;
        svg += `<text x="${width - padding}" y="${height - padding + 15}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">Day ${lastDay}</text>`;
        svg += `<text x="${padding - 8}" y="${getY(minVal) + 3}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">${formatCredits(minVal, false)}</text>`;
        svg += `<text x="${padding - 8}" y="${getY(maxVal) + 3}" fill="#9ca3af" font-size="10" font-family="Roboto Mono" text-anchor="end">${formatCredits(maxVal, false)}</text>`;
        svg += `</svg>`;
        return svg;
    }

    /**
     * Displays and positions the tutorial toast. Uses either percentage-based positioning
     * relative to an overlay or Popper.js for element anchoring.
     * @param {object} options - Configuration for the toast.
     * @param {object} options.step - The tutorial step data.
     * @param {function} options.onSkip - Callback for skip.
     * @param {function} options.onNext - Callback for next.
     * @param {object} options.gameState - The current game state.
     */
    showTutorialToast({ step, onSkip, onNext, gameState }) {
        const toast = this.cache.tutorialToastContainer;
        const arrow = toast.querySelector('#tt-arrow');
        // Use the new overlay if anchor is 'body', otherwise find the element
        const isOverlayAnchor = step.anchorElement === 'body';
        let referenceEl;
        
        if (isOverlayAnchor) {
            referenceEl = this.cache.tutorialAnchorOverlay; // Use the dedicated overlay
        } else {
            referenceEl = document.querySelector(step.anchorElement);
            if (!referenceEl) {
                this.logger.error('TutorialService', `Anchor element "${step.anchorElement}" not found for step "${step.stepId}". Defaulting to overlay.`);
                referenceEl = this.cache.tutorialAnchorOverlay; // Fallback to overlay
                 // TODO: Decide if we should force isOverlayAnchor = true here?
            }
        }
        
        // Cleanup existing Popper instance if any
        if (this.popperInstance) {
            this.popperInstance.destroy();
            this.popperInstance = null;
        }

        // --- Update Content ---
        let processedText = step.text;
        // b. Fix {shipName} replacement
        if (processedText.includes('{shipName}')) {
            const activeShipId = gameState.player.activeShipId;
            const shipName = activeShipId ? DB.SHIPS[activeShipId].name : 'your ship'; // Fallback
            processedText = processedText.replace(/{shipName}/g, shipName);
        }

        // c. Fix {playerName} replacement
        if (processedText.includes('{playerName}')) {
            const playerName = gameState.player.name || 'Captain'; // Fallback
            processedText = processedText.replace(/{playerName}/g, playerName);
        }

        this.cache.tutorialToastText.innerHTML = processedText;

        // --- Apply Size ---
        const initialWidth = step.size?.width || 'auto';
        const initialHeight = step.size?.height || 'auto';
        toast.style.width = initialWidth;
        toast.style.height = initialHeight;
        
        // --- Apply Position ---
        if (isOverlayAnchor) {
            // Percentage-based positioning
            const posX = step.positionX ?? 50; // Default to center
            const posY = step.positionY ?? 50; // Default to center
            toast.style.left = `${posX}%`;
            toast.style.top = `${posY}%`;
            // Ensure Popper-related styles/attributes are cleared/reset if switching modes
            toast.style.transform = 'translate(-50%, -50%)'; // Center element on the % point
            arrow.style.display = 'none'; // No arrow for overlay anchor
            toast.removeAttribute('data-popper-placement'); 
            
            // Note: No Popper instance created in this mode
        } else {
            // Element-anchored positioning using Popper.js
            toast.style.left = ''; // Clear direct styles
            toast.style.top = ''; 
            toast.style.transform = ''; // Clear direct transform
            
            arrow.style.display = 'block'; // Show arrow

            // Configure Popper.js
            const defaultOptions = { /* ... Popper defaults for element anchor ... */ 
                placement: 'auto',
                modifiers: [
                    { name: 'offset', options: { offset: [0, 10] } }, // Standard distance
                    { name: 'preventOverflow', options: { padding: { top: 60, bottom: 60, left: 10, right: 10 } } },
                    { name: 'flip', options: { fallbackPlacements: ['top', 'bottom', 'left', 'right'] } },
                    { name: 'arrow', options: { element: '#tt-arrow', padding: 5 } }
                ]
            };
            
             // Merge step-specific Popper options/modifiers
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

            // Create Popper instance
            this.popperInstance = Popper.createPopper(referenceEl, toast, finalOptions);
        }

        // --- Show Toast & Configure Buttons ---
        toast.classList.remove('hidden');
        const isInfoStep = step.completion.type === 'INFO';
        this.cache.tutorialToastNextBtn.classList.toggle('hidden', !isInfoStep);
        if (isInfoStep) {
            this.cache.tutorialToastNextBtn.onclick = onNext;
        }
        const showSkipButton = false; // Configure as needed
        this.cache.tutorialToastSkipBtn.style.display = showSkipButton ? 'block' : 'none';
        this.cache.tutorialToastSkipBtn.onclick = onSkip;
        this.cache.tutorialToastText.scrollTop = 0;
        
        // --- Notify DebugService ---
        if (this.debugService) {
            this.debugService.setActiveTutorialStep(step); // Pass the raw step data
        }
    }


    /**
     * Hides the tutorial toast and destroys the associated Popper.js instance.
     */
    hideTutorialToast() {
        this.cache.tutorialToastContainer.classList.add('hidden');
        if (this.popperInstance) {
            this.popperInstance.destroy();
            this.popperInstance = null;
        }
        this.applyTutorialHighlight(null);
        
        // Notify DebugService
        if (this.debugService) {
            this.debugService.clearActiveTutorialStep();
        }
    }

    /**
     * Updates the active tutorial toast position and size in real-time based on debug controls.
     * Handles both percentage-based and Popper-based positioning.
     * @param {object} newOptions - Options from DebugService._handleTutorialTune
     * @param {boolean} newOptions.isOverlayAnchor - True if using percentage positioning.
     * @param {number} newOptions.width - New width (0 for 'auto').
     * @param {number} newOptions.height - New height (0 for 'auto').
     * @param {number} newOptions.percentX - New X percentage (0-100).
     * @param {number} newOptions.percentY - New Y percentage (0-100).
     * @param {string} newOptions.placement - New Popper placement.
     * @param {number} newOptions.distance - New Popper offset distance.
     * @param {number} newOptions.skidding - New Popper offset skidding.
     }
     */
    updateTutorialPopper(newOptions) {
        const toast = this.cache.tutorialToastContainer;
        const arrow = toast.querySelector('#tt-arrow');
        const { isOverlayAnchor, width, height, percentX, percentY, placement, distance, skidding } = newOptions;

        // --- Apply Size (Common) ---
        // Apply size *first* so calculations are based on the new dimensions
        toast.style.width = width > 0 ? `${width}px` : 'auto';
        toast.style.height = height > 0 ? `${height}px` : 'auto';

        // --- Apply Position (Conditional) ---
        if (isOverlayAnchor) {
            // Using Percentage Positioning
            
            // Destroy Popper instance if it exists (switching modes)
            if (this.popperInstance) {
                this.popperInstance.destroy();
                this.popperInstance = null;
                 toast.removeAttribute('data-popper-placement'); 
                 toast.style.transform = ''; // Clear Popper transform
            }
            
            // Apply direct percentage styles
            toast.style.left = `${percentX}%`;
            toast.style.top = `${percentY}%`;
            toast.style.transform = 'translate(-50%, -50%)'; // Re-apply centering transform
            arrow.style.display = 'none';

        } else {
            // Using Popper.js Positioning
            toast.style.left = ''; // Clear direct styles
            toast.style.top = ''; 
            toast.style.transform = ''; // Clear direct transform (Popper will add its own)
            arrow.style.display = 'block';

            const popperUpdateOptions = {
                placement: placement,
                modifiers: [
                    { name: 'offset', options: { offset: [skidding, distance] } },
                    // Re-apply other essential modifiers for element anchoring
                    { name: 'preventOverflow', options: { padding: { top: 60, bottom: 60, left: 10, right: 10 } } },
                    { name: 'flip', options: { fallbackPlacements: ['top', 'bottom', 'left', 'right'] } },
                    { name: 'arrow', options: { element: '#tt-arrow', padding: 5 } }
                ]
            };

            if (this.popperInstance) {
                 // Update existing instance
                 this.popperInstance.setOptions(popperUpdateOptions).catch(e => {
                     this.logger.error('UIManager', 'Error updating Popper options:', e);
                 });
            } else {
                 // Need to create Popper instance if switching modes or first time
                 // This requires the original reference element, which isn't passed here.
                 // Ideally, the DebugService should trigger a full `showTutorialToast`
                 // when the anchor *type* changes, rather than just `updateTutorialPopper`.
                 // For now, we'll log a warning.
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

        overlay.innerHTML = ''; // Clear previous highlights
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
            // Apply dynamic styles to the animated child, not the parent container
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
            const salePrice = Math.floor(shipStatic.price * GAME_RULES.SHIP_SELL_MODIFIER);
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

        // If travel isn't possible from the current location, do nothing.
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

        // Two-step render for the glow
        requestAnimationFrame(() => {
            modal.classList.add('modal-visible');
            const wrapper = modal.querySelector('.launch-modal-wrapper');
            if (wrapper) {
                requestAnimationFrame(() => {
                    wrapper.classList.add('is-glowing');
                });
            }
        });

        // Add a one-time click listener to the backdrop to close the modal.
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

        const modal = this.cache.cargoDetailModal;
        const modalContent = this.cache.cargoDetailContent;

        modalContent.innerHTML = _renderMaxCargoModal(good, item);
        modal.classList.remove('hidden');
        modal.classList.add('modal-visible');
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
        const progressEl = this.cache.stickyObjectiveProgress;
        if (progressEl) {
            progressEl.classList.add('objective-progress-flash');
            setTimeout(() => {
                progressEl.classList.remove('objective-progress-flash');
            }, 700);
        }
    }

    // --- New DOM Abstraction Methods ---
    getModalIdFromEvent(e) {
        const modalBackdrop = e.target.closest('.modal-backdrop');
        if (!modalBackdrop || !modalBackdrop.id || modalBackdrop.classList.contains('dismiss-disabled')) {
            return null;
        }

        // --- VIRTUAL WORKBENCH: GDD DISMISSAL LOGIC ---
        const dismissInside = modalBackdrop.dataset.dismissInside === 'true';
        const dismissOutside = modalBackdrop.dataset.dismissOutside === 'true';
        
        const isBackdropClick = !e.target.closest('.modal-content');
        const isContentClick = e.target.closest('.modal-content');

        if ((dismissOutside && isBackdropClick) || (dismissInside && isContentClick)) {
             // Special case: Allow lore-modal to be dismissed by clicking content
            if (modalBackdrop.id === 'lore-modal' && e.target.closest('#lore-modal-content')) {
                 return modalBackdrop.id;
            }
            // Standard dismissal (backdrop click only)
            if (modalBackdrop.id !== 'lore-modal' && !e.target.closest('.modal-content')) {
                return modalBackdrop.id;
            }
             // Standard dismissal for lore-modal (backdrop click only)
            if (modalBackdrop.id === 'lore-modal' && !e.target.closest('.modal-content')) {
                return modalBackdrop.id;
            }

            // GDD-compliant dismissal
            return modalBackdrop.id;
        }
        // --- END VIRTUAL WORKBENCH ---

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

        // Set height immediately on show
        this._setAppHeight();

        // Set height again on the next animation frame to catch the final, stable value
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
        // --- VIRTUAL WORKBENCH: GDD MODAL THEME ---
        // Use the data-theme attribute for CSS-based glowing borders
        modal.dataset.theme = locationId;
        // --- END VIRTUAL WORKBENCH ---


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

        // *** MODIFIED HTML Structure to apply theme color ***
        const contentHtml = `
            <div class="text-center">
                <h3 class="text-3xl font-orbitron" style="color: ${theme.textColor};">${location.name}</h3>
                <p class="text-lg italic imprinted-text">${location.launchFlavor}</p>
            </div>

            <div class="my-4 space-y-3">
                <div class="map-intel-block">
                    <h5 class="font-bold imprinted-text" style="color: ${theme.textColor}; opacity: 0.7;">Fuel</h5>
                    <p class="font-roboto-mono imprinted-text-embedded" style="color: ${theme.textColor};">${formatCredits(location.fuelPrice, true)}/unit</p>
                </div>
                <div class="map-intel-block">
                    <h5 class="font-bold imprinted-text" style="color: ${theme.textColor}; opacity: 0.7;">Station Details</h5>
                    <p class="font-roboto-mono imprinted-text-embedded" style="color: ${theme.textColor};">${location.specialty || 'None reported'}</p>
                </div>
            </div>

            <div class="text-center">
                <div>
                    <h5 class="font-bold imprinted-text">Exports:</h5>
                    <div>${exports.length > 0 ? renderTags(exports) : '<span class="text-gray-400">CLASSIFIED</span>'}</div>
                </div>
                <div class="mt-2">
                    <h5 class="font-bold imprinted-text">Needs:</h5>
                    <div>${imports.length > 0 ? renderTags(imports) : '<span class="text-gray-400">CLASSIFIED</span>'}</div>
                </div>
            </div>
        `;

        contentContainer.innerHTML = contentHtml;
        modal.classList.remove('hidden');
        modal.classList.remove('is-glowing');

        // Use requestAnimationFrame to ensure the browser has rendered the modal
        // before we add the class that triggers the animation.
        requestAnimationFrame(() => {
            modal.classList.add('modal-visible');
            modal.classList.add('is-glowing');
        });

        // *** MODIFIED: Combined backdrop and content click listeners ***
        const closeHandler = (e) => {
            // Close if clicking the backdrop OR the content area
            if (e.target.id === 'map-detail-modal' || e.target.closest('.modal-content')) {
                this.hideMapDetailModal();
                modal.removeEventListener('click', closeHandler); // Ensure listener is removed
            }
        };
        // Add the listener *after* the modal is made visible
        requestAnimationFrame(() => {
             modal.addEventListener('click', closeHandler);
        });
    }


    hideMapDetailModal() {
        const modal = this.cache.mapDetailModal;
        if (modal) {
            modal.classList.remove('is-glowing');
            // --- VIRTUAL WORKBENCH: GDD MODAL THEME ---
            delete modal.dataset.theme; // Clear theme on close
            // --- END VIRTUAL WORKBENCH ---
            // Remove the specific click listener if it exists
            const existingHandler = modal.__mapDetailCloseHandler; 
            if(existingHandler) {
                modal.removeEventListener('click', existingHandler);
                delete modal.__mapDetailCloseHandler;
            }
        }
        this.hideModal('map-detail-modal');
    }

    // --- VIRTUAL WORKBENCH: ADD INTEL HANDLERS ---

    /**
     * Handles switching tabs on the Intel screen.
     * @param {HTMLElement} element - The clicked tab button.
     * @JSDoc
     */
    handleSetIntelTab(element) {
        const targetId = element.dataset.target;
        if (!targetId) return;

        const screen = element.closest('.active-screen');
        if (!screen) return;

        // Deactivate all tabs and content
        screen.querySelectorAll('.sub-nav-button').forEach(btn => btn.classList.remove('active'));
        screen.querySelectorAll('.intel-tab-content').forEach(content => content.classList.remove('active'));

        // Activate the clicked tab and corresponding content
        element.classList.add('active');
        const targetContent = screen.querySelector(`#${targetId}`);
        if (targetContent) {
            targetContent.classList.add('active');
            
            // If we are switching to the market tab, re-render its contents
            if (targetId === 'intel-market-content' && this.intelMarketRenderer) {
                this.intelMarketRenderer.render(targetContent);
            }
        }
    }

    /**
     * Finds the specified intel packet from the game state.
     * @param {string} packetId 
     * @param {string} locationId 
     * @returns {object | null} The packet object or null if not found.
     * @private
     */
    _findIntelPacket(packetId, locationId) {
        const state = this.gameState.getState();
        if (!state.intelMarket[locationId]) {
            this.logger.error('UIManager', `_findIntelPacket: No intelMarket for location ${locationId}`);
            return null;
        }
        const packet = state.intelMarket[locationId].find(p => p.id === packetId);
        if (!packet) {
            this.logger.error('UIManager', `_findIntelPacket: Could not find packet ${packetId} at ${locationId}`);
            return null;
        }
        return packet;
    }

    /**
     * Formats an intel "details" string, replacing all GDD placeholders.
     * @param {string} template - The template string from INTEL_CONTENT.
     * @param {object} packet - The intelPacket object.
     * @param {number} price - The calculated price.
     * @returns {string} The formatted, player-facing string.
     * @private
     * @JSDoc
     */
    _formatIntelDetails(template, packet, price) {
        const locationName = DB.MARKETS.find(m => m.id === packet.locationId)?.name || 'an unknown location';
        const commodityName = DB.COMMODITIES.find(c => c.id === packet.commodityId)?.name || 'a mystery commodity';
        const discountStr = `${Math.floor(packet.discountPercent * 100)}%`;
        const priceStr = `${price.toLocaleString()} ⌬`;

        return template
            .replace(/\[location name\]/g, locationName)
            .replace(/\[commodity name\]/g, commodityName)
            .replace(/\[discount amount %\]/g, discountStr)
            .replace(/\[durationDays\]/g, packet.durationDays)
            .replace(/\[⌬ credit price\]/g, priceStr);
    }

    /**
     * Shows the "Sample" modal (the offer) for an intel packet.
     * @param {HTMLElement} element - The clicked button element.
     * @JSDoc
     */
    handleShowIntelOffer(element) {
        const { packetId, locationId, price } = element.dataset;
        const packet = this._findIntelPacket(packetId, locationId);
        if (!packet) return;

        const locationName = DB.MARKETS.find(m => m.id === locationId)?.name || 'this location';
        const vagueText = (INTEL_CONTENT[packet.messageKey]?.sample || "Intel available at [location name].")
            .replace('[location name]', locationName);
        
        const priceNum = parseInt(price, 10);
        const purchaseButtonHTML = `
            <button class="btn btn-intel-buy" 
                    data-action="buy_intel" 
                    data-packet-id="${packet.id}" 
                    data-location-id="${locationId}" 
                    data-price="${priceNum}">
                Purchase Intel (${priceNum.toLocaleString()} ⌬)
            </button>`;

        this.queueModal('event-modal', 'Intel Offer', vagueText, null, {
            theme: locationId, // GDD: Apply location-specific theme
            dismissOutside: true, // GDD: Allow dismissing outside
            footer: purchaseButtonHTML // GDD: Use custom footer
        });
    }

    /**
     * Handles the "buy_intel" action, calls the service, and shows the "Details" modal on success.
     * @param {HTMLElement} element - The clicked "Purchase Intel" button.
     * @JSDoc
     */
    handleBuyIntel(element) {
        const { packetId, locationId, price } = element.dataset;
        const priceNum = parseInt(price, 10);

        // Call the service to perform the transaction
        const purchasedPacket = this.intelService.purchaseIntel(packetId, locationId, priceNum);

        if (purchasedPacket) {
            // GDD: On success, immediately close "Sample" modal and open "Details" modal
            this.hideModal('event-modal'); // Close the sample modal
            
            // Re-find the packet from the *new* state to ensure we have the purchased copy
            const updatedPacket = this._findIntelPacket(packetId, locationId);
            if (updatedPacket) {
                this._showIntelDetailsModal(updatedPacket, priceNum, locationId);
            }

            // GDD: Rerender the screen to update button states (e.g., to "View Intel" and disabled)
            const intelScreen = document.getElementById('intel-screen');
            const marketContentEl = intelScreen?.querySelector('#intel-market-content');
            if (marketContentEl && this.intelMarketRenderer) {
                this.intelMarketRenderer.render(marketContentEl);
            }
        } else {
            // Purchase failed (e.g., already active deal, not enough credits)
            // The service will log the error. We can optionally show a UI error here.
            this.hideModal('event-modal');
            this.queueModal('event-modal', 'Purchase Failed', 'Unable to purchase intel. You may already have an active deal or insufficient credits.');
        }
    }

    /**
     * Shows the "Details" modal for a purchased packet.
     * @param {HTMLElement} element - The clicked "View Intel" button.
     * @JSDoc
     */
    handleShowIntelDetails(element) {
        const { packetId, locationId } = element.dataset;
        const packet = this._findIntelPacket(packetId, locationId);
        if (!packet) return;

        // Price wasn't passed, but we need it for the text. Re-calculate it.
        // This is okay, as it's just for display and not for a transaction.
        const price = this.intelService.calculateIntelPrice(packet);

        this._showIntelDetailsModal(packet, price, locationId);
    }

    /**
     * Private helper to show the "Details" modal.
     * @param {object} packet - The intelPacket object.
     * @param {number} price - The price (either from purchase or re-calculated).
     * @param {string} locationId - The locationId for theming.
     * @private
     * @JSDoc
     */
    _showIntelDetailsModal(packet, price, locationId) {
        const detailsTemplate = INTEL_CONTENT[packet.messageKey]?.details || "No details found.";
        const formattedDetails = this._formatIntelDetails(detailsTemplate, packet, price);

        this.queueModal('event-modal', 'Intel Unlocked', formattedDetails, null, {
            theme: locationId, // GDD: Apply location-specific theme
            dismissInside: true, // GDD: Dismiss on *any* click
            dismissOutside: true,
            footer: null, // GDD: No buttons
            contentClass: 'text-left' // GDD: Details are paragraphs
        });
    }

    // --- END VIRTUAL WORKBENCH ---

    // MODIFIED: Removed obsolete _bindScreenSpecificEvents method
}