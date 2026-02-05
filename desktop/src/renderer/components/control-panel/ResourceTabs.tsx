import React, { memo, useMemo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tabStyles, colors } from '../../styles/controlPanelStyles';

export type ResourcePanel = 'songs' | 'media' | 'tools' | 'bible' | 'presentations';

interface Tab {
  id: ResourcePanel;
  labelKey: string;
}

const TABS: Tab[] = [
  { id: 'songs', labelKey: 'controlPanel.tabs.songs' },
  { id: 'media', labelKey: 'controlPanel.tabs.media' },
  { id: 'tools', labelKey: 'controlPanel.tabs.tools' },
  { id: 'bible', labelKey: 'controlPanel.tabs.bible' },
  { id: 'presentations', labelKey: 'controlPanel.tabs.presentations' },
];

// SVG icons for each tab (black fill)
const TabIcons: Record<ResourcePanel, React.ReactNode> = {
  songs: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="black">
      <path d="M9 18V5l12-2v13M9 18c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3zM21 16c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"/>
    </svg>
  ),
  media: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="black">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="black" strokeWidth="2"/>
      <circle cx="8.5" cy="8.5" r="1.5" fill="black"/>
      <path d="M21 15l-5-5L5 21" fill="none" stroke="black" strokeWidth="2"/>
    </svg>
  ),
  tools: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  bible: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  presentations: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="9" y1="21" x2="9" y2="9"/>
    </svg>
  ),
};

// Memoized tab button component to prevent re-renders
interface TabButtonProps {
  tab: Tab;
  isActive: boolean;
  onClick: (id: ResourcePanel) => void;
  label: string;
}

const TabButton = memo<TabButtonProps>(({ tab, isActive, onClick, label }) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = useCallback(() => onClick(tab.id), [onClick, tab.id]);
  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const style = useMemo(() => {
    const baseStyle = tabStyles.tab(isActive);
    if (!isActive && isHovered) {
      return {
        ...baseStyle,
        background: 'rgba(255,255,255,0.08)',
        color: '#e4e4e7'
      };
    }
    return baseStyle;
  }, [isActive, isHovered]);

  return (
    <button
      onClick={handleClick}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span style={{ marginRight: '4px', display: 'flex', alignItems: 'center' }}>{TabIcons[tab.id]}</span>
      {label}
    </button>
  );
});

TabButton.displayName = 'TabButton';

interface ResourceTabsProps {
  activeTab: ResourcePanel;
  onTabChange: (tab: ResourcePanel) => void;
}

const ResourceTabs: React.FC<ResourceTabsProps> = memo(({
  activeTab,
  onTabChange,
}) => {
  const { t } = useTranslation();

  const containerStyle = useMemo(() => ({
    ...tabStyles.container,
    flexWrap: 'wrap' as const,
  }), []);

  return (
    <div style={containerStyle}>
      {TABS.map((tab) => (
        <TabButton
          key={tab.id}
          tab={tab}
          isActive={activeTab === tab.id}
          onClick={onTabChange}
          label={t(tab.labelKey, tab.id)}
        />
      ))}
    </div>
  );
});

ResourceTabs.displayName = 'ResourceTabs';

export default ResourceTabs;
