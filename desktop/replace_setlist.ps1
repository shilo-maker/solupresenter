$file = "C:\Users\shilo\Documents\solupresenter\desktop\src\renderer\pages\ControlPanel.tsx"
$content = Get-Content $file -Raw

# Define the replacement for the setlist section
$replacement = @'
          {/* Middle Column - Setlist */}
          <div style={{ width: `${setlistPanelWidth}%`, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', overflow: 'hidden' }}>
            <SetlistPanel
              setlist={setlist}
              currentSetlistId={currentSetlistId}
              currentSetlistName={currentSetlistName}
              hasUnsavedChanges={hasUnsavedChanges}
              showSetlistMenu={showSetlistMenu}
              setlistMenuHover={setlistMenuHover}
              draggedSong={draggedSong}
              isDraggingMedia={isDraggingMedia}
              dropTargetIndex={dropTargetIndex}
              draggedSetlistIndex={draggedSetlistIndex}
              collapsedSections={collapsedSections}
              expandedPlaylistIds={expandedPlaylistIds}
              setlistMenuOpen={setlistMenuOpen}
              hoveredMediaStopId={hoveredMediaStopId}
              selectedSetlistMediaId={selectedSetlistMediaId}
              selectedYoutubeItemId={selectedYoutubeItemId}
              selectedSong={selectedSong}
              selectedPresentation={selectedPresentation}
              activeMedia={activeMedia}
              activeAudio={activeAudio}
              audioStatus={audioStatus}
              activeToolId={activeToolId}
              youtubeOnDisplay={youtubeOnDisplay}
              activeYoutubeVideo={activeYoutubeVideo}
              activePlaylistId={activePlaylistId}
              activePlaylistIndex={activePlaylistIndex}
              activePlaylistOrder={activePlaylistOrder}
              autoPlayActive={autoPlayActive}
              autoPlayInterval={autoPlayInterval}
              currentPresentationSlideIndex={currentPresentationSlideIndex}
              onShowSetlistMenuChange={setShowSetlistMenu}
              onSetlistMenuHoverChange={setSetlistMenuHover}
              onDraggedSongChange={setDraggedSong}
              onIsDraggingMediaChange={setIsDraggingMedia}
              onDropTargetIndexChange={setDropTargetIndex}
              onDraggedSetlistIndexChange={setDraggedSetlistIndex}
              onCollapsedSectionsChange={setCollapsedSections}
              onExpandedPlaylistIdsChange={setExpandedPlaylistIds}
              onSetlistMenuOpenChange={setSetlistMenuOpen}
              onHoveredMediaStopIdChange={setHoveredMediaStopId}
              onSelectedSetlistMediaIdChange={setSelectedSetlistMediaId}
              onSelectedYoutubeItemIdChange={setSelectedYoutubeItemId}
              onSetlistContextMenuChange={setSetlistContextMenu}
              onSetlistChange={setSetlist}
              onAddToSetlist={addToSetlist}
              onRemoveFromSetlist={removeFromSetlist}
              onTryClearSetlist={tryClearSetlist}
              onAddSectionHeader={addSectionHeader}
              onShowLoadModal={() => setShowLoadModal(true)}
              onShowSaveModal={() => setShowSaveModal(true)}
              onSelectSong={selectSong}
              onSelectPresentation={(pres) => {
                setSelectedPresentation(pres);
                setCurrentPresentationSlideIndex(0);
              }}
              onSetSelectedSong={setSelectedSong}
              onSetSelectedPresentation={setSelectedPresentation}
              onSetCurrentPresentationSlideIndex={setCurrentPresentationSlideIndex}
              onSetCurrentContentType={setCurrentContentType}
              onSetIsBlank={setIsBlank}
              onSetLiveState={setLiveState}
              onSendBlank={() => window.electronAPI.sendBlank()}
              onStopAllTools={stopAllTools}
              onBroadcastToolFromSetlist={broadcastToolFromSetlist}
              onSetActiveMedia={setActiveMedia}
              onSetActiveAudio={setActiveAudio}
              onSetActiveAudioSetlistId={setActiveAudioSetlistId}
              onHandlePlayAudio={handlePlayAudio}
              onHandleDisplayMedia={handleDisplayMedia}
              onClearMedia={() => window.electronAPI.clearMedia()}
              onStartPlaylist={startPlaylist}
              onSetActivePlaylistId={setActivePlaylistId}
              onSetActivePlaylistIndex={setActivePlaylistIndex}
              onSetActivePlaylistOrder={setActivePlaylistOrder}
              onOpenEditPlaylistModal={openEditPlaylistModal}
              onStartEditingSong={startEditingSong}
              onPlayYoutubeVideo={(videoId, title, thumbnail) => {
                setActiveYoutubeVideo({ videoId, title, thumbnail });
                setYoutubeOnDisplay(true);
                window.electronAPI.playYoutube(videoId, title, thumbnail);
              }}
              onStopYoutubeVideo={() => {
                setYoutubeOnDisplay(false);
                setActiveYoutubeVideo(null);
                window.electronAPI.stopYoutube();
              }}
            />
          </div>
'@

# Find the start line (line 6109 contains "Middle Column - Setlist")
# And the end line (line 7327 is the closing </div> before the resize handle)
$lines = $content -split "`n"
$startLine = -1
$endLine = -1

for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '\{/\* Middle Column - Setlist \*/\}') {
        $startLine = $i
    }
    if ($startLine -ge 0 -and $lines[$i] -match '\{/\* Resize Handle - Setlist/Preview \*/\}') {
        $endLine = $i - 2  # Go back to include the closing div and blank line
        break
    }
}

if ($startLine -ge 0 -and $endLine -ge 0) {
    Write-Host "Found setlist section from line $($startLine + 1) to line $($endLine + 1)"

    # Create new content
    $newLines = @()
    $newLines += $lines[0..($startLine - 1)]
    $newLines += $replacement
    $newLines += ""
    $newLines += $lines[($endLine + 1)..($lines.Count - 1)]

    $newContent = $newLines -join "`n"
    Set-Content -Path $file -Value $newContent -NoNewline

    Write-Host "Successfully replaced setlist section"
} else {
    Write-Host "Could not find setlist section markers. Start: $startLine, End: $endLine"
}
