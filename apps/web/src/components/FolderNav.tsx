'use client';

import { Film, ImageIcon, Archive, Package, Video } from 'lucide-react';

export type FolderTab = 'timeline' | 'assets' | 'vault' | 'releases' | 'renders';

interface FolderNavProps {
  activeTab: FolderTab;
  onTabChange: (tab: FolderTab) => void;
  counts: { used: number; vault: number; releases: number; renders: number };
}

const TABS: { id: FolderTab; label: string; icon: any }[] = [
  { id: 'timeline', label: 'Timeline', icon: Film },
  { id: 'assets', label: 'Used', icon: ImageIcon },
  { id: 'vault', label: 'Vault', icon: Archive },
  { id: 'releases', label: 'Releases', icon: Package },
  { id: 'renders', label: 'Renders', icon: Video },
];

export function FolderNav({ activeTab, onTabChange, counts }: FolderNavProps) {
  const getCount = (id: FolderTab) => {
    switch (id) {
      case 'assets': return counts.used;
      case 'vault': return counts.vault;
      case 'releases': return counts.releases;
      case 'renders': return counts.renders;
      default: return null;
    }
  };

  return (
    <div className="flex overflow-x-auto border-b border-[var(--border-color)]">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const count = getCount(tab.id);
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex items-center gap-1 whitespace-nowrap px-3 py-2 text-xs transition-colors"
            style={{
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            <Icon size={12} />
            {tab.label}
            {count !== null && (
              <span className="ml-0.5 rounded-full bg-[var(--bg-tertiary)] px-1.5 text-[10px]">{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
