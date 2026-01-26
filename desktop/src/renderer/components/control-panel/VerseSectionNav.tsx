import React, { memo, useMemo } from 'react';

interface Slide {
  verseType?: string;
  [key: string]: any;
}

interface VerseSectionNavProps {
  slides: Slide[];
  currentSlideIndex: number;
  onSelectSlide: (index: number) => void;
  getVerseTypeColor: (verseType: string) => string;
}

const getAbbreviation = (verseType: string) => {
  switch(verseType) {
    case 'Intro': return 'In';
    case 'Verse1': return 'V1';
    case 'Verse2': return 'V2';
    case 'Verse3': return 'V3';
    case 'Verse4': return 'V4';
    case 'PreChorus': return 'PC';
    case 'Chorus': return 'Ch';
    case 'Bridge': return 'Br';
    case 'Instrumental': return '🎸';
    case 'Outro': return 'Out';
    case 'Tag': return 'Tag';
    default: return verseType?.substring(0, 2) || '?';
  }
};

const VerseSectionNav = memo<VerseSectionNavProps>(({
  slides,
  currentSlideIndex,
  onSelectSlide,
  getVerseTypeColor
}) => {
  // Memoize verse sections computation - expensive for large slide lists
  const verseSections = useMemo(() => {
    const sections: Array<{ type: string; index: number }> = [];
    const seenTypes = new Set<string>();
    slides.forEach((slide, index) => {
      if (slide.verseType && !seenTypes.has(slide.verseType)) {
        seenTypes.add(slide.verseType);
        sections.push({ type: slide.verseType, index });
      }
    });
    return sections;
  }, [slides]);

  // Hide for single section or Bible passages (numeric verse types like "1", "2", "3")
  const isBiblePassage = verseSections.length > 0 && verseSections.every(s => /^\d+$/.test(s.type));
  if (verseSections.length <= 1 || isBiblePassage) {
    return null;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
      {verseSections.map((section, idx) => (
        <button
          key={idx}
          onClick={() => onSelectSlide(section.index)}
          title={section.type}
          style={{
            padding: '2px 6px',
            fontSize: '0.7rem',
            fontWeight: 'bold',
            border: currentSlideIndex === section.index ? '2px solid white' : '1px solid rgba(255,255,255,0.4)',
            borderRadius: '4px',
            backgroundColor: getVerseTypeColor(section.type),
            color: 'white',
            cursor: 'pointer',
            minWidth: '28px',
            textAlign: 'center'
          }}
        >
          {getAbbreviation(section.type)}
        </button>
      ))}
    </div>
  );
});

VerseSectionNav.displayName = 'VerseSectionNav';

export default VerseSectionNav;
