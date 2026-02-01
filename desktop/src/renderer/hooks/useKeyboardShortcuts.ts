import { useEffect } from 'react';

type DisplayMode = 'bilingual' | 'original' | 'translation';

interface KeyboardShortcutsCallbacks {
  nextSlide: () => void;
  prevSlide: () => void;
  toggleBlank: () => void;
  setShowKeyboardHelp: (show: boolean) => void;
  setShowQuickSlideModal: (show: boolean) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setIsBlank: (blank: boolean) => void;
  setLiveState: (state: { slideData: any; contentType: any; songId: string | null; slideIndex: number }) => void;
}

interface KeyboardShortcutsDeps {
  displayMode: DisplayMode;
  isRTL?: boolean;
  disabled?: boolean;
}

export function useKeyboardShortcuts(
  callbacks: KeyboardShortcutsCallbacks,
  deps: KeyboardShortcutsDeps
) {
  const {
    nextSlide,
    prevSlide,
    toggleBlank,
    setShowKeyboardHelp,
    setShowQuickSlideModal,
    setDisplayMode,
    setIsBlank,
    setLiveState
  } = callbacks;

  const { displayMode, isRTL = false, disabled = false } = deps;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when shortcuts are disabled (e.g. settings overlay is open)
      if (disabled) return;

      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // ? or F1 for help
      if (e.key === '?' || e.key === 'F1') {
        e.preventDefault();
        setShowKeyboardHelp(true);
        return;
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        setShowKeyboardHelp(false);
        setShowQuickSlideModal(false);
        return;
      }

      // Arrow keys for slide navigation
      // In RTL (Hebrew), left/right arrows are reversed for horizontal navigation
      // Up/Down arrows remain the same (vertical is universal)
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        isRTL ? prevSlide() : nextSlide();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        isRTL ? nextSlide() : prevSlide();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        nextSlide();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        prevSlide();
        return;
      }

      // B for blank
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        toggleBlank();
        return;
      }

      // Q for quick slide
      if (e.key === 'q' || e.key === 'Q') {
        e.preventDefault();
        setShowQuickSlideModal(true);
        return;
      }

      // Space to toggle display mode
      if (e.key === ' ') {
        e.preventDefault();
        const newMode = displayMode === 'bilingual' ? 'original' : 'bilingual';
        setDisplayMode(newMode);
        // Clear the screen when switching display modes
        setIsBlank(true);
        setLiveState({ slideData: null, contentType: null, songId: null, slideIndex: 0 });
        window.electronAPI.sendBlank();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, toggleBlank, setShowKeyboardHelp, setShowQuickSlideModal, setDisplayMode, setIsBlank, setLiveState, displayMode, isRTL, disabled]);
}
