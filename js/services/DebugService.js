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
        this.exportTextarea = null;
    }

    /**
     * Initializes the debug panel, creating the lil-gui instance and setting up all the controls.
     */
    init() {
        if (this.gui) return;

        this.gui = new lil.GUI();
        this.gui.domElement.style.display = 'none'; // Initially hidden

        // --- State object updated with values from screenshots ---
        this.state = {
            // Card Appearance
            cardHeight: 145,
            cardBorderRadius: 21,

            // Name Text
            infoTop: 7,
            infoLeft: 16,
            nameFontSize: 1.2,
            nameColor: '#ffffff',
            nameOutlineWidth: 1,
            nameOutlineColor: '#000000',
            nameShadowX: -0.5,
            nameShadowY: 0,
            nameShadowBlur: 3,
            nameShadowColor: '#000000',

            // Player Inventory Text
            pinvTop: 34,
            pinvLeft: 74,
            pinvFontSize: 0.65,
            pinvColor: '#e8e8e8',
            pinvOutlineWidth: 0.4,
            pinvOutlineColor: '#000000',
            pinvShadowX: 0,
            pinvShadowY: 1.5,
            pinvShadowBlur: 2.5,
            pinvShadowColor: '#616b70',

            // Availability Text
            availTop: 34,
            availLeft: 21,
            availFontSize: 0.65,
            availColor: '#ffffff',
            availOutlineWidth: 0.7,
            availOutlineColor: '#292929',
            availShadowX: -0.5,
            availShadowY: 1.5,
            availShadowBlur: 2,
            availShadowColor: '#554a4a',

            // Price Text
            priceTop: 59,
            priceLeft: 16,
            priceFontSize: 1.7,
            priceColor: '#2fe1f9',
            priceFontFamily: "'Roboto Mono', monospace",
            priceOutlineWidth: 1,
            priceOutlineColor: '#000000',
            priceGlowColor: '#2fe1f9',
            priceGlowRadius: 1,
            priceShadowX: 0,
            priceShadowY: 0,
            priceShadowBlur: 20,
            priceShadowColor: '#28d5d7',
            
            // Indicators
            indicatorTop: 109,
            indicatorLeft: 16,
            indicatorHSpacing: 6,
            indicatorVSpacing: 3,
            indicatorFontSize: 0.6,
            indicatorPositiveColor: '#ffffff',
            indicatorNegativeColor: '#fee2e2',
            indicatorNeutralColor: '#e5e5e5',

            // Spacing
            priceIndicatorVGap: 7,

            // Transaction Module
            moduleTop: 10,
            moduleWidth: 123,
            moduleVGap: 14.1,
            moduleToggleHeight: 20,
            moduleStepperHeight: 40,
            moduleStepperArrowSize: 1.4,
            moduleButtonHeight: 35,
            moduleFontSize: 0.75,
            buyColor: '#196a8f',
            sellColor: '#a73535',
        };
        this.defaults = { ...this.state };

        this.buildGui();
        this.updateAllStyles();
    }
    
    buildGui() {
        this.gui.add({ export: () => this.exportCssDeltas() }, 'export').name('Export CSS Deltas');
        this.createExportTextarea();

        const cardFolder = this.gui.addFolder('Commodity Card');
        cardFolder.add(this.state, 'cardHeight', 60, 200, 1).name('Height (px)').onChange(v => this.updateCssVariable('--market-card-height', `${v}px`));
        cardFolder.add(this.state, 'cardBorderRadius', 0, 50, 1).name('Roundness (px)').onChange(v => this.updateCssVariable('--market-card-border-radius', `${v}px`));

        const nameFolder = this.gui.addFolder('Name Text');
        this.buildTextControls(nameFolder, 'name', true, 'info');

        const pinvFolder = this.gui.addFolder('Player Inventory Text');
        this.buildTextControls(pinvFolder, 'pinv', true);

        const availFolder = this.gui.addFolder('Availability Text');
        this.buildTextControls(availFolder, 'avail', true);

        const priceFolder = this.gui.addFolder('Price Text');
        this.buildTextControls(priceFolder, 'price', true);
        priceFolder.add(this.state, 'priceFontFamily', ["'Roboto Mono', monospace", "'Orbitron', sans-serif", "'Exo 2', sans-serif"]).name('Font Family').onChange(v => this.updateCssVariable('--market-card-price-font-family', v));
        const priceGlowFolder = priceFolder.addFolder('Glow');
        priceGlowFolder.addColor(this.state, 'priceGlowColor').name('Color').onChange(() => this.updateTextStyles());
        priceGlowFolder.add(this.state, 'priceGlowRadius', 0, 20, 1).name('Radius (px)').onChange(() => this.updateTextStyles());
        
        const indFolder = this.gui.addFolder('Indicators');
        indFolder.add(this.state, 'indicatorTop', 0, 128, 1).name('Top (px)').onChange(v => this.updateCssVariable('--market-card-indicator-top', `${v}px`));
        indFolder.add(this.state, 'indicatorLeft', 0, 128, 1).name('Left (px)').onChange(v => this.updateCssVariable('--market-card-indicator-left', `${v}px`));
        indFolder.add(this.state, 'indicatorHSpacing', 0, 20, 1).name('H-Spacing (px)').onChange(v => this.updateCssVariable('--market-card-indicator-h-spacing', `${v}px`));
        indFolder.add(this.state, 'indicatorVSpacing', 0, 20, 1).name('V-Spacing (px)').onChange(v => this.updateCssVariable('--market-card-indicator-v-spacing', `${v}px`));
        indFolder.add(this.state, 'indicatorFontSize', 0.5, 1.5, 0.05).name('Font Size (em)').onChange(v => this.updateCssVariable('--market-card-indicator-font-size', `${v}em`));
        indFolder.addColor(this.state, 'indicatorPositiveColor').name('Positive Color').onChange(v => this.updateCssVariable('--market-card-indicator-positive-color', v));
        indFolder.addColor(this.state, 'indicatorNegativeColor').name('Negative Color').onChange(v => this.updateCssVariable('--market-card-indicator-negative-color', v));
        indFolder.addColor(this.state, 'indicatorNeutralColor').name('Neutral Color').onChange(v => this.updateCssVariable('--market-card-indicator-neutral-color', v));

        const moduleFolder = this.gui.addFolder('Transaction Module');
        moduleFolder.add(this.state, 'moduleTop', 0, 100, 1).name('Module Y (px)').onChange(v => this.updateCssVariable('--market-card-module-top', `${v}px`));
        moduleFolder.add(this.state, 'moduleWidth', 80, 150, 1).name('Width (px)').onChange(v => this.updateCssVariable('--market-card-module-width', `${v}px`));
        moduleFolder.add(this.state, 'moduleVGap', 0, 15, 0.1).name('V-Gap (px)').onChange(v => this.updateCssVariable('--market-card-module-v-gap', `${v}px`));
        moduleFolder.add(this.state, 'moduleFontSize', 0.5, 1.5, 0.05).name('Font Size (rem)').onChange(v => this.updateCssVariable('--font-size', `${v}rem`));
        moduleFolder.add(this.state, 'moduleToggleHeight', 20, 50, 1).name('Toggle Height (px)').onChange(v => this.updateCssVariable('--market-card-module-toggle-height', `${v}px`));
        moduleFolder.add(this.state, 'moduleStepperHeight', 20, 50, 1).name('Stepper Height (px)').onChange(v => this.updateCssVariable('--market-card-module-stepper-height', `${v}px`));
        moduleFolder.add(this.state, 'moduleStepperArrowSize', 0.5, 2, 0.1).name('Arrow Size (em)').onChange(v => this.updateCssVariable('--market-card-module-stepper-arrow-size', `${v}em`));
        moduleFolder.add(this.state, 'moduleButtonHeight', 20, 50, 1).name('Button Height (px)').onChange(v => this.updateCssVariable('--market-card-module-button-height', `${v}px`));
        moduleFolder.addColor(this.state, 'buyColor').name('Buy Color').onChange(v => this.updateCssVariable('--buy-primary', v));
        moduleFolder.addColor(this.state, 'sellColor').name('Sell Color').onChange(v => this.updateCssVariable('--sell-primary', v));
        
        const spacingFolder = this.gui.addFolder('Spacing');
        spacingFolder.add(this.state, 'priceIndicatorVGap', 0, 40, 1).name('Price/Indicator V-Gap').onChange(v => this.updateCssVariable('--market-card-price-indicator-v-gap', `${v}px`));
    }

    buildTextControls(folder, prefix, includePositioning = false, posPrefix) {
        posPrefix = posPrefix || prefix;
        if (includePositioning) {
            const posFolder = folder.addFolder('Positioning');
            posFolder.add(this.state, `${posPrefix}Top`, 0, 128, 1).name('Top (px)').onChange(v => this.updateCssVariable(`--market-card-${posPrefix}-top`, `${v}px`));
            posFolder.add(this.state, `${posPrefix}Left`, 0, 200, 1).name('Left (px)').onChange(v => this.updateCssVariable(`--market-card-${posPrefix}-left`, `${v}px`));
        }
        folder.add(this.state, `${prefix}FontSize`, 0.5, 3, 0.05).name('Font Size (rem)').onChange(v => this.updateCssVariable(`--market-card-${prefix}-font-size`, `${v}rem`));
        folder.addColor(this.state, `${prefix}Color`).name('Color').onChange(v => this.updateCssVariable(`--market-card-${prefix}-color`, v));
        const outlineFolder = folder.addFolder('Outline');
        outlineFolder.add(this.state, `${prefix}OutlineWidth`, 0, 5, 0.1).name('Thickness (px)').onChange(() => this.updateTextStyles());
        outlineFolder.addColor(this.state, `${prefix}OutlineColor`).name('Color').onChange(() => this.updateTextStyles());
        const shadowFolder = folder.addFolder('Drop Shadow');
        shadowFolder.add(this.state, `${prefix}ShadowX`, -10, 10, 0.5).name('Offset X (px)').onChange(() => this.updateTextStyles());
        shadowFolder.add(this.state, `${prefix}ShadowY`, -10, 10, 0.5).name('Offset Y (px)').onChange(() => this.updateTextStyles());
        shadowFolder.add(this.state, `${prefix}ShadowBlur`, 0, 20, 0.5).name('Blur (px)').onChange(() => this.updateTextStyles());
        shadowFolder.addColor(this.state, `${prefix}ShadowColor`).name('Color').onChange(() => this.updateTextStyles());
    }
    
    updateAllStyles() {
        for (const key in this.state) {
            const cssVar = this.getCssVarForKey(key);
            const cssVal = this.getCssValueForKey(key);
            if (cssVar) {
                this.updateCssVariable(cssVar, cssVal);
            }
        }
        this.updateTextStyles();
    }

    toggleVisibility() {
        if (!this.gui) return;
        this.active = !this.active;
        this.gui.domElement.style.display = this.active ? 'block' : 'none';
    }

    updateCssVariable(property, value) {
        document.documentElement.style.setProperty(property, value);
    }
    
    updateTextStyles() {
        ['name', 'pinv', 'avail', 'price'].forEach(prefix => {
            let shadows = [];
            if (prefix === 'price' && this.state.priceGlowRadius > 0) {
                shadows.push(`0 0 ${this.state.priceGlowRadius}px ${this.state.priceGlowColor}`);
            }
            if (this.state[`${prefix}OutlineWidth`] > 0) {
                shadows.push(this.createOutline(this.state[`${prefix}OutlineWidth`], this.state[`${prefix}OutlineColor`]));
            }
            if (this.state[`${prefix}ShadowBlur`] > 0 || this.state[`${prefix}ShadowX`] !== 0 || this.state[`${prefix}ShadowY`] !== 0) {
                shadows.push(`${this.state[`${prefix}ShadowX`]}px ${this.state[`${prefix}ShadowY`]}px ${this.state[`${prefix}ShadowBlur`]}px ${this.state[`${prefix}ShadowColor`]}`);
            }
            this.updateCssVariable(`--market-card-${prefix}-text-shadow`, shadows.length > 0 ? shadows.join(', ') : 'none');
        });
    }

    createOutline(width, color) {
        const angles = [0, 45, 90, 135, 180, 225, 270, 315];
        return angles.map(angle => {
            const rad = angle * (Math.PI / 180);
            const x = width * Math.cos(rad);
            const y = width * Math.sin(rad);
            return `${x.toFixed(2)}px ${y.toFixed(2)}px 0 ${color}`;
        }).join(', ');
    }

    createExportTextarea() {
        this.exportTextarea = document.createElement('textarea');
        this.exportTextarea.style.width = '100%';
        this.exportTextarea.style.minHeight = '200px';
        this.exportTextarea.style.fontFamily = 'monospace';
        this.exportTextarea.style.backgroundColor = '#1a1a1a';
        this.exportTextarea.style.color = '#f0f0f0';
        this.exportTextarea.style.border = '1px solid #444';
        this.exportTextarea.readOnly = true;

        const li = document.createElement('li');
        li.appendChild(this.exportTextarea);
        li.classList.add('lil-gui');
        
        this.gui.children[0].domElement.parentElement.appendChild(li);
    }
    
    exportCssDeltas() {
        let output = ':root {\n';
        let changed = false;
        for (const key in this.state) {
            if (JSON.stringify(this.state[key]) !== JSON.stringify(this.defaults[key])) {
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
            this.exportTextarea.value = output;
        } else {
            this.exportTextarea.value = "No changes detected from defaults.";
        }
    }
    
    getCssVarForKey(key) {
        const prefixMap = {
            name: '--market-card-name', pinv: '--market-card-pinv', avail: '--market-card-avail', price: '--market-card-price'
        };
        for (const p in prefixMap) {
            if (key.startsWith(p)) {
                const suffix = key.substring(p.length).replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
                return `${prefixMap[p]}${suffix}`;
            }
        }
        
        const map = {
            cardHeight: '--market-card-height', cardBorderRadius: '--market-card-border-radius',
            infoTop: '--market-card-info-top', infoLeft: '--market-card-info-left',
            indicatorTop: '--market-card-indicator-top', indicatorLeft: '--market-card-indicator-left', indicatorHSpacing: '--market-card-indicator-h-spacing', indicatorVSpacing: '--market-card-indicator-v-spacing', indicatorFontSize: '--market-card-indicator-font-size',
            indicatorPositiveColor: '--market-card-indicator-positive-color', indicatorNegativeColor: '--market-card-indicator-negative-color', indicatorNeutralColor: '--market-card-indicator-neutral-color',
            priceIndicatorVGap: '--market-card-price-indicator-v-gap',
            moduleTop: '--market-card-module-top', moduleWidth: '--market-card-module-width', moduleVGap: '--market-card-module-v-gap', moduleFontSize: '--font-size',
            moduleToggleHeight: '--market-card-module-toggle-height', moduleStepperHeight: '--market-card-module-stepper-height', moduleButtonHeight: '--market-card-module-button-height',
            moduleStepperArrowSize: '--market-card-module-stepper-arrow-size', buyColor: '--buy-primary', sellColor: '--sell-primary',
        };
        return map[key] || null;
    }

    getCssValueForKey(key) {
        const value = this.state[key];
        const unitMap = {
            FontSize: 'rem', Top: 'px', Left: 'px', Width: 'px', Height: 'px', Radius: 'px', VGap: 'px', HSpacing: 'px', VSpacing: 'px', Blur: 'px', ArrowSize: 'em'
        };
        for(const suffix in unitMap) {
            if(key.endsWith(suffix)) return `${value}${unitMap[suffix]}`;
        }
        return value;
    }
}