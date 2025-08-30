// js/services/UIManager.js
import { DB } from '../data/database.js';
import { formatCredits, calculateInventoryUsed, getDateFromDay } from '../utils.js';
import { SCREEN_IDS, NAV_IDS, ACTION_IDS, GAME_RULES, PERK_IDS, LOCATION_IDS, SHIP_IDS, COMMODITY_IDS } from '../data/constants.js';

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
        this.activeStatusTooltipAnchor = null;
        this.lastActiveScreenEl = null;
        this.lastKnownState = null;
        this.missionService = null; // To be injected
        this.marketTransactionState = {}; // To store quantity and mode

        this.navStructure = {
            [NAV_IDS.SHIP]: { label: 'Ship', screens: { [SCREEN_IDS.STATUS]: 'Status', [SCREEN_IDS.NAVIGATION]: 'Navigation', [SCREEN_IDS.CARGO]: 'Cargo' } },
            [NAV_IDS.STARPORT]: { label: 'Starport', screens: { [SCREEN_IDS.MARKET]: 'Market', [SCREEN_IDS.SERVICES]: 'Services', [SCREEN_IDS.HANGAR]: 'Hangar' } },
            [NAV_IDS.ADMIN]: { label: 'Admin', screens: { [SCREEN_IDS.FINANCE]: 'Finance', [SCREEN_IDS.INTEL]: 'Intel', [SCREEN_IDS.MISSIONS]: 'Missions' } }
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
     * @param {import('./MissionService.js').MissionService} missionService
     */
    setMissionService(missionService) {
        this.missionService = missionService;
    }

    _cacheDOM() {
        this.cache = {
            gameContainer: document.getElementById('game-container'),
            topBarContainer: document.getElementById('top-bar-container'),
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
            graphTooltip: document.getElementById('graph-tooltip'),
            genericTooltip: document.getElementById('generic-tooltip'),
            statusTooltip: document.getElementById('status-tooltip'),
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
        this.renderStickyBar(gameState);
    }

    renderNavigation(gameState) {
        const { activeNav, activeScreen, player, currentLocationId, tutorials } = gameState;
        const { navLock } = tutorials;
        const location = DB.MARKETS.find(l => l.id === currentLocationId);
        const shipStatic = player.activeShipId ? DB.SHIPS[player.activeShipId] : null;
        const shipState = player.activeShipId ? player.shipStates[player.activeShipId] : null;

        const themeClass = location ? `theme-${location.id.replace('loc_', '')}` : 'theme-luna';

        let statusPodHtml = '';
        if (shipStatic && shipState) {
            const cargoUsed = calculateInventoryUsed(player.inventories[player.activeShipId]);
            const hullPct = (shipState.health / shipStatic.maxHealth) * 100;
            const fuelPct = (shipState.fuel / shipStatic.maxFuel) * 100;
            const cargoPct = (cargoUsed / shipStatic.cargoCapacity) * 100;

            statusPodHtml = `
                <div class="status-pod">
                    <div class="status-bar-group" data-action="toggle-tooltip" data-tooltip="${Math.floor(shipState.health)}% Hull Integrity">
                        <span class="status-bar-label">H</span>
                        <div class="status-bar"><div class="fill hull-fill" style="width: ${hullPct}%;"></div></div>
                    </div>
                    <div class="status-bar-group" data-action="toggle-tooltip" data-tooltip="${Math.floor(shipState.fuel)}/${shipStatic.maxFuel} Fuel">
                        <span class="status-bar-label">F</span>
                        <div class="status-bar"><div class="fill fuel-fill" style="width: ${fuelPct}%;"></div></div>
                    </div>
                    <div class="status-bar-group" data-action="toggle-tooltip" data-tooltip="${cargoUsed}/${shipStatic.cargoCapacity} Cargo">
                        <span class="status-bar-label">C</span>
                        <div class="status-bar"><div class="fill cargo-fill" style="width: ${cargoPct}%;"></div></div>
                    </div>
                </div>
            `;
        }

        let navBarHtml = '';
        navBarHtml = Object.entries(this.navStructure).map(([navId, navData]) => {
            const isActive = navId === activeNav;
            const isLocked = navLock && navLock.navId && navLock.navId !== navId;
            const tabClass = navId === NAV_IDS.SHIP ? 'ship-tab' : 'station-data-tab';
            const screenId = gameState.lastActiveScreen[navId] || Object.keys(navData.screens)[0];

            return `
                <div class="tab ${tabClass} ${isActive ? 'active' : ''}" ${isLocked ? 'disabled' : ''}
                     data-action="set-screen" data-nav-id="${navId}" data-screen-id="${screenId}">
                    ${navData.label}
                </div>
            `;
        }).join('');

        let subNavBarHtml = Object.entries(this.navStructure).map(([navId, navData]) => {
            const isActive = navId === activeNav;
            const subNavScreens = Object.entries(navData.screens).map(([screenId, screenLabel]) => {
                const isLocked = navLock && navLock.screenId && navLock.screenId !== screenId;
                return `<a href="#" draggable="false" ${isLocked ? 'disabled' : ''}
                           data-action="set-screen" data-nav-id="${navId}" data-screen-id="${screenId}">
                            ${screenLabel}
                        </a>`;
            }).join('');
            return `<div class="nav-sub ${isActive ? '' : 'hidden'}" id="sub-nav-${navId}">${subNavScreens}</div>`;
        }).join('');

        const finalHtml = `
            <div class="sticky-nav main-nav-ui ${themeClass}">
                <div class="context-bar">
                    <span>${location?.name || 'In Transit'}</span>
                    <span class="credit-text">⌬ ${formatCredits(player.credits, false)}</span>
                </div>
                <div class="nav-wrapper">
                    <div class="nav-main">${navBarHtml}</div>
                    ${statusPodHtml}
                </div>
                ${subNavBarHtml}
            </div>
        `;

        this.cache.topBarContainer.innerHTML = finalHtml;
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
                this.cache.marketScreen.innerHTML = renderMarketScreen(gameState, this.isMobile, this.getItemPrice, this.marketTransactionState);
                this._restoreMarketTransactionState();
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

    showStatusTooltip(anchorEl, content) {
        this.activeStatusTooltipAnchor = anchorEl;
        const tooltip = this.cache.statusTooltip;
        const themeColor = getComputedStyle(anchorEl.closest('.sticky-nav')).getPropertyValue('--theme-main');

        tooltip.innerText = content;
        tooltip.style.borderColor = themeColor.trim();
        tooltip.style.display = 'block';

        const rect = anchorEl.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
        tooltip.style.top = `${rect.bottom + 8}px`;
    }

    hideStatusTooltip() {
        if (this.activeStatusTooltipAnchor) {
            this.cache.statusTooltip.style.display = 'none';
            this.activeStatusTooltipAnchor = null;
        }
    }
}