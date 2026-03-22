// js/ui/components/FinanceScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Finance screen.
 * It displays the player's current debt status or available loan options,
 * as well as a detailed log of all financial transactions.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';
import { ACTION_IDS, GAME_RULES, LOCATION_IDS } from '../../data/constants.js';
import { GameAttributes } from '../../services/GameAttributes.js';

/**
 * Renders the entire Finance screen UI.
 * @param {object} gameState - The current state of the game.
 * @returns {string} The HTML content for the Finance screen.
 */
export function renderFinanceScreen(gameState) {
    const { player, day, currentLocationId, missions } = gameState;
    const location = DB.MARKETS.find(l => l.id === currentLocationId);
    const theme = location?.navTheme || { gradient: 'linear-gradient(135deg, #4a5568, #2d3748)', textColor: '#f0f0f0', borderColor: '#7a9ac0' };
    
    // --- VIRTUAL WORKBENCH: Define theme vars for inline styling ---
    const themeStyleVars = `
        --theme-gradient: ${theme.gradient}; 
        --theme-text-color: ${theme.textColor}; 
        --theme-border-color: ${theme.borderColor};
    `;
    // --- END VIRTUAL WORKBENCH ---

    // --- CORPORATE EXPANSION: Ship Net Worth Calculation ---
    let shipNetWorth = 0;
    const activeShipId = player.activeShipId;
    const activeShip = DB.SHIPS[activeShipId];
    if (activeShip) {
        shipNetWorth += activeShip.price;
        const shipState = player.shipStates[activeShipId];
        if (shipState && shipState.upgrades) {
            shipState.upgrades.forEach(upgradeId => {
                const def = GameAttributes.getDefinition(upgradeId);
                if (def) {
                    shipNetWorth += GameAttributes.getUpgradeHardwareCost(def.tier || 1, activeShip.price);
                }
            });
        }
    }
    // --------------------------------------------------------

    let loanHtml;

    // Display the current debt panel if the player has debt.
    if (player.debt > 0) {
        let garnishmentTimerHtml = '';
        if (player.loanStartDate) {
            const activeLoanType = player.loanType || 'guild';
            const termDays = player.loanDueDate ? (player.loanDueDate - player.loanStartDate) : GAME_RULES.LOAN_GARNISHMENT_DAYS;
            
            if (activeLoanType === 'syndicate') {
                const daysRemaining = player.loanDueDate - day;
                if (daysRemaining > 0) {
                    garnishmentTimerHtml = `<p class="text-base text-red-400/70 mt-2">Due in ${daysRemaining} days</p>`;
                } else {
                    garnishmentTimerHtml = `<p class="text-base text-glow-red font-bold mt-2 animate-pulse">DELINQUENT: DEBT PAST DUE</p>`;
                }
            } else {
                const daysRemaining = termDays - (day - player.loanStartDate);
                if (daysRemaining > 0) {
                    garnishmentTimerHtml = `<p class="text-base text-red-400/70 mt-2">Garnishment in ${daysRemaining} days</p>`;
                } else {
                    const garnishmentAmount = Math.floor(player.credits * GAME_RULES.LOAN_GARNISHMENT_PERCENT);
                    const displayGarnish = Math.min(garnishmentAmount, player.debt);
                    garnishmentTimerHtml = `<p class="text-base text-glow-red font-bold mt-2 animate-pulse">Active Garnishment: ${formatCredits(displayGarnish)} / Mo</p>`;
                }
            }
        }

        // --- UPGRADE SYSTEM: INTEREST DISPLAY ---
        const shipState = player.shipStates[activeShipId];
        const upgrades = shipState ? (shipState.upgrades || []) : [];
        
        // Calculate effective interest
        const interestMod = GameAttributes.getInterestModifier(upgrades);
        const effectiveInterest = Math.floor(player.monthlyInterestAmount * interestMod);
        
        // Only show if modified
        let interestHtml = '';
        if (interestMod < 1.0) {
            interestHtml = `
                <div class="mt-2 text-sm text-gray-400">
                    Monthly Interest: <span class="text-green-400">${formatCredits(effectiveInterest)}</span> 
                    <span class="line-through text-gray-600">${formatCredits(player.monthlyInterestAmount)}</span>
                </div>
            `;
        } else {
             interestHtml = `
                <div class="mt-2 text-sm text-gray-400">
                    Monthly Interest: <span class="text-red-400">${formatCredits(player.monthlyInterestAmount)}</span>
                </div>
            `;
        }
        // ----------------------------------------

        // --- VIRTUAL WORKBENCH: Interactive Payment Slider ---
        const completedMissionIds = missions?.completedMissionIds || [];
        const isDebtLocked = !completedMissionIds.includes('mission_10') && !gameState.isDebugStart;
        let sliderHtml = '';

        if (isDebtLocked) {
            sliderHtml = `
                <div class="w-full mt-6 flex flex-col items-center px-4">
                    <button disabled class="btn-module btn-module-destructive w-full font-roboto-mono opacity-50 cursor-not-allowed flex flex-col items-center py-3">
                        <span class="text-sm tracking-widest text-red-300">GUILD PAYMENTS LOCKED</span>
                        <span class="text-xs mt-1 text-red-400/70">(Complete Tutorial)</span>
                    </button>
                </div>
            `;
        } else {
            const maxPayment = Math.min(player.credits, player.debt);
            sliderHtml = player.credits > 0 ? `
                <div class="w-full mt-6 flex flex-col items-center px-4">
                    <label class="text-xs text-gray-400 tracking-widest mb-3 uppercase">Payment Amount</label>
                    <input type="range" id="debt-slider" class="w-full" min="1" max="${maxPayment}" value="${maxPayment}">
                    <button data-action="${ACTION_IDS.PAY_DEBT}" data-input-id="debt-slider" class="btn-module btn-module-destructive relative overflow-hidden w-full font-roboto-mono mt-4">
                        <div class="loan-normal-content flex items-center justify-center w-full">
                            <span class="text-lg">Pay <span id="debt-payment-display" class="text-glow-red">${formatCredits(-maxPayment, true)}</span></span>
                        </div>
                        <div class="loan-confirm-content">
                            CONFIRM PAYMENT?
                        </div>
                    </button>
                </div>
            ` : `
                <div class="w-full mt-6 flex flex-col items-center px-4">
                    <button disabled class="btn-module btn-module-destructive w-full font-roboto-mono opacity-50 cursor-not-allowed">
                        <span class="text-base">Insufficient Funds</span>
                    </button>
                </div>
            `;
        }
        // --- END VIRTUAL WORKBENCH ---

        loanHtml = `
            <div>
                <div class="themed-header-bar" style="${themeStyleVars}">
                    <div class="themed-header-title">Debt Servicing</div>
                </div>
                <div class="finance-module-panel flex flex-col items-center justify-center space-y-2 text-center" style="border-color: ${theme.borderColor};">
                    <div class="text-sm text-gray-400 mb-1 uppercase tracking-widest">Active Principal</div>
                    <div class="text-2xl mb-2 text-red-400 font-bold">${formatCredits(player.debt)}</div>
                    ${garnishmentTimerHtml}
                    ${interestHtml}
                    ${sliderHtml}
                </div>
            </div>`;
    } else {
        // --- CORPORATE EXPANSION: Branching Loan Logic ---
        
        // --- NEW: INDENTURED SERVITUDE LOCKOUT CHECK ---
        const isCreditLocked = player.creditLockoutExpiryDate && day < player.creditLockoutExpiryDate;
        
        if (isCreditLocked) {
            const yearsRemaining = Math.ceil((player.creditLockoutExpiryDate - day) / 365);
            loanHtml = `
                <div class="themed-header-bar" style="${themeStyleVars}">
                    <div class="themed-header-title text-red-500">CREDIT BLACKLISTED</div>
                </div>
                <div class="finance-module-panel flex flex-col items-center justify-center space-y-4 text-center" style="border-color: #dc2626;">
                    <div class="text-xl text-red-400 font-bold tracking-widest">ACCOUNT FROZEN</div>
                    <div class="text-sm text-gray-400">Pursuant to bankruptcy restructuring, your ability to secure institutional or private credit has been suspended.</div>
                    <div class="p-3 border border-red-800/50 bg-red-950/30 rounded w-full font-roboto-mono text-red-300">
                        LOCKOUT EXPIRY: <br><span class="text-lg">${yearsRemaining} YEARS</span>
                    </div>
                </div>
            `;
        } else {
            // 1. GUILD FINANCING
            const guildAmount = Math.floor(shipNetWorth * 0.35);
            const guildFee = Math.floor(guildAmount * 0.10);
            const guildInterest = Math.floor(guildAmount * 0.04);
            const guildData = { amount: guildAmount, fee: guildFee, interest: guildInterest, type: 'guild', termDays: 1080 };

            let guildHtml = `
                <div class="themed-header-bar" style="${themeStyleVars}">
                    <div class="themed-header-title">Guild Financing</div>
                </div>
                <div class="finance-module-panel flex flex-col items-center justify-center space-y-2 text-center" style="border-color: ${theme.borderColor};">
                    <div class="text-base text-gray-400 mb-2">Asset-Backed Title Loan</div>
                    <button class="btn-module btn-module-credit w-full relative overflow-hidden transition-colors duration-200" style="background: var(--theme-gradient); border-color: var(--theme-border-color);" data-action="${ACTION_IDS.TAKE_LOAN}" data-loan-details='${JSON.stringify(guildData)}' ${player.credits < guildFee ? 'disabled' : ''}>
                        <div class="loan-normal-content flex flex-col items-center w-full">
                            <span class="loan-label text-[13px] tracking-widest mb-1 opacity-70">GUILD LOAN</span>
                            <span class="credits-text-pulsing text-[21px]">${formatCredits(guildAmount, true)}</span>
                            <div class="loan-details mt-3 text-sm flex gap-3 w-full justify-center">
                                <div class="detail-block text-center flex-1">
                                    <div class="text-xs text-slate-400 font-bold mb-1 tracking-wide">FEE</div>
                                    <div class="text-red-400 font-bold text-sm">${formatCredits(-guildFee)}</div>
                                </div>
                                <div class="detail-block text-center flex-1">
                                    <div class="text-xs text-slate-400 font-bold mb-1 tracking-wide">INTEREST</div>
                                    <div class="text-red-400 font-bold text-sm">${formatCredits(-guildInterest)}<span class="text-xs font-normal text-slate-500 ml-1">/mo</span></div>
                                </div>
                            </div>
                            <div class="loan-cta-button w-full mt-4 py-2 rounded text-sm tracking-widest font-bold uppercase transition-all shadow-md">
                                Take Loan
                            </div>
                        </div>
                        <div class="loan-confirm-content">
                            CONFIRM GUILD LOAN?
                        </div>
                    </button>
                </div>
            `;

            // 2. SYNDICATE CREDITORS
            let syndicateHtml = '';
            if ([LOCATION_IDS.EXCHANGE, LOCATION_IDS.VENUS, LOCATION_IDS.PLUTO].includes(currentLocationId)) {
                const syndAmount = Math.floor(shipNetWorth * 0.55);
                const syndFee = 0;
                const syndInterest = Math.floor(syndAmount * 0.15);
                const syndData = { amount: syndAmount, fee: syndFee, interest: syndInterest, type: 'syndicate', termDays: 1080 };

                syndicateHtml = `
                    <div class="themed-header-bar mt-6" style="${themeStyleVars}">
                        <div class="themed-header-title">Syndicate Creditors</div>
                    </div>
                    <div class="finance-module-panel flex flex-col items-center justify-center space-y-2 text-center" style="border-color: ${theme.borderColor};">
                        <div class="text-base text-red-400/80 mb-2">High-Risk Predatory Capital</div>
                        <button class="btn-module btn-module-credit w-full relative overflow-hidden transition-colors duration-200" style="background: var(--theme-gradient); border-color: var(--theme-border-color);" data-action="${ACTION_IDS.TAKE_LOAN}" data-loan-details='${JSON.stringify(syndData)}'>
                            <div class="loan-normal-content flex flex-col items-center w-full">
                                <span class="loan-label text-[13px] tracking-widest mb-1 opacity-70 text-red-500">SYNDICATE LOAN</span>
                                <span class="text-red-500 font-bold text-[21px]" style="text-shadow: 0 0 8px rgba(239,68,68,0.5);">${formatCredits(syndAmount, true)}</span>
                                <div class="loan-details mt-3 text-sm flex gap-3 w-full justify-center text-red-300">
                                    <div class="detail-block text-center flex-1">
                                        <div class="text-xs text-slate-400 font-bold mb-1 tracking-wide">FEE</div>
                                        <div class="text-slate-300 font-bold text-sm">$0</div>
                                    </div>
                                    <div class="detail-block text-center flex-1">
                                        <div class="text-xs text-slate-400 font-bold mb-1 tracking-wide">INTEREST</div>
                                        <div class="text-red-400 font-bold text-sm">${formatCredits(-syndInterest)}<span class="text-xs font-normal text-slate-500 ml-1">/mo</span></div>
                                    </div>
                                </div>
                                <div class="loan-cta-button syndicate-cta w-full mt-4 py-2 rounded text-sm tracking-widest font-bold uppercase transition-all shadow-md">
                                    Take Loan
                                </div>
                            </div>
                            <div class="loan-confirm-content">
                                ACCEPT SYNDICATE TERMS?
                            </div>
                        </button>
                    </div>
                `;
            }

            loanHtml = `<div>${guildHtml}${syndicateHtml}</div>`;
        }
        // --- END CORPORATE EXPANSION ---
    }

    // Render the transaction log.
    const logEntries = [...player.financeLog].reverse().map(entry => {
        const amountColor = entry.amount > 0 ? 'credits-text-pulsing' : 'text-glow-red';
        const sign = entry.amount > 0 ? '+' : '';
        return `
            <div class="log-entry">
                <span class="text-gray-400 text-center">${entry.day}</span>
                <span>${entry.description}</span>
                <span class="${amountColor} text-right font-roboto-mono">${sign}${formatCredits(entry.amount, false)}</span>
            </div>
        `;
       }).join('');

    return `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 h-full">
            <div class="md:col-span-1">
                ${loanHtml}
            </div>
            <div class="md:col-span-2 flex flex-col min-h-0">
                 <div class="themed-header-bar" style="${themeStyleVars}">
                    <div class="themed-header-title">Transaction Log</div>
                 </div>
                 <div class="finance-module-panel flex flex-col flex-grow min-h-0" style="border-color: ${theme.borderColor}; --theme-text-color: ${theme.textColor};">
                    <div class="finance-log-panel">
                        <div class="log-header" style="border-color: ${theme.borderColor};">
                           <span class="text-center">Day</span>
                           <span>Description</span>
                           <span class="text-right">Amount</span>
                        </div>
                        <div class="log-entries-container">
                           ${logEntries || '<p class="text-center p-4">No transactions recorded.</p>'}
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    `;
}