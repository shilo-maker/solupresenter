import React, { useState, useCallback, useMemo } from 'react';

interface QuickModeSubtitle {
  subtitle: string;
  subtitleTranslation?: string;
  description: string;
  descriptionTranslation?: string;
  bibleRef?: {
    reference: string;
    hebrewReference?: string;
  };
}

interface QuickModeData {
  type: 'sermon' | 'prayer' | 'announcements';
  title: string;
  subtitles: QuickModeSubtitle[];
}

interface Presentation {
  id: string;
  title: string;
  quickModeData?: QuickModeData;
}

interface PrayerEditorModalProps {
  presentation: Presentation;
  onClose: () => void;
  onSave: (presentationId: string, subtitles: QuickModeSubtitle[]) => Promise<void>;
}

const PrayerEditorModal: React.FC<PrayerEditorModalProps> = ({
  presentation,
  onClose,
  onSave
}) => {
  // Convert quickModeData subtitles to express text format
  const initialExpressText = useMemo(() => {
    if (!presentation.quickModeData) return '';

    return presentation.quickModeData.subtitles.map(subtitle => {
      const lines: string[] = [];
      if (subtitle.subtitle) lines.push(subtitle.subtitle);
      if (subtitle.subtitleTranslation) lines.push('~' + subtitle.subtitleTranslation);
      if (subtitle.description && subtitle.description !== subtitle.subtitle) {
        lines.push('---');
        lines.push(subtitle.description);
        if (subtitle.descriptionTranslation) lines.push('~~' + subtitle.descriptionTranslation);
      }
      if (subtitle.bibleRef?.reference || subtitle.bibleRef?.hebrewReference) {
        const refParts: string[] = [];
        if (subtitle.bibleRef.hebrewReference) refParts.push(subtitle.bibleRef.hebrewReference);
        if (subtitle.bibleRef.reference) refParts.push(subtitle.bibleRef.reference);
        lines.push('@' + refParts.join(' | '));
      }
      return lines.join('\n');
    }).join('\n\n');
  }, [presentation]);

  const [expressText, setExpressText] = useState(initialExpressText);

  const parseExpressText = useCallback((): QuickModeSubtitle[] => {
    const normalizedText = expressText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const pointBlocks = normalizedText.split(/\n\s*\n/);
    const subtitles: QuickModeSubtitle[] = [];

    for (const block of pointBlocks) {
      const lines = block.split('\n').map(line => line.trim()).filter(line => line);
      if (lines.length === 0) continue;

      let subtitle = '';
      let subtitleTranslation = '';
      let description = '';
      let descriptionTranslation = '';
      let bibleRef: { reference: string; hebrewReference?: string } | undefined;
      let inDescription = false;

      for (const line of lines) {
        if (line === '---' || /^-{3,}$/.test(line)) {
          inDescription = true;
          continue;
        }
        if (line.startsWith('@')) {
          const refText = line.slice(1).trim();
          const refParts = refText.split('|').map(p => p.trim());
          if (refParts.length >= 2) {
            bibleRef = { hebrewReference: refParts[0], reference: refParts[1] };
          } else if (refParts.length === 1) {
            bibleRef = { reference: refParts[0] };
          }
          continue;
        }
        if (line.startsWith('~~')) {
          descriptionTranslation = descriptionTranslation
            ? descriptionTranslation + '\n' + line.slice(2).trim()
            : line.slice(2).trim();
          continue;
        }
        if (line.startsWith('~')) {
          if (inDescription) {
            descriptionTranslation = descriptionTranslation
              ? descriptionTranslation + '\n' + line.slice(1).trim()
              : line.slice(1).trim();
          } else {
            subtitleTranslation = subtitleTranslation
              ? subtitleTranslation + '\n' + line.slice(1).trim()
              : line.slice(1).trim();
          }
          continue;
        }
        if (inDescription) {
          description = description ? description + '\n' + line : line;
        } else {
          subtitle = subtitle ? subtitle + '\n' + line : line;
        }
      }

      if (subtitle) {
        subtitles.push({
          subtitle,
          subtitleTranslation: subtitleTranslation || undefined,
          description: description || subtitle,
          descriptionTranslation: descriptionTranslation || undefined,
          bibleRef
        });
      }
    }

    return subtitles;
  }, [expressText]);

  const handleSave = async () => {
    const subtitles = parseExpressText();
    if (subtitles.length === 0) {
      alert('Please add at least one point');
      return;
    }
    await onSave(presentation.id, subtitles);
  };

  const type = presentation.quickModeData?.type;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, rgba(30,30,50,0.98), rgba(20,20,40,0.98))',
          borderRadius: '16px',
          padding: '24px',
          width: '650px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid rgba(6,182,212,0.3)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡</span> Edit {type === 'sermon' ? 'Sermon' : 'Prayer'} Points
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '6px', padding: '4px 8px', color: 'white', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Title display */}
        <div style={{
          padding: '12px',
          background: 'rgba(6,182,212,0.1)',
          borderRadius: '8px',
          marginBottom: '12px',
          border: '1px solid rgba(6,182,212,0.3)'
        }}>
          <div style={{ color: '#06b6d4', fontSize: '0.85rem', fontWeight: 600 }}>
            {presentation.title}
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          padding: '12px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          marginBottom: '12px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>Express Mode Instructions</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', lineHeight: 1.5 }}>
            • Separate points with a blank line<br/>
            • Hebrew/original text (main line)<br/>
            • ~English translation (prefix with ~)<br/>
            • --- then description text<br/>
            • @hebrewRef | englishRef for Bible reference
          </div>
        </div>

        {/* Text area */}
        <textarea
          value={expressText}
          onChange={(e) => setExpressText(e.target.value)}
          placeholder={"נקודה ראשונה בעברית\n~First point in English\n---\nתיאור נוסף\n@ישעיהו מ:לא | Isaiah 40:31\n\nנקודה שנייה\n~Second point\n---\nתיאור\n@תהילים כג:א | Psalm 23:1"}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            padding: '12px',
            color: 'white',
            fontSize: '0.95rem',
            fontFamily: 'monospace',
            resize: 'none',
            direction: 'rtl',
            minHeight: '250px'
          }}
        />

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrayerEditorModal;
