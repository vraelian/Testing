// js/ui/components/FinanceScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Finance screen.
 * It displays the player's current debt status or available loan options,
 * as well as a detailed log of all financial transactions.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';
import { ACTION_IDS, GAME_RULES } from '../../data/constants.js';

// --- VIRTUAL WORKBENCH START: Phase 1 ---
// This function is now REMOVED as the global formatCredits handles all logic.
// --- VIRTUAL WORKBENCH END: Phase 1 ---

/**
 * Renders the entire Finance screen UI.
 * @param {object} gameState - The current state of the game.
 * @returns {string} The HTML content for the Finance screen.
 */
export function renderFinanceScreen(gameState) {
    const { player, day, currentLocationId } = gameState;
    const location = DB.MARKETS.find(l => l.id === currentLocationId);
    const theme = location?.navTheme || { gradient: 'linear-gradient(135deg, #4a5568, #2d3748)', textColor: '#f0f0f0', borderColor: '#7a9ac0' };
    
    // --- VIRTUAL WORKBENCH: Define theme vars for inline styling ---
    const themeStyleVars = `
        --theme-gradient: ${theme.gradient}; 
        --theme-text-color: ${theme.textColor}; 
        --theme-border-color: ${theme.borderColor};
    `;
    // --- END VIRTUAL WORKBENCH ---

    let loanHtml;

    // Display the current debt panel if the player has debt.
    if (player.debt > 0) {
        let garnishmentTimerHtml = '';
        if (player.loanStartDate) {
            const daysRemaining = GAME_RULES.LOAN_GARNISHMENT_DAYS - (day - player.loanStartDate);
            if (daysRemaining > 0) {
                // VIRTUAL WORKBENCH: Increased font size from text-xs to text-sm
                garnishmentTimerHtml = `<p class="text-sm text-red-400/70 mt-2">Garnishment in ${daysRemaining} days</p>`;
            }
        }
        // --- VIRTUAL WORKBENCH START: Phase 2 ---
        loanHtml = `
            <div>
                <div class="themed-header-bar" style="${themeStyleVars}">
                    <div class="themed-header-title">Debt</div>
                </div>
                <div class="finance-module-panel flex flex-col items-center justify-center space-y-2 text-center" style="border-color: ${theme.borderColor};">
                    <button data-action="${ACTION_IDS.PAY_DEBT}" class="btn-module btn-module-destructive w-full font-roboto-mono" ${player.credits >= player.debt ? '' : 'disabled'}>
                        <span class="text-base">Pay Off <span class="text-glow-red">${formatCredits(-player.debt, true)}</span></span>
                    </button>
                    ${garnishmentTimerHtml}
                </div>
            </div>`;
        // --- VIRTUAL WORKBENCH END: Phase 2 ---
    } else {
        // Otherwise, display available loan options.
        const dynamicLoanAmount = Math.floor(player.credits * 3.5);
        const dynamicLoanFee = Math.floor(dynamicLoanAmount * 0.1);
        const dynamicLoanInterest = Math.floor(dynamicLoanAmount * 0.04);
        const dynamicLoanData = { amount: dynamicLoanAmount, fee: dynamicLoanFee, interest: dynamicLoanInterest };
        
        // --- VIRTUAL WORKBENCH START: Phase 1 & 2 ---
        const loanButtonsHtml = [
            { key: '10000', amount: 10000, fee: 600, interest: 500 },
            { key: 'dynamic', ...dynamicLoanData }
        ].map((loan) => {
            return `<button class="btn-module btn-module-credit w-full mt-2" data-action="${ACTION_IDS.TAKE_LOAN}" data-loan-details='${JSON.stringify(loan)}' ${player.credits < loan.fee ? 'disabled' : ''}>
                        <span class="credits-text-pulsing">${formatCredits(loan.amount, true)}</span>
                    </button>`;
        }).join('');
        // --- VIRTUAL WORKBENCH END: Phase 1 & 2 ---

        loanHtml = `
            <div>
                <div class="themed-header-bar" style="${themeStyleVars}">
                    <div class="themed-header-title">Financing</div>
                </div>
                <div class="finance-module-panel flex flex-col items-center justify-center space-y-2 text-center" style="border-color: ${theme.borderColor};">
                    <div class="flex justify-center gap-4 w-full">${loanButtonsHtml}</div>
                </div>
            </div>`;
    }
    // --- END VIRTUAL WORKBENCH ---

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