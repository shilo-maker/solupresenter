/**
 * ML Translation Service using Transformers.js
 * Uses Helsinki-NLP/opus-mt-tc-big-he-en for Hebrew to English translation
 */

import { pipeline } from '@huggingface/transformers';
import path from 'path';
import { app } from 'electron';

// Use any type for the translator since the Pipeline types are complex
let translator: any = null;
let isLoading = false;
let loadError: string | null = null;

// Model to use for multilingual translation (supports Hebrew)
// Using the smaller quantized int8 version to reduce download size and memory usage
const MODEL_ID = 'Xenova/nllb-200-distilled-600M';

// Language codes for NLLB
const HEBREW_LANG = 'heb_Hebr';
const ENGLISH_LANG = 'eng_Latn';

// Flag to disable ML translation if it keeps failing
let mlDisabled = false;

// Cache directory for models
const getCacheDir = () => {
  return path.join(app.getPath('userData'), 'ml-models');
};

/**
 * Initialize the translation model
 * This downloads the model on first use (~300MB for quantized NLLB-200)
 */
export async function initTranslator(): Promise<boolean> {
  if (translator) return true;
  if (isLoading) return false;
  if (mlDisabled) return false;

  isLoading = true;
  loadError = null;

  try {
    console.log('Loading multilingual translation model (NLLB-200)...');
    console.log('Model:', MODEL_ID);
    console.log('Cache directory:', getCacheDir());
    console.log('This may take a few minutes on first run...');

    // Initialize the translation pipeline with quantized model for smaller size
    translator = await pipeline('translation', MODEL_ID, {
      cache_dir: getCacheDir(),
      device: 'cpu',
      // Use quantized int8 model for smaller download and memory usage
      dtype: 'q8',
    });

    console.log('Translation model loaded successfully!');
    isLoading = false;
    return true;
  } catch (error: any) {
    console.error('Failed to load translation model:', error);
    loadError = error instanceof Error ? error.message : 'Unknown error';
    isLoading = false;

    // If permission error, disable ML translation to prevent crashes
    if (error?.code === 'EPERM' || error?.message?.includes('EPERM')) {
      console.warn('Permission error - disabling ML translation. Will use dictionary fallback.');
      mlDisabled = true;
    }

    return false;
  }
}

/**
 * Translate Hebrew text to English using ML model
 * @param text Hebrew text to translate
 * @returns English translation or null if failed
 */
export async function translateHebrewToEnglish(text: string): Promise<string | null> {
  if (!text || !text.trim()) return null;
  if (mlDisabled) return null;

  // Initialize if not already done
  if (!translator) {
    const success = await initTranslator();
    if (!success) {
      console.warn('Translation model not available, returning null');
      return null;
    }
  }

  try {
    const result = await translator(text, {
      src_lang: HEBREW_LANG,
      tgt_lang: ENGLISH_LANG,
      max_length: 512,
    });

    // Result is an array of translations
    if (Array.isArray(result) && result.length > 0) {
      let translation = result[0]?.translation_text;
      if (translation) {
        // Post-process: Replace "Jesus" with "Yeshua" for worship context
        translation = translation.replace(/\bJesus\b/gi, 'Yeshua');
      }
      return translation || null;
    }

    return null;
  } catch (error) {
    console.error('Translation error:', error);
    return null;
  }
}

/**
 * Check if the translator is ready
 */
export function isTranslatorReady(): boolean {
  return translator !== null;
}

/**
 * Check if the translator is currently loading
 */
export function isTranslatorLoading(): boolean {
  return isLoading;
}

/**
 * Get the last load error if any
 */
export function getTranslatorError(): string | null {
  return loadError;
}

/**
 * Check if text contains Hebrew characters
 */
export function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}
