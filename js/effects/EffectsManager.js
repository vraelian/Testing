/**
 * @fileoverview Defines the EffectsManager, a controller for queueing and playing visual effects.
 */

export class EffectsManager {
    /**
     * @JSDoc
     * @constructor
     */
    constructor() {
        /** @private @type {Array<object>} */
        this.effectQueue = [];
        /** @private @type {boolean} */
        this.isEffectActive = false;
        /** @private @type {Object<string, typeof BaseEffect>} */
        this.effectsRegistry = {};
    }

    /**
     * @JSDoc
     * @method registerEffect
     * @description Adds an effect class to the registry, making it available to be triggered.
     * @param {string} name - The unique name to identify the effect (e.g., 'systemSurge').
     * @param {typeof BaseEffect} effectClass - The class definition for the effect, which must extend BaseEffect.
     */
    registerEffect(name, effectClass) {
        this.effectsRegistry[name] = effectClass;
    }

    /**
     * @JSDoc
     * @method trigger
     * @description Adds an effect request to the queue and starts processing.
     * @param {string} effectName - The name of the effect to trigger, must match a registered effect.
     * @param {object} options - The configuration object to pass to the effect's constructor.
     */
    trigger(effectName, options) {
        console.log(`MANAGER: EffectsManager.trigger received call for '${effectName}'. Queue length: ${this.effectQueue.length}`); // DIAGNOSTIC LOG
        this.effectQueue.push({ effectName, options });
        this._processQueue();
    }

    /**
     * @JSDoc
     * @method _processQueue
     * @private
     * @async
     * @description Processes the effect queue sequentially. It takes the next effect from the queue,
     * plays it, and waits for it to complete before starting the next one.
     */
    async _processQueue() {
        if (this.isEffectActive || this.effectQueue.length === 0) {
            return;
        }

        this.isEffectActive = true;
        const request = this.effectQueue.shift();
        const EffectClass = this.effectsRegistry[request.effectName];

        if (!EffectClass) {
            console.warn(`EffectManager: Attempted to trigger unregistered effect '${request.effectName}'.`);
            this.isEffectActive = false;
            this._processQueue(); // Process next item
            return;
        }

        try {
            console.log(`MANAGER: Instantiating and playing effect: '${request.effectName}'.`); // DIAGNOSTIC LOG
            const effect = new EffectClass(request.options);
            await effect.play();
        } catch (error) {
            console.error(`Error playing effect '${request.effectName}':`, error);
        } finally {
            this.isEffectActive = false;
            // Check for more effects that may have been added during playback
            this._processQueue();
        }
    }
}