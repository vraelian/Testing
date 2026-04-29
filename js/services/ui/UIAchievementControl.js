// js/services/ui/UIAchievementControl.js
import { ACHIEVEMENT_REGISTRY } from '../../data/achievementRegistry.js';

/**
 * Domain Controller for the Achievements System presentation layer.
 * Handles calculation, sorting, string masking, and scroll DOM memory retention.
 */
export class UIAchievementControl {
    /**
     * @param {import('../UIManager.js').UIManager} uiManager 
     */
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.modal = null;
        this.scrollContainer = null;
        this._backdropListenerBound = false;
    }

    _lazyCacheDOM() {
        if (!this.modal) {
            this.modal = document.getElementById('achievements-modal');
            this.scrollContainer = document.getElementById('achievements-scroll-container');
            
            // Attach DOM memory scroll listener
            if (this.scrollContainer) {
                this.scrollContainer.addEventListener('scroll', (e) => {
                    // Direct mutation of the persistent GameState
                    if (this.uiManager && this.uiManager.simulationService && this.uiManager.simulationService.gameState) {
                        this.uiManager.simulationService.gameState.uiState.achievementsScrollY = e.target.scrollTop;
                    }
                }, { passive: true });
            }
        }
    }

    showModal(state) {
        this._lazyCacheDOM();
        if (this.modal) {
            this.modal.classList.remove('hidden');
            
            // Apply 0.4s fade-in animation
            this.modal.style.animation = 'achFadeIn 0.4s ease forwards';
            
            this.render(state);

            // Phase 3: Bind dismissal when tapping outside the modal content
            if (!this._backdropListenerBound) {
                this.modal.addEventListener('click', (e) => {
                    // Dismiss strictly if the click target is the backdrop div itself
                    if (e.target === this.modal) {
                        this.hideModal();
                    }
                });
                this._backdropListenerBound = true;
            }
        }
    }

    hideModal() {
        if (this.modal && !this.modal.classList.contains('hidden')) {
            // Apply 0.4s fade-out animation
            this.modal.style.animation = 'achFadeOut 0.4s ease forwards';
            
            // Wait for the animation to complete before snapping to hidden
            this.modal.addEventListener('animationend', () => {
                this.modal.classList.add('hidden');
                this.modal.style.animation = ''; // Reset animation property
            }, { once: true });
        }
    }

    render(state) {
        this._lazyCacheDOM();
        if (!this.scrollContainer || !state.achievements) return;

        const metrics = state.achievements.metrics || {};
        const status = state.achievements.status || {};
        const collapsedCats = state.uiState.achievementsCollapsedCategories || [];

        // 1. Group by Category & Calculate State
        const grouped = {};
        ACHIEVEMENT_REGISTRY.forEach(ach => {
            const cat = ach.categoryId;
            if (!grouped[cat]) grouped[cat] = [];
            
            const metricVal = metrics[ach.metricKey] || 0;
            let pct = (metricVal / ach.targetValue) * 100;
            pct = Math.min(100, Math.max(0, pct)); // Clamp between 0-100%
            
            const stat = status[ach.id] || 'INERT'; // 'INERT', 'COMPLETED', 'CLAIMED'
            
            grouped[cat].push({
                ...ach,
                percent: pct,
                currentMetric: metricVal,
                status: stat,
                maskedDesc: ach.description(state) // Procedural Masking Evaluated JIT
            });
        });

        // 2. Generate and Sort HTML
        let html = '';
        const sortedCategories = Object.keys(grouped).sort();

        sortedCategories.forEach(cat => {
            const isCollapsed = collapsedCats.includes(cat);
            
            // Sort inner achievements according to GDD Logic
            grouped[cat].sort((a, b) => {
                // CLAIMED always at the absolute bottom
                if (a.status === 'CLAIMED' && b.status !== 'CLAIMED') return 1;
                if (b.status === 'CLAIMED' && a.status !== 'CLAIMED') return -1;
                
                // COMPLETED pulses at the absolute top of the unclaimed pool
                if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return -1;
                if (b.status === 'COMPLETED' && a.status !== 'COMPLETED') return 1;
                
                // Otherwise, sort descending by how close the player is to finishing
                return b.percent - a.percent;
            });

            const chevron = isCollapsed ? '+' : '−';
            html += `
                <div class="mb-4">
                    <div class="flex justify-between items-center bg-slate-800 p-3 md:p-4 cursor-pointer border border-slate-700 hover:bg-slate-700 transition-colors" data-action="toggle-ach-category" data-category-id="${cat}">
                        <h3 class="text-xl md:text-2xl font-orbitron text-cyan-300 font-bold uppercase tracking-widest">${cat}</h3>
                        <span class="text-cyan-500 font-bold text-5xl leading-none flex items-center justify-center">${chevron}</span>
                    </div>
                    <div class="${isCollapsed ? 'hidden' : 'flex flex-col gap-2 p-2 bg-slate-900/50'}">
            `;

            if (!isCollapsed) {
                grouped[cat].forEach(ach => {
                    const isClaimed = ach.status === 'CLAIMED';
                    const isCompleted = ach.status === 'COMPLETED';
                    
                    // Triple-State Visual Architecture mapping
                    let pillClass = 'ach-pill bg-slate-800 border-slate-600';
                    let textClass = 'text-cyan-100';
                    let starHtml = '';
                    let progressHtml = '';
                    let actionAttr = '';
                    
                    if (isClaimed) {
                        pillClass = 'ach-pill ach-claimed bg-yellow-500 border-yellow-400';
                        textClass = 'text-black';
                        starHtml = `<span class="text-white ml-2 text-xl">★</span>`;
                    } else if (isCompleted) {
                        pillClass = 'ach-pill ach-completed border-yellow-400 bg-slate-800 shadow-[0_0_10px_rgba(250,204,21,0.5)] cursor-pointer';
                        textClass = 'text-yellow-400';
                        actionAttr = `data-action="claim-achievement" data-id="${ach.id}"`;
                    } else {
                        progressHtml = `
                            <div class="w-full bg-slate-900 h-2 mt-3 rounded-full overflow-hidden">
                                <div class="bg-yellow-500 h-full ach-progress-fill" style="width: ${ach.percent}%"></div>
                            </div>
                        `;
                    }

                    // CSS structural targets prepared for Web Animations API phase (.ach-pill-wrapper)
                    html += `
                        <div class="ach-pill-wrapper relative overflow-hidden transition-all duration-300" style="opacity: 1; height: auto;">
                            <div class="${pillClass} p-4 rounded border transition-all duration-300" ${actionAttr}>
                                <div class="flex justify-between items-start">
                                    <div class="flex-1 pr-4">
                                        <div class="text-base md:text-lg font-bold font-orbitron ${textClass}">${ach.title}</div>
                                        <div class="text-sm ${isClaimed ? 'text-slate-800 font-semibold' : 'text-gray-400'} mt-1">${ach.maskedDesc}</div>
                                    </div>
                                    <div class="text-right whitespace-nowrap flex items-center">
                                        ${isClaimed ? starHtml : `<span class="text-sm font-roboto-mono ${isCompleted ? 'text-yellow-400 font-bold' : 'text-gray-500'}">${Math.min(ach.currentMetric, ach.targetValue)} / ${ach.targetValue}</span>`}
                                    </div>
                                </div>
                                ${progressHtml}
                            </div>
                        </div>
                    `;
                });
            }
            html += `</div></div>`;
        });

        this.scrollContainer.innerHTML = html;

        // 3. Restore DOM Memory
        // Ensure DOM has fully painted before attempting to restore scroll position
        requestAnimationFrame(() => {
            if (this.scrollContainer && state.uiState) {
                this.scrollContainer.scrollTop = state.uiState.achievementsScrollY || 0;
            }
        });
    }
}