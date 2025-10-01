/**
 * @fileoverview Defines the BaseEffect class, an abstract blueprint for all visual effects.
 * This class should not be instantiated directly. Instead, specific effect classes
 * should extend it and implement its methods.
 */

export class BaseEffect {
    /**
     * @JSDoc
     * @constructor
     * @param {object} options - Configuration for the effect, passed from the trigger.
     */
    constructor(options) {
        this.options = options;
    }

    /**
     * @JSDoc
     * @method play
     * @description The main entry point for the effect. The EffectsManager calls this method.
     * It is responsible for the entire lifecycle of the effect (setup, animation, cleanup).
     * Subclasses MUST implement this method.
     * @returns {Promise<void>} A promise that resolves when the effect is completely finished.
     */
    async play() {
        throw new Error("Effects must implement the 'play' method.");
    }

    /**
     * @JSDoc
     * @method _createDOM
     * @protected
     * @description Creates the necessary DOM elements for the effect and appends them to the document.
     * Subclasses should implement this to build their specific HTML structure.
     */
    _createDOM() {
        // To be implemented by subclasses
    }

    /**
     * @JSDoc
     * @method _injectCSS
     * @protected
     * @description Injects the effect-specific CSS into the document's head.
     * Subclasses should implement this to provide their styling.
     */
    _injectCSS() {
        // To be implemented by subclasses
    }

    /**
     * @JSDoc
     * @method _cleanup
     * @protected
     * @description Removes all DOM elements and CSS created by the effect.
     * This method is crucial for leaving the DOM in a clean state.
     */
    _cleanup() {
        // To be implemented by subclasses
    }
}