import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  SongArrangement,
  ArrangementSection,
  Slide,
  getUniqueSections,
  getSectionRanges,
  createDefaultArrangement,
  generateArrangementId,
  generateSectionId,
  getArrangementSlideCount,
  validateArrangement,
  resolveSlideIndex,
  slideIndexToArrangementPosition,
  arrangementPositionToSlideIndex,
  getSectionSlideCount
} from '../utils/arrangementUtils';

interface Song {
  id: string;
  title: string;
  slides: Slide[];
  arrangements?: SongArrangement[];
  // Allow additional properties from ControlPanel's Song interface
  [key: string]: any;
}

interface UseArrangementStateOptions {
  onSongUpdate?: (songId: string, arrangements: SongArrangement[]) => Promise<void>;
}

export interface ArrangementStateReturn {
  // Mode state
  isArrangementMode: boolean;
  setIsArrangementMode: (value: boolean) => void;

  // Active arrangement
  activeArrangementId: string | null;
  activeArrangement: SongArrangement | null;
  setActiveArrangementId: (id: string | null) => void;

  // Arrangement navigation
  currentSectionIndex: number;
  currentSlideInSection: number;
  setCurrentSectionIndex: (index: number) => void;
  setCurrentSlideInSection: (index: number) => void;

  // Derived data
  availableSections: string[];
  arrangements: SongArrangement[];
  totalSlides: number;
  flatSlideIndex: number;
  actualSlideIndex: number;

  // Actions
  createArrangement: (name: string) => Promise<SongArrangement>;
  updateArrangement: (id: string, sections: ArrangementSection[]) => Promise<void>;
  renameArrangement: (id: string, name: string) => Promise<void>;
  deleteArrangement: (id: string) => Promise<void>;
  duplicateArrangement: (id: string) => Promise<SongArrangement>;

  // Section manipulation
  addSection: (verseType: string, index?: number) => void;
  removeSection: (index: number) => void;
  moveSectionUp: (index: number) => void;
  moveSectionDown: (index: number) => void;
  reorderSections: (fromIndex: number, toIndex: number) => void;

  // Navigation
  goToNextSlide: () => boolean;
  goToPrevSlide: () => boolean;
  goToSection: (sectionIndex: number) => void;
  goToFlatSlideIndex: (flatIndex: number) => void;

  // Validation
  validationResult: { valid: boolean; missingSections: string[] };

  // Utility
  getSectionSlideCount: (verseType: string) => number;
  getSectionPreviewText: (verseType: string) => string;
  resetNavigation: () => void;
}

export function useArrangementState(
  song: Song | null,
  options: UseArrangementStateOptions = {}
): ArrangementStateReturn {
  const { onSongUpdate } = options;

  // Mode state
  const [isArrangementMode, setIsArrangementMode] = useState(false);

  // Active arrangement
  const [activeArrangementId, setActiveArrangementId] = useState<string | null>(null);

  // Navigation state
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentSlideInSection, setCurrentSlideInSection] = useState(0);

  // Local arrangements state (synced with song)
  const [localArrangements, setLocalArrangements] = useState<SongArrangement[]>([]);

  // Sync local arrangements with song
  useEffect(() => {
    if (song?.arrangements) {
      setLocalArrangements(song.arrangements);
    } else {
      setLocalArrangements([]);
    }
  }, [song?.arrangements, song?.id]);

  // Reset arrangement mode when song changes
  useEffect(() => {
    setIsArrangementMode(false);
    setActiveArrangementId(null);
    setCurrentSectionIndex(0);
    setCurrentSlideInSection(0);
  }, [song?.id]);

  // Reset navigation when active arrangement changes
  useEffect(() => {
    setCurrentSectionIndex(0);
    setCurrentSlideInSection(0);
  }, [activeArrangementId]);

  // Derived: available sections from the song's slides
  const availableSections = useMemo(() => {
    return getUniqueSections(song?.slides);
  }, [song?.slides]);

  // Derived: active arrangement object
  const activeArrangement = useMemo(() => {
    if (!activeArrangementId) return null;
    return localArrangements.find(a => a.id === activeArrangementId) || null;
  }, [activeArrangementId, localArrangements]);

  // Derived: section ranges for the current song
  const sectionRanges = useMemo(() => {
    return getSectionRanges(song?.slides);
  }, [song?.slides]);

  // Derived: total slides in current arrangement (uses precomputed ranges)
  const totalSlides = useMemo(() => {
    return getArrangementSlideCount(song?.slides, activeArrangement, sectionRanges);
  }, [song?.slides, activeArrangement, sectionRanges]);

  // Derived: flat slide index (position in the arrangement sequence, uses precomputed ranges)
  const flatSlideIndex = useMemo(() => {
    return arrangementPositionToSlideIndex(
      song?.slides,
      activeArrangement,
      currentSectionIndex,
      currentSlideInSection,
      sectionRanges
    );
  }, [song?.slides, activeArrangement, currentSectionIndex, currentSlideInSection, sectionRanges]);

  // Derived: actual slide index in the song's slides array (uses precomputed ranges)
  const actualSlideIndex = useMemo(() => {
    return resolveSlideIndex(song?.slides, activeArrangement, currentSectionIndex, currentSlideInSection, sectionRanges);
  }, [song?.slides, activeArrangement, currentSectionIndex, currentSlideInSection, sectionRanges]);

  // Derived: validation result
  const validationResult = useMemo(() => {
    if (!activeArrangement) return { valid: true, missingSections: [] };
    return validateArrangement(song?.slides, activeArrangement);
  }, [song?.slides, activeArrangement]);

  // Helper to save arrangements
  const songId = song?.id ?? null;
  const saveArrangements = useCallback(async (newArrangements: SongArrangement[]) => {
    setLocalArrangements(newArrangements);
    if (songId && onSongUpdate) {
      await onSongUpdate(songId, newArrangements);
    }
  }, [songId, onSongUpdate]);

  // Create a new arrangement
  const createArrangement = useCallback(async (name: string): Promise<SongArrangement> => {
    const newArrangement = createDefaultArrangement(song?.slides);
    newArrangement.name = name;

    const newArrangements = [...localArrangements, newArrangement];
    await saveArrangements(newArrangements);
    setActiveArrangementId(newArrangement.id);

    return newArrangement;
  }, [song?.slides, localArrangements, saveArrangements]);

  // Update an arrangement's sections
  const updateArrangement = useCallback(async (id: string, sections: ArrangementSection[]) => {
    const newArrangements = localArrangements.map(arr => {
      if (arr.id === id) {
        return {
          ...arr,
          sections,
          updatedAt: new Date().toISOString()
        };
      }
      return arr;
    });
    await saveArrangements(newArrangements);
  }, [localArrangements, saveArrangements]);

  // Rename an arrangement
  const renameArrangement = useCallback(async (id: string, name: string) => {
    const newArrangements = localArrangements.map(arr => {
      if (arr.id === id) {
        return {
          ...arr,
          name,
          updatedAt: new Date().toISOString()
        };
      }
      return arr;
    });
    await saveArrangements(newArrangements);
  }, [localArrangements, saveArrangements]);

  // Delete an arrangement
  const deleteArrangement = useCallback(async (id: string) => {
    // Check before async operation to avoid stale closure issue
    const shouldClearActive = activeArrangementId === id;

    const newArrangements = localArrangements.filter(arr => arr.id !== id);
    await saveArrangements(newArrangements);

    // If we deleted the active arrangement, clear selection
    if (shouldClearActive) {
      setActiveArrangementId(null);
    }
  }, [localArrangements, saveArrangements, activeArrangementId]);

  // Duplicate an arrangement
  const duplicateArrangement = useCallback(async (id: string): Promise<SongArrangement> => {
    const original = localArrangements.find(arr => arr.id === id);
    if (!original) {
      throw new Error('Arrangement not found');
    }

    const now = new Date().toISOString();
    const duplicate: SongArrangement = {
      id: generateArrangementId(),
      name: `${original.name} (Copy)`,
      sections: original.sections.map(s => ({
        id: generateSectionId(),
        verseType: s.verseType
      })),
      createdAt: now,
      updatedAt: now
    };

    const newArrangements = [...localArrangements, duplicate];
    await saveArrangements(newArrangements);

    return duplicate;
  }, [localArrangements, saveArrangements]);

  // Add a section to the active arrangement
  const addSection = useCallback((verseType: string, index?: number) => {
    if (!activeArrangement) return;

    const newSection: ArrangementSection = {
      id: generateSectionId(),
      verseType
    };

    const newSections = [...activeArrangement.sections];
    if (index !== undefined && index >= 0 && index <= newSections.length) {
      newSections.splice(index, 0, newSection);
    } else {
      newSections.push(newSection);
    }

    updateArrangement(activeArrangement.id, newSections);
  }, [activeArrangement, updateArrangement]);

  // Remove a section from the active arrangement
  const removeSection = useCallback((index: number) => {
    if (!activeArrangement) return;
    if (index < 0 || index >= activeArrangement.sections.length) return;

    const newSections = activeArrangement.sections.filter((_, i) => i !== index);
    updateArrangement(activeArrangement.id, newSections);

    // Adjust navigation if needed
    if (currentSectionIndex >= newSections.length) {
      setCurrentSectionIndex(Math.max(0, newSections.length - 1));
      // Also reset slide position when moving to a different section
      setCurrentSlideInSection(0);
    } else if (currentSectionIndex === index) {
      // If we removed the currently viewed section, reset slide position
      setCurrentSlideInSection(0);
    }
  }, [activeArrangement, updateArrangement, currentSectionIndex]);

  // Move a section up
  const moveSectionUp = useCallback((index: number) => {
    if (!activeArrangement || index <= 0) return;

    const newSections = [...activeArrangement.sections];
    [newSections[index - 1], newSections[index]] = [newSections[index], newSections[index - 1]];
    updateArrangement(activeArrangement.id, newSections);
  }, [activeArrangement, updateArrangement]);

  // Move a section down
  const moveSectionDown = useCallback((index: number) => {
    if (!activeArrangement || index >= activeArrangement.sections.length - 1) return;

    const newSections = [...activeArrangement.sections];
    [newSections[index], newSections[index + 1]] = [newSections[index + 1], newSections[index]];
    updateArrangement(activeArrangement.id, newSections);
  }, [activeArrangement, updateArrangement]);

  // Reorder sections via drag and drop
  const reorderSections = useCallback((fromIndex: number, toIndex: number) => {
    if (!activeArrangement) return;
    if (fromIndex < 0 || fromIndex >= activeArrangement.sections.length) return;
    if (toIndex < 0 || toIndex >= activeArrangement.sections.length) return;
    if (fromIndex === toIndex) return;

    const newSections = [...activeArrangement.sections];
    const [removed] = newSections.splice(fromIndex, 1);
    newSections.splice(toIndex, 0, removed);
    updateArrangement(activeArrangement.id, newSections);
  }, [activeArrangement, updateArrangement]);

  // Get slide count for a section (uses precomputed ranges)
  const getSectionSlideCountFn = useCallback((verseType: string): number => {
    return getSectionSlideCount(song?.slides, verseType, sectionRanges);
  }, [song?.slides, sectionRanges]);

  // Navigate to next slide
  const goToNextSlide = useCallback((): boolean => {
    if (!song?.slides || song.slides.length === 0) return false;

    // If not using arrangement, simple increment
    if (!activeArrangement) {
      const newIndex = flatSlideIndex + 1;
      if (newIndex >= song.slides.length) return false;
      setCurrentSlideInSection(newIndex);
      return true;
    }

    // Using arrangement - check if we can move within current section
    const currentSection = activeArrangement.sections[currentSectionIndex];
    if (!currentSection) return false;

    const range = sectionRanges.get(currentSection.verseType);
    if (!range) return false;

    const sectionSlideCount = range.end - range.start + 1;
    const newSlideInSection = currentSlideInSection + 1;

    if (newSlideInSection < sectionSlideCount) {
      // Still in current section
      setCurrentSlideInSection(newSlideInSection);
      return true;
    }

    // Move to next section
    const newSectionIndex = currentSectionIndex + 1;
    if (newSectionIndex >= activeArrangement.sections.length) {
      return false; // End of arrangement
    }

    setCurrentSectionIndex(newSectionIndex);
    setCurrentSlideInSection(0);
    return true;
  }, [song?.slides, activeArrangement, currentSectionIndex, currentSlideInSection, flatSlideIndex, sectionRanges]);

  // Navigate to previous slide
  const goToPrevSlide = useCallback((): boolean => {
    if (!song?.slides || song.slides.length === 0) return false;

    // If not using arrangement, simple decrement
    if (!activeArrangement) {
      const newIndex = flatSlideIndex - 1;
      if (newIndex < 0) return false;
      setCurrentSlideInSection(newIndex);
      return true;
    }

    // Using arrangement - check if we can move within current section
    if (currentSlideInSection > 0) {
      setCurrentSlideInSection(currentSlideInSection - 1);
      return true;
    }

    // Move to previous section
    const newSectionIndex = currentSectionIndex - 1;
    if (newSectionIndex < 0) {
      return false; // Start of arrangement
    }

    const prevSection = activeArrangement.sections[newSectionIndex];
    const range = sectionRanges.get(prevSection.verseType);
    if (!range) return false;

    const prevSectionSlideCount = range.end - range.start + 1;
    setCurrentSectionIndex(newSectionIndex);
    setCurrentSlideInSection(prevSectionSlideCount - 1);
    return true;
  }, [song?.slides, activeArrangement, currentSectionIndex, currentSlideInSection, flatSlideIndex, sectionRanges]);

  // Navigate to a specific section
  const goToSection = useCallback((sectionIndex: number) => {
    if (!activeArrangement || sectionIndex < 0 || sectionIndex >= activeArrangement.sections.length) {
      return;
    }
    // Validate that the section's verseType exists in the song's slides
    const section = activeArrangement.sections[sectionIndex];
    if (!sectionRanges.has(section.verseType)) {
      return; // Section doesn't exist in slides
    }
    setCurrentSectionIndex(sectionIndex);
    setCurrentSlideInSection(0);
  }, [activeArrangement, sectionRanges]);

  // Navigate to a flat slide index (uses precomputed ranges)
  const goToFlatSlideIndex = useCallback((flatIndex: number) => {
    if (!song?.slides || song.slides.length === 0) return;

    if (!activeArrangement) {
      setCurrentSlideInSection(Math.max(0, Math.min(flatIndex, song.slides.length - 1)));
      return;
    }

    const position = slideIndexToArrangementPosition(song.slides, activeArrangement, flatIndex, sectionRanges);
    if (position) {
      setCurrentSectionIndex(position.sectionIndex);
      setCurrentSlideInSection(position.slideInSection);
    }
  }, [song?.slides, activeArrangement, sectionRanges]);

  // Reset navigation
  const resetNavigation = useCallback(() => {
    setCurrentSectionIndex(0);
    setCurrentSlideInSection(0);
  }, []);

  // Get preview text (first 3 words) for a section's first slide
  const getSectionPreviewText = useCallback((verseType: string): string => {
    if (!song?.slides) return '';
    const range = sectionRanges.get(verseType);
    if (!range) return '';
    const slide = song.slides[range.start];
    if (!slide) return '';
    const text = slide.originalText || slide.translation || '';
    const words = text.trim().split(/\s+/).slice(0, 4).join(' ');
    return words ? words + '..' : '';
  }, [song?.slides, sectionRanges]);

  // Memoize the return object to avoid breaking memo on downstream components
  // (BottomRowPanel, SlidesGrid, ArrangementEditor all receive this as a prop)
  const stableSetIsArrangementMode = useRef(setIsArrangementMode).current;
  const stableSetActiveArrangementId = useRef(setActiveArrangementId).current;
  const stableSetCurrentSectionIndex = useRef(setCurrentSectionIndex).current;
  const stableSetCurrentSlideInSection = useRef(setCurrentSlideInSection).current;

  return useMemo(() => ({
    // Mode state
    isArrangementMode,
    setIsArrangementMode: stableSetIsArrangementMode,

    // Active arrangement
    activeArrangementId,
    activeArrangement,
    setActiveArrangementId: stableSetActiveArrangementId,

    // Navigation
    currentSectionIndex,
    currentSlideInSection,
    setCurrentSectionIndex: stableSetCurrentSectionIndex,
    setCurrentSlideInSection: stableSetCurrentSlideInSection,

    // Derived data
    availableSections,
    arrangements: localArrangements,
    totalSlides,
    flatSlideIndex,
    actualSlideIndex,

    // Actions
    createArrangement,
    updateArrangement,
    renameArrangement,
    deleteArrangement,
    duplicateArrangement,

    // Section manipulation
    addSection,
    removeSection,
    moveSectionUp,
    moveSectionDown,
    reorderSections,

    // Navigation
    goToNextSlide,
    goToPrevSlide,
    goToSection,
    goToFlatSlideIndex,

    // Validation
    validationResult,

    // Utility
    getSectionSlideCount: getSectionSlideCountFn,
    getSectionPreviewText,
    resetNavigation
  }), [
    isArrangementMode, stableSetIsArrangementMode,
    activeArrangementId, activeArrangement, stableSetActiveArrangementId,
    currentSectionIndex, currentSlideInSection, stableSetCurrentSectionIndex, stableSetCurrentSlideInSection,
    availableSections, localArrangements, totalSlides, flatSlideIndex, actualSlideIndex,
    createArrangement, updateArrangement, renameArrangement, deleteArrangement, duplicateArrangement,
    addSection, removeSection, moveSectionUp, moveSectionDown, reorderSections,
    goToNextSlide, goToPrevSlide, goToSection, goToFlatSlideIndex,
    validationResult,
    getSectionSlideCountFn, getSectionPreviewText, resetNavigation
  ]);
}
