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
    getStoredValue('controlPanel_setlistWidth', 70)
  );
  const [topRowHeight, setTopRowHeight] = useState(() =>
    getStoredValue('controlPanel_topRowHeight', 65)
  );
  const [isResizing, setIsResizing] = useState<ResizeType>(null);
  const resizeStartRef = useRef<{ x: number; y: number; startValue: number }>({ x: 0, y: 0, startValue: 0 });

  // Use refs for values accessed in event handlers to avoid effect re-runs
  const isRTLRef = useRef(isRTL);
  const leftPanelWidthRef = useRef(leftPanelWidth);
  const setlistPanelWidthRef = useRef(setlistPanelWidth);
  const topRowHeightRef = useRef(topRowHeight);

  // Keep refs in sync
  isRTLRef.current = isRTL;
  leftPanelWidthRef.current = leftPanelWidth;
  setlistPanelWidthRef.current = setlistPanelWidth;
  topRowHeightRef.current = topRowHeight;

  // Handle panel resize - only re-run when isResizing changes
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!mainContentRef.current) return;

      const rect = mainContentRef.current.getBoundingClientRect();
      const { x: startX, y: startY, startValue } = resizeStartRef.current;

      // row-reverse on an RTL document cancels out, so visual order is always the same
      const rtlMultiplier = -1;

      if (isResizing === 'row') {
        // 'row' controls the boundary between Live Preview and Setlist
        // This adjusts setlistPanelWidth - dragging right shrinks Setlist (in LTR)
        const deltaX = e.clientX - startX;
        const deltaPercent = (deltaX / rect.width) * 100 * rtlMultiplier;
        const newWidth = Math.min(Math.max(startValue + deltaPercent, 15), 60);
        setSetlistPanelWidth(newWidth);
      } else if (isResizing === 'setlist') {
        // 'setlist' controls top/bottom row split - vertical drag
        const deltaY = e.clientY - startY;
        const deltaPercent = (deltaY / rect.height) * 100;
        const newHeight = Math.min(Math.max(startValue + deltaPercent, 30), 80);
        setTopRowHeight(newHeight);
      } else if (isResizing === 'left') {
        // 'left' controls the boundary between Setlist and Tabs
        // This adjusts leftPanelWidth (Tabs width) - dragging right shrinks Tabs (in LTR)
        const deltaX = e.clientX - startX;
        const deltaPercent = (deltaX / rect.width) * 100 * rtlMultiplier;
        const newWidth = Math.min(Math.max(startValue + deltaPercent, 15), 50);
        setLeftPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      // Save to localStorage with error handling using current ref values
      try {
        localStorage.setItem('controlPanel_leftWidth', leftPanelWidthRef.current.toString());
        localStorage.setItem('controlPanel_setlistWidth', setlistPanelWidthRef.current.toString());
        localStorage.setItem('controlPanel_topRowHeight', topRowHeightRef.current.toString());
      } catch (error) {
        console.error('[usePanelResize] Failed to save panel sizes to localStorage:', error);
      }
      setIsResizing(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isResizing, mainContentRef]);

  const startResize = useCallback((type: 'left' | 'setlist' | 'row', e: React.MouseEvent) => {
    e.preventDefault();
    // 'row' controls setlistPanelWidth (boundary between Live Preview and Setlist)
    // 'setlist' controls topRowHeight (top/bottom row split)
    // 'left' controls leftPanelWidth (boundary between Setlist and Tabs)
    const startValue = type === 'row' ? setlistPanelWidthRef.current : type === 'setlist' ? topRowHeightRef.current : leftPanelWidthRef.current;
    resizeStartRef.current = { x: e.clientX, y: e.clientY, startValue };
    setIsResizing(type);
    document.body.style.cursor = type === 'setlist' ? 'row-resize' : 'col-resize';
  }, []);

  return {
    leftPanelWidth,
    setlistPanelWidth,
    topRowHeight,
    isResizing,
    startResize
  };
}
