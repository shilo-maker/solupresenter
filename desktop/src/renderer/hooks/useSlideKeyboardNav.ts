import { useState, useEffect, useCallback, useRef } from 'react';
import { SlideCodeMap, parseSlideCode } from '../utils/slideCodeUtils';

interface UseSlideKeyboardNavOptions {
  codeMap: SlideCodeMap | null;
  onNavigate: (slideIndex: number) => void;
  enabled?: boolean;
  timeout?: number;  // Time to wait for more keys before executing (ms)
}

interface UseSlideKeyboardNavResult {
  currentInput: string;
  isTyping: boolean;
  clearInput: () => void;
}

// Reserved keys that shouldn't trigger slide navigation
const RESERVED_KEYS = new Set(['B']); // B = blank toggle

export function useSlideKeyboardNav({
  codeMap,
  onNavigate,
  enabled = true,
  timeout = 1000
}: UseSlideKeyboardNavOptions): UseSlideKeyboardNavResult {
  const [currentInput, setCurrentInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Use refs to avoid re-registering event listener on every state change
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef('');
  const isTypingRef = useRef(false);
  const codeMapRef = useRef(codeMap);
  const onNavigateRef = useRef(onNavigate);
  const timeoutValueRef = useRef(timeout);

  // Keep refs in sync with props
  codeMapRef.current = codeMap;
  onNavigateRef.current = onNavigate;
  timeoutValueRef.current = timeout;

  const clearInput = useCallback(() => {
    setCurrentInput('');
    setIsTyping(false);
    inputRef.current = '';
    isTypingRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const executeNavigation = useCallback(() => {
    const currentCodeMap = codeMapRef.current;
    if (!currentCodeMap || !inputRef.current) {
      clearInput();
      return;
    }

    const slideIndex = parseSlideCode(inputRef.current, currentCodeMap);
    if (slideIndex !== null) {
      onNavigateRef.current(slideIndex);
    }
    clearInput();
  }, [clearInput]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      // Check if it's a valid navigation key (letters A-Z or numbers 0-9)
      const key = e.key.toUpperCase();
      const isLetter = /^[A-Z]$/.test(key) && !RESERVED_KEYS.has(key);
      const isNumber = /^[0-9]$/.test(key);

      if (!isLetter && !isNumber) {
        // Escape clears the input
        if (e.key === 'Escape') {
          clearInput();
        }
        // Enter executes immediately
        if (e.key === 'Enter' && inputRef.current) {
          e.preventDefault();
          executeNavigation();
        }
        return;
      }

      e.preventDefault();

      // Start fresh if typing a letter after numbers, or if not currently typing
      if (isLetter && !isTypingRef.current) {
        inputRef.current = key;
      } else if (isLetter && /\d$/.test(inputRef.current)) {
        // Starting new sequence with a letter after numbers
        inputRef.current = key;
      } else {
        inputRef.current += key;
      }

      setCurrentInput(inputRef.current);
      setIsTyping(true);
      isTypingRef.current = true;

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Check if we have a complete code that can be executed immediately
      const input = inputRef.current;
      const isComplete =
        (input.length >= 3 && /^[A-Z]\d\d$/.test(input)) ||
        (input.length >= 4);

      const currentCodeMap = codeMapRef.current;
      if (isComplete && currentCodeMap) {
        const slideIndex = parseSlideCode(input, currentCodeMap);
        if (slideIndex !== null) {
          onNavigateRef.current(slideIndex);
          clearInput();
          return;
        }
      }

      // Set timeout to execute after delay
      timeoutRef.current = setTimeout(() => {
        executeNavigation();
      }, timeoutValueRef.current);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, clearInput, executeNavigation]); // Minimal deps - uses refs for changing values

  return {
    currentInput,
    isTyping,
    clearInput
  };
}
