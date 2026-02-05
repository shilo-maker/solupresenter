import { useState, useRef, useEffect, useCallback } from 'react';
import { formatClockTime, formatClockDate, formatStopwatchTime } from '../utils/slideUtils';

interface RotatingMessage {
  id: string;
  text: string;
  textHe: string;
  enabled: boolean;
  isPreset: boolean;
}

interface SetlistItem {
  id: string;
  type: string;
  title?: string;
  countdownTime?: string;
  countdownMessage?: string;
  announcementText?: string;
  messages?: string[];
  messagesInterval?: number;
}

export interface UseToolsStateReturn {
  // Countdown state
  countdownTargetTime: string;
  setCountdownTargetTime: React.Dispatch<React.SetStateAction<string>>;
  countdownRemaining: string;
  countdownMessage: string;
  setCountdownMessage: React.Dispatch<React.SetStateAction<string>>;
  countdownMessageTranslation: string;
  setCountdownMessageTranslation: React.Dispatch<React.SetStateAction<string>>;
  isCountdownActive: boolean;

  // Announcement state
  announcementText: string;
  setAnnouncementText: React.Dispatch<React.SetStateAction<string>>;
  isAnnouncementActive: boolean;

  // Clock state
  clockFormat: '12h' | '24h';
  setClockFormat: React.Dispatch<React.SetStateAction<'12h' | '24h'>>;
  clockShowDate: boolean;
  setClockShowDate: React.Dispatch<React.SetStateAction<boolean>>;
  isClockActive: boolean;
  currentTime: Date;

  // Stopwatch state
  stopwatchTime: number;
  isStopwatchRunning: boolean;
  isStopwatchActive: boolean;

  // Rotating messages state
  rotatingMessages: RotatingMessage[];
  setRotatingMessages: React.Dispatch<React.SetStateAction<RotatingMessage[]>>;
  customMessageInput: string;
  setCustomMessageInput: React.Dispatch<React.SetStateAction<string>>;
  rotatingInterval: number;
  setRotatingInterval: React.Dispatch<React.SetStateAction<number>>;
  isRotatingMessagesActive: boolean;

  // Active tool tracking
  activeToolId: string | null;
  setActiveToolId: React.Dispatch<React.SetStateAction<string | null>>;
  activeToolsTab: 'countdown' | 'announce' | 'clock' | 'stopwatch';
  setActiveToolsTab: React.Dispatch<React.SetStateAction<'countdown' | 'announce' | 'clock' | 'stopwatch'>>;

  // Countdown handlers
  startCountdownFromTime: () => void;
  stopCountdown: () => void;

  // Announcement handlers
  showAnnouncement: () => void;
  hideAnnouncement: () => void;

  // Clock handlers
  startClock: () => void;
  stopClock: () => void;

  // Stopwatch handlers
  startStopwatch: () => void;
  pauseStopwatch: () => void;
  resetStopwatch: () => void;
  stopStopwatchBroadcast: () => void;

  // Rotating messages handlers
  toggleMessageEnabled: (id: string) => void;
  addCustomMessage: () => void;
  removeCustomMessage: (id: string) => void;
  broadcastRotatingMessages: () => void;
  stopRotatingMessages: () => void;

  // Add to setlist handlers
  addCountdownToSetlist: () => void;
  addAnnouncementToSetlist: () => void;
  addMessagesToSetlist: () => void;

  // General handlers
  stopAllTools: () => void;
  broadcastToolFromSetlist: (item: SetlistItem) => void;

  // Memoized tools object for SlidePreview
  memoizedTools: {
    countdown?: { active: boolean; remaining: string; message: string; messageTranslation: string };
    announcement?: { active: boolean; text: string };
    clock?: { active: boolean; time: string; date: string };
    stopwatch?: { active: boolean; time: string; running: boolean };
  };

  // Refs for cleanup
  countdownIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
  clockIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
  stopwatchIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

// Helper function to calculate next round hour (e.g., 14:35 -> "15:00")
function getNextRoundHour(): string {
  const now = new Date();
  let nextHour = now.getHours() + 1;
  if (nextHour >= 24) nextHour = 0;
  return `${nextHour.toString().padStart(2, '0')}:00`;
}

export function useToolsState(
  setlist: SetlistItem[],
  setSetlist: React.Dispatch<React.SetStateAction<SetlistItem[]>>
): UseToolsStateReturn {
  // Countdown state - default to next round hour with preset messages
  const [countdownTargetTime, setCountdownTargetTime] = useState(() => getNextRoundHour());
  const [countdownRemaining, setCountdownRemaining] = useState<string>('');
  const [countdownMessage, setCountdownMessage] = useState('מתחילים בקרוב');
  const [countdownMessageTranslation, setCountdownMessageTranslation] = useState('Starting Soon');
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownMessageRef = useRef(countdownMessage);
  const countdownMessageTranslationRef = useRef(countdownMessageTranslation);
  countdownMessageRef.current = countdownMessage;
  countdownMessageTranslationRef.current = countdownMessageTranslation;

  // Announcement state
  const [announcementText, setAnnouncementText] = useState('');
  const [isAnnouncementActive, setIsAnnouncementActive] = useState(false);

  // Clock state
  const [clockFormat, setClockFormat] = useState<'12h' | '24h'>('12h');
  const [clockShowDate, setClockShowDate] = useState(true);
  const [isClockActive, setIsClockActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const clockIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stopwatch state
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const [isStopwatchActive, setIsStopwatchActive] = useState(false);
  const stopwatchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Rotating messages state
  const [rotatingMessages, setRotatingMessages] = useState<RotatingMessage[]>([
    { id: '1', text: 'Welcome!', textHe: 'ברוכים הבאים!', enabled: true, isPreset: true },
    { id: '2', text: 'Please silence your phones', textHe: 'נא להשתיק טלפונים', enabled: true, isPreset: true },
    { id: '3', text: 'Service starting soon', textHe: 'הכנסייה מתחילה בקרוב', enabled: false, isPreset: true },
    { id: '4', text: 'Connect to WiFi: GuestNetwork', textHe: 'התחברו לרשת: GuestNetwork', enabled: false, isPreset: true },
  ]);
  const [customMessageInput, setCustomMessageInput] = useState('');
  const [rotatingInterval, setRotatingInterval] = useState(5);
  const [isRotatingMessagesActive, setIsRotatingMessagesActive] = useState(false);

  // Active tool tracking
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [activeToolsTab, setActiveToolsTab] = useState<'countdown' | 'announce' | 'clock' | 'stopwatch'>('countdown');

  // Clock interval - only update when clock or stopwatch is active
  useEffect(() => {
    if (isClockActive || isStopwatchRunning) {
      clockIntervalRef.current = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    } else if (clockIntervalRef.current) {
      clearInterval(clockIntervalRef.current);
      clockIntervalRef.current = null;
    }

    return () => {
      if (clockIntervalRef.current) {
        clearInterval(clockIntervalRef.current);
      }
    };
  }, [isClockActive, isStopwatchRunning]);

  // Broadcast clock when active
  useEffect(() => {
    if (isClockActive) {
      const timeStr = formatClockTime(currentTime, clockFormat);
      const dateStr = clockShowDate ? formatClockDate(currentTime) : '';
      window.electronAPI.sendTool({
        type: 'clock',
        active: true,
        time: timeStr,
        date: dateStr,
        format: clockFormat
      });
    }
  }, [isClockActive, currentTime, clockFormat, clockShowDate]);

  // Stopwatch interval
  useEffect(() => {
    if (isStopwatchRunning) {
      stopwatchIntervalRef.current = setInterval(() => {
        setStopwatchTime(prev => prev + 100);
      }, 100);
    } else if (stopwatchIntervalRef.current) {
      clearInterval(stopwatchIntervalRef.current);
    }

    return () => {
      if (stopwatchIntervalRef.current) {
        clearInterval(stopwatchIntervalRef.current);
      }
    };
  }, [isStopwatchRunning]);

  // Broadcast stopwatch when active
  useEffect(() => {
    if (isStopwatchActive) {
      window.electronAPI.sendTool({
        type: 'stopwatch',
        active: true,
        time: formatStopwatchTime(stopwatchTime),
        running: isStopwatchRunning
      });
    }
  }, [isStopwatchActive, stopwatchTime, isStopwatchRunning]);

  // Stop all tools helper (defined early so other functions can use it)
  const stopAllToolsInternal = useCallback(() => {
    // Stop countdown
    if (isCountdownActive) {
      setIsCountdownActive(false);
      setCountdownRemaining('');
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      window.electronAPI.sendTool({ type: 'countdown', active: false, remaining: '', message: '' });
    }
    // Stop announcement
    if (isAnnouncementActive) {
      setIsAnnouncementActive(false);
      window.electronAPI.sendTool({ type: 'announcement', active: false, text: '' });
    }
    // Stop rotating messages
    if (isRotatingMessagesActive) {
      setIsRotatingMessagesActive(false);
      window.electronAPI.sendTool({ type: 'rotatingMessages', active: false, messages: [], interval: 5 });
    }
    // Stop clock
    if (isClockActive) {
      setIsClockActive(false);
      window.electronAPI.sendTool({ type: 'clock', active: false });
    }
    // Stop stopwatch broadcast
    if (isStopwatchActive) {
      setIsStopwatchActive(false);
      window.electronAPI.sendTool({ type: 'stopwatch', active: false });
    }
    setActiveToolId(null);
  }, [isCountdownActive, isAnnouncementActive, isRotatingMessagesActive, isClockActive, isStopwatchActive]);

  // Countdown handlers
  const startCountdownFromTime = useCallback(() => {
    if (!countdownTargetTime) return;

    const [hours, minutes] = countdownTargetTime.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, minutes, 0, 0);

    // If target time is in the past, assume it's for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    setIsCountdownActive(true);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    const updateCountdown = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setCountdownRemaining('00:00');
        setIsCountdownActive(false);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        window.electronAPI.sendTool({ type: 'countdown', active: false, remaining: '00:00', message: countdownMessageRef.current, messageTranslation: countdownMessageTranslationRef.current });
        return;
      }
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      const remaining = hrs > 0
        ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      setCountdownRemaining(remaining);
      window.electronAPI.sendTool({ type: 'countdown', active: true, remaining, message: countdownMessageRef.current, messageTranslation: countdownMessageTranslationRef.current });
    };

    updateCountdown();
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);
  }, [countdownTargetTime]);

  const stopCountdown = useCallback(() => {
    setIsCountdownActive(false);
    setCountdownRemaining('');
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    window.electronAPI.sendTool({ type: 'countdown', active: false, remaining: '', message: '' });
    setActiveToolId(prev => {
      const activeItem = setlist.find(item => item.id === prev);
      if (activeItem?.type === 'countdown') return null;
      return prev;
    });
  }, [setlist]);

  // Announcement handlers
  const showAnnouncement = useCallback(() => {
    if (!announcementText.trim()) return;
    stopAllToolsInternal();
    setIsAnnouncementActive(true);
    window.electronAPI.sendTool({ type: 'announcement', active: true, text: announcementText });
  }, [announcementText, stopAllToolsInternal]);

  const hideAnnouncement = useCallback(() => {
    setIsAnnouncementActive(false);
    window.electronAPI.sendTool({ type: 'announcement', active: false, text: '' });
    setActiveToolId(prev => {
      const activeItem = setlist.find(item => item.id === prev);
      if (activeItem?.type === 'announcement') return null;
      return prev;
    });
  }, [setlist]);

  // Clock handlers
  const startClock = useCallback(() => {
    stopAllToolsInternal();
    setIsClockActive(true);
  }, [stopAllToolsInternal]);

  const stopClock = useCallback(() => {
    setIsClockActive(false);
    window.electronAPI.sendTool({ type: 'clock', active: false });
    setActiveToolId(prev => {
      const activeItem = setlist.find(item => item.id === prev);
      if (activeItem?.type === 'clock') return null;
      return prev;
    });
  }, [setlist]);

  // Stopwatch handlers
  const startStopwatch = useCallback(() => {
    stopAllToolsInternal();
    setIsStopwatchRunning(true);
    setIsStopwatchActive(true);
  }, [stopAllToolsInternal]);

  const pauseStopwatch = useCallback(() => {
    setIsStopwatchRunning(false);
  }, []);

  const resetStopwatch = useCallback(() => {
    setStopwatchTime(0);
    setIsStopwatchRunning(false);
  }, []);

  const stopStopwatchBroadcast = useCallback(() => {
    setIsStopwatchActive(false);
    window.electronAPI.sendTool({ type: 'stopwatch', active: false });
    setActiveToolId(prev => {
      const activeItem = setlist.find(item => item.id === prev);
      if (activeItem?.type === 'stopwatch') return null;
      return prev;
    });
  }, [setlist]);

  // Rotating messages handlers
  const toggleMessageEnabled = useCallback((id: string) => {
    setRotatingMessages(prev =>
      prev.map(msg => msg.id === id ? { ...msg, enabled: !msg.enabled } : msg)
    );
  }, []);

  const addCustomMessage = useCallback(() => {
    if (!customMessageInput.trim()) return;
    const newMessage: RotatingMessage = {
      id: crypto.randomUUID(),
      text: customMessageInput.trim(),
      textHe: customMessageInput.trim(),
      enabled: true,
      isPreset: false
    };
    setRotatingMessages(prev => [...prev, newMessage]);
    setCustomMessageInput('');
  }, [customMessageInput]);

  const removeCustomMessage = useCallback((id: string) => {
    setRotatingMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  const broadcastRotatingMessages = useCallback(() => {
    const enabledMessages = rotatingMessages.filter(m => m.enabled).map(m => m.text);
    if (enabledMessages.length === 0) return;
    stopAllToolsInternal();
    setIsRotatingMessagesActive(true);
    window.electronAPI.sendTool({
      type: 'rotatingMessages',
      active: true,
      messages: enabledMessages,
      interval: rotatingInterval
    });
  }, [rotatingMessages, rotatingInterval, stopAllToolsInternal]);

  const stopRotatingMessages = useCallback(() => {
    setIsRotatingMessagesActive(false);
    window.electronAPI.sendTool({ type: 'rotatingMessages', active: false, messages: [], interval: 5 });
    setActiveToolId(prev => {
      const activeItem = setlist.find(item => item.id === prev);
      if (activeItem?.type === 'messages') return null;
      return prev;
    });
  }, [setlist]);

  // Add to setlist handlers
  const addCountdownToSetlist = useCallback(() => {
    if (!countdownTargetTime) return;
    const newItem: SetlistItem = {
      id: `countdown-${Date.now()}`,
      type: 'countdown',
      title: `⏱ ${countdownTargetTime}${countdownMessage ? ` - ${countdownMessage}` : ''}`,
      countdownTime: countdownTargetTime,
      countdownMessage: countdownMessage
    };
    setSetlist(prev => [...prev, newItem]);
  }, [countdownTargetTime, countdownMessage, setSetlist]);

  const addAnnouncementToSetlist = useCallback(() => {
    if (!announcementText.trim()) return;
    const newItem: SetlistItem = {
      id: `announcement-${Date.now()}`,
      type: 'announcement',
      title: `📢 ${announcementText.substring(0, 30)}${announcementText.length > 30 ? '...' : ''}`,
      announcementText: announcementText
    };
    setSetlist(prev => [...prev, newItem]);
  }, [announcementText, setSetlist]);

  const addMessagesToSetlist = useCallback(() => {
    const enabledMessages = rotatingMessages.filter(m => m.enabled).map(m => m.text);
    if (enabledMessages.length === 0) return;
    const newItem: SetlistItem = {
      id: `messages-${Date.now()}`,
      type: 'messages',
      title: `💬 ${enabledMessages.length} rotating messages`,
      messages: enabledMessages,
      messagesInterval: rotatingInterval
    };
    setSetlist(prev => [...prev, newItem]);
  }, [rotatingMessages, rotatingInterval, setSetlist]);

  // Broadcast tool from setlist item
  const broadcastToolFromSetlist = useCallback((item: SetlistItem) => {
    // If this tool is already active, stop it
    if (activeToolId === item.id) {
      stopAllToolsInternal();
      return;
    }

    // Stop any other active tools first
    stopAllToolsInternal();

    if (item.type === 'countdown' && item.countdownTime) {
      setCountdownTargetTime(item.countdownTime);
      setCountdownMessage(item.countdownMessage || '');
      setActiveToolId(item.id);

      // Start countdown
      const [hours, minutes] = item.countdownTime.split(':').map(Number);
      const now = new Date();
      const target = new Date();
      target.setHours(hours, minutes, 0, 0);
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }

      setIsCountdownActive(true);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      const updateCountdown = () => {
        const diff = target.getTime() - Date.now();
        if (diff <= 0) {
          setCountdownRemaining('00:00');
          setIsCountdownActive(false);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          window.electronAPI.sendTool({ type: 'countdown', active: false, remaining: '00:00', message: item.countdownMessage || '' });
          setActiveToolId(null);
          return;
        }
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        const remaining = hrs > 0
          ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
          : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        setCountdownRemaining(remaining);
        window.electronAPI.sendTool({ type: 'countdown', active: true, remaining, message: item.countdownMessage || '' });
      };

      updateCountdown();
      countdownIntervalRef.current = setInterval(updateCountdown, 1000);
    } else if (item.type === 'announcement' && item.announcementText) {
      setAnnouncementText(item.announcementText);
      setActiveToolId(item.id);
      setIsAnnouncementActive(true);
      window.electronAPI.sendTool({ type: 'announcement', active: true, text: item.announcementText });
    } else if (item.type === 'messages' && item.messages && item.messages.length > 0) {
      setActiveToolId(item.id);
      setIsRotatingMessagesActive(true);
      window.electronAPI.sendTool({
        type: 'rotatingMessages',
        active: true,
        messages: item.messages,
        interval: item.messagesInterval || 5
      });
    } else if (item.type === 'clock') {
      setActiveToolId(item.id);
      setIsClockActive(true);
    } else if (item.type === 'stopwatch') {
      setActiveToolId(item.id);
      setIsStopwatchRunning(true);
      setIsStopwatchActive(true);
    }
  }, [activeToolId, stopAllToolsInternal]);

  // Memoized tools object for SlidePreview
  const memoizedTools = {
    countdown: isCountdownActive ? { active: true, remaining: countdownRemaining, message: countdownMessage, messageTranslation: countdownMessageTranslation } : undefined,
    announcement: isAnnouncementActive ? { active: true, text: announcementText } : undefined,
    clock: isClockActive ? { active: true, time: formatClockTime(currentTime, clockFormat), date: clockShowDate ? formatClockDate(currentTime) : '' } : undefined,
    stopwatch: isStopwatchActive ? { active: true, time: formatStopwatchTime(stopwatchTime), running: isStopwatchRunning } : undefined
  };

  return {
    // Countdown state
    countdownTargetTime,
    setCountdownTargetTime,
    countdownRemaining,
    countdownMessage,
    setCountdownMessage,
    countdownMessageTranslation,
    setCountdownMessageTranslation,
    isCountdownActive,

    // Announcement state
    announcementText,
    setAnnouncementText,
    isAnnouncementActive,

    // Clock state
    clockFormat,
    setClockFormat,
    clockShowDate,
    setClockShowDate,
    isClockActive,
    currentTime,

    // Stopwatch state
    stopwatchTime,
    isStopwatchRunning,
    isStopwatchActive,

    // Rotating messages state
    rotatingMessages,
    setRotatingMessages,
    customMessageInput,
    setCustomMessageInput,
    rotatingInterval,
    setRotatingInterval,
    isRotatingMessagesActive,

    // Active tool tracking
    activeToolId,
    setActiveToolId,
    activeToolsTab,
    setActiveToolsTab,

    // Countdown handlers
    startCountdownFromTime,
    stopCountdown,

    // Announcement handlers
    showAnnouncement,
    hideAnnouncement,

    // Clock handlers
    startClock,
    stopClock,

    // Stopwatch handlers
    startStopwatch,
    pauseStopwatch,
    resetStopwatch,
    stopStopwatchBroadcast,

    // Rotating messages handlers
    toggleMessageEnabled,
    addCustomMessage,
    removeCustomMessage,
    broadcastRotatingMessages,
    stopRotatingMessages,

    // Add to setlist handlers
    addCountdownToSetlist,
    addAnnouncementToSetlist,
    addMessagesToSetlist,

    // General handlers
    stopAllTools: stopAllToolsInternal,
    broadcastToolFromSetlist,

    // Memoized tools object
    memoizedTools,

    // Refs for cleanup
    countdownIntervalRef,
    clockIntervalRef,
    stopwatchIntervalRef,
  };
}
