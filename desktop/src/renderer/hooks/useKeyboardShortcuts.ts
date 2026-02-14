import { useEffect } from 'react';

type DisplayMode = 'bilingual' | 'original' | 'translation';

export const SECTION_KEY_MAP: Record<string, string[]> = {
  'a': ['Verse1', 'Verse'],
  's': ['Verse2'],
  'd': ['Verse3'],
  'f': ['Verse4'],
  'g': ['Verse5'],
  'h': ['Verse6'],
  'c': ['Chorus1', 'Chorus'],
  'x': ['Chorus2'],
  'z': ['Chorus3'],
  'b': ['Bridge1', 'Bridge'],
  'n': ['Bridge2'],
  'm': ['Bridge3'],
  'p': ['PreChorus1', 'PreChorus'],
};

interface KeyboardShortcutsCallbacks {
  nextSlide: () => void;
  prevSlide: () => void;
  toggleBlank: () => void;
  setShowKeyboardHelp: (show: boolean) => void;
  setShowQuickSlideModal: (show: boolean) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setIsBlank: (blank: boolean) => void;
  setLiveState: (state: { slideData: any; contentType: any; songId: string | null; slideIndex: number }) => void;
  onJumpToSection: (sectionKey: string) => void;
}

interface KeyboardShortcutsDeps {
  displayMode: DisplayMode;
  isRTL?: boolean;
  disabled?: boolean;
  hasSong?: boolean;
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
    setLiveState,
    onJumpToSection
  } = callbacks;

  const { displayMode, isRTL = false, disabled = false, hasSong = false } = deps;

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

      // Section jump shortcuts (only when a song is selected, no modifier keys)
      const sectionCandidates = SECTION_KEY_MAP[e.key.toLowerCase()];
      if (sectionCandidates && hasSong && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onJumpToSection(e.key.toLowerCase());
        return;
      }

      // . for blank
      if (e.key === '.') {
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

      // Space to toggle display mode (without blanking the screen)
      if (e.key === ' ') {
        e.preventDefault();
        setDisplayMode(displayMode === 'bilingual' ? 'original' : 'bilingual');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide, toggleBlank, setShowKeyboardHelp, setShowQuickSlideModal, setDisplayMode, setIsBlank, setLiveState, onJumpToSection, displayMode, isRTL, disabled, hasSong]);
}
