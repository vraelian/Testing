// meta/UI_LIBRARY.md

Orbital Trading: UI Component Library & Style Guide

1. Design System Core

1.1 Typography
The game uses a dual-font system to establish its "Industrial Sci-Fi" aesthetic.
Primary Font: Oxanium (Variable Weight)
Usage: All UI text, data readouts, body copy, and buttons.
Weights: Light (300) for body, Medium (500) for labels, Bold (700) for headers.
Accent Font: Zorque (Regular)
Usage: Logos, Major Section Headers, "Hero" numbers (e.g., Credits balance).
Characteristics: Blocky, retro-futuristic.

1.2 Color Palette (CSS Variables)
Do not hardcode hex values. Use these semantic variables defined in global.css.
VariableRole
--bg-colorApp background (Deep Space Black).
--panel-bgComponent background (Semi-transparent dark grey).
--color-text-primaryMain text (White/Off-White).
--color-text-secondaryLabels and dim text (Light Grey).
--color-accentPrimary action color (Cyan/Blue).
--color-successPositive values/Profits (Green).
--color-dangerNegative values/Costs/Alerts (Red).
--color-warningCautions (Yellow/Orange).
--color-borderStandard border color for cards/panels.

1.3 Z-Index Registry
Strict layering ensures modals and overlays behave correctly.
LayerZ-IndexComponents
Base0Background, Canvas Starfield.
Content10Main Screen Containers, Carousel.
Chrome50Top Bar, Bottom Nav, Sticky HUD.
Help Anchor800Global Contextual Help '?' Button.
Modal Mask900The generic modal-overlay background.
Modal1000Active Modal Dialogs, Help Modals.
Toast2000Notifications, Floating Battle Text.
Cursor9999Custom hardware cursors (if applicable).

2. Component Blueprints

2.1 Standard Card (.card)
Used for Commodities, Ships, and Missions.
HTML
<div class="card" data-id="{id}">
    <div class="card-header">
        <span class="card-title">{Title}</span>
        <span class="badge">{Status}</span>
    </div>
    
    <div class="card-content">
        <div class="data-row">
            <span class="label">Label:</span>
            <span class="value">{Value}</span>
        </div>
    </div>
    
    <div class="card-actions">
        <button class="btn btn-secondary" data-action="...">Action</button>
    </div>
</div>

2.2 Action Button (.btn)
Interactive elements must always use the `.btn` class and **MUST** include `type="button"` to prevent page reloads.

2.3 Attribute Pill (.attribute-pill)
Used in Hangar/Shipyard to show stats. Now explicitly a <button> for better mobile touch handling (ADR-011).
HTML
<button class="attribute-pill" type="button" data-type="{type}" data-tooltip="{text}">
    <span class="label">{Label}</span>
    <span class="value">{Value}</span>
</button>

2.4 Modal Dialog (.modal)
Standard wrapper for popup content. The `UIModalEngine` dynamically mutates the header into a flexbox layout if a `portraitId` is detected in the triggering payload.

HTML (Standard):
<div id="modal-overlay" class="hidden">
    <div class="modal">
        <div class="modal-header">
            <h2>{Title}</h2>
        </div>
        <div class="modal-content">...</div>
        <div class="modal-footer">
            <button class="btn btn-secondary" type="button" data-action="close-modal">Close</button>
        </div>
    </div>
</div>

HTML (Dynamically Injected with Portrait):
<div id="modal-overlay" class="hidden">
    <div class="modal">
        <div class="modal-header-flex">
            <div class="portrait-thumbnail" style="background-image: url('...'); background-position: -Xpx -Ypx;"></div>
            <h2 class="modal-title-group">{Title}</h2>
        </div>
        <div class="modal-content">...</div>
        <div class="modal-footer">...</div>
    </div>
</div>

Dynamic Injection Classes (Managed by UIModalEngine):
- `.modal-header-flex`: Establishes the flex-row structure.
- `.portrait-thumbnail`: The 128x128px fixed container utilizing the WebP sprite sheet.
- `.modal-title-group`: Wraps the title text, forcing `text-align: right` to counterbalance the left-aligned portrait. 
*Note: If no portrait ID is passed to the engine, it automatically unwraps these classes to gracefully restore the standard center/left alignment.*

2.5 Tab Navigation (.mission-tabs-nav)
Used in Missions/Data screens to toggle sub-views.
HTML
<div class="mission-tabs-nav">
    <button class="mission-tab-btn active" type="button" data-action="switch-tab" data-target="A">TAB A</button>
    <button class="mission-tab-btn" type="button" data-action="switch-tab" data-target="B">TAB B</button>
</div>

2.6 Objective Progress Bar (.objective-row-filled)
Used in Mission Log cards to show continuous progress.
HTML
<div class="objective-row-filled">
    <div class="objective-fill-bar" style="width: 50%"></div>
    <div class="objective-text">
        <span>DELIVER ICE</span>
        <span>5/10</span>
    </div>
</div>

2.7 Contextual Help Modal (.help-modal-container)
Strictly containerized, fixed-aspect-ratio modal utilizing horizontal micro-pagination. Requires `touch-action: pan-x` on the track to restrict mobile gesture bleed.
HTML
<div class="help-modal-container" style="aspect-ratio: 1/1;">
    <div class="help-header">
        <button class="btn btn-close" type="button" data-action="close-help">-</button>
    </div>
    <div class="help-slide-track" style="transform: translateX(0%); touch-action: pan-x;">
        <div class="help-slide">
            <h3>Mechanics</h3>
            <p>Slide 1 context content.</p>
        </div>
        <div class="help-slide">
            <h3>Strategy</h3>
            <p>Slide 2 context content.</p>
        </div>
    </div>
    <div class="help-footer">
        <div class="pagination-dots">
            <span class="dot active"></span>
            <span class="dot"></span>
        </div>
    </div>
</div>

2.8 Universal Toast Notification (.toast-message)
A strictly timed, non-blocking alert system. Uses an animated visual fuse that acts as a countdown. Requires localized event interception on the dismiss button to prevent routing bubbles.
HTML
<div class="toast-message toast-{type}" data-action="route-toast" data-target="{actionTarget}">
    <div class="toast-fuse" style="animation: toast-fuse-burn 4s linear forwards;"></div>
    <div class="toast-content-wrapper">
        <div class="toast-title">{Title}</div>
        <div class="toast-body">{Message}</div>
    </div>
    <button type="button" class="toast-dismiss-btn" data-action="dismiss-toast">-</button>
</div>

2.9 Cinematic Overlays (.intro-starfield-bg)
Used for bespoke sequences (like the Starter Ship Selection) that bypass the main UIManager render cycle to execute asynchronous crossfades via the native Web Animations API. Rendered outside the core `#game-container`.
HTML
<div id="starter-ship-selection-overlay" class="intro-starfield-bg">
    <div class="starter-selection-container">
        </div>
</div>

3. CSS Utilities
.hidden: display: none !important. Used for toggling visibility.
.text-center: text-align: center.
.text-highlight: Applies the accent color to text.
.flex-row: display: flex; flex-direction: row;
.flex-col: display: flex; flex-direction: column;
.spacer: flex-grow: 1. Pushes flex items apart.
.scroll-y: overflow-y: auto. Enables vertical scrolling within a container.
.silent-exit: Forces a modal to close instantly without an exit animation. Used for cinematic transitions.