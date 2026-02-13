Orbital Trading: UI Component Library & Style Guide1. Design System Core1.1 TypographyThe game uses a dual-font system to establish its "Industrial Sci-Fi" aesthetic.Primary Font: Oxanium (Variable Weight)Usage: All UI text, data readouts, body copy, and buttons.Weights: Light (300) for body, Medium (500) for labels, Bold (700) for headers.Accent Font: Zorque (Regular)Usage: Logos, Major Section Headers, "Hero" numbers (e.g., Credits balance).Characteristics: Blocky, retro-futuristic.1.2 Color Palette (CSS Variables)Do not hardcode hex values. Use these semantic variables defined in global.css.VariableRole--bg-colorApp background (Deep Space Black).--panel-bgComponent background (Semi-transparent dark grey).--color-text-primaryMain text (White/Off-White).--color-text-secondaryLabels and dim text (Light Grey).--color-accentPrimary action color (Cyan/Blue).--color-successPositive values/Profits (Green).--color-dangerNegative values/Costs/Alerts (Red).--color-warningCautions (Yellow/Orange).--color-borderStandard border color for cards/panels.1.3 Z-Index RegistryStrict layering ensures modals and overlays behave correctly.LayerZ-IndexComponentsBase0Background, Canvas Starfield.Content10Main Screen Containers, Carousel.Chrome50Top Bar, Bottom Nav, Sticky HUD.Modal Mask900The generic modal-overlay background.Modal1000Active Modal Dialogs.Toast2000Tutorial Popups, Notifications.Cursor9999Custom hardware cursors (if applicable).2. Component Blueprints2.1 Standard Card (.card)Used for Commodities, Ships, and Missions.HTML<div class="card" data-id="{id}">
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
2.3 Attribute Pill (.attribute-pill)Used in Hangar/Shipyard to show stats. Now explicitly a <button> for better mobile touch handling (ADR-011).HTML<button class="attribute-pill" data-type="{type}" data-tooltip="{text}">
    <span class="label">{Label}</span>
    <span class="value">{Value}</span>
</button>
2.4 Modal Dialog (.modal)Standard wrapper for popup content.HTML<div id="modal-overlay" class="hidden">
    <div class="modal">
        <div class="modal-header">
            <h2>{Title}</h2>
        </div>
        <div class="modal-content">
            </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" data-action="close-modal">Close</button>
        </div>
    </div>
</div>
2.5 Tab Navigation (.mission-tabs-nav)
Used in Missions/Data screens to toggle sub-views.
HTML<div class="mission-tabs-nav">
    <button class="mission-tab-btn active" data-action="switch-tab" data-target="A">TAB A</button>
    <button class="mission-tab-btn" data-action="switch-tab" data-target="B">TAB B</button>
</div>
2.6 Objective Progress Bar (.objective-row-filled)
Used in Mission Log cards to show continuous progress.
HTML<div class="objective-row-filled">
    <div class="objective-fill-bar" style="width: 50%"></div>
    <div class="objective-text">
        <span>DELIVER ICE</span>
        <span>5/10</span>
    </div>
</div>
3. CSS Utilities.hidden: display: none !important. Used for toggling visibility..text-center: text-align: center..text-highlight: Applies the accent color to text..flex-row: display: flex; flex-direction: row;..flex-col: display: flex; flex-direction: column;..spacer: flex-grow: 1. Pushes flex items apart..scroll-y: overflow-y: auto. Enables vertical scrolling within a container.