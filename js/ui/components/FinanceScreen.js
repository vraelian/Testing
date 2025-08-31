// js/ui/components/FinanceScreen.js
/**
 * @fileoverview This file contains the rendering logic for the Finance screen.
 * It displays the player's current debt status or available loan options,
 * as well as a detailed log of all financial transactions.
 */
import { DB } from '../../data/database.js';
import { formatCredits } from '../../utils.js';
import { ACTION_IDS, GAME_RULES } from '../../data/constants.js';

/**
 * Renders the entire Finance screen UI.
 * @param {object} gameState - The current state of the game.
 * @returns {string} The HTML content for the Finance screen.
 */
export function renderFinanceScreen(gameState) {
    const { player, day, currentLocationId } = gameState;
    const location = DB.MARKETS.find(l => l.id === currentLocationId);
    const theme = location?.navTheme || { gradient: 'linear-gradient(135deg, #4a5568, #2d3748)', textColor: '#f0f0f0', borderColor: '#7a9ac0' };
    let loanHtml;

    // Display the current debt panel if the player has debt.
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
             <p class="text-2xl font-bold font-roboto-mono text-red-400 mb-2">⌬ ${formatCredits(player.debt, false)}</p>
             <button data-action="${ACTION_IDS.PAY_DEBT}" class="btn w-full py-3 bg-red-800/80 hover:bg-red-700/80 border-red-500" ${player.credits >= player.debt ? '' : 'disabled'}>
                 Pay Off Full Amount
             </button>
             ${garnishmentTimerHtml}
           </div>`;
    } else {
        // Otherwise, display available loan options.
        const dynamicLoanAmount = Math.floor(player.credits * 3.5);
        const dynamicLoanFee = Math.floor(dynamicLoanAmount * 0.1);
        const dynamicLoanInterest = Math.floor(dynamicLoanAmount * 0.04);
        const dynamicLoanData = { amount: dynamicLoanAmount, fee: dynamicLoanFee, interest: dynamicLoanInterest };
        const loanButtonsHtml = [
            { key: '10000', amount: 10000, fee: 600, interest: 500 },
            { key: 'dynamic', ...dynamicLoanData }
        ].map((loan) => {
            const tooltipText = `Fee: ${formatCredits(loan.fee, false)}\\nInterest: ${formatCredits(loan.interest, false)} / 30d`;
            return `<button class="btn btn-loan w-full p-2 mt-2 loan-btn-tooltip" data-action="${ACTION_IDS.TAKE_LOAN}" data-loan-details='${JSON.stringify(loan)}' ${player.credits < loan.fee ? 'disabled' : ''} data-tooltip="${tooltipText}">
                        <span class="font-orbitron text-cyan-300">⌬ ${formatCredits(loan.amount, false)}</span>
                    </button>`;
        }).join('');
        loanHtml = `<h4 class="font-orbitron text-xl mb-2">Financing</h4><div class="flex justify-center gap-4 w-full">${loanButtonsHtml}</div>`;
    }

    // Render the transaction log.
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

    return `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="md:col-span-1 p-4 rounded-lg flex flex-col items-center justify-center space-y-2 shadow-lg panel-border border text-center" style="border-color: ${theme.borderColor}; color: ${theme.textColor}; background: ${theme.gradient};">
                ${loanHtml}
            </div>
            <div class="md:col-span-2">
                 <h3 class="text-2xl font-orbitron text-center mb-4">Transaction Log</h3>
                 <div class="p-4 rounded-lg shadow-lg panel-border border h-96 overflow-y-auto" style="border-color: ${theme.borderColor}; color: ${theme.textColor}; background: ${theme.gradient};">
                    <div class="grid grid-cols-4 gap-2 p-2 border-b-2 font-bold" style="border-color: ${theme.borderColor};">
                       <span>Day</span>
                       <span class="col-span-2">Description</span>
                       <span class="text-right">Amount</span>
                    </div>
                    ${logEntries || '<p class="text-center p-4">No transactions recorded.</p>'}
                 </div>
            </div>
        </div>
    `;
}