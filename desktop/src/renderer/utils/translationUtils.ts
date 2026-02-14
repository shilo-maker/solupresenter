/**
 * Multi-translation utilities for resolving and normalizing slide translations.
 *
 * Each slide has an optional `translations` map: Record<string, string>
 * where keys are language codes (e.g. 'en', 'cs') and values are translation text.
 * A newline within a value splits into translation + translationOverflow at render time.
 */

/**
 * Resolve translation text from a slide's translations map (or fall back to flat fields).
 */
export function resolveTranslation(
  slide: { translation?: string; translationOverflow?: string; translations?: Record<string, string> },
  preferredLang: string
): { translation: string; translationOverflow: string } {
  if (slide.translations && typeof slide.translations === 'object' && !Array.isArray(slide.translations) && Object.keys(slide.translations).length > 0) {
    const text = slide.translations[preferredLang]
      || slide.translations['en']
      || Object.values(slide.translations)[0]
      || '';
    if (typeof text !== 'string') {
      return { translation: slide.translation || '', translationOverflow: slide.translationOverflow || '' };
    }
    const nlIdx = text.indexOf('\n');
    if (nlIdx !== -1) {
      return { translation: text.substring(0, nlIdx), translationOverflow: text.substring(nlIdx + 1) };
    }
    return { translation: text, translationOverflow: '' };
  }
  return { translation: slide.translation || '', translationOverflow: slide.translationOverflow || '' };
}

/**
 * Normalize a slide that only has flat translation/translationOverflow into a translations map.
 * If the slide already has a translations map, returns it unchanged.
 */
export function normalizeSlideTranslations(slide: any): any {
  if (slide.translations && typeof slide.translations === 'object' && !Array.isArray(slide.translations) && Object.keys(slide.translations).length > 0) return slide;
  const result = { ...slide };
  const parts = [slide.translation || '', slide.translationOverflow || ''].filter(Boolean);
  result.translations = parts.length > 0 ? { en: parts.join('\n') } : {};
  return result;
}

/**
 * Mirror the active language from translations map back to flat translation/translationOverflow
 * fields for backward compatibility with older app versions.
 */
export function denormalizeSlideTranslations(slide: any, activeLang: string): any {
  const resolved = resolveTranslation(slide, activeLang);
  return {
    ...slide,
    translation: resolved.translation,
    translationOverflow: resolved.translationOverflow,
  };
}
