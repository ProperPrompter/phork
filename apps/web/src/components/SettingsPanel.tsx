'use client';

import { X, Moon, Sun, Monitor } from 'lucide-react';
import { useThemeStore, type Theme } from '@/stores/theme';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { theme, setTheme } = useThemeStore();

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'var(--overlay-bg)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed left-[var(--sidebar-width)] top-0 z-50 flex h-full w-80 flex-col border-r"
        style={{
          background: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Appearance */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Appearance
            </h3>

            {/* Theme toggle */}
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <label className="mb-2 block text-xs text-[var(--text-secondary)]">Theme</label>
              <div className="grid grid-cols-2 gap-2">
                <ThemeOption
                  icon={Moon}
                  label="Dark"
                  active={theme === 'dark'}
                  onClick={() => setTheme('dark')}
                />
                <ThemeOption
                  icon={Sun}
                  label="Light"
                  active={theme === 'light'}
                  onClick={() => setTheme('light')}
                />
              </div>
            </div>
          </section>

          {/* Accent preview */}
          <section className="mt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Accent Preview
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                <div className="h-8 w-8 rounded-lg bg-[var(--accent)]" />
                <div>
                  <div className="text-xs font-medium">Primary Accent</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">Warm Orange — buttons, links, focus</div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                <div className="h-8 w-8 rounded-lg bg-[var(--highlight)]" />
                <div>
                  <div className="text-xs font-medium">Complement</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">Teal — secondary highlights</div>
                </div>
              </div>
            </div>
          </section>

          {/* About */}
          <section className="mt-6">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              About
            </h3>
            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
              <div className="text-xs">
                <span className="font-semibold text-[var(--accent)]">Phork</span> Studio
              </div>
              <div className="mt-1 text-[10px] text-[var(--text-secondary)]">
                AI Production Studio — Create, Fork, Remix
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function ThemeOption({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
        active
          ? 'border border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]'
          : 'border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--card-hover-border)] hover:text-[var(--text-primary)]'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}
