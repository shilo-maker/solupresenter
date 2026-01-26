$file = "C:\Users\shilo\Documents\solupresenter\desktop\src\renderer\pages\ControlPanel.tsx"
$content = Get-Content $file -Raw

# Define the replacement for the header section
$replacement = @'
      {/* Header */}
      <HeaderBar
        showDisplayPanel={showDisplayPanel}
        displays={displays}
        assignedDisplays={assignedDisplays}
        controlDisplayId={controlDisplayId}
        onlineConnected={onlineConnected}
        viewerCount={viewerCount}
        roomPin={roomPin}
        authState={authState}
        showUserMenu={showUserMenu}
        themes={themes}
        stageMonitorThemes={stageMonitorThemes}
        bibleThemes={bibleThemes}
        prayerThemes={prayerThemes}
        obsThemes={obsThemes}
        selectedTheme={selectedTheme}
        selectedStageTheme={selectedStageTheme}
        selectedBibleTheme={selectedBibleTheme}
        selectedPrayerTheme={selectedPrayerTheme}
        selectedOBSTheme={selectedOBSTheme}
        selectedOBSSongsTheme={selectedOBSSongsTheme}
        selectedOBSBibleTheme={selectedOBSBibleTheme}
        selectedOBSPrayerTheme={selectedOBSPrayerTheme}
        obsServerRunning={obsServerRunning}
        obsServerUrl={obsServerUrl}
        onShowDisplayPanelChange={setShowDisplayPanel}
        onShowUserMenuChange={setShowUserMenu}
        onShowAuthModal={() => setShowAuthModal(true)}
        onShowKeyboardHelp={() => setShowKeyboardHelp(true)}
        onNavigateToSettings={() => navigate('/settings')}
        onControlDisplayChange={async (displayId) => {
          const success = await window.electronAPI.moveControlWindow(displayId);
          if (success) {
            setControlDisplayId(displayId);
          }
        }}
        onOpenDisplay={openDisplay}
        onCloseDisplay={closeDisplay}
        onIdentifyDisplay={(displayId) => window.electronAPI.identifyDisplays(displayId)}
        onApplyViewerTheme={applyThemeToViewer}
        onApplyStageTheme={applyStageThemeToMonitor}
        onApplyBibleTheme={applyBibleThemeCallback}
        onApplyPrayerTheme={applyPrayerThemeCallback}
        onApplyOBSTheme={applyOBSThemeCallback}
        onCreateNewTheme={handleCreateNewTheme}
        onCloseDisplayPanel={handleCloseDisplayPanel}
        onToggleOBSServer={async () => {
          try {
            if (obsServerRunning) {
              await window.electronAPI.stopOBSServer();
              setObsServerRunning(false);
              setObsServerUrl(null);
            } else {
              const result = await window.electronAPI.startOBSServer();
              if (result.success) {
                setObsServerRunning(true);
                setObsServerUrl(result.url ?? null);
              }
            }
          } catch (err) {
            console.error('[OBS Server] Error:', err);
          }
        }}
        onConnectOnline={connectOnline}
        onLogout={handleLogout}
      />
'@

# Find the start line (line containing "Header - like web app")
# And the end line (line containing "</header>")
$lines = $content -split "`n"
$startLine = -1
$endLine = -1

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '\{/\* Header - like web app \*/\}') {
        $startLine = $i
    }
    if ($startLine -ge 0 -and $lines[$i] -match '</header>') {
        $endLine = $i
        break
    }
}

if ($startLine -ge 0 -and $endLine -ge 0) {
    Write-Host "Found header section from line $($startLine + 1) to line $($endLine + 1)"

    # Create new content
    $newLines = @()
    $newLines += $lines[0..($startLine - 1)]
    $newLines += $replacement
    $newLines += $lines[($endLine + 1)..($lines.Count - 1)]

    $newContent = $newLines -join "`n"
    Set-Content -Path $file -Value $newContent -NoNewline

    Write-Host "Successfully replaced header section"
} else {
    Write-Host "Could not find header section markers. Start: $startLine, End: $endLine"
}
