// js/services/DebugService.js
/**
 * @fileoverview This file contains the DebugService class, which is responsible for creating and managing
 * the lil-gui visual editor panel for real-time tuning of game variables and CSS properties.
 * This service should only be initialized in a development environment.
 */

export class DebugService {
    /**
     * @param {import('./UIManager.js').UIManager} uiManager The UI rendering service.
     */
    constructor(uiManager) {
        this.uiManager = uiManager;
        this.gui = null;
        this.active = false;
        this.state = {};
        this.defaults = {};
    }

    /**
     * Initializes the debug panel, creating the lil-gui instance and setting up all the controls.
     */
    init() {
        if (this.gui) return;

        this.gui = new lil.GUI();
        this.gui.domElement.style.display = 'none'; // Initially hidden

        // Define the state and default values based on the CSS variables
        this.state = {
            // Card Appearance
            cardHeight: 128,
            cardBorderRadius: 8,
            cardGradientAngle: 45,
            
            // Positioning
            infoTop: 12,
            infoLeft: 16,
            moduleTop: 12,
            moduleRight: 12,
            
            // Spacing
            infoVGap: 4,

            // Name Text
            nameFontSize: 1,
            nameColor: '#ffffff',
            nameShadow: true,

            // Price Text
            priceFontSize: 1.35,
            priceColor: '#7dd3fc',
            priceShadow: true,
            priceGlow: true,

            // Module
            moduleWidth: 100,
            moduleVGap: 5.6,
            moduleToggleHeight: 30,
            moduleStepperHeight: 30,
            moduleButtonHeight: 28,
            buyColor: '#196a8f',
            sellColor: '#a73535',

            // Indicators
            indicatorTop: 86,
            indicatorLeft: 16,
            indicatorFontSize: 0.75,
            indicatorPadding: '0.1em 0.5em',
            positiveBg: '#10b981',
            negativeBg: '#dc2626',
            neutralBg: '#737373',
        };
        this.defaults = { ...this.state };

        // Card Appearance Folder
        const cardFolder = this.gui.addFolder('Card Appearance');
        cardFolder.add(this.state, 'cardHeight', 60, 200, 1).name('Height (px)').onChange(v => this.updateCssVariable('--market-card-height', `${v}px`));
        cardFolder.add(this.state, 'cardBorderRadius', 0, 50, 1).name('Border Radius (px)').onChange(v => this.updateCssVariable('--market-card-border-radius', `${v}px`));
        cardFolder.add(this.state, 'cardGradientAngle', 0, 360, 1).name('Gradient Angle (deg)').onChange(v => this.updateCssVariable('--market-card-gradient-angle', `${v}deg`));

        // Positioning Folder
        const posFolder = this.gui.addFolder('Positioning');
        posFolder.add(this.state, 'infoTop', 0, 100, 1).name('Info Y (px)').onChange(v => this.updateCssVariable('--market-card-info-top', `${v}px`));
        posFolder.add(this.state, 'infoLeft', 0, 100, 1).name('Info X (px)').onChange(v => this.updateCssVariable('--market-card-info-left', `${v}px`));
        posFolder.add(this.state, 'moduleTop', 0, 100, 1).name('Module Y (px)').onChange(v => this.updateCssVariable('--market-card-module-top', `${v}px`));
        posFolder.add(this.state, 'moduleRight', 0, 100, 1).name('Module X (px)').onChange(v => this.updateCssVariable('--market-card-module-right', `${v}px`));
        posFolder.add(this.state, 'indicatorTop', 0, 128, 1).name('Indicator Y (px)').onChange(v => this.updateCssVariable('--market-card-indicator-top', `${v}px`));
        posFolder.add(this.state, 'indicatorLeft', 0, 128, 1).name('Indicator X (px)').onChange(v => this.updateCssVariable('--market-card-indicator-left', `${v}px`));

        // Text Folders
        const nameFolder = this.gui.addFolder('Name Text');
        nameFolder.add(this.state, 'nameFontSize', 0.5, 2, 0.05).name('Font Size (rem)').onChange(v => this.updateCssVariable('--market-card-name-font-size', `${v}rem`));
        nameFolder.addColor(this.state, 'nameColor').name('Color').onChange(v => this.updateCssVariable('--market-card-name-color', v));
        nameFolder.add(this.state, 'nameShadow').name('Outline').onChange(() => this.updateTextShadows());

        const priceFolder = this.gui.addFolder('Price Text');
        priceFolder.add(this.state, 'priceFontSize', 0.5, 3, 0.05).name('Font Size (rem)').onChange(v => this.updateCssVariable('--market-card-price-font-size', `${v}rem`));
        priceFolder.addColor(this.state, 'priceColor').name('Color').onChange(v => this.updateTextShadows());
        priceFolder.add(this.state, 'priceShadow').name('Outline').onChange(() => this.updateTextShadows());
        priceFolder.add(this.state, 'priceGlow').name('Glow').onChange(() => this.updateTextShadows());
        
        // Module Folder
        const moduleFolder = this.gui.addFolder('Transaction Module');
        moduleFolder.add(this.state, 'moduleWidth', 80, 150, 1).name('Width (px)').onChange(v => this.updateCssVariable('--market-card-module-width', `${v}px`));
        moduleFolder.add(this.state, 'moduleVGap', 0, 15, 0.1).name('V-Gap (px)').onChange(v => this.updateCssVariable('--market-card-module-v-gap', `${v}px`));
        moduleFolder.add(this.state, 'moduleToggleHeight', 20, 50, 1).name('Toggle Height (px)').onChange(v => this.updateCssVariable('--market-card-module-toggle-height', `${v}px`));
        moduleFolder.add(this.state, 'moduleStepperHeight', 20, 50, 1).name('Stepper Height (px)').onChange(v => this.updateCssVariable('--market-card-module-stepper-height', `${v}px`));
        moduleFolder.add(this.state, 'moduleButtonHeight', 20, 50, 1).name('Button Height (px)').onChange(v => this.updateCssVariable('--market-card-module-button-height', `${v}px`));
        moduleFolder.addColor(this.state, 'buyColor').name('Buy Color').onChange(v => this.updateCssVariable('--buy-primary', v));
        moduleFolder.addColor(this.state, 'sellColor').name('Sell Color').onChange(v => this.updateCssVariable('--sell-primary', v));

        // Indicators Folder
        const indFolder = this.gui.addFolder('Indicators');
        indFolder.add(this.state, 'indicatorFontSize', 0.5, 1.5, 0.05).name('Font Size (em)').onChange(v => this.updateCssVariable('--market-card-indicator-font-size', `${v}em`));
        indFolder.addColor(this.state, 'positiveBg').name('Positive BG').onChange(v => this.updateCssVariable('--market-card-indicator-positive-bg', v));
        indFolder.addColor(this.state, 'negativeBg').name('Negative BG').onChange(v => this.updateCssVariable('--market-card-indicator-negative-bg', v));
        indFolder.addColor(this.state, 'neutralBg').name('Neutral BG').onChange(v => this.updateCssVariable('--market-card-indicator-neutral-bg', v));

        this.gui.add({ export: () => this.exportCssDeltas() }, 'export').name('Export CSS Deltas');
        
        console.log("DebugService Initialized.");
    }

    /**
     * Toggles the visibility of the debug panel.
     */
    toggleVisibility() {
        if (!this.gui) return;
        this.active = !this.active;
        this.gui.domElement.style.display = this.active ? 'block' : 'none';
    }

    /**
     * Updates a CSS custom property on the root element.
     * @param {string} property - The name of the CSS variable.
     * @param {string} value - The new value for the variable.
     */
    updateCssVariable(property, value) {
        document.documentElement.style.setProperty(property, value);
    }
    
    /**
     * Updates the composite text-shadow properties for name and price text.
     */
    updateTextShadows() {
        let nameShadow = this.state.nameShadow ? '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' : 'none';
        this.updateCssVariable('--market-card-name-text-shadow', nameShadow);

        let priceShadows = [];
        if (this.state.priceGlow) priceShadows.push(`0 0 4px ${this.state.priceColor}`, `0 0 8px ${this.state.priceColor}`);
        if (this.state.priceShadow) priceShadows.push('-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000');
        this.updateCssVariable('--market-card-price-text-shadow', priceShadows.length > 0 ? priceShadows.join(', ') : 'none');
    }

    /**
     * Exports only the changed CSS variables to the developer console.
     */
    exportCssDeltas() {
        let output = ':root {\n';
        let changed = false;
        for (const key in this.state) {
            if (this.state[key] !== this.defaults[key]) {
                changed = true;
                const cssVar = this.getCssVarForKey(key);
                const cssVal = this.getCssValueForKey(key);
                if(cssVar) {
                    output += `    ${cssVar}: ${cssVal};\n`;
                }
            }
        }
        output += '}';

        if (changed) {
            console.log("--- CSS Deltas ---");
            console.log(output);
        } else {
            console.log("No changes detected from defaults.");
        }
    }
    
    /**
     * Maps a state key to its corresponding CSS variable name and value.
     * @param {string} key - The key from the this.state object.
     * @returns {string|null} - The CSS variable name or null.
     */
    getCssVarForKey(key) {
        const map = {
            cardHeight: '--market-card-height', cardBorderRadius: '--market-card-border-radius', cardGradientAngle: '--market-card-gradient-angle',
            infoTop: '--market-card-info-top', infoLeft: '--market-card-info-left', moduleTop: '--market-card-module-top', moduleRight: '--market-card-module-right',
            infoVGap: '--market-card-info-v-gap', nameFontSize: '--market-card-name-font-size', nameColor: '--market-card-name-color',
            priceFontSize: '--market-card-price-font-size', priceColor: '--market-card-price-color',
            moduleWidth: '--market-card-module-width', moduleVGap: '--market-card-module-v-gap',
            moduleToggleHeight: '--market-card-module-toggle-height', moduleStepperHeight: '--market-card-module-stepper-height', moduleButtonHeight: '--market-card-module-button-height',
            buyColor: '--buy-primary', sellColor: '--sell-primary',
            indicatorTop: '--market-card-indicator-top', indicatorLeft: '--market-card-indicator-left', indicatorFontSize: '--market-card-indicator-font-size',
            positiveBg: '--market-card-indicator-positive-bg', negativeBg: '--market-card-indicator-negative-bg', neutralBg: '--market-card-indicator-neutral-bg'
        };
        return map[key] || null;
    }

    /**
     * Gets the correctly formatted CSS value for a given state key.
     * @param {string} key - The key from the this.state object.
     * @returns {string} - The formatted CSS value.
     */
    getCssValueForKey(key) {
        const value = this.state[key];
        if (key.includes('Height') || key.includes('Radius') || key.includes('Top') || key.includes('Left') || key.includes('Right') || key.includes('Width') || key.includes('VGap')) return `${value}px`;
        if (key.includes('Angle')) return `${value}deg`;
        if (key.includes('FontSize')) return `${value}rem`;
        if (key === 'nameShadow' || key === 'priceShadow' || key === 'priceGlow') return null; // Handled separately
        return value;
    }
}