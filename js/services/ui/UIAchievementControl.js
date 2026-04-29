// js/services/ui/UIAchievementControl.js
import { ACHIEVEMENT_REGISTRY } from '../../data/achievementRegistry.js';
import { formatNumberCompact } from '../../utils.js';

/**
 * Domain Controller for the Achievements System presentation layer.
 * Handles calculation, sorting, string masking, tab layout, and scroll DOM memory retention.
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
        this._closeBtnBound = false;
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

            // Manually bind the close button to bypass event delegation drop issues
            if (this.modal) {
                const closeBtn = this.modal.querySelector('[data-action="close-achievements"]');
                if (closeBtn && !this._closeBtnBound) {
                    closeBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.hideModal();
                    };
                    this._closeBtnBound = true;
                }
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

            // Bind dismissal when tapping outside the modal content
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
        const activeTab = state.uiState.activeAchievementTab || 'Navigation';

        // Update Modal Title (from AWARDS to Achievements, size reduction, white glow)
        const titleEl = this.modal.querySelector('h2');
        if (titleEl) {
            titleEl.textContent = 'Achievements';
            titleEl.className = 'text-2xl font-orbitron font-bold text-center text-cyan-300 mb-2 tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]';
        }

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

        const sortedCategories = Object.keys(grouped).sort();

        // 2. Build or Update Horizontal Tabs Row
        let tabsContainer = this.modal.querySelector('#achievements-tabs');
        if (!tabsContainer) {
            tabsContainer = document.createElement('div');
            tabsContainer.id = 'achievements-tabs';
            tabsContainer.className = 'flex flex-row overflow-x-auto overflow-y-hidden gap-2 mb-4 pb-2 custom-scrollbar';
            const modalContent = this.modal.querySelector('.modal-content');
            modalContent.insertBefore(tabsContainer, this.scrollContainer);
        }

        let tabsHtml = '';
        sortedCategories.forEach(cat => {
            const isActive = cat === activeTab;
            const tabClass = isActive 
                ? 'bg-cyan-900 border-cyan-400 text-white shadow-[0_0_10px_rgba(34,211,238,0.5)]' 
                : 'bg-slate-800 border-slate-600 text-gray-400 hover:bg-slate-700';
            tabsHtml += `<button class="btn flex-shrink-0 whitespace-nowrap px-4 py-2 text-sm font-orbitron rounded-xl border ${tabClass} transition-all duration-200" data-action="switch-achievement-tab" data-tab-id="${cat}">${cat}</button>`;
        });
        tabsContainer.innerHTML = tabsHtml;

        // 3. Generate and Sort HTML for Active Tab Only
        let html = '';
        
        if (grouped[activeTab]) {
            const cat = activeTab;
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
                    <div class="flex justify-between items-center bg-slate-800 p-3 md:p-4 cursor-pointer border border-slate-700 rounded-t-xl ${isCollapsed ? 'rounded-b-xl' : ''} hover:bg-slate-700 transition-colors" data-action="toggle-ach-category" data-category-id="${cat}">
                        <h3 class="text-xl md:text-2xl font-orbitron text-cyan-300 font-bold uppercase tracking-widest">${cat}</h3>
                        <span class="text-cyan-500 font-bold text-5xl leading-none flex items-center justify-center">${chevron}</span>
                    </div>
                    <div class="${isCollapsed ? 'hidden' : 'flex flex-col gap-3 p-3 bg-slate-900/50 border border-t-0 border-slate-700 rounded-b-xl'}">
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
                        pillClass = 'ach-pill ach-completed border-yellow-400 bg-slate-800 cursor-pointer';
                        textClass = 'text-yellow-400';
                        actionAttr = `data-action="claim-achievement" data-id="${ach.id}"`;
                    } else {
                        progressHtml = `
                            <div class="w-full bg-slate-900 h-2 mt-3 rounded-full overflow-hidden shadow-inner">
                                <div class="bg-yellow-500 h-full ach-progress-fill" style="width: ${ach.percent}%"></div>
                            </div>
                        `;
                    }

                    // Format numbers using the new compact display logic
                    const formattedMetric = formatNumberCompact(Math.min(ach.currentMetric, ach.targetValue));
                    const formattedTarget = formatNumberCompact(ach.targetValue);

                    // CSS structural targets prepared for Web Animations API phase (.ach-pill-wrapper)
                    html += `
                        <div class="ach-pill-wrapper relative overflow-hidden transition-all duration-300" style="opacity: 1; height: auto;">
                            <div class="${pillClass} p-4 rounded-xl border transition-all duration-300 relative overflow-hidden" ${actionAttr}>
                                <div class="flex justify-between items-start relative z-10">
                                    <div class="flex-1 pr-4">
                                        <div class="text-base md:text-lg font-bold font-orbitron ${textClass}">${ach.title}</div>
                                        <div class="text-sm ${isClaimed ? 'text-slate-800 font-semibold' : 'text-gray-400'} mt-1">${ach.maskedDesc}</div>
                                    </div>
                                    <div class="text-right whitespace-nowrap flex items-center">
                                        ${isClaimed ? starHtml : `<span class="text-sm font-roboto-mono ${isCompleted ? 'text-yellow-400 font-bold' : 'text-gray-500'}">${formattedMetric} / ${formattedTarget}</span>`}
                                    </div>
                                </div>
                                <div class="relative z-10">${progressHtml}</div>
                            </div>
                        </div>
                    `;
                });
            }
            html += `</div></div>`;
        } else {
            // Handle edge case where a category is empty or undefined
            html = `<div class="text-center text-gray-500 py-8 font-orbitron">No achievements available in this category.</div>`;
        }

        this.scrollContainer.innerHTML = html;

        // 4. Restore DOM Memory
        // Ensure DOM has fully painted before attempting to restore scroll position
        requestAnimationFrame(() => {
            if (this.scrollContainer && state.uiState) {
                this.scrollContainer.scrollTop = state.uiState.achievementsScrollY || 0;
            }
        });
    }
}