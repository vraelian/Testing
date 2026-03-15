// meta/CODING_STANDARDS.md

Orbital Trading: Coding Standards & Protocols

1. AI Implementation Protocols
These rules govern how the AI Assistant (Gemini) must interact with the codebase.

1.1 The "Append/Merge" Strategy
Constraint: Never provide truncated files.
Rule: When updating a file, provide the Full, Complete, Executable file content.
Reasoning: Partial updates (e.g., "// ... existing code ...") lead to context loss and copy-paste errors by the user.

1.2 The "Virtual Workbench"
Methodology: Before generating code, mentally identify the specific "blocks" of logic affected.
Process:
Parse the existing file from the provided context.
Apply the changes internally.
Verify the integrity of the closing braces } and parentheses ).
Output the final result.

1.3 Strict "Zero-Inference"
Rule: Do not guess at user intent regarding game design changes.
Protocol: If a request is ambiguous, ask clarifying questions before writing code.
Logic: Code changes must be "Surgical" and "Intentional."

2. JavaScript Architecture
2.1 Service-Oriented Pattern
Services are Singletons: Logic services (e.g., MarketService) are instantiated once by SimulationService.
State Separation: Services contain Logic, GameState contains Data. Services should not hold state properties unless they are ephemeral (e.g., lastFrameTime).
Facade Access:
SimulationService is the entry point for Game Logic.
UIManager is the entry point for Rendering.

2.2 Naming Conventions
Classes: PascalCase (e.g., PlayerActionService).
Methods: camelCase (e.g., calculateFuelCost).
Private Methods: Prefix with underscore _ (e.g., _updateInternalState).
Constants: UPPER_SNAKE_CASE (e.g., MAX_INVENTORY_SLOTS).
DOM Elements: Variables holding DOM refs should ideally be cached in this.cache or named clearly (e.g., submitBtn).

2.3 JSDoc Requirements
All public methods must include JSDoc blocks.

JavaScript
/**
 * Short description of what the function does.
 * @param {Type} paramName - Description of the parameter.
 * @returns {Type} Description of the return value.
 */

2.4 Logging
Prohibited: console.log, console.warn, console.error.
Required: Use the LoggingService (injected as logger).
this.logger.info(...)
this.logger.warn(...)
this.logger.error(...)

3. Forbidden Patterns
3.1 No innerHTML for User Input
Security: Never use .innerHTML to insert strings that could contain user-generated content (e.g., Ship Names). Use .textContent or explicitly construct DOM nodes.

3.2 No Direct GameState Mutation from UI
Flow Violation: The UI Layer (UIManager and Controllers) must READ from GameState but NEVER WRITE to it.
Correction: UI interactions must call a Service method (via ActionClickHandler or SimulationService) to request a change.

3.3 No Magic Numbers
Maintenance: Avoid hardcoded numbers in logic files (e.g., if (price > 1000)).
Correction: Define these as constants in js/data/constants.js and import them.

3.4 Implicit Button Types
**Stability:** Never define a `<button>` without a `type` attribute.
**Risk:** Browsers default to `type="submit"`, causing page reloads that dump game state (The "Mars Revert" Bug).
**Correction:** Always write `<button type="button" ...>`.

3.5 Unhandled Default Events
**Stability:** When handling a click for a game action, always assume the browser might have a default behavior attached.
**Correction:** Explicitly call `event.preventDefault()` at the start of the handler case.

3.6 Cinematic Transitions and Web Animations API
**Stability:** Bespoke, full-screen cinematic transitions (like the Intro sequence) or localized inline component sequences (like the Ship Upgrade Animation) must not rely on standard CSS `.hidden` class toggling to handle complex fades, as this creates race conditions and visible flashing when the `UIManager` executes aggressive DOM wiping and state re-renders.
**Correction:** Use the native Web Animations API (`Element.animate()`) for independent cinematic blocking. The actual `GameState` mutations and `UIManager.render()` calls should be executed *during* the blackout/hold phase of the animation. 
**Strict Cleanup Mandate:** You MUST explicitly ensure all inline styling injected by the API (e.g., `opacity`, `filter`, `transform`) is fully stripped or reset to its baseline state within the `.onfinish` callback. Failure to clean up injected Web Animations API styles will permanently break subsequent UI rendering behavior for those elements.