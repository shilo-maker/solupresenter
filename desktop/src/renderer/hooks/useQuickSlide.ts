import { useCallback } from 'react';

interface Song {
  id: string;
  title: string;
  slides: Array<{
    originalText?: string;
    transliteration?: string;
    translation?: string;
    verseType?: string;
  }>;
}

type DisplayMode = 'bilingual' | 'original' | 'translation';

interface UseQuickSlideCallbacks {
  setQuickSlideCount: React.Dispatch<React.SetStateAction<number>>;
  setQuickSlideText: React.Dispatch<React.SetStateAction<string>>;
  setIsAutoGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedSong: React.Dispatch<React.SetStateAction<Song | null>>;
  setCurrentSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  setIsBlank: React.Dispatch<React.SetStateAction<boolean>>;
  setQuickSlideBroadcastIndex: React.Dispatch<React.SetStateAction<number>>;
  setCurrentContentType: React.Dispatch<React.SetStateAction<'song' | 'bible' | 'prayer' | 'presentation'>>;
  setLiveState: React.Dispatch<React.SetStateAction<{ slideData: any; contentType: 'song' | 'bible' | 'prayer' | 'presentation' | null; songId: string | null; slideIndex: number }>>;
  sendCurrentSlide: (song: Song | null, slideIndex: number, mode: DisplayMode, combinedIndices?: number[], contentType?: 'song' | 'bible' | 'prayer') => void;
}

interface UseQuickSlideState {
  displayMode: DisplayMode;
  quickSlideText: string;
}

interface UseQuickSlideRefs {
  quickSlideTextareaRef?: React.RefObject<HTMLTextAreaElement>;
}

// Check if text contains Hebrew characters
const isHebrewText = (text: string) => /[\u0590-\u05FF]/.test(text);

export function useQuickSlide(
  state: UseQuickSlideState,
  callbacks: UseQuickSlideCallbacks,
  refs?: UseQuickSlideRefs
) {
  const { displayMode, quickSlideText } = state;

  const {
    setQuickSlideCount,
    setQuickSlideText,
    setIsAutoGenerating,
    setSelectedSong,
    setCurrentSlideIndex,
    setIsBlank,
    setQuickSlideBroadcastIndex,
    setCurrentContentType,
    setLiveState,
    sendCurrentSlide
  } = callbacks;

  const quickSlideTextareaRef = refs?.quickSlideTextareaRef;

  // Get current text - prefer textarea ref if available (for modal), otherwise use state (for inline editor)
  const getCurrentQuickSlideText = useCallback(() => {
    return quickSlideTextareaRef?.current?.value || quickSlideText || '';
  }, [quickSlideTextareaRef, quickSlideText]);

  // Update the count of slides based on text blocks
  const updateQuickSlideCount = useCallback((text: string) => {
    if (!text.trim()) {
      setQuickSlideCount(0);
    } else {
      const blocks = text.split(/\n\s*\n/).filter(block => block.trim());
      setQuickSlideCount(blocks.length);
    }
  }, [setQuickSlideCount]);

  // Auto-generate transliteration and translation for Hebrew text
  const autoGenerateQuickSlide = useCallback(async () => {
    const currentText = getCurrentQuickSlideText();
    if (!currentText.trim()) return;

    setIsAutoGenerating(true);
    try {
      const blocks = currentText.split(/\n\s*\n/);
      const processedBlocks = await Promise.all(
        blocks.map(async (block) => {
          const lines = block.split('\n').map(l => l.trim());
          if (lines.length === 0 || !lines[0]) return block;

          // If first line is Hebrew and we don't have all 3 lines
          if (isHebrewText(lines[0]) && lines.length < 3) {
            const result = await window.electronAPI.processQuickSlide(lines[0]);
            return `${result.original}\n${result.transliteration}\n${result.translation}`;
          }
          return block;
        })
      );

      const newText = processedBlocks.join('\n\n');
      // Update textarea ref if available (modal mode)
      if (quickSlideTextareaRef?.current) {
        quickSlideTextareaRef.current.value = newText;
      }
      // Always update state (works for both modal and inline editor)
      setQuickSlideText(newText);
      updateQuickSlideCount(newText);
    } catch (error) {
      console.error('Error auto-generating:', error);
    }
    setIsAutoGenerating(false);
  }, [getCurrentQuickSlideText, quickSlideTextareaRef, setQuickSlideText, updateQuickSlideCount, setIsAutoGenerating]);

  // Parse text and broadcast a specific slide
  // Accepts optional text parameter to avoid stale closure issues with inline editor
  const parseAndBroadcastQuickSlide = useCallback((slideIndex: number, textOverride?: string) => {
    const currentText = textOverride ?? getCurrentQuickSlideText();
    if (!currentText.trim()) return;

    const blocks = currentText.split(/\n\s*\n/).filter(block => block.trim());
    if (slideIndex >= blocks.length) return;

    // Create a temporary song with all slides
    const quickSong: Song = {
      id: 'quick-slide',
      title: 'Quick Slide',
      slides: blocks.map((b, idx) => {
        const slideLines = b.split('\n').map(l => l.trim());
        return {
          originalText: slideLines[0] || '',
          transliteration: slideLines[1] || '',
          translation: slideLines[2] || '',
          verseType: `Slide ${idx + 1}`
        };
      })
    };

    // Set as current and broadcast
    setSelectedSong(quickSong);
    setCurrentSlideIndex(slideIndex);
    setIsBlank(false);
    setQuickSlideBroadcastIndex(slideIndex);
    setCurrentContentType('song'); // Quick slide is always song type

    // Update live state for the preview panel
    const slide = quickSong.slides[slideIndex];
    setLiveState({ slideData: slide, contentType: 'song', songId: 'quick-slide', slideIndex });

    sendCurrentSlide(quickSong, slideIndex, displayMode, undefined, 'song');
  }, [getCurrentQuickSlideText, displayMode, setSelectedSong, setCurrentSlideIndex, setIsBlank, setQuickSlideBroadcastIndex, setCurrentContentType, setLiveState, sendCurrentSlide]);

  return {
    isHebrewText,
    getCurrentQuickSlideText,
    updateQuickSlideCount,
    autoGenerateQuickSlide,
    parseAndBroadcastQuickSlide
  };
}
