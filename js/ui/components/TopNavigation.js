// js/ui/components/TopNavigation.js
/**
 * @fileoverview Renders the top navigation bar components, including the context bar,
 * main navigation tabs, status pod (hull, fuel, cargo), and sub-navigation links.
 */
import { DB } from '../../data/database.js';
import { formatCredits, calculateInventoryUsed } from '../../utils.js';
import { ACTION_IDS, SCREEN_IDS, NAV_IDS } from '../../data/constants.js';

/**
 * Generates the HTML for the top navigation elements.
 * @param {object} gameState - The current state of the game.
 * @returns {{ contextBarHtml: string, navWrapperHtml: string, subNavsHtml: string }} An object containing the HTML strings for the different parts of the navigation.
 */
export function renderTopNavigation(gameState) {
    const { player, currentLocationId, activeNav, activeScreen, lastActiveScreen, introSequenceActive, tutorials, subNavCollapsed } = gameState;
    const { navLock } = tutorials;
    const location = DB.MARKETS.find(l => l.id === currentLocationId);
    const activeShipStatic = player.activeShipId ? DB.SHIPS[player.activeShipId] : null;
    const activeShipState = player.activeShipId ? player.shipStates[player.activeShipId] : null;
    const inventory = player.activeShipId ? player.inventories[player.activeShipId] : null;
    const theme = location?.navTheme || { gradient: 'linear-gradient(135deg, #4a5568, #2d3748)', textColor: '#f0f0f0' };

    const navStructure = {
        [NAV_IDS.SHIP]: { label: 'Ship', screens: { [SCREEN_IDS.MAP]: 'Map', [SCREEN_IDS.NAVIGATION]: 'Navigation', [SCREEN_IDS.CARGO]: 'Cargo' } },
        [NAV_IDS.STARPORT]: { label: 'Starport', screens: { [SCREEN_IDS.MARKET]: 'Market', [SCREEN_IDS.SERVICES]: 'Services', [SCREEN_IDS.HANGAR]: 'Shipyard' } },
        [NAV_IDS.DATA]: { label: 'Data', screens: { [SCREEN_IDS.MISSIONS]: 'Missions', [SCREEN_IDS.FINANCE]: 'Finance', [SCREEN_IDS.INTEL]: 'Intel' } }
    };

    const contextBarHtml = `
        <div class="context-bar" style="background: ${theme.gradient}; color: ${theme.textColor};">
            <span class="location-name-text">${location?.name || 'In Transit'}</span>
            <span class="credit-text">${formatCredits(player.credits)}</span>
        </div>`;

    const mainTabsHtml = Object.keys(navStructure).map(navId => {
        const isActive = navId === activeNav;
        const screenIdToLink = lastActiveScreen[navId] || Object.keys(navStructure[navId].screens)[0];
        const isDisabledByTutorial = navLock && navLock.navId !== navId;
        const isDisabled = introSequenceActive || isDisabledByTutorial;
        const activeStyle = isActive ? `background: ${theme.gradient}; color: ${theme.textColor};` : '';
        return `<div class="tab ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}" style="${activeStyle}" data-action="${ACTION_IDS.SET_SCREEN}" data-nav-id="${navId}" data-screen-id="${screenIdToLink}">${navStructure[navId].label}</div>`;
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

    const subNavsHtml = Object.keys(navStructure).map(navId => {
        const screens = navStructure[navId].screens;
        const isActive = navId === activeNav;
        const subNavButtons = Object.keys(screens).map(screenId => {
             const isDisabledByTutorial = navLock && navLock.screenId !== screenId;
             const isSubNavActive = screenId === activeScreen;
             const isDisabled = introSequenceActive || isDisabledByTutorial;
             const activeClass = isSubNavActive ? 'sub-nav-active' : '';
             let subStyle = '';
             if (isSubNavActive) {
                subStyle = `style="background: ${theme.gradient}; color: ${theme.textColor}; opacity: 1; font-weight: 700;"`;
             }
            return `<a href="#" class="${isDisabled ? 'disabled' : ''} ${activeClass}" ${subStyle} data-action="${ACTION_IDS.SET_SCREEN}" data-nav-id="${navId}" data-screen-id="${screenId}" draggable="false">${screens[screenId]}</a>`;
        }).join('');
        return `<div class="nav-sub ${(!isActive || subNavCollapsed) ? 'hidden' : ''}" id="${navId}-sub">${subNavButtons}</div>`;
    }).join('');

    return { contextBarHtml, navWrapperHtml, subNavsHtml };
}