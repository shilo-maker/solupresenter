import React, { memo, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { tabStyles, colors } from '../../styles/controlPanelStyles';

export type ResourcePanel = 'songs' | 'media' | 'tools' | 'bible' | 'presentations';

interface Tab {
  id: ResourcePanel;
  labelKey: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'songs', labelKey: 'controlPanel.tabs.songs', icon: '🎵' },
  { id: 'media', labelKey: 'controlPanel.tabs.media', icon: '🖼️' },
  { id: 'tools', labelKey: 'controlPanel.tabs.tools', icon: '🔧' },
  { id: 'bible', labelKey: 'controlPanel.tabs.bible', icon: '📖' },
  { id: 'presentations', labelKey: 'controlPanel.tabs.presentations', icon: '📊' },
];

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

  const handleTabClick = useCallback((tabId: ResourcePanel) => {
    onTabChange(tabId);
  }, [onTabChange]);

  return (
    <div style={containerStyle}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabClick(tab.id)}
          style={tabStyles.tab(activeTab === tab.id)}
          onMouseEnter={(e) => {
            if (activeTab !== tab.id) {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.color = '#e4e4e7';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== tab.id) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = colors.text.muted;
            }
          }}
        >
          <span style={{ marginRight: '4px' }}>{tab.icon}</span>
          {t(tab.labelKey, tab.id)}
        </button>
      ))}
    </div>
  );
});

ResourceTabs.displayName = 'ResourceTabs';

export default ResourceTabs;
