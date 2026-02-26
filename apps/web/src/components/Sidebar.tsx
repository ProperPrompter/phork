'use client';

import { useState } from 'react';
import { useProjectStore } from '@/stores/project';
import {
  Sparkles, Film, Package, Globe, GitFork, Utensils, Settings, Info, Coins,
} from 'lucide-react';
import { SettingsPanel } from './SettingsPanel';

interface SidebarProps {
  onRelease: () => void;
  onPublish: () => void;
  onFork: () => void;
  onBack: () => void;
  canPublish: boolean;
  credits?: number;
  onToggleProvenance?: () => void;
}

interface SidebarIconProps {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  accent?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function SidebarIcon({ icon: Icon, label, active, accent, disabled, onClick }: SidebarIconProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
        accent
          ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-50'
          : active
            ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] disabled:opacity-40'
      }`}
    >
      <Icon size={20} />
    </button>
  );
}

export function Sidebar({
  onRelease, onPublish, onFork, onBack, canPublish, credits, onToggleProvenance,
}: SidebarProps) {
  const { activeSection, setActiveSection } = useProjectStore();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <div
        className="flex flex-col items-center border-r border-[var(--border-color)] py-3"
        style={{ width: 'var(--sidebar-width)', background: 'var(--sidebar-bg)' }}
      >
        {/* Brand logo */}
        <button
          onClick={onBack}
          title="Home"
          className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
        >
          <Utensils size={22} />
        </button>

        {/* Separator */}
        <div className="mb-3 h-px w-8 bg-[var(--border-color)]" />

        {/* Section navigation */}
        <div className="flex flex-col items-center gap-1.5">
          <SidebarIcon
            icon={Sparkles}
            label="Generate & Organize"
            active={activeSection === 'generate'}
            onClick={() => setActiveSection('generate')}
          />
          <SidebarIcon
            icon={Film}
            label="Timeline Editor"
            active={activeSection === 'timeline'}
            onClick={() => setActiveSection('timeline')}
          />
        </div>

        {/* Separator */}
        <div className="my-3 h-px w-8 bg-[var(--border-color)]" />

        {/* Utility actions */}
        <div className="flex flex-col items-center gap-1.5">
          <SidebarIcon icon={Package} label="Create Release" onClick={onRelease} />
          <SidebarIcon icon={Globe} label="Publish" onClick={onPublish} disabled={!canPublish} />
          <SidebarIcon icon={GitFork} label="Fork Project" onClick={onFork} />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Provenance + Credits */}
        <div className="flex flex-col items-center gap-1.5 mb-3">
          {onToggleProvenance && (
            <SidebarIcon icon={Info} label="Provenance" onClick={onToggleProvenance} />
          )}
          {credits !== undefined && (
            <button
              title={`${credits} credits`}
              className="flex h-10 w-10 flex-col items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Coins size={18} />
              <span className="mt-0.5 text-[10px] font-semibold">{credits}</span>
            </button>
          )}
        </div>

        {/* Separator */}
        <div className="mb-3 h-px w-8 bg-[var(--border-color)]" />

        {/* Bottom actions */}
        <div className="flex flex-col items-center gap-1.5">
          <SidebarIcon
            icon={Settings}
            label="Settings"
            active={showSettings}
            onClick={() => setShowSettings(!showSettings)}
          />
        </div>
      </div>

      {/* Settings panel */}
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
