# Game Design Document: Metal Update V1 (v7 - Machine-Readable Release)

## Table of Contents

1.  **[1.0 Overview](#10-overview)**
    * [1.1 Feature Summary](#11-feature-summary)
    * [1.2 Objectives](#12-objectives)
    * [1.3 Implementation Context & Goals (For AI Parser)](#13-implementation-context--goals-for-ai-parser)
2.  **[2.0 Resource Details: Metal Scrap](#20-resource-details-metal-scrap)**
    * [2.1 Core Concept & Rationale](#21-core-concept--rationale)
    * [2.2 Acquisition & Generation](#22-acquisition--generation)
        * [2.2.1 Primary Source (HULL Repair)](#221-primary-source-hull-repair)
        * [2.2.2 Generation Formula & Balancing](#222-generation-formula--balancing)
        * [2.2.3 Secondary Sources (Future Scope)](#223-secondary-sources-future-scope)
    * [2.3 Storage & Properties](#23-storage--properties)
    * [2.4 Utility (Sinks)](#24-utility-sinks)
3.  **[3.0 UI/UX Implementation](#30-uiux-implementation)**
    * [3.1 Market Screen Sub-Screen System](#31-market-screen-sub-screen-system)
        * [3.1.1 Sub-Screens](#311-sub-screens)
        * [3.1.2 Navigation Pager](#312-navigation-pager)
        * [3.1.3 Carousel Container](#313-carousel-container)
        * [3.1.4 Swipe Navigation](#314-swipe-navigation)
    * [3.2 Materials Sub-Screen & Material Card](#32-materials-sub-screen--material-card)
        * [3.2.1 Metal Scrap Card Visuals (Performance-First)](#321-metal-scrap-card-visuals-performance-first)
        * [3.2.2 Metal Scrap Card Layout](#322-metal-scrap-card-layout)
        * [3.2.3 Omitted Elements](#323-omitted-elements)
    * [3.3 Services Screen: Scrap Bar](#33-services-screen-scrap-bar)
        * [3.3.1 Location](#331-location)
        * [3.3.2 Container & Visuals](#332-container--visuals)
        * [3.3.3 Text Overlay](#333-text-overlay)
        * [3.3.4 Bar Fill Logic (UX-Refined)](#334-bar-fill-logic-ux-refined)
        * [3.3.5 Examples (UX-Refined)](#335-examples-ux-refined)
    * [3.4 Floating Text Feedback](#34-floating-text-feedback)
4.  **[4.0 Player Onboarding (Deferred Implementation)](#40-player-onboarding-deferred-implementation)**
    * [4.1 Trigger](#41-trigger)
    * [4.2 UI/UX (Tutorial Toast)](#42-uiux-tutorial-toast)
    * [4.3 Implementation Note](#43-implementation-note)
5.  **[5.0 Gameplay & Lore Rationale](#50-gameplay--lore-rationale)**
    * [5.1 Gameplay Impact](#51-gameplay-impact)
    * [5.2 Lore Integration](#52-lore-integration)
6.  **[6.0 Key Visual References (Analogs)](#60-key-visual-references-analogs)**
    * [6.1 Market Pager](#61-market-pager)
    * [6.2 Market Carousel](#62-market-carousel)
    * [6.3 Floating Text](#63-floating-text)
    * [6.4 Commodity Card Transaction Module](#64-commodity-card-transaction-module)
    * [6.5 Scrap Bar Styling](#65-scrap-bar-styling)
7.  **[7.0 Engineering Implementation Plan (The "How")](#70-engineering-implementation-plan-the-how)**
    * [7.1 Engineering Preamble (For AI Parser)](#71-engineering-preamble-for-ai-parser)
    * [7.2 Phase 1: Data & State Foundation](#72-phase-1-data--state-foundation)
    * [7.3 Phase 2: Core Logic, Effects, & Balancing](#73-phase-2-core-logic-effects--balancing)
    * [7.4 Phase 3: UI Structure & Styling](#74-phase-3-ui-structure--styling)
    * [7.5 Phase 4: UI Logic, Handlers, & Optimization](#75-phase-4-ui-logic-handlers--optimization)
    * [7.6 Phase 5: Onboarding (Deferred)](#76-phase-5-onboarding-deferred)
    * [7.7 Phase 6: Documentation & Maintenance](#77-phase-6-documentation--maintenance)
8.  **[8.0 Quality Assurance Test Plan](#80-quality-assurance-test-plan)**
    * [8.1 Test Plan: Phase 1 (Data & State)](#81-test-plan-phase-1-data--state)
    * [8.2 Test Plan: Phase 2 (Core Logic & Effects)](#82-test-plan-phase-2-core-logic--effects)
    * [8.3 Test Plan: Phase 3 (UI Structure & Styling)](#83-test-plan-phase-3-ui-structure--styling)
    * [8.4 Test Plan: Phase 4 (UI Logic & Regression)](#84-test-plan-phase-4-ui-logic--regression)
    * [8.5 Test Plan: Phase 5 (Onboarding)](#85-test-plan-phase-5-onboarding)
    * [8.6 Test Plan: Phase 6 (Documentation)](#86-test-plan-phase-6-documentation)
9.  **[9.0 Appendices (Context & Data)](#90-appendices-context--data)**
    * [9.1 Appendix A: Data & State Schema (Machine-Readable)](#91-appendix-a-data--state-schema-machine-readable)
    * [9.2 Appendix B: Component Responsibility Key](#92-appendix-b-component-responsibility-key)
    * [9.3 Appendix C: New CSS Class Library (Machine-Readable)](#93-appendix-c-new-css-class-library-machine-readable)
    * [9.4 Appendix D: Decision Rationale Log](#94-appendix-d-decision-rationale-log)

---

## 1.0 Overview

### 1.1 Feature Summary
This document details the "Metal Update V1," a foundational update introducing a new resource system. The core of this update is **Metal Scrap**, a passive, non-cargo resource generated primarily through ship maintenance. This resource is designed to be "low-friction," meaning it does not consume cargo space, has no inventory limit, and cannot be purchased, only earned.

### 1.2 Objectives
The update's objectives are:
1.  **Introduce Metal Scrap:** A new player-owned resource (`player.metalScrap`).
2.  **Integrate Generation:** Tie scrap generation directly to the HULL repair service, balanced to be a "modest" credit recoup.
3.  **Expand Market UI:** Create a new "Materials" sub-screen on the Market screen, necessitating a new carousel-based UI with a segmented pager and swipe controls.
4.  **Create Material Card:** Design a new, visually distinct "Material Card" for selling Metal Scrap.
5.  **Add Visual Feedback:** Implement a "Scrap Bar" on the Services screen for at-a-glance tracking and a new blue floating text (`+ METAL`) for acquisition feedback.
6.  **Ensure Performance & Stability:** Implement all UI updates defensively to prevent performance degradation and regressions to existing systems, prioritizing iOS/WKWebView performance.

### 1.3 Implementation Context & Goals (For AI Parser)
* **Purpose:** This document is a "cold-delivery" artifact intended for an AI implementation partner (Gemini). It is designed to be verbose, explicit, and highly-detailed to minimize inference, guesswork, and ambiguity.
* **Mandatory Action:** The implementer **MUST** read this document in its entirety, paying special attention to **Section 6.0 (Key Visual References)**, **Section 7.0 (Engineering Implementation Plan)**, and **Section 9.0 (Appendices)** before writing any code.
* **Workflow:** The implementation **MUST** follow the 6-Phase plan outlined in Section 7.0. All code must adhere to the "Virtual Workbench" methodology (modifying and outputting complete, single files).
* **Single Source of Truth:** This GDD is a high-level specification. For exact implementation details (file names, data keys, CSS classes), you **MUST** use the machine-readable helper files as your single source of truth:
    * `meta/GDD_Metal_Update_v7.datakeys.json`
    * `meta/GDD_Metal_Update_v7.csskeys.json`

---

## 2.0 Resource Details: Metal Scrap

### 2.1 Core Concept & Rationale
Metal Scrap is a non-cargo, unlimited-storage resource representing salvaged industrial materials. It is acquired as a byproduct of gameplay actions (primarily HULL repair) and serves as a long-term resource for two main sinks:
1.  **Sale:** Provides a steady, supplemental credit income stream. This is intended to be a *modest* (e.g., 10-12%) recoup of repair costs, not a primary income source.
2.  **Donation:** (Future Scope) Will be the key resource for contributing to long-term, high-cost construction projects (e.g., space stations).

### 2.2 Acquisition & Generation

#### 2.2.1 Primary Source (HULL Repair)
Metal Scrap is automatically generated and added to the player's inventory when purchasing HULL repairs on the Services screen.

#### 2.2.2 Generation Formula & Balancing
Generation is tied directly to the amount of HULL repaired, not the credits spent. This avoids issues with fluctuating repair costs.
* **Constant:** A new constant, `CONSTANTS.SCRAP_PER_HULL_POINT`, will be added.
* **Balancing (v1):** `SCRAP_PER_HULL_POINT = 0.02`
* **Designer's Note (Balancing):** This value is critical. The starter ship "Lancer" has a repair cost of `250c` per hull point. The material sell value is `1500c` per ton.
    * `0.02 scrap/hull * 1500c/ton = 30c revenue/hull`
    * `30c revenue / 250c cost = 12% recoup rate`
    This 12% rate is intentional, aligning with the design goal of a "modest" recoup. This prevents an "infinite money" exploit where `Value(Scrap) > Cost(Repair)`. This value is a placeholder and **MUST** be re-evaluated if repair costs or the scrap sell value change.

#### 2.2.3 Secondary Sources (Future Scope)
Scrap may also be awarded from mission rewards, event outcomes, or salvage operations.

### 2.3 Storage & Properties
* **Inventory:** Stored as a number in `GameState.player.metalScrap`.
* **Default Value:** `0`.
* **Cargo:** Does **not** count as cargo and does not interact with the cargo hold.
* **Limit:** There is **no quantity limit**.
* **Unit:** The resource is tracked in Tons (e.g., `12.75`).

### 2.4 Utility (Sinks)
* **Sell:** Metal Scrap can be sold for credits at any market via the "Materials" sub-screen.
    * **Sell Value:** The base sell value is fixed at **1,500 Credits per 1 Ton**.
* **Purchase:** Metal Scrap can **never** be purchased. The UI will reflect this by omitting all "buy" functionality.

---

## 3.0 UI/UX Implementation

### 3.1 Market Screen Sub-Screen System
The Market screen will be rebuilt to house a horizontal "carousel" with multiple sub-screens, controlled by a new pager.

#### 3.1.1 Sub-Screens
* **Materials** (Index 0, Left)
* **Commodities** (Index 1, Middle, **Default**)

#### 3.1.2 Navigation Pager
* **Visual:** A two-button segmented control, identical in aesthetic and function to the Hangar/Shipyard pager (`#hangar-toggle-container`), will be added below the sub-nav bar.
* **HTML ID:** `#market-pager-container`.
* **Buttons:**
    * `[ MATERIALS ]` (with `data-action="market-page-materials"`)
    * `[ COMMODITIES ]` (with `data-action="market-page-commodities"`)
* **State:** The active sub-screen's button will have the `.btn-primary` class (bright, filled). The inactive button will have the `.btn-secondary` class (dark, bordered).
* **Interaction (Tap):** Tapping the inactive button (e.g., "MATERIALS") will update the `GameState.uiState.marketSubScreen` to `'materials'`, swap the button classes, and trigger the carousel animation.

#### 3.1.3 Carousel Container
* The existing market content will be wrapped in a carousel structure (e.g., `#market-carousel-slider`) containing two child `div`s: `#market-materials-screen` and `#market-commodities-screen`.
* The `UIManager` will apply a CSS transform (e.g., `translateX(-100%)`) to show the Materials screen based on the `uiState.marketSubScreen` value.

#### 3.1.4 Swipe Navigation
* Horizontal swipe gestures (left/right) on the carousel content area will also be supported.
* A swipe will update `GameState.uiState.marketSubScreen` and automatically update the active/inactive state of the pager buttons to remain synchronized.

### 3.2 Materials Sub-Screen & Material Card

#### 3.2.1 Metal Scrap Card Visuals (Performance-First)
* **Shape:** A standard rectangle with sharp corners (`border-radius: 0;`).
* **Decision Rationale:** This design replaces the previous `clip-path` (tapered corners) specification. `clip-path` can cause rendering artifacts and performance issues on low-end mobile GPUs (like those in iOS devices running a WKWebView).
* **Visual Distinction:** The existing Commodity cards use a `border-radius`. Using sharp `0px` corners provides the necessary visual distinction from commodity cards while maximizing rendering performance. See **Appendix D** for more.
* **Style:** Standard dark, semi-transparent background (`var(--color-bg-dark-75)`) and a 1px solid border (`var(--color-border-medium)`).
* **CSS Class:** `.material-card`

#### 3.2.2 Metal Scrap Card Layout
(Top to Bottom)
1.  **Header:** "METAL SCRAP" (Font: `var(--font-primary)`, large, bold, uppercase. Color: `var(--color-text-header)`).
2.  **Inventory:** "INVENTORY: X.XX TONS" (e.g., "12.75 TONS". Font: `var(--font-secondary)`, small, uppercase. Color: `var(--color-text-secondary)`). This value is a direct binding to `player.metalScrap`.
3.  **Separator:** A thin 1px horizontal line (`var(--color-divider)`).
4.  **Sell-Only Transaction Module:** This module is permanently themed with "sell" colors (using `var(--color-danger)` for highlights).
    * **Label/Price:** "SELL VALUE: 1,500 CREDITS / TON" (Static text).
    * **Controls:** The standard quantity input, steppers (`+`/`-`), "MAX" button, and a "SELL" confirmation button (styled with `.btn-danger` classes).

#### 3.2.3 Omitted Elements
The card will **not** display MKT/PL indicators, Market Availability, Purchase Price, or the Buy/Sell Toggle Button.

### 3.3 Services Screen: Scrap Bar
A new UI element on the Services screen will provide a constant visual reference for the player's scrap inventory.

#### 3.3.1 Location
Rendered directly **below the HULL repair block** (`#services-hull-repair`).

#### 3.3.2 Container & Visuals
* **Container:** A new `div` with ID `#scrap-bar-container`.
* **Bar:** A `div` (`#scrap-bar`) with a dark, inset background (`var(--color-bg-dark)`) and a standard border (`var(--color-border-medium)`).
* **Fill:** A child `div` (`#scrap-bar-fill`) styled with an industrial, metallic color (e.g., a new `var(--color-metal-scrap)`, which can default to `var(--color-border-medium)`).

#### 3.3.3 Text Overlay
* A `div` (`#scrap-bar-text`) positioned absolutely, centered over the bar.
* **Text:** "X TONS" (e.g., "2 TONS"). This text **always rounds down** to the nearest whole number.
* **Font:** `var(--font-primary)`, bold, uppercase.
* **Style:** `text-shadow: 1px 1px 2px var(--color-bg-dark);` to ensure readability over the fill.

#### 3.3.4 Bar Fill Logic (UX-Refined)
* **Logic:** This logic is designed to give the player the satisfaction of seeing a "full bar" upon reaching a new ton.
    1.  The bar tracks fractional progress *after* the first increment is reached.
    2.  When a whole ton is reached (e.g., `3.00`), the bar will display **100% full** (representing the *completion* of the previous ton).
    3.  The bar **remains at 100%** until the first fractional increment (0.2 tons) is gained.
    4.  Once the player reaches `3.20` tons, the bar drops to `20%` to show progress *towards* the next ton.
* **Decision Rationale:** The previous logic (`X.00 tons = 0% full`) was mathematically cleaner but poor UX, as the player would *never* see a 100% full bar. This revised logic creates a "window of opportunity" (from `X.00` to `X.19`) for the player to see their completed achievement. See **Appendix D**.
* The bar is visually divided into **5 increments** (0.2 tons / 20% each).
* The fill `div`'s width will **snap** to the nearest 20% increment *rounding down*.

#### 3.3.5 Examples (UX-Refined)
* `2.00 Tons`: Text "2 Tons", Bar **100%** (5/5 increments).
* `2.12 Tons`: Text "2 Tons", Bar **100%** (5/5 increments).
* `2.20 Tons`: Text "2 Tons", Bar **20%** (1/5 increments).
* `2.78 Tons`: Text "2 Tons", Bar **60%** (3/5 increments).
* `2.99 Tons`: Text "2 Tons", Bar **80%** (4/5 increments).
* `3.00 Tons`: Text "3 Tons", Bar **100%** (5/5 increments).
* `3.19 Tons`: Text "3 Tons", Bar **100%** (5/5 increments).
* `3.20 Tons`: Text "3 Tons", Bar **20%** (1/5 increments).

### 3.4 Floating Text Feedback
* **Trigger:** Any event that increases `GameState.player.metalScrap` (e.g., `repairTick`).
* **Text:** `+ METAL`.
* **Color:** **Blue**. This will use `var(--color-blue)` from `global.css`.
* **Position:** Centered vertically and horizontally on the game screen. A new CSS class `.floating-text.center-screen` will be created for this.
* **Behavior:** Animation (fade in, rise, fade out) will be identical to existing floating text.
* **Note:** There will be **no** deduction FT for selling or donating scrap.

---

## 4.0 Player Onboarding (Deferred Implementation)

### 4.1 Trigger
This event will trigger **one time only**.
* **Condition:** The first time `GameState.player.metalScrap` becomes greater than `0`.
* **Implementation:** A new boolean flag, `GameState.player.flags.hasSeenScrapTutorial`, will be created (defaulting to `false`) and checked/set by the `PlayerActionService`.

### 4.2 UI/UX (Tutorial Toast)
* A Tutorial Toast (TT) will be triggered (via `TutorialService.showToast`).
* **Header:** `NEW RESOURCE: METAL SCRAP`
* **Body:** "Repairing your hull now generates Metal Scrap. This is a special resource that **doesn't use cargo space**. You can sell it for credits at any station via the **Market > Materials** tab."

### 4.3 Implementation Note
This feature is designated as **Phase 5 (Deferred)**. It is documented here for design completeness but is not part of the initial "Metal Update V1" implementation push.

---

## 5.0 Gameplay & Lore Rationale

### 5.1 Gameplay Impact
This feature introduces a passive resource loop that rewards players for activity (risking damage) and maintenance (repairing). It creates a new, stable, and "modest" income source that isn't dependent on market fluctuation. It also provides a resource-based foundation for future long-term goals (construction projects), giving players a new vector for progression beyond credit accumulation.

### 5.2 Lore Integration
Metal Scrap reinforces the gritty, industrial, "make-do" feel of the universe. Ships are constantly breaking down, and recycling those broken parts into usable material is highly logical. It aligns with **"The Razor's Edge of Commerce"** by creating value from the dangerous (and damaging) act of plying the trade routes. Its future use for station-building aligns with **"Wealth is the Way"**, as it allows players to invest their byproducts (a form of wealth) into tangible, system-changing projects.

---

## 6.0 Key Visual References (Analogs)

These are existing components in the codebase that the new features must visually and functionally emulate for consistency.

### 6.1 Market Pager
* **Analog:** Hangar/Shipyard Pager
* **Files:** `js/ui/components/HangarScreen.js`, `css/screens/hangar-screen.css`
* **Visual:** It is a two-button, conjoined, segmented control (`<div class="toggle-container">`) styled identically.
* **Style:** Uses `.btn-primary` for the active state (filled, bright) and `.btn-secondary` for the inactive state (bordered, dark).

### 6.2 Market Carousel
* **Analog:** Hangar/Shipyard Carousel
* **Files:** `js/ui/components/HangarScreen.js`, `js/services/handlers/CarouselEventHandler.js`, `css/screens/hangar-screen.css`
* **Visual:** Content slides horizontally to reveal different sub-screens (`#market-materials-screen`, `#market-commodities-screen`) within a container (`#market-carousel-slider`). Use CSS `transform: translateX()` for positioning.
* **Function:** Supports both tapping the pager buttons and horizontal swipe gestures. Swipe detection and state updates managed by a *new instance* of `CarouselEventHandler`.

### 6.3 Floating Text
* **Analog:** Existing Credit/Debit Floating Text
* **Files:** `js/effects/EffectsManager.js`, `css/global.css`
* **Visual:** Text (`+ METAL`) appears, animates upwards, and fades out.
* **Style:** Uses the `.floating-text` class for base animation. A new `.center-screen` class will be added for absolute centering. Color will be blue (`var(--color-blue)`).

### 6.4 Commodity Card Transaction Module
* **Analog:** Existing Commodity Card Transaction Module
* **Files:** `js/ui/components/MarketScreen.js`, `css/screens/market-screen.css`, `js/services/handlers/MarketEventHandler.js`
* **Visual:** The Material Card's sell module must reuse the existing HTML structure and classes for quantity input, `+`/`-` steppers, "MAX" button, and "Confirm" button.
* **Function:** Steppers, "MAX", and "Confirm" buttons must be wired to `MarketEventHandler.js` and `HoldEventHandler.js` identically to commodity cards.

### 6.5 Scrap Bar Styling
* **Analog:** Status Pod Bars (Hull/Fuel/Cargo) in Header
* **Files:** `css/hud.css`, `js/services/UIManager.js` (for HUD update logic reference)
* **Visual:** A horizontal bar (`#scrap-bar`) with a background and a dynamically sized fill element (`#scrap-bar-fill`). Text (`#scrap-bar-text`) overlaid and centered.
* **Style:** Use similar dimensions, `border-radius`, background colors (`var(--color-bg-dark)`), and border styles (`var(--color-border-medium)`) as the HUD status bars.

---

## 7.0 Engineering Implementation Plan (The "How")

### 7.1 Engineering Preamble (For AI Parser)
* **Workflow:** This implementation **MUST** follow the 6-Phase plan outlined below. Each phase is a logical prerequisite for the next.
* **Methodology:** All code modifications **MUST** adhere to the "Virtual Workbench" methodology. The implementer will identify the affected files for a given phase, load their full content, perform surgical modifications to all required "virtual blocks" (functions, classes, CSS rules), and then output the **single, complete, updated file** for each file modified in that phase.
* **Context:** Before starting a phase, review the appendices:
    * **Appendix A & C:** For the *file paths* to the machine-readable JSON helper files.
    * **Appendix B:** For the *role* of each service/component.
    * **Appendix D:** For the *reasoning* behind key design changes.

### 7.2 Phase 1: Data & State Foundation
**Purpose:** Establish the "Metal Scrap" resource in core data, database, and state.
* **Action:** Implement all changes specified in `meta/GDD_Metal_Update_v7.datakeys.json`.
* **Files to Modify:**
    1.  `js/data/constants.js`
    2.  `js/data/database.js`
    3.  `js/services/GameState.js`

### 7.3 Phase 2: Core Logic, Effects, & Balancing
**Purpose:** Implement scrap generation (repairing), spending (selling), and generation feedback (floating text).
* **Action:** Implement the logic as detailed below.
* **Files to Modify:**
    1.  `js/services/player/PlayerActionService.js` (Inject `uiManager`, `tutorialService`; Modify `repairTick`)
    2.  `js/services/SimulationService.js` (Inject `effectsManager`; Create `sellMaterial`)
    3.  `js/effects/EffectsManager.js` (Modify `floatingText` for 'blue' type and 'center-screen' position)
    4.  `css/global.css` (Add CSS var `var(--color-metal-scrap)` and class `.floating-text.center-screen` as specified in `meta/GDD_Metal_Update_v7.csskeys.json`)

### 7.4 Phase 3: UI Structure & Styling
**Purpose:** Build HTML structures and CSS styles for the Scrap Bar (Services screen) and the Pager/Carousel/Material Card (Market screen).
* **Action:** Implement all changes specified in `meta/GDD_Metal_Update_v7.csskeys.json`.
* **Files to Modify:**
    1.  `js/ui/components/ServicesScreen.js` (Modify `renderServicesScreen` to add Scrap Bar HTML)
    2.  `css/screens/services-screen.css` (Add all Scrap Bar styles)
    3.  `js/ui/components/MarketScreen.js` (Modify `renderMarketScreen` for Pager/Carousel HTML; Create `_renderMaterialsList` and `_renderMaterialCard`; Create `_updateMarketPager`)
    4.  `css/screens/market-screen.css` (Add Pager, Carousel, and `.material-card` styles)

### 7.5 Phase 4: UI Logic, Handlers, & Optimization
**Purpose:** Wire up UI interactions: pager clicks, carousel swipes, material card selling, and Scrap Bar updates.
* **Action:** Implement the event handler logic and UI synchronization.
* **Files to Modify:**
    1.  `js/services/handlers/ActionClickHandler.js` (Add cases for `market-page-materials` and `market-page-commodities`)
    2.  `js/services/handlers/MarketEventHandler.js` (Fork `handleClick`, `handleSetMaxTrade`, `handleConfirmTrade` based on `data-item-type`)
    3.  `js/services/UIManager.js` (Create public `updateScrapBar()` method; Modify `render(screen)` to call `updateScrapBar()` and `_updateMarketPager()` in their respective screen cases; Modify `initEventHandlers()` to create a new `CarouselEventHandler` instance for the Market screen)

### 7.6 Phase 5: Onboarding (Deferred)
**Purpose:** Implement the one-time tutorial toast for Metal Scrap. This is a non-blocking, deferred task.
* **Action:** Implement the tutorial trigger logic.
* **Files to Modify:**
    1.  `js/services/TutorialService.js` (Create `triggerScrapTutorial()`)
* **Note:** The call to this function was already added to `PlayerActionService.js` in Phase 2.

### 7.7 Phase 6: Documentation & Maintenance
**Purpose:** Update the core meta-documentation to reflect the new features, ensuring future AI context is complete.
* **Action:** Update the following project meta-files.
* **Files to Modify:**
    1.  `meta/lexicon.json` (Add new terms: "Metal Scrap", "Scrap Bar", "Materials Screen", "Market Pager").
    2.  `meta/ARCHITECTURAL_DECISIONS.md` (Add a new entry for "D-01: Market Screen Refactor (Wrap & Fork)" and "D-03: UI Update (Push/Pull Hybrid)").
    3.  `meta/DATA_FLOW.md` (Add a new section for "Scrap Generation & UI Update Flow" detailing the `PlayerActionService` -> `GameState` -> `UIManager` -> DOM path).

---

## 8.0 Quality Assurance Test Plan

### 8.1 Test Plan: Phase 1 (Data & State)
| Test ID | Feature/File | Test Description | Expected Result | Risk/Priority |
| :--- | :--- | :--- | :--- | :--- |
| P1-01 | `GameState.js` | Start a new game. Check `GameState.player.metalScrap`. | Value must be `0`. | Low |
| P1-02 | `GameState.js` | Start new game, save game, reload. Check `metalScrap`. | Value must be `0`. | Low |
| P1-03 | `database.js` | Check `DB.MATERIALS['metal-scrap'].sellValue`. | Value must be `1500`. | Low |
| P1-04 | `constants.js` | Check `CONSTANTS.SCRAP_PER_HULL_POINT`. | Value must be `0.02`. | Low |
| P1-05 | `GameState.js` | Start a new game. Check `player.flags.hasSeenScrapTutorial`. | Value must be `false`. | Low |

### 8.2 Test Plan: Phase 2 (Core Logic & Effects)
| Test ID | Feature/File | Test Description | Expected Result | Risk/Priority |
| :--- | :--- | :--- | :--- | :--- |
| P2-01 | `PlayerActionService.js` | Repair 10 hull points. | `player.metalScrap` should be `0.2`. `+ METAL` FT should appear. | High |
| P2-02 | `PlayerActionService.js` | Repair 15 hull points. | `player.metalScrap` should be `0.3`. | Medium |
| P2-03 | `EffectsManager.js` | Trigger `+ METAL` FT. | Text must be blue (`var(--color-blue)`) and centered on screen. | Low |
| P2-04 | `SimulationService.js` | Manually set `player.metalScrap = 10`. Call `sellMaterial('metal-scrap', 5)`. | `player.metalScrap` becomes `5`. `player.credits` increases by `7500`. `+7,500` FT appears. | High |
| P2-05 | `SimulationService.js` | Manually set `player.metalScrap = 10`. Call `sellMaterial('metal-scrap', 11)`. | Function should return/warn. `player.metalScrap` remains `10`. `player.credits` unchanged. | Medium |
| P2-06 | `SimulationService.js` | Manually set `player.metalScrap = 10`. Call `sellMaterial('metal-scrap', -1)`. | Function should return/warn. `player.metalScrap` remains `10`. | Medium |
| P2-07 | `PlayerActionService.js` | (Floating Point) Repair 1 hull 3 times. | `player.metalScrap` must be `0.06` (not `0.06000000000000001`). | High |
| P2-08 | `SimulationService.js` | (Floating Point) Set scrap to `0.3`. Sell `0.1`. | `player.metalScrap` must be `0.2` (not `0.19999999999999998`). | High |

### 8.3 Test Plan: Phase 3 (UI Structure & Styling)
| Test ID | Feature/File | Test Description | Expected Result | Risk/Priority |
| :--- | :--- | :--- | :--- | :--- |
| P3-01 | `ServicesScreen.js` | Go to Services screen. | Scrap Bar (`#scrap-bar-container`) must be visible below the Hull Repair block. | Low |
| P3-02 | `MarketScreen.js` | Go to Market screen. | Pager (`#market-pager-container`) must be visible. "Commodities" button must be active (`.btn-primary`). | Medium |
| P3-03 | `MarketScreen.js` | Go to Market. | The commodity list must be visible and fully functional (scrolling, etc.). | Medium |
| P3-04 | `css/market-screen.css` | Go to Market, manually activate Materials screen. | Material Card (`.material-card`) must have sharp corners (`border-radius: 0px`). | Low |
| P3-05 | `css/services-screen.css` | Go to Services. | Scrap Bar must be styled correctly (background, border, text overlay). | Low |

### 8.4 Test Plan: Phase 4 (UI Logic & Regression)
| Test ID | Feature/File | Test Description | Expected Result | Risk/Priority |
| :--- | :--- | :--- | :--- | :--- |
| **REGRESSION** | | | | |
| **P4-R01** | `MarketEventHandler.js` | **(CRITICAL REGRESSION)** Go to Market. Buy 1 Commodity. | Purchase must succeed. | **Critical** |
| **P4-R02** | `MarketEventHandler.js` | **(CRITICAL REGRESSION)** Go to Market. Sell 1 Commodity. | Sale must succeed. | **Critical** |
| **P4-R03** | `MarketEventHandler.js` | **(CRITICAL REGRESSION)** Go to Market. Use "MAX" Buy/Sell on a Commodity. | Max logic must be correct. | **Critical** |
| **P4-R04** | `MarketEventHandler.js` | **(CRITICAL REGRESSION)** Go to Market. Toggle Buy/Sell on a Commodity. | Toggle must work. | **Critical** |
| **P4-R05** | `CarouselEventHandler.js` | **(CRITICAL REGRESSION)** Go to Hangar screen. | Hangar/Shipyard swipe carousel must be 100% functional. | **Critical** |
| **P4-R06** | `PlayerActionService.js` | **(PERFORMANCE)** Go to Services. Open Performance monitor. Hold repair button. | `updateScrapBar` is called, but no significant frame drop or layout shift occurs. | High |
| **NEW FEATURES** | | | | |
| P4-N01 | `ActionClickHandler.js` | Go to Market. Click "MATERIALS" button. | Screen slides, "MATERIALS" button becomes active, URL/state updates. | High |
| P4-N02 | `CarouselEventHandler.js` | Go to Market. Swipe left. | Screen slides to Materials. "MATERIALS" button becomes active. | High |
| P4-N03 | `CarouselEventHandler.js` | Go to Materials screen. Swipe right. | Screen slides to Commodities. "COMMODITIES" button becomes active. | High |
| P4-N04 | `MarketScreen.js` | Go to Materials screen. | "METAL SCRAP" card is visible, showing correct `player.metalScrap` inventory. | High |
| P4-N05 | `MarketEventHandler.js` | On Material card, click "MAX". | Quantity input must equal `player.metalScrap`. | High |
| P4-N06 | `MarketEventHandler.js` | On Material card, sell 1 ton. | Transaction succeeds (see P2-04). Inventory on card updates. | High |
| P4-N07 | `MarketEventHandler.js` | On Material card, verify no "Buy/Sell" toggle exists. | No toggle is visible. | Medium |
| P4-N08 | `UIManager.js` | (Scrap Bar Logic) Set scrap = `0.0`. Go to Services. | Bar text is "0 TONS", fill is `0%`. | High |
| P4-N09 | `UIManager.js` | (Scrap Bar Logic) Set scrap = `0.19`. Go to Services. | Bar text is "0 TONS", fill is `0%`. | High |
| P4-N10 | `UIManager.js` | (Scrap Bar Logic) Set scrap = `0.20`. Go to Services. | Bar text is "0 TONS", fill is `20%`. | High |
| P4-N11 | `UIManager.js` | (Scrap Bar Logic) Set scrap = `0.99`. Go to Services. | Bar text is "0 TONS", fill is `80%`. | High |
| P4-N12 | `UIManager.js` | (Scrap Bar Logic) Set scrap = `1.00`. Go to Services. | Bar text is "1 TONS", fill is `100%`. | High |
| P4-N13 | `UIManager.js` | (Scrap Bar Logic) Set scrap = `1.19`. Go to Services. | Bar text is "1 TONS", fill is `100%`. | High |
| P4-N14 | `UIManager.js` | (Scrap Bar Logic) Set scrap = `1.20`. Go to Services. | Bar text is "1 TONS", fill is `20%`. | High |
| P4-N15 | `UIManager.js` | **(Push Update)** Go to Services screen. Perform a repair (e.g., gain 0.2 scrap). | Scrap Bar text and fill must update *in real-time* without reloading the screen. | High |

### 8.5 Test Plan: Phase 5 (Onboarding)
| Test ID | Feature/File | Test Description | Expected Result | Risk/Priority |
| :--- | :--- | :--- | :--- | :--- |
| P5-01 | `TutorialService.js` | Start new game. Repair hull for the first time. | `hasSeenScrapTutorial` becomes `true`. Tutorial toast appears. | Medium |
| P5-02 | `TutorialService.js` | After P5-01, repair hull a second time. | Tutorial toast must *not* appear again. | Medium |
| P5-03 | `GameState.js` | Manually set `hasSeenScrapTutorial = true`. Repair hull. | Tutorial toast must *not* appear. | Low |

### 8.6 Test Plan: Phase 6 (Documentation)
| Test ID | Feature/File | Test Description | Expected Result | Risk/Priority |
| :--- | :--- | :--- | :--- | :--- |
| P6-01 | `meta/lexicon.json` | Check file. | File must contain definitions for "Metal Scrap", "Scrap Bar", "Materials Screen". | Low |
| P6-02 | `meta/ARCHITECTURAL_DECISIONS.md` | Check file. | File must contain entries for the Market Screen "Wrap & Fork" and the UI "Push/Pull" update logic. | Low |
| P6-03 | `meta/DATA_FLOW.md` | Check file. | File must contain a new diagram/section for the Scrap Generation data flow. | Low |

---

## 9.0 Appendices (Context & Data)

### 9.1 Appendix A: Data & State Schema (Machine-Readable)
The data schema for this update is defined in the machine-readable file:
`meta/GDD_Metal_Update_v7.datakeys.json`

The implementer **MUST** parse this file as the single source of truth for all `GameState`, `database`, and `constants` modifications.

### 9.2 Appendix B: Component Responsibility Key
This table defines the *specific role* of each new or modified file in this update.

| File/Component | Role / Responsibility |
| :--- | :--- |
| `PlayerActionService.js` | **Generator:** Calculates scrap gained from repairs, adds it to `GameState`, and triggers feedback (FT, UI Push, Tutorial). |
| `SimulationService.js` | **Consumer:** Contains the `sellMaterial` logic. Verifies transaction, removes scrap from `GameState`, and adds credits. |
| `MarketEventHandler.js` | **Input Handler (Materials):** "Forks" its logic to handle `confirm-trade` and `set-max-trade` actions originating from a `.material-card`. |
| `ActionClickHandler.js` | **Input Handler (Pager):** Handles simple clicks on the new Market Pager buttons (`market-page-materials`) to update `uiState`. |
| `CarouselEventHandler.js` | **Input Handler (Pager):** A *new instance* will be created to handle *swipe* gestures on the Market carousel, also updating `uiState`. |
| `UIManager.js` | **State-to-UI Synchronizer:** 1. Creates `updateScrapBar()` (public method) for real-time "push" updates. 2. Calls `updateScrapBar()` on 'services' screen load ("pull" update). 3. Calls `marketScreen._updateMarketPager()` on 'market' screen load. |
| `MarketScreen.js` | **UI Builder (Market):** Renders the pager, carousel HTML. Renders the `.material-card` via `_renderMaterialCard`. Syncs the pager/carousel visuals via `_updateMarketPager()`. |
| `ServicesScreen.js` | **UI Builder (Services):** Renders the static HTML for the `#scrap-bar-container`. |
| `EffectsManager.js` | **Feedback:** Modified to support `'blue'` color and `'center-screen'` position for floating text. |
| `TutorialService.js` | **Onboarding:** Contains the new `triggerScrapTutorial()` method to display the one-time helper toast. |

### 9.3 Appendix C: New CSS Class Library (Machine-Readable)
The CSS library for this update is defined in the machine-readable file:
`meta/GDD_Metal_Update_v7.csskeys.json`

The implementer **MUST** parse this file as the single source of truth for all new CSS IDs, classes, and variables.

### 9.4 Appendix D: Decision Rationale Log
This log explicitly states *why* key design decisions were made to prevent ambiguity or future flip-flopping.

| Decision ID | Feature | Decision & Rationale |
| :--- | :--- | :--- |
| **D-01** | Material Card Shape (Sec 3.2.1) | **Replaced `clip-path` (tapered corners) with `border-radius: 0;` (sharp corners).** <br/> **Rationale:** `clip-path` is a known performance risk on low-end mobile GPUs and in WKWebView, causing potential re-rasterization and artifacts. The design *intent* was visual distinction from rounded commodity cards. Sharp corners achieve this distinction with zero performance cost, prioritizing the iOS target. |
| **D-02** | Scrap Bar Logic (Sec 3.3.4) | **Reverted to "Full Bar Window" logic from "0% on Full Ton" logic.** <br/> **Rationale:** The `X.00 tons = 0% full` logic, while mathematically simple, was identified as poor UX. It robs the player of the "level up" moment, as they would never see a 100% full bar. The revised logic (`X.00` to `X.19` = 100% full) provides a crucial "window of opportunity" for the player to see and feel the satisfaction of completing a ton, which aligns with the original design intent. |
| **D-03** | Scrap Bar Update (Sec 7.5) | **Optimized `updateScrapBar` logic to be "push" and "pull" safe.** <br/> **Rationale:** The initial plan to call this from the main `UIManager.render()` loop was a performance risk. The new plan creates a dedicated `uiManager.updateScrapBar()` function. This is called *on-demand* ("push") by `PlayerActionService` (only when scrap is gained *and* the player is on the services screen) and *on-load* ("pull") by `UIManager.render('services')`. This is the most performant and architecturally sound method. |