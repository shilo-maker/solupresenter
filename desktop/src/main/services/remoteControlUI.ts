/**
 * Mobile Remote Control UI
 * Returns HTML for the mobile web interface with Songs, Bible, and Media browsing
 */
export function getRemoteControlUI(port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <title>SoluCast Remote</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-tap-highlight-color: transparent;
    }

    html, body {
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: white;
      overflow: hidden;
    }

    .app {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-width: 600px;
      margin: 0 auto;
    }

    /* PIN Entry Screen */
    #pin-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 24px;
    }

    .logo {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #06b6d4, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.5px;
    }

    .subtitle {
      font-size: 14px;
      color: rgba(255,255,255,0.6);
      margin-bottom: 32px;
    }

    .pin-label {
      font-size: 16px;
      margin-bottom: 16px;
    }

    .pin-input-container {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
    }

    .pin-digit {
      width: 42px;
      height: 54px;
      font-size: 24px;
      text-align: center;
      background: rgba(255,255,255,0.1);
      border: 2px solid rgba(255,255,255,0.2);
      border-radius: 12px;
      color: white;
      outline: none;
      transition: border-color 0.2s;
    }

    .pin-digit:focus {
      border-color: #06b6d4;
    }

    .connect-btn {
      width: 100%;
      max-width: 230px;
      padding: 14px 24px;
      font-size: 16px;
      font-weight: 600;
      background: linear-gradient(135deg, #06b6d4, #0891b2);
      border: none;
      border-radius: 12px;
      color: white;
      cursor: pointer;
      transition: transform 0.1s, opacity 0.2s;
    }

    .connect-btn:active {
      transform: scale(0.98);
    }

    .connect-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .error-msg {
      color: #f87171;
      font-size: 14px;
      margin-top: 16px;
      text-align: center;
    }

    /* Main Control Screen */
    #control-screen {
      display: none;
      flex-direction: column;
      height: 100%;
    }

    .header {
      padding: 10px 16px;
      background: rgba(0,0,0,0.3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }

    .header-title {
      font-size: 16px;
      font-weight: 700;
      background: linear-gradient(135deg, #06b6d4, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .connection-status {
      font-size: 12px;
      color: #4ade80;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .connection-status.disconnected {
      color: #f87171;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: currentColor;
    }

    /* Main Tabs */
    .main-tabs {
      display: flex;
      background: rgba(0,0,0,0.2);
      flex-shrink: 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }

    .main-tab {
      flex: 1;
      padding: 12px 4px;
      font-size: 11px;
      font-weight: 500;
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.6);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      transition: all 0.2s;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    .main-tab.active {
      color: #06b6d4;
      background: rgba(6, 182, 212, 0.1);
    }

    .main-tab svg {
      width: 20px;
      height: 20px;
    }

    /* Tab Content */
    .tab-content {
      flex: 1;
      overflow: hidden;
      display: none;
    }

    .tab-content.active {
      display: flex;
      flex-direction: column;
    }

    /* Control Tab */
    .current-item {
      padding: 16px;
      background: rgba(255,255,255,0.05);
      border-bottom: 1px solid rgba(255,255,255,0.1);
      flex-shrink: 0;
    }

    .item-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .slide-indicator {
      display: inline-block;
      background: rgba(6, 182, 212, 0.2);
      color: #06b6d4;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
    }

    .nav-controls {
      padding: 20px 16px;
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-shrink: 0;
    }

    .nav-btn {
      flex: 1;
      max-width: 120px;
      height: 70px;
      font-size: 14px;
      font-weight: 600;
      background: rgba(255,255,255,0.1);
      border: 2px solid rgba(255,255,255,0.2);
      border-radius: 14px;
      color: white;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: all 0.15s;
    }

    .nav-btn:active {
      transform: scale(0.95);
      background: rgba(255,255,255,0.15);
    }

    .nav-btn:disabled {
      opacity: 0.3;
    }

    .nav-btn svg {
      width: 24px;
      height: 24px;
    }

    .blank-toggle {
      padding: 0 16px 12px;
      flex-shrink: 0;
    }

    .blank-btn {
      width: 100%;
      padding: 14px;
      font-size: 14px;
      font-weight: 600;
      background: rgba(255,255,255,0.05);
      border: 2px solid rgba(255,255,255,0.2);
      border-radius: 10px;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .blank-btn.active {
      background: rgba(239, 68, 68, 0.2);
      border-color: #ef4444;
      color: #fca5a5;
    }

    .blank-btn-small {
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .blank-btn-small.active {
      background: rgba(239, 68, 68, 0.2);
      border-color: #ef4444;
      color: #fca5a5;
    }

    /* Slides Grid */
    .slides-section {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      border-top: 1px solid rgba(255,255,255,0.1);
      min-height: 0;
    }

    .slides-grid {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 8px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      align-content: start;
    }

    .slide-card {
      background: rgba(255,255,255,0.05);
      border: 2px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 10px;
      cursor: pointer;
      transition: all 0.15s;
      min-height: 70px;
      display: flex;
      flex-direction: column;
    }

    .slide-card:active {
      transform: scale(0.98);
    }

    .slide-card.current {
      background: rgba(6, 182, 212, 0.2);
      border-color: #06b6d4;
    }

    .slide-card.combined {
      border-left: 3px solid #f59e0b;
    }

    .slide-card.combined.current {
      border-left: 3px solid #f59e0b;
    }

    .slide-number {
      font-size: 10px;
      font-weight: 600;
      color: rgba(255,255,255,0.5);
      margin-bottom: 4px;
    }

    .slide-card.current .slide-number {
      color: #06b6d4;
    }

    .slide-preview {
      font-size: 12px;
      line-height: 1.3;
      color: rgba(255,255,255,0.8);
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      flex: 1;
    }

    .mode-selector {
      padding: 0 16px 12px;
      flex-shrink: 0;
    }

    .mode-label {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      margin-bottom: 6px;
    }

    .mode-buttons {
      display: flex;
      gap: 6px;
    }

    .mode-btn {
      flex: 1;
      padding: 8px;
      font-size: 12px;
      font-weight: 500;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px;
      color: rgba(255,255,255,0.7);
      cursor: pointer;
    }

    .mode-btn.active {
      background: rgba(6, 182, 212, 0.2);
      border-color: #06b6d4;
      color: #06b6d4;
    }

    /* Setlist in Control Tab */
    .setlist-section {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      border-top: 1px solid rgba(255,255,255,0.1);
    }

    .section-header {
      padding: 10px 16px;
      font-size: 12px;
      font-weight: 600;
      color: rgba(255,255,255,0.5);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: rgba(0,0,0,0.2);
      flex-shrink: 0;
    }

    .scrollable-list {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .list-item {
      padding: 12px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: background 0.15s;
    }

    .list-item:active {
      background: rgba(255,255,255,0.05);
    }

    .list-item.current {
      background: rgba(6, 182, 212, 0.15);
      border-left: 3px solid #06b6d4;
    }

    .item-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: rgba(255,255,255,0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }

    .item-icon.song { background: rgba(139, 92, 246, 0.2); color: #a78bfa; }
    .item-icon.bible { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
    .item-icon.media { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
    .item-icon.tool { background: rgba(16, 185, 129, 0.2); color: #34d399; }

    .item-details {
      flex: 1;
      min-width: 0;
    }

    .item-name {
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item-meta {
      font-size: 11px;
      color: rgba(255,255,255,0.5);
      margin-top: 2px;
    }

    .empty-state {
      padding: 40px 16px;
      text-align: center;
      color: rgba(255,255,255,0.4);
      font-size: 14px;
    }

    /* Search Box */
    .search-box {
      padding: 12px 16px;
      background: rgba(0,0,0,0.2);
      flex-shrink: 0;
    }

    .search-input {
      width: 100%;
      padding: 10px 14px;
      font-size: 14px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      color: white;
      outline: none;
    }

    .search-input::placeholder {
      color: rgba(255,255,255,0.4);
    }

    .search-input:focus {
      border-color: #06b6d4;
    }

    /* Bible Book/Chapter Selection */
    .bible-nav {
      padding: 12px 16px;
      background: rgba(0,0,0,0.2);
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .bible-select {
      flex: 1;
      padding: 10px;
      font-size: 14px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      color: white;
      outline: none;
    }

    .bible-select option {
      background: #1a1a2e;
      color: white;
    }

    /* Add to Setlist Button */
    .add-btn {
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 500;
      background: rgba(6, 182, 212, 0.2);
      border: 1px solid #06b6d4;
      border-radius: 6px;
      color: #06b6d4;
      cursor: pointer;
      flex-shrink: 0;
    }

    .add-btn:active {
      background: rgba(6, 182, 212, 0.3);
    }

    /* Loading */
    .loading {
      padding: 40px;
      text-align: center;
      color: rgba(255,255,255,0.5);
    }

    .loading-spinner {
      width: 30px;
      height: 30px;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: #06b6d4;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 12px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Loading Overlay */
    .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.7);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }

    .loading-overlay.visible {
      display: flex;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255,255,255,0.2);
      border-top-color: #06b6d4;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    /* Audio volume slider */
    input[type="range"] {
      -webkit-appearance: none;
      background: rgba(255,255,255,0.2);
      border-radius: 3px;
      height: 6px;
    }
    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      background: linear-gradient(135deg, #9C27B0, #E91E63);
      border-radius: 50%;
      cursor: pointer;
    }
    input[type="range"]::-moz-range-thumb {
      width: 18px;
      height: 18px;
      background: linear-gradient(135deg, #9C27B0, #E91E63);
      border-radius: 50%;
      cursor: pointer;
      border: none;
    }

    /* Settings Tab Styles */
    .settings-section {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 16px;
    }

    .settings-action-btn {
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 600;
      border: none;
      border-radius: 6px;
      color: white;
      cursor: pointer;
    }

    .settings-btn-gray { background: rgba(255,255,255,0.15); }
    .settings-btn-gray:active { background: rgba(255,255,255,0.25); }

    .display-item {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 8px;
    }

    .display-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .display-item-name {
      font-weight: 600;
      font-size: 14px;
    }

    .display-item-meta {
      font-size: 12px;
      color: rgba(255,255,255,0.5);
      margin-bottom: 8px;
    }

    .display-actions {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .display-actions button {
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      border: none;
      border-radius: 6px;
      color: white;
      cursor: pointer;
    }

    .display-actions .btn-viewer { background: rgba(6,182,212,0.3); color: #06b6d4; }
    .display-actions .btn-viewer:active { background: rgba(6,182,212,0.5); }
    .display-actions .btn-stage { background: rgba(139,92,246,0.3); color: #a78bfa; }
    .display-actions .btn-stage:active { background: rgba(139,92,246,0.5); }
    .display-actions .btn-close { background: rgba(239,68,68,0.3); color: #f87171; }
    .display-actions .btn-close:active { background: rgba(239,68,68,0.5); }
    .display-actions .btn-identify { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
    .display-actions .btn-identify:active { background: rgba(255,255,255,0.2); }

    .theme-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }

    .theme-row label {
      font-size: 13px;
      font-weight: 600;
      min-width: 60px;
      color: rgba(255,255,255,0.8);
    }

    .theme-row select {
      flex: 1;
      padding: 8px 10px;
      font-size: 13px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 6px;
      color: white;
      outline: none;
      -webkit-appearance: none;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23fff' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      padding-right: 28px;
    }

    .theme-row select option {
      background: #1a1a2e;
      color: white;
    }

    .theme-row select:focus {
      border-color: #06b6d4;
    }
  </style>
</head>
<body>
  <div class="app">
    <!-- PIN Entry Screen -->
    <div id="pin-screen">
      <div class="logo">SoluCast</div>
      <div class="subtitle">Remote Control</div>
      <div class="pin-label">Enter 6-digit PIN</div>
      <div class="pin-input-container">
        <input type="tel" class="pin-digit" maxlength="1" data-index="0" inputmode="numeric" pattern="[0-9]*">
        <input type="tel" class="pin-digit" maxlength="1" data-index="1" inputmode="numeric" pattern="[0-9]*">
        <input type="tel" class="pin-digit" maxlength="1" data-index="2" inputmode="numeric" pattern="[0-9]*">
        <input type="tel" class="pin-digit" maxlength="1" data-index="3" inputmode="numeric" pattern="[0-9]*">
        <input type="tel" class="pin-digit" maxlength="1" data-index="4" inputmode="numeric" pattern="[0-9]*">
        <input type="tel" class="pin-digit" maxlength="1" data-index="5" inputmode="numeric" pattern="[0-9]*">
      </div>
      <button class="connect-btn" id="connect-btn">Connect</button>
      <div class="error-msg" id="error-msg"></div>
    </div>

    <!-- Main Control Screen -->
    <div id="control-screen">
      <div class="header">
        <div class="header-title">SoluCast</div>
        <div class="connection-status" id="connection-status">
          <div class="status-dot"></div>
          <span>Connected</span>
        </div>
      </div>

      <!-- Main Navigation Tabs -->
      <div class="main-tabs">
        <button class="main-tab active" data-tab="control">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
          Control
        </button>
        <button class="main-tab" data-tab="songs">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
          </svg>
          Songs
        </button>
        <button class="main-tab" data-tab="bible">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          Bible
        </button>
        <button class="main-tab" data-tab="media">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
            <line x1="7" y1="2" x2="7" y2="22"/>
            <line x1="17" y1="2" x2="17" y2="22"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <line x1="2" y1="7" x2="7" y2="7"/>
            <line x1="2" y1="17" x2="7" y2="17"/>
            <line x1="17" y1="17" x2="22" y2="17"/>
            <line x1="17" y1="7" x2="22" y2="7"/>
          </svg>
          Media
        </button>
        <button class="main-tab" data-tab="presentations">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          Slides
        </button>
        <button class="main-tab" data-tab="settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Settings
        </button>
      </div>

      <!-- Control Tab -->
      <div class="tab-content active" id="tab-control">
        <div class="current-item">
          <div class="item-title" id="current-title">No item selected</div>
          <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
            <span class="slide-indicator" id="slide-info">-</span>
            <button class="blank-btn-small" id="blank-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
              BLANK
            </button>
          </div>
        </div>

        <div class="mode-selector" style="padding-top: 8px;">
          <div class="mode-buttons">
            <button class="mode-btn active" data-mode="bilingual">Bilingual</button>
            <button class="mode-btn" data-mode="original">Original</button>
            <button class="mode-btn" data-mode="translation">Translation</button>
          </div>
        </div>

        <div class="nav-controls">
          <button class="nav-btn" id="prev-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            PREV
          </button>
          <button class="nav-btn" id="next-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            NEXT
          </button>
        </div>

        <div class="slides-section">
          <div class="section-header">Slides</div>
          <div class="slides-grid" id="slides-grid">
            <div class="empty-state">Select a song or item</div>
          </div>
        </div>

        <div class="setlist-section" style="max-height: 30%;">
          <div class="section-header">Setlist</div>
          <div class="scrollable-list" id="setlist-items">
            <div class="empty-state">No items in setlist</div>
          </div>
        </div>
      </div>

      <!-- Songs Tab -->
      <div class="tab-content" id="tab-songs">
        <div class="search-box">
          <input type="text" class="search-input" id="song-search" placeholder="Search songs...">
        </div>
        <div class="scrollable-list" id="songs-list">
          <div class="loading">
            <div class="loading-spinner"></div>
            Loading songs...
          </div>
        </div>
      </div>

      <!-- Bible Tab -->
      <div class="tab-content" id="tab-bible">
        <div class="search-box">
          <input type="text" class="search-input" id="bible-ref-search" placeholder="e.g., John 3:16 or Genesis 1:1-5">
        </div>
        <div class="bible-nav">
          <select class="bible-select" id="bible-book">
            <option value="">Select Book</option>
          </select>
          <select class="bible-select" id="bible-chapter" style="max-width: 100px;">
            <option value="">Ch.</option>
          </select>
        </div>
        <div id="bible-quick-add" style="display: none; padding: 8px; background: rgba(6,182,212,0.2); border-radius: 6px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span id="bible-ref-display" style="font-size: 0.9rem; color: #06b6d4;"></span>
            <button id="bible-add-btn" style="padding: 6px 12px; background: #06b6d4; border: none; border-radius: 4px; color: white; font-size: 0.8rem; cursor: pointer;">Add to Setlist</button>
          </div>
        </div>
        <div class="scrollable-list" id="bible-verses">
          <div class="empty-state">Select a book and chapter</div>
        </div>
      </div>

      <!-- Media Tab -->
      <div class="tab-content" id="tab-media">
        <div class="search-box">
          <input type="text" class="search-input" id="media-search" placeholder="Search media...">
        </div>
        <div class="scrollable-list" id="media-list">
          <div class="loading">
            <div class="loading-spinner"></div>
            Loading media...
          </div>
        </div>
      </div>

      <!-- Presentations Tab -->
      <div class="tab-content" id="tab-presentations">
        <div class="search-box">
          <input type="text" class="search-input" id="presentation-search" placeholder="Search presentations...">
        </div>
        <div class="scrollable-list" id="presentations-list">
          <div class="loading">
            <div class="loading-spinner"></div>
            Loading presentations...
          </div>
        </div>
      </div>

      <!-- Settings Tab -->
      <div class="tab-content" id="tab-settings">
        <div style="flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:12px;">
          <!-- Displays Section -->
          <div class="settings-section">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
              <span style="font-weight:700; font-size:16px;">Displays</span>
              <div style="display:flex; gap:6px;">
                <button id="identify-all-btn" class="settings-action-btn settings-btn-gray">Identify All</button>
                <button id="refresh-displays-btn" class="settings-action-btn settings-btn-gray">Refresh</button>
              </div>
            </div>
            <div id="displays-list">Loading...</div>
          </div>

          <!-- Themes Section -->
          <div class="settings-section" style="margin-top:16px;">
            <span style="font-weight:700; font-size:16px; display:block; margin-bottom:12px;">Themes</span>
            <div id="themes-section">Loading...</div>
          </div>
        </div>
      </div>
    </div>

    <div class="loading-overlay" id="loading-overlay">
      <div class="spinner"></div>
    </div>
  </div>

  <script src="/socket.io/socket.io.js"></script>
  <script>
    const PORT = ${port};

    // Elements
    const pinScreen = document.getElementById('pin-screen');
    const controlScreen = document.getElementById('control-screen');
    const connectBtn = document.getElementById('connect-btn');
    const errorMsg = document.getElementById('error-msg');
    const pinDigits = document.querySelectorAll('.pin-digit');
    const loadingOverlay = document.getElementById('loading-overlay');

    const connectionStatus = document.getElementById('connection-status');
    const currentTitle = document.getElementById('current-title');
    const slideInfo = document.getElementById('slide-info');
    const blankBtn = document.getElementById('blank-btn');
    const modeButtons = document.querySelectorAll('.mode-btn');
    const setlistItems = document.getElementById('setlist-items');

    const mainTabs = document.querySelectorAll('.main-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    let socket = null;
    let currentState = {
      currentItem: null,
      currentSlideIndex: 0,
      totalSlides: 0,
      displayMode: 'bilingual',
      isBlank: false,
      setlist: [],
      slides: [],
      activeTools: [],
      onlineViewerCount: 0,
      activeMedia: null,
      activeAudio: null,
      activeVideo: null,
      activeYoutube: null
    };

    // Data caches
    let songsCache = null;
    let bibleBooks = null;
    let mediaCache = null;
    let presentationsCache = null;

    // Render throttling for performance
    let renderPending = false;
    let lastRenderTime = 0;
    const MIN_RENDER_INTERVAL = 16; // ~60fps max

    // PIN Input handling
    pinDigits.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        const value = e.target.value;
        if (value.length === 1 && index < 5) {
          pinDigits[index + 1].focus();
        }
        checkPinComplete();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && input.value === '' && index > 0) {
          pinDigits[index - 1].focus();
        }
      });

      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        const digits = pastedText.replace(/\\D/g, '').slice(0, 6);
        digits.split('').forEach((digit, i) => {
          if (pinDigits[i]) pinDigits[i].value = digit;
        });
        if (digits.length === 6) pinDigits[5].focus();
        checkPinComplete();
      });
    });

    function checkPinComplete() {
      const pin = Array.from(pinDigits).map(d => d.value).join('');
      connectBtn.disabled = pin.length !== 6;
    }

    function getPin() {
      return Array.from(pinDigits).map(d => d.value).join('');
    }

    connectBtn.addEventListener('click', () => {
      const pin = getPin();
      if (pin.length === 6) connect(pin);
    });

    // Tab switching
    mainTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        mainTabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tabId).classList.add('active');

        // Load data for tab if needed
        if (tabId === 'songs' && !songsCache) loadSongs();
        if (tabId === 'bible' && !bibleBooks) loadBibleBooks();
        if (tabId === 'media' && !mediaCache) loadMedia();
        if (tabId === 'presentations' && !presentationsCache) loadPresentations();
        if (tabId === 'settings') { loadDisplays(); loadThemes(); }
      });
    });

    // Connect to server
    function connect(pin) {
      showLoading(true);
      errorMsg.textContent = '';

      socket = io();

      socket.on('connect', () => {
        socket.emit('authenticate', pin);
      });

      socket.on('authenticated', (result) => {
        showLoading(false);
        if (result.success) {
          showControlScreen();
        } else {
          errorMsg.textContent = result.error || 'Invalid PIN';
          pinDigits.forEach(d => d.value = '');
          pinDigits[0].focus();
          socket.disconnect();
          socket = null;
        }
      });

      socket.on('state', (state) => {
        // Merge partial state updates (server may omit unchanged arrays)
        const mergedState = { ...currentState };
        for (const key in state) {
          if (state[key] !== undefined) {
            mergedState[key] = state[key];
          }
        }
        // Debug: log setlist changes
        if (state.setlist) {
          console.log('[Remote] Received setlist update:', state.setlist.length, 'items');
        }
        updateState(mergedState);
      });

      socket.on('session_expired', () => {
        alert('Session expired. Please reconnect.');
        showPinScreen();
      });

      socket.on('disconnect', () => {
        updateConnectionStatus(false);
        // Clear any pending Settings tab loading states
        if (displaysListEl && displaysListEl.querySelector('.loading')) { displaysListEl.innerHTML = '<div class="empty-state">Disconnected</div>'; }
        if (themesSectionEl && themesSectionEl.querySelector('.loading')) { themesSectionEl.innerHTML = '<div class="empty-state">Disconnected</div>'; }
        displaysBusy = false;
      });

      socket.on('connect_error', () => {
        showLoading(false);
        errorMsg.textContent = 'Connection failed. Check if SoluCast is running.';
      });
    }

    function sendCommand(type, payload) {
      if (socket && socket.connected) {
        socket.emit('command', { type, payload });
      }
    }

    var volumeThrottleTimer = null;
    function sendVolumeCommand(type, volume) {
      if (volumeThrottleTimer) return;
      sendCommand(type, { volume: volume });
      volumeThrottleTimer = setTimeout(function() { volumeThrottleTimer = null; }, 50);
    }

    function updateState(state) {
      currentState = state;

      // Throttle rendering to prevent excessive DOM updates
      const now = Date.now();
      if (renderPending) return;

      const timeSinceLastRender = now - lastRenderTime;
      if (timeSinceLastRender < MIN_RENDER_INTERVAL) {
        renderPending = true;
        setTimeout(() => {
          renderPending = false;
          lastRenderTime = Date.now();
          doRender();
        }, MIN_RENDER_INTERVAL - timeSinceLastRender);
        return;
      }

      lastRenderTime = now;
      doRender();
    }

    function doRender() {
      const state = currentState;

      if (state.activeYoutube) {
        currentTitle.textContent = state.activeYoutube.title || 'YouTube Video';
        const mins = Math.floor((state.activeYoutube.currentTime || 0) / 60);
        const secs = Math.floor((state.activeYoutube.currentTime || 0) % 60);
        const totalMins = Math.floor((state.activeYoutube.duration || 0) / 60);
        const totalSecs = Math.floor((state.activeYoutube.duration || 0) % 60);
        slideInfo.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs + ' / ' + totalMins + ':' + (totalSecs < 10 ? '0' : '') + totalSecs;
      } else if (state.activeVideo) {
        currentTitle.textContent = state.activeVideo.name || 'Video';
        const mins = Math.floor((state.activeVideo.currentTime || 0) / 60);
        const secs = Math.floor((state.activeVideo.currentTime || 0) % 60);
        const totalMins = Math.floor((state.activeVideo.duration || 0) / 60);
        const totalSecs = Math.floor((state.activeVideo.duration || 0) % 60);
        slideInfo.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs + ' / ' + totalMins + ':' + (totalSecs < 10 ? '0' : '') + totalSecs;
      } else if (state.activeAudio) {
        currentTitle.textContent = state.activeAudio.name || 'Audio';
        const mins = Math.floor((state.activeAudio.currentTime || 0) / 60);
        const secs = Math.floor((state.activeAudio.currentTime || 0) % 60);
        const totalMins = Math.floor((state.activeAudio.duration || 0) / 60);
        const totalSecs = Math.floor((state.activeAudio.duration || 0) % 60);
        slideInfo.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs + ' / ' + totalMins + ':' + (totalSecs < 10 ? '0' : '') + totalSecs;
      } else if (state.activeMedia) {
        currentTitle.textContent = state.activeMedia.name || 'Media';
        slideInfo.textContent = state.activeMedia.type === 'video' ? 'Video Playing' : 'Image Displayed';
      } else if (state.currentItem) {
        currentTitle.textContent = state.currentItem.title || 'Untitled';
        slideInfo.textContent = 'Slide ' + (state.currentSlideIndex + 1) + ' of ' + state.totalSlides;
      } else {
        currentTitle.textContent = 'No item selected';
        slideInfo.textContent = '-';
      }

      blankBtn.classList.toggle('active', state.isBlank);
      modeButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === state.displayMode);
      });

      renderSlides(state.slides, state.currentSlideIndex, state.activeMedia, state.activeAudio, state.activeVideo, state.activeYoutube);
      renderSetlist(state.setlist, state.currentItem?.id);
      updateConnectionStatus(true);
    }

    function renderSlides(slides, currentIndex, activeMedia, activeAudio, activeVideo, activeYoutube) {
      const slidesGrid = document.getElementById('slides-grid');

      // Show YouTube controls when YouTube is active
      if (activeYoutube) {
        const mins = Math.floor((activeYoutube.currentTime || 0) / 60);
        const secs = Math.floor((activeYoutube.currentTime || 0) % 60);
        const totalMins = Math.floor((activeYoutube.duration || 0) / 60);
        const totalSecs = Math.floor((activeYoutube.duration || 0) % 60);
        const progress = activeYoutube.duration > 0 ? (activeYoutube.currentTime / activeYoutube.duration) * 100 : 0;

        slidesGrid.innerHTML =
          '<div style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 24px;">' +
            '<div style="font-size: 48px; color: #FF0000;">&#9658;</div>' +
            '<div style="font-size: 16px; font-weight: 600; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis;">' + escapeHtml(activeYoutube.title || 'YouTube Video') + '</div>' +
            '<div style="font-size: 14px; color: rgba(255,255,255,0.6);">' + mins + ':' + (secs < 10 ? '0' : '') + secs + ' / ' + totalMins + ':' + (totalSecs < 10 ? '0' : '') + totalSecs + '</div>' +
            '<div style="width: 100%; max-width: 280px; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; overflow: hidden; cursor: pointer;" id="youtube-progress-bar">' +
              '<div style="width: ' + progress + '%; height: 100%; background: linear-gradient(90deg, #FF0000, #CC0000); transition: width 0.3s;"></div>' +
            '</div>' +
            '<div style="display: flex; gap: 12px; margin-top: 8px;">' +
              '<button id="youtube-play-btn" style="width: 56px; height: 56px; border-radius: 50%; border: none; background: ' + (activeYoutube.isPlaying ? 'rgba(255, 0, 0, 0.3)' : 'linear-gradient(135deg, #FF0000, #CC0000)') + '; color: white; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">' +
                (activeYoutube.isPlaying ? '&#10074;&#10074;' : '&#9654;') +
              '</button>' +
              '<button id="youtube-stop-btn" style="width: 56px; height: 56px; border-radius: 50%; border: none; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;">' +
                '&#9632;' +
              '</button>' +
            '</div>' +
          '</div>';

        document.getElementById('youtube-play-btn').addEventListener('click', () => {
          sendCommand(activeYoutube.isPlaying ? 'youtube:pause' : 'youtube:play', {});
        });
        document.getElementById('youtube-stop-btn').addEventListener('click', () => {
          sendCommand('youtube:stop', {});
        });
        document.getElementById('youtube-progress-bar').addEventListener('click', (e) => {
          const bar = document.getElementById('youtube-progress-bar');
          if (!bar) return;
          if (!activeYoutube.duration) return;
          const rect = bar.getBoundingClientRect();
          const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const seekTime = percent * activeYoutube.duration;
          sendCommand('youtube:seek', { time: seekTime });
        });
        return;
      }

      // Show video controls when video is active
      if (activeVideo) {
        const mins = Math.floor((activeVideo.currentTime || 0) / 60);
        const secs = Math.floor((activeVideo.currentTime || 0) % 60);
        const totalMins = Math.floor((activeVideo.duration || 0) / 60);
        const totalSecs = Math.floor((activeVideo.duration || 0) % 60);
        const progress = activeVideo.duration > 0 ? (activeVideo.currentTime / activeVideo.duration) * 100 : 0;
        const volumePercent = Math.round((activeVideo.volume != null ? activeVideo.volume : 1) * 100);

        slidesGrid.innerHTML =
          '<div style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 24px;">' +
            '<div style="font-size: 48px;">&#127909;</div>' +
            '<div style="font-size: 16px; font-weight: 600; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis;">' + escapeHtml(activeVideo.name || 'Video') + '</div>' +
            '<div style="font-size: 14px; color: rgba(255,255,255,0.6);">' + mins + ':' + (secs < 10 ? '0' : '') + secs + ' / ' + totalMins + ':' + (totalSecs < 10 ? '0' : '') + totalSecs + '</div>' +
            '<div style="width: 100%; max-width: 280px; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; overflow: hidden; cursor: pointer;" id="video-progress-bar">' +
              '<div style="width: ' + progress + '%; height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); transition: width 0.3s;"></div>' +
            '</div>' +
            '<div style="display: flex; gap: 12px; margin-top: 8px;">' +
              '<button id="video-play-btn" style="width: 56px; height: 56px; border-radius: 50%; border: none; background: ' + (activeVideo.isPlaying ? 'rgba(59, 130, 246, 0.3)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)') + '; color: white; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">' +
                (activeVideo.isPlaying ? '&#10074;&#10074;' : '&#9654;') +
              '</button>' +
              '<button id="video-stop-btn" style="width: 56px; height: 56px; border-radius: 50%; border: none; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;">' +
                '&#9632;' +
              '</button>' +
            '</div>' +
            '<div style="display: flex; align-items: center; gap: 12px; width: 100%; max-width: 280px; margin-top: 8px;">' +
              '<span style="font-size: 18px;">&#128264;</span>' +
              '<input type="range" id="video-volume" min="0" max="100" value="' + volumePercent + '" style="flex: 1; height: 6px; -webkit-appearance: none; background: rgba(255,255,255,0.2); border-radius: 3px; outline: none;">' +
              '<span id="video-volume-label" style="font-size: 12px; min-width: 36px; text-align: right;">' + volumePercent + '%</span>' +
            '</div>' +
          '</div>';

        document.getElementById('video-play-btn').addEventListener('click', () => {
          sendCommand(activeVideo.isPlaying ? 'video:pause' : 'video:play', {});
        });
        document.getElementById('video-stop-btn').addEventListener('click', () => {
          sendCommand('video:stop', {});
        });
        document.getElementById('video-volume').addEventListener('input', (e) => {
          const vol = parseInt(e.target.value);
          document.getElementById('video-volume-label').textContent = vol + '%';
          sendVolumeCommand('video:volume', vol / 100);
        });
        document.getElementById('video-progress-bar').addEventListener('click', (e) => {
          const bar = document.getElementById('video-progress-bar');
          if (!bar) return;
          if (!activeVideo.duration) return;
          const rect = bar.getBoundingClientRect();
          const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const seekTime = percent * activeVideo.duration;
          sendCommand('video:seek', { time: seekTime });
        });
        return;
      }

      // Show audio controls when audio is active
      if (activeAudio) {
        const mins = Math.floor((activeAudio.currentTime || 0) / 60);
        const secs = Math.floor((activeAudio.currentTime || 0) % 60);
        const totalMins = Math.floor((activeAudio.duration || 0) / 60);
        const totalSecs = Math.floor((activeAudio.duration || 0) % 60);
        const progress = activeAudio.duration > 0 ? (activeAudio.currentTime / activeAudio.duration) * 100 : 0;
        const volumePercent = Math.round((activeAudio.volume != null ? activeAudio.volume : 1) * 100);

        slidesGrid.innerHTML =
          '<div style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 24px;">' +
            '<div style="font-size: 48px;">&#127925;</div>' +
            '<div style="font-size: 16px; font-weight: 600; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis;">' + escapeHtml(activeAudio.name || 'Audio') + '</div>' +
            '<div style="font-size: 14px; color: rgba(255,255,255,0.6);">' + mins + ':' + (secs < 10 ? '0' : '') + secs + ' / ' + totalMins + ':' + (totalSecs < 10 ? '0' : '') + totalSecs + '</div>' +
            '<div style="width: 100%; max-width: 280px; height: 6px; background: rgba(255,255,255,0.2); border-radius: 3px; overflow: hidden; cursor: pointer;" id="audio-progress-bar">' +
              '<div style="width: ' + progress + '%; height: 100%; background: linear-gradient(90deg, #9C27B0, #E91E63); transition: width 0.3s;"></div>' +
            '</div>' +
            '<div style="display: flex; gap: 12px; margin-top: 8px;">' +
              '<button id="audio-play-btn" style="width: 56px; height: 56px; border-radius: 50%; border: none; background: ' + (activeAudio.isPlaying ? 'rgba(156, 39, 176, 0.3)' : 'linear-gradient(135deg, #9C27B0, #E91E63)') + '; color: white; font-size: 24px; cursor: pointer; display: flex; align-items: center; justify-content: center;">' +
                (activeAudio.isPlaying ? '&#10074;&#10074;' : '&#9654;') +
              '</button>' +
              '<button id="audio-stop-btn" style="width: 56px; height: 56px; border-radius: 50%; border: none; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center;">' +
                '&#9632;' +
              '</button>' +
            '</div>' +
            '<div style="display: flex; align-items: center; gap: 12px; width: 100%; max-width: 280px; margin-top: 8px;">' +
              '<span style="font-size: 18px;">&#128264;</span>' +
              '<input type="range" id="audio-volume" min="0" max="100" value="' + volumePercent + '" style="flex: 1; height: 6px; -webkit-appearance: none; background: rgba(255,255,255,0.2); border-radius: 3px; outline: none;">' +
              '<span id="audio-volume-label" style="font-size: 12px; min-width: 36px; text-align: right;">' + volumePercent + '%</span>' +
            '</div>' +
          '</div>';

        document.getElementById('audio-play-btn').addEventListener('click', () => {
          sendCommand(activeAudio.isPlaying ? 'audio:pause' : 'audio:play', {});
        });
        document.getElementById('audio-stop-btn').addEventListener('click', () => {
          sendCommand('audio:stop', {});
        });
        document.getElementById('audio-volume').addEventListener('input', (e) => {
          const vol = parseInt(e.target.value);
          document.getElementById('audio-volume-label').textContent = vol + '%';
          sendVolumeCommand('audio:volume', vol / 100);
        });
        document.getElementById('audio-progress-bar').addEventListener('click', (e) => {
          const bar = document.getElementById('audio-progress-bar');
          if (!bar) return;
          if (!activeAudio.duration) return;
          const rect = bar.getBoundingClientRect();
          const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const seekTime = percent * activeAudio.duration;
          sendCommand('audio:seek', { time: seekTime });
        });
        return;
      }

      // Show media controls when media is active
      if (activeMedia) {
        const icon = activeMedia.type === 'video' ? '&#127909;' : '&#128247;';
        const typeLabel = activeMedia.type === 'video' ? 'Video' : 'Image';
        slidesGrid.innerHTML =
          '<div style="grid-column: 1/-1; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 24px;">' +
            '<div style="font-size: 48px;">' + icon + '</div>' +
            '<div style="font-size: 18px; font-weight: 600;">' + typeLabel + ' Playing</div>' +
            '<div style="font-size: 14px; color: rgba(255,255,255,0.6);">' + escapeHtml(activeMedia.name || 'Media') + '</div>' +
            '<button id="stop-media-btn" style="margin-top: 16px; padding: 12px 32px; background: linear-gradient(135deg, #ef4444, #dc2626); border: none; border-radius: 8px; color: white; font-size: 16px; font-weight: 600; cursor: pointer;">' +
              '&#9632; Stop Media' +
            '</button>' +
          '</div>';

        document.getElementById('stop-media-btn').addEventListener('click', () => {
          sendCommand('media:stop', {});
        });
        return;
      }

      if (!slides || slides.length === 0) {
        slidesGrid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;">Select a song or item</div>';
        return;
      }

      slidesGrid.innerHTML = slides.map(slide => {
        const isCurrent = slide.index === currentIndex;
        const isCombined = slide.isCombined;
        const cardClass = 'slide-card' + (isCurrent ? ' current' : '') + (isCombined ? ' combined' : '');
        return '<div class="' + cardClass + '" data-index="' + slide.index + '">' +
          '<div class="slide-number">' +
            (isCombined ? '<span style="color: #f59e0b; margin-right: 4px;">⧉</span>' : '') +
            escapeHtml(slide.verseType || ('Slide ' + (slide.index + 1))) +
          '</div>' +
          '<div class="slide-preview">' + escapeHtml(slide.preview || '') + '</div>' +
        '</div>';
      }).join('');

      slidesGrid.querySelectorAll('.slide-card').forEach(el => {
        el.addEventListener('click', () => {
          const index = parseInt(el.dataset.index);
          sendCommand('slide:goto', { index });
        });
      });
    }

    function renderSetlist(items, currentId) {
      if (!items || items.length === 0) {
        setlistItems.innerHTML = '<div class="empty-state">No items in setlist</div>';
        return;
      }

      setlistItems.innerHTML = items.map(item => {
        const isCurrent = item.id === currentId;
        const iconClass = getItemIconClass(item.type);
        const icon = getItemIcon(item.type);

        return '<div class="list-item' + (isCurrent ? ' current' : '') + '" data-id="' + escapeHtml(String(item.id)) + '">' +
          '<div class="item-icon ' + iconClass + '">' + icon + '</div>' +
          '<div class="item-details"><div class="item-name">' + escapeHtml(item.title || 'Untitled') + '</div></div>' +
        '</div>';
      }).join('');

      setlistItems.querySelectorAll('.list-item').forEach(el => {
        el.addEventListener('click', () => {
          sendCommand('setlist:select', { id: el.dataset.id });
        });
      });
    }

    // Songs
    function loadSongs() {
      const songsList = document.getElementById('songs-list');
      if (!socket || !socket.connected) {
        songsList.innerHTML = '<div class="empty-state">Not connected</div>';
        return;
      }
      songsList.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Loading songs...</div>';

      socket.emit('getSongs', (result) => {
        if (result.error) {
          songsList.innerHTML = '<div class="empty-state">Failed to load songs</div>';
          return;
        }
        songsCache = result.songs;
        renderSongs(songsCache);
      });
    }

    function renderSongs(songs) {
      const songsList = document.getElementById('songs-list');
      if (!songs || songs.length === 0) {
        songsList.innerHTML = '<div class="empty-state">No songs found</div>';
        return;
      }

      songsList.innerHTML = songs.map(song =>
        '<div class="list-item" data-song-id="' + escapeHtml(String(song.id)) + '">' +
          '<div class="item-icon song">&#9835;</div>' +
          '<div class="item-details">' +
            '<div class="item-name">' + escapeHtml(song.title || 'Untitled') + '</div>' +
            '<div class="item-meta">' + escapeHtml(song.author || '') + ' &bull; ' + song.slideCount + ' slides</div>' +
          '</div>' +
          '<button class="add-btn" data-action="add-song">+ Add</button>' +
        '</div>'
      ).join('');

      songsList.querySelectorAll('.list-item').forEach(el => {
        el.querySelector('.add-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          sendCommand('library:addSong', { songId: el.dataset.songId });
        });
        el.addEventListener('click', () => {
          sendCommand('library:selectSong', { songId: el.dataset.songId });
        });
      });
    }

    document.getElementById('song-search').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      if (!songsCache) return;
      const filtered = songsCache.filter(s =>
        (s.title && s.title.toLowerCase().includes(query)) ||
        (s.author && s.author.toLowerCase().includes(query))
      );
      renderSongs(filtered);
    });

    // Bible
    function loadBibleBooks() {
      if (!socket || !socket.connected) return;
      socket.emit('getBibleBooks', (result) => {
        if (result.error) return;
        bibleBooks = result.books;
        const bookSelect = document.getElementById('bible-book');
        bookSelect.innerHTML = '<option value="">Select Book</option>' +
          result.books.map(b => '<option value="' + escapeHtml(b.name) + '">' + escapeHtml(b.name) + (b.hebrewName ? ' (' + escapeHtml(b.hebrewName) + ')' : '') + '</option>').join('');
      });
    }

    document.getElementById('bible-book').addEventListener('change', (e) => {
      const bookName = e.target.value;
      const chapterSelect = document.getElementById('bible-chapter');
      const versesDiv = document.getElementById('bible-verses');

      if (!bookName) {
        chapterSelect.innerHTML = '<option value="">Ch.</option>';
        versesDiv.innerHTML = '<div class="empty-state">Select a book and chapter</div>';
        return;
      }

      const book = bibleBooks.find(b => b.name === bookName);
      if (book) {
        chapterSelect.innerHTML = '<option value="">Ch.</option>' +
          Array.from({length: book.chapters}, (_, i) => '<option value="' + (i+1) + '">' + (i+1) + '</option>').join('');
      }
    });

    document.getElementById('bible-chapter').addEventListener('change', (e) => {
      const chapter = parseInt(e.target.value);
      const book = document.getElementById('bible-book').value;
      const versesDiv = document.getElementById('bible-verses');

      if (!book || !chapter) return;
      if (!socket || !socket.connected) return;

      versesDiv.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Loading...</div>';

      socket.emit('getBibleChapter', { book, chapter }, (result) => {
        if (result.error) {
          versesDiv.innerHTML = '<div class="empty-state">Failed to load chapter</div>';
          return;
        }

        if (!result.verses || result.verses.length === 0) {
          versesDiv.innerHTML = '<div class="empty-state">No verses found</div>';
          return;
        }

        versesDiv.innerHTML = '<div class="list-item" data-book="' + escapeHtml(book) + '" data-chapter="' + chapter + '">' +
          '<div class="item-icon bible">&#128214;</div>' +
          '<div class="item-details">' +
            '<div class="item-name">' + escapeHtml(book) + ' ' + chapter + '</div>' +
            '<div class="item-meta">' + result.verses.length + ' verses</div>' +
          '</div>' +
          '<button class="add-btn" data-action="add-bible">+ Add</button>' +
        '</div>';

        versesDiv.querySelector('.add-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          sendCommand('library:addBible', { book, chapter });
        });
        versesDiv.querySelector('.list-item').addEventListener('click', () => {
          sendCommand('library:selectBible', { book, chapter });
        });
      });
    });

    // Bible reference search
    const hebrewBookNames = {
      // Old Testament
      'בראשית': 'Genesis', 'שמות': 'Exodus', 'ויקרא': 'Leviticus',
      'במדבר': 'Numbers', 'דברים': 'Deuteronomy', 'יהושע': 'Joshua',
      'שופטים': 'Judges', 'שמואל א': 'I Samuel', 'שמואל ב': 'II Samuel',
      'מלכים א': 'I Kings', 'מלכים ב': 'II Kings', 'ישעיהו': 'Isaiah',
      'ישעיה': 'Isaiah', 'ירמיהו': 'Jeremiah', 'ירמיה': 'Jeremiah',
      'יחזקאל': 'Ezekiel', 'הושע': 'Hosea', 'יואל': 'Joel', 'עמוס': 'Amos',
      'עובדיה': 'Obadiah', 'יונה': 'Jonah', 'מיכה': 'Micah', 'נחום': 'Nahum',
      'חבקוק': 'Habakkuk', 'צפניה': 'Zephaniah', 'חגי': 'Haggai',
      'זכריה': 'Zechariah', 'מלאכי': 'Malachi', 'תהילים': 'Psalms',
      'משלי': 'Proverbs', 'איוב': 'Job', 'שיר השירים': 'Song of Solomon',
      'רות': 'Ruth', 'איכה': 'Lamentations', 'קהלת': 'Ecclesiastes',
      'אסתר': 'Esther', 'דניאל': 'Daniel', 'עזרא': 'Ezra',
      'נחמיה': 'Nehemiah', 'דברי הימים א': 'I Chronicles',
      'דברי הימים ב': 'II Chronicles',
      // New Testament
      'מתי': 'Matthew', 'מרקוס': 'Mark', 'לוקס': 'Luke', 'יוחנן': 'John',
      'מעשי השליחים': 'Acts', 'מעשה השליחים': 'Acts', 'רומים': 'Romans',
      'קורינתים א': 'I Corinthians', 'קורינתים ב': 'II Corinthians',
      'גלטים': 'Galatians', 'אפסים': 'Ephesians', 'פיליפים': 'Philippians',
      'קולוסים': 'Colossians', 'תסלוניקים א': 'I Thessalonians',
      'תסלוניקים ב': 'II Thessalonians', 'טימותיוס א': 'I Timothy',
      'טימותיוס ב': 'II Timothy', 'טיטוס': 'Titus', 'פילמון': 'Philemon',
      'עברים': 'Hebrews', 'יעקב': 'James', 'פטרוס א': 'I Peter',
      'פטרוס ב': 'II Peter', 'יוחנן א': 'I John', 'יוחנן ב': 'II John',
      'יוחנן ג': 'III John', 'יהודה': 'Jude', 'התגלות': 'Revelation'
    };

    const bibleRefSearch = document.getElementById('bible-ref-search');
    const bibleQuickAdd = document.getElementById('bible-quick-add');
    const bibleRefDisplay = document.getElementById('bible-ref-display');
    const bibleAddBtn = document.getElementById('bible-add-btn');
    let parsedBibleRef = null;

    // Hebrew letter to number conversion
    function hebrewToNumber(str) {
      const hebrewNums = {
        'א': 1, 'ב': 2, 'ג': 3, 'ד': 4, 'ה': 5, 'ו': 6, 'ז': 7, 'ח': 8, 'ט': 9,
        'י': 10, 'כ': 20, 'ך': 20, 'ל': 30, 'מ': 40, 'ם': 40, 'נ': 50, 'ן': 50,
        'ס': 60, 'ע': 70, 'פ': 80, 'ף': 80, 'צ': 90, 'ץ': 90,
        'ק': 100, 'ר': 200, 'ש': 300, 'ת': 400
      };
      let total = 0;
      for (const char of str) {
        if (hebrewNums[char]) {
          total += hebrewNums[char];
        }
      }
      return total > 0 ? total : null;
    }

    // Check if string contains Hebrew letters
    function hasHebrew(str) {
      return /[\u0590-\u05FF]/.test(str);
    }

    bibleRefSearch.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      if (!query || !bibleBooks) {
        bibleQuickAdd.style.display = 'none';
        parsedBibleRef = null;
        return;
      }

      let bookSearch, chapter, verseStart, verseEnd;

      // Try Arabic numerals first: "John 3:16" or "Genesis 1:1-5"
      const arabicMatch = query.match(/^(.+?)\\s+(\\d+)(?::(\\d+)(?:-(\\d+))?)?$/);
      // Try Hebrew format: "בראשית כ" or "בראשית כ:א-ה"
      const hebrewMatch = query.match(/^(.+?)\\s+([א-ת]+)(?::([א-ת]+)(?:-([א-ת]+))?)?$/);

      if (arabicMatch) {
        bookSearch = arabicMatch[1].trim();
        chapter = parseInt(arabicMatch[2]);
        verseStart = arabicMatch[3] ? parseInt(arabicMatch[3]) : null;
        verseEnd = arabicMatch[4] ? parseInt(arabicMatch[4]) : null;
      } else if (hebrewMatch) {
        bookSearch = hebrewMatch[1].trim();
        chapter = hebrewToNumber(hebrewMatch[2]);
        verseStart = hebrewMatch[3] ? hebrewToNumber(hebrewMatch[3]) : null;
        verseEnd = hebrewMatch[4] ? hebrewToNumber(hebrewMatch[4]) : null;
      } else {
        bibleQuickAdd.style.display = 'none';
        parsedBibleRef = null;
        return;
      }

      if (!chapter) {
        bibleQuickAdd.style.display = 'none';
        parsedBibleRef = null;
        return;
      }

      // Check if Hebrew and convert
      if (hebrewBookNames[bookSearch]) {
        bookSearch = hebrewBookNames[bookSearch];
      }

      // Find matching book
      const searchLower = bookSearch.toLowerCase();
      let matchedBook = bibleBooks.find(b => b.name.toLowerCase() === searchLower);
      if (!matchedBook) {
        matchedBook = bibleBooks.find(b => b.name.toLowerCase().startsWith(searchLower));
      }
      if (!matchedBook) {
        matchedBook = bibleBooks.find(b => b.name.toLowerCase().includes(searchLower));
      }

      if (matchedBook && chapter >= 1 && chapter <= matchedBook.chapters) {
        // Valid reference found
        let refText = matchedBook.name + ' ' + chapter;
        if (verseStart) {
          refText += ':' + verseStart;
          if (verseEnd && verseEnd > verseStart) {
            refText += '-' + verseEnd;
          }
        }

        parsedBibleRef = {
          book: matchedBook.name,
          chapter: chapter,
          verseStart: verseStart,
          verseEnd: verseEnd
        };

        bibleRefDisplay.textContent = refText;
        bibleQuickAdd.style.display = 'block';
        // Hide the verses list when quick add is shown
        document.getElementById('bible-verses').innerHTML = '';
      } else {
        bibleQuickAdd.style.display = 'none';
        parsedBibleRef = null;
      }
    });

    bibleAddBtn.addEventListener('click', () => {
      if (parsedBibleRef) {
        sendCommand('library:addBible', {
          book: parsedBibleRef.book,
          chapter: parsedBibleRef.chapter,
          verseStart: parsedBibleRef.verseStart,
          verseEnd: parsedBibleRef.verseEnd
        });
        // Clear search after adding
        bibleRefSearch.value = '';
        bibleQuickAdd.style.display = 'none';
        parsedBibleRef = null;
      }
    });

    // Media
    function loadMedia() {
      const mediaList = document.getElementById('media-list');
      if (!socket || !socket.connected) {
        mediaList.innerHTML = '<div class="empty-state">Not connected</div>';
        return;
      }
      mediaList.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Loading media...</div>';

      socket.emit('getMedia', (result) => {
        if (result.error) {
          mediaList.innerHTML = '<div class="empty-state">Failed to load media</div>';
          return;
        }
        mediaCache = result.media;
        renderMedia(mediaCache);
      });
    }

    function renderMedia(media) {
      const mediaList = document.getElementById('media-list');
      if (!media || media.length === 0) {
        mediaList.innerHTML = '<div class="empty-state">No media found</div>';
        return;
      }

      mediaList.innerHTML = media.map(m => {
        const typeIcon = m.type === 'video' ? '&#127909;' : m.type === 'audio' ? '&#127925;' : '&#128247;';
        return '<div class="list-item" data-media-id="' + escapeHtml(String(m.id)) + '">' +
          '<div class="item-icon media">' + typeIcon + '</div>' +
          '<div class="item-details">' +
            '<div class="item-name">' + escapeHtml(m.name || 'Untitled') + '</div>' +
            '<div class="item-meta">' + escapeHtml(m.type || '') + (m.duration ? ' &bull; ' + formatDuration(m.duration) : '') + '</div>' +
          '</div>' +
          '<button class="add-btn" data-action="add-media">+ Add</button>' +
        '</div>';
      }).join('');

      mediaList.querySelectorAll('.list-item').forEach(el => {
        el.querySelector('.add-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          sendCommand('library:addMedia', { mediaId: el.dataset.mediaId });
        });
        el.addEventListener('click', () => {
          sendCommand('library:selectMedia', { mediaId: el.dataset.mediaId });
        });
      });
    }

    document.getElementById('media-search').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      if (!mediaCache) return;
      const filtered = mediaCache.filter(m => m.name && m.name.toLowerCase().includes(query));
      renderMedia(filtered);
    });

    function formatDuration(seconds) {
      if (!seconds) return '';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return mins + ':' + secs.toString().padStart(2, '0');
    }

    // Presentations
    function loadPresentations() {
      const presentationsList = document.getElementById('presentations-list');
      if (!socket || !socket.connected) {
        presentationsList.innerHTML = '<div class="empty-state">Not connected</div>';
        return;
      }
      presentationsList.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Loading presentations...</div>';

      socket.emit('getPresentations', (result) => {
        if (result.error) {
          presentationsList.innerHTML = '<div class="empty-state">Failed to load presentations</div>';
          return;
        }
        presentationsCache = result.presentations;
        renderPresentations(presentationsCache);
      });
    }

    function renderPresentations(presentations) {
      const presentationsList = document.getElementById('presentations-list');
      if (!presentations || presentations.length === 0) {
        presentationsList.innerHTML = '<div class="empty-state">No presentations found</div>';
        return;
      }

      presentationsList.innerHTML = presentations.map(p => {
        const typeIcon = p.quickModeType === 'prayer' ? '&#128591;' : p.quickModeType === 'sermon' ? '&#128220;' : '&#128200;';
        const typeLabel = p.quickModeType || 'presentation';
        return '<div class="list-item" data-presentation-id="' + escapeHtml(String(p.id)) + '">' +
          '<div class="item-icon tool">' + typeIcon + '</div>' +
          '<div class="item-details">' +
            '<div class="item-name">' + escapeHtml(p.title || 'Untitled') + '</div>' +
            '<div class="item-meta">' + escapeHtml(typeLabel) + ' &bull; ' + p.slideCount + ' slides</div>' +
          '</div>' +
          '<button class="add-btn" data-action="add-presentation">+ Add</button>' +
        '</div>';
      }).join('');

      presentationsList.querySelectorAll('.list-item').forEach(el => {
        el.querySelector('.add-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          sendCommand('library:addPresentation', { presentationId: el.dataset.presentationId });
        });
        el.addEventListener('click', () => {
          sendCommand('library:selectPresentation', { presentationId: el.dataset.presentationId });
        });
      });
    }

    document.getElementById('presentation-search').addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      if (!presentationsCache) return;
      const filtered = presentationsCache.filter(p => p.title && p.title.toLowerCase().includes(query));
      renderPresentations(filtered);
    });

    // Settings: Displays
    var displaysBusy = false;
    var displaysListEl = document.getElementById('displays-list');

    function loadDisplays() {
      displaysBusy = false;
      displaysListEl.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Loading displays...</div>';
      if (!socket || !socket.connected) {
        displaysListEl.innerHTML = '<div class="empty-state">Not connected</div>';
        return;
      }
      socket.emit('getDisplays', (result) => {
        if (result.error) {
          displaysListEl.innerHTML = '<div class="empty-state">Failed to load displays</div>';
          return;
        }
        renderDisplays(result.displays);
      });
    }

    function renderDisplays(displays) {
      displaysBusy = false;
      if (!displays || displays.length === 0) {
        displaysListEl.innerHTML = '<div class="empty-state">No displays found</div>';
        return;
      }

      displaysListEl.innerHTML = displays.map(d => {
        const statusLabel = d.isAssigned ? (d.assignedType === 'viewer' ? 'Viewer' : d.assignedType === 'camera' ? 'Camera' : 'Stage') : 'Not assigned';
        const statusColor = d.isAssigned ? (d.assignedType === 'viewer' ? '#06b6d4' : d.assignedType === 'camera' ? '#00897b' : '#a78bfa') : 'rgba(255,255,255,0.5)';
        return '<div class="display-item">' +
          '<div class="display-item-header">' +
            '<span class="display-item-name">' + escapeHtml(d.label || ('Display ' + d.id)) + (d.isPrimary ? ' (Primary)' : '') + '</span>' +
            '<span style="font-size:12px; color:' + statusColor + '; font-weight:600;">' + statusLabel + '</span>' +
          '</div>' +
          '<div class="display-item-meta">' + (d.bounds ? (d.bounds.width + 'x' + d.bounds.height) : 'Unknown') + ' &bull; Scale ' + (d.scaleFactor || 1) + 'x</div>' +
          '<div class="display-actions">' +
            (d.isAssigned
              ? '<button class="btn-close" data-action="close" data-id="' + escapeHtml(String(d.id)) + '">Close</button>'
              : '<button class="btn-viewer" data-action="open-viewer" data-id="' + escapeHtml(String(d.id)) + '">Open Viewer</button>' +
                '<button class="btn-stage" data-action="open-stage" data-id="' + escapeHtml(String(d.id)) + '">Open Stage</button>'
            ) +
            '<button class="btn-identify" data-action="identify" data-id="' + escapeHtml(String(d.id)) + '">Identify</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    // Event delegation: single listener on container handles all display buttons
    displaysListEl.addEventListener('click', (e) => {
      var btn = e.target.closest('button');
      if (!btn || !btn.dataset.action) return;
      var action = btn.dataset.action;
      var displayId = parseInt(btn.dataset.id);
      if (isNaN(displayId)) return;
      if (action === 'identify') {
        if (socket && socket.connected) socket.emit('identifyDisplays', { displayId }, () => {});
        return;
      }
      if (displaysBusy || !socket || !socket.connected) return;
      displaysBusy = true;
      if (action === 'open-viewer') {
        socket.emit('openDisplay', { displayId, type: 'viewer' }, (result) => {
          if (result && result.error) { alert('Failed to open viewer: ' + result.error); }
          loadDisplays();
        });
      } else if (action === 'open-stage') {
        socket.emit('openDisplay', { displayId, type: 'stage' }, (result) => {
          if (result && result.error) { alert('Failed to open stage: ' + result.error); }
          loadDisplays();
        });
      } else if (action === 'close') {
        socket.emit('closeDisplay', { displayId }, (result) => {
          if (result && result.error) { alert('Failed to close display: ' + result.error); }
          loadDisplays();
        });
      }
    });

    document.getElementById('identify-all-btn').addEventListener('click', () => {
      if (socket && socket.connected) socket.emit('identifyDisplays', {}, () => {});
    });
    document.getElementById('refresh-displays-btn').addEventListener('click', () => {
      if (!displaysBusy) loadDisplays();
    });

    // Settings: Themes
    var themesData = null;
    var themesSectionEl = document.getElementById('themes-section');

    function loadThemes(forceRefresh) {
      if (themesData && !forceRefresh) {
        renderThemes(themesData);
        return;
      }
      if (!socket || !socket.connected) {
        themesSectionEl.innerHTML = '<div class="empty-state">Not connected</div>';
        return;
      }
      themesSectionEl.innerHTML = '<div class="loading"><div class="loading-spinner"></div>Loading themes...</div>';
      socket.emit('getThemes', (result) => {
        if (result.error) {
          themesSectionEl.innerHTML = '<div class="empty-state">Failed to load themes</div>';
          return;
        }
        themesData = result;
        renderThemes(result);
      });
    }

    function renderThemes(data) {
      var categories = [
        { key: 'viewer', label: 'Song' },
        { key: 'stage', label: 'Stage' },
        { key: 'bible', label: 'Bible' },
        { key: 'prayer', label: 'Prayer' }
      ];

      themesSectionEl.innerHTML = categories.map(cat => {
        var themes = data[cat.key] || [];
        var selectedId = data.selectedIds ? data.selectedIds[cat.key] : null;
        var options = themes.map(t =>
          '<option value="' + escapeHtml(t.id || '') + '"' + (t.id === selectedId ? ' selected' : '') + '>' + escapeHtml(t.name || 'Untitled') + '</option>'
        ).join('');
        return '<div class="theme-row">' +
          '<label>' + cat.label + '</label>' +
          '<select data-theme-type="' + cat.key + '">' + options + '</select>' +
        '</div>';
      }).join('');
    }

    // Event delegation: single listener on container handles all theme selects
    themesSectionEl.addEventListener('change', (e) => {
      var sel = e.target;
      if (sel.tagName !== 'SELECT' || !sel.dataset.themeType) return;
      var themeType = sel.dataset.themeType;
      var themeId = sel.value;
      var previousValue = (themesData && themesData.selectedIds) ? themesData.selectedIds[themeType] : null;
      if (!socket || !socket.connected) return;
      socket.emit('selectTheme', { themeType, themeId }, (result) => {
        if (result && result.error) {
          alert('Failed to apply theme: ' + result.error);
          if (previousValue) { sel.value = previousValue; }
        } else {
          // Update cached selectedId and invalidate full cache for next tab visit
          if (themesData && themesData.selectedIds) {
            themesData.selectedIds[themeType] = themeId;
          }
          themesData = null;
        }
      });
    });

    // Navigation
    document.getElementById('prev-btn').addEventListener('click', () => sendCommand('slide:prev', {}));
    document.getElementById('next-btn').addEventListener('click', () => sendCommand('slide:next', {}));
    blankBtn.addEventListener('click', () => sendCommand('slide:blank', {}));
    modeButtons.forEach(btn => {
      btn.addEventListener('click', () => sendCommand('mode:set', { mode: btn.dataset.mode }));
    });

    // Helpers
    function getItemIconClass(type) {
      if (type === 'song') return 'song';
      if (type === 'bible') return 'bible';
      if (type === 'media' || type === 'youtube') return 'media';
      if (type === 'presentation') return 'tool';
      return 'tool';
    }

    function getItemIcon(type) {
      switch (type) {
        case 'song': return '&#9835;';
        case 'bible': return '&#128214;';
        case 'media': return '&#127909;';
        case 'youtube': return '&#9658;';
        case 'presentation': return '&#128200;';
        case 'countdown': return '&#9201;';
        case 'announcement': return '&#128227;';
        default: return '&#9734;';
      }
    }

    function showControlScreen() {
      pinScreen.style.display = 'none';
      controlScreen.style.display = 'flex';
    }

    function showPinScreen() {
      controlScreen.style.display = 'none';
      pinScreen.style.display = 'flex';
      pinDigits.forEach(d => d.value = '');
      pinDigits[0].focus();
      if (socket) {
        socket.disconnect();
        socket = null;
      }
    }

    function showLoading(show) {
      loadingOverlay.classList.toggle('visible', show);
    }

    function updateConnectionStatus(connected) {
      connectionStatus.classList.toggle('disconnected', !connected);
      connectionStatus.querySelector('span').textContent = connected ? 'Connected' : 'Disconnected';
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text != null ? text : '';
      return div.innerHTML;
    }

    // Check for PIN in URL for auto-authentication (from QR code)
    const urlParams = new URLSearchParams(window.location.search);
    const autoPin = urlParams.get('pin');
    if (autoPin && autoPin.length === 6 && /^\\d{6}$/.test(autoPin)) {
      // Auto-fill and connect with PIN from QR code
      autoPin.split('').forEach((digit, i) => {
        if (pinDigits[i]) pinDigits[i].value = digit;
      });
      connect(autoPin);
    } else {
      pinDigits[0].focus();
    }
  </script>
</body>
</html>`;
}
