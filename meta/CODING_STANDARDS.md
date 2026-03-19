// meta/CODING_STANDARDS.md

# Orbital Trading: Coding Standards & Protocols

## 1. AI Implementation Protocols
These rules govern how the AI Assistant must interact with the codebase.

**1.1 The "Append/Merge" Strategy**
* **Constraint:** Never provide truncated files.
* **Rule:** When updating a file, provide the Full, Complete, Executable file content.
* **Reasoning:** Partial updates lead to context loss and copy-paste errors.

**1.2 The "Virtual Workbench"**
* **Methodology:** Before generating code, mentally identify the specific "blocks" of logic affected.
* **Process:** Parse the existing file -> Apply changes internally -> Verify closing braces/parentheses -> Output final result.

**1.3 Strict "Zero-Inference"**
* **Rule:** Do not guess at game design changes.
* **Protocol:** If a request is ambiguous, ask clarifying questions before writing code.

## 2. JavaScript Architecture
**2.1 Service-Oriented Pattern**
* **Services are Singletons:** Logic services are instantiated once by SimulationService.
* **State Separation:** Services contain Logic, GameState contains Data.
* **Facade Access:** SimulationService is the entry point for Game Logic. UIManager is the entry point for Rendering.

**2.2 Naming Conventions**
* **Classes:** PascalCase (e.g., `PlayerActionService`).
* **Methods:** camelCase (e.g., `calculateFuelCost`).
* **Private Methods:** Prefix with underscore `_` (e.g., `_updateInternalState`).
* **Constants:** UPPER_SNAKE_CASE (e.g., `MAX_INVENTORY_SLOTS`).

**2.3 JSDoc Requirements**
All public methods must include JSDoc blocks detailing purpose, parameters, and returns.

**2.4 Logging**
* **Prohibited:** `console.log`, `console.warn`, `console.error`.
* **Required:** Use the `LoggingService` (injected as `this.logger`).

## 3. High-Performance Mobile Constraints (iOS Native Target)
**3.1 Deferred State & JIT Commits (ADR-029)**
* **Mandate:** High-frequency simulation loops (like the Sol Station endgame engine) MUST NOT directly mutate the global `GameState` or force UI re-renders on every tick.
* **Protocol:** Utilize a `deferredState` buffer within the service to accumulate math logic. Expose interpolated View-Model data to the UI layer. Only execute a "Just-In-Time (JIT) Commit" to the global `GameState` when the user physically leaves the screen or triggers a hard transaction.

**3.2 WebP Sprite Sheet Mandate (ADR-035)**
* **Mandate:** The game must never load individual image files for UI portraits, icons, or badges.
* **Protocol:** All static 2D UI art must be compiled into a master `.webp` sprite sheet. Render elements dynamically utilizing CSS `background-image` and precise `background-position` coordinates mapped via the global `PortraitRegistry`.

## 4. Forbidden Patterns
**4.1 No innerHTML for User Input**
Never use `.innerHTML` to insert strings that could contain user-generated content. Use `.textContent`.

**4.2 No Direct GameState Mutation from UI**
The UI Layer (UIManager and Controllers) must READ from GameState but NEVER WRITE to it. UI interactions must call a Service method.

**4.3 No Magic Numbers**
Avoid hardcoded numbers in logic files. Define them in `js/data/constants.js`.

**4.4 Implicit Button Types (The "Mars Revert" Bug)**
* **Stability:** Never define a `<button>` without a `type` attribute. Browsers default to `type="submit"`, causing SPA reloads.
* **Correction:** Always write `<button type="button" ...>`.

**4.5 Unhandled Default Events**
Always explicitly call `event.preventDefault()` at the start of delegated click handlers.

**4.6 Cinematic Transitions and Web Animations API**
* **Stability:** Do not use CSS `.hidden` class toggling for full-screen cinematic fades.
* **Correction:** Use the native Web Animations API (`Element.animate()`) for independent cinematic blocking. 
* **Strict Cleanup Mandate:** You MUST explicitly strip inline styles injected by the API within the `.onfinish` callback.