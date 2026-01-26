import { useState, useRef, useEffect, useCallback, RefObject } from 'react';

type ResizeType = 'left' | 'setlist' | 'row' | null;

interface UsePanelResizeReturn {
  leftPanelWidth: number;
  setlistPanelWidth: number;
  topRowHeight: number;
  isResizing: ResizeType;
  startResize: (type: 'left' | 'setlist' | 'row', e: React.MouseEvent) => void;
}

function getStoredValue(key: string, defaultValue: number): number {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = parseFloat(saved);
      return !isNaN(parsed) && parsed > 0 && parsed < 100 ? parsed : defaultValue;
    }
  } catch (error) {
    console.error(`[usePanelResize] Failed to read ${key} from localStorage:`, error);
  }
  return defaultValue;
}

export function usePanelResize(
  mainContentRef: RefObject<HTMLDivElement | null>,
  isRTL: boolean
): UsePanelResizeReturn {
  const [leftPanelWidth, setLeftPanelWidth] = useState(() =>
    getStoredValue('controlPanel_leftWidth', 25)
  );
  const [setlistPanelWidth, setSetlistPanelWidth] = useState(() =>
    getStoredValue('controlPanel_setlistWidth', 25)
  );
  const [topRowHeight, setTopRowHeight] = useState(() =>
    getStoredValue('controlPanel_topRowHeight', 50)
  );
  const [isResizing, setIsResizing] = useState<ResizeType>(null);
  const resizeStartRef = useRef<{ x: number; y: number; startValue: number }>({ x: 0, y: 0, startValue: 0 });

  // Handle panel resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !mainContentRef.current) return;

      const rect = mainContentRef.current.getBoundingClientRect();
      const { x: startX, y: startY, startValue } = resizeStartRef.current;

      // In RTL mode, horizontal drag direction is inverted
      const rtlMultiplier = isRTL ? -1 : 1;

      if (isResizing === 'left') {
        const deltaX = (e.clientX - startX) * rtlMultiplier;
        const deltaPercent = (deltaX / rect.width) * 100;
        const newWidth = Math.min(Math.max(startValue + deltaPercent, 15), 40);
        setLeftPanelWidth(newWidth);
      } else if (isResizing === 'setlist') {
        const deltaX = (e.clientX - startX) * rtlMultiplier;
        const deltaPercent = (deltaX / rect.width) * 100;
        const newWidth = Math.min(Math.max(startValue + deltaPercent, 15), 40);
        setSetlistPanelWidth(newWidth);
      } else if (isResizing === 'row') {
        const deltaY = e.clientY - startY;
        const deltaPercent = (deltaY / rect.height) * 100;
        const newHeight = Math.min(Math.max(startValue + deltaPercent, 30), 70);
        setTopRowHeight(newHeight);
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        // Save to localStorage with error handling
        try {
          localStorage.setItem('controlPanel_leftWidth', leftPanelWidth.toString());
          localStorage.setItem('controlPanel_setlistWidth', setlistPanelWidth.toString());
          localStorage.setItem('controlPanel_topRowHeight', topRowHeight.toString());
        } catch (error) {
          console.error('[usePanelResize] Failed to save panel sizes to localStorage:', error);
        }
        setIsResizing(null);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, leftPanelWidth, setlistPanelWidth, topRowHeight, isRTL, mainContentRef]);

  const startResize = useCallback((type: 'left' | 'setlist' | 'row', e: React.MouseEvent) => {
    e.preventDefault();
    const startValue = type === 'left' ? leftPanelWidth : type === 'setlist' ? setlistPanelWidth : topRowHeight;
    resizeStartRef.current = { x: e.clientX, y: e.clientY, startValue };
    setIsResizing(type);
    document.body.style.cursor = type === 'row' ? 'row-resize' : 'col-resize';
  }, [leftPanelWidth, setlistPanelWidth, topRowHeight]);

  return {
    leftPanelWidth,
    setlistPanelWidth,
    topRowHeight,
    isResizing,
    startResize
  };
}
