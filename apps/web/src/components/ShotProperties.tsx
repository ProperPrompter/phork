'use client';

import { useEffect, useState } from 'react';
import type { ShotSnapshot } from '@phork/shared';
import { X } from 'lucide-react';
import { api } from '@/lib/api';

interface ShotPropertiesProps {
  shot: ShotSnapshot;
  onUpdate: (shot: ShotSnapshot) => void;
  workspaceId: string;
  projectId: string;
}

export function ShotProperties({ shot, onUpdate, workspaceId, projectId }: ShotPropertiesProps) {
  const [availableAssets, setAvailableAssets] = useState<any[]>([]);

  useEffect(() => {
    loadAssets();
  }, [workspaceId, projectId]);

  const loadAssets = async () => {
    try {
      const res = await api.get(`/assets?workspaceId=${workspaceId}&projectId=${projectId}&classification=all`);
      setAvailableAssets(res.data || []);
    } catch (err) {
      console.error('Failed to load assets for properties:', err);
    }
  };

  const videoAssets = availableAssets.filter((a: any) => a.type === 'video' || a.type === 'image');
  const audioAssets = availableAssets.filter((a: any) => a.type === 'audio');

  return (
    <div className="border-t border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        Shot Properties
      </h3>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Duration */}
        <div>
          <label className="mb-1 block text-[10px] text-[var(--text-secondary)]">Duration (sec)</label>
          <input
            type="number"
            min={0.5}
            max={30}
            step={0.5}
            value={shot.duration_ms / 1000}
            onChange={(e) => {
              const ms = Math.round(parseFloat(e.target.value) * 1000);
              onUpdate({ ...shot, duration_ms: ms, trim_out_ms: ms });
            }}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Subtitle */}
        <div>
          <label className="mb-1 block text-[10px] text-[var(--text-secondary)]">Subtitle</label>
          <input
            type="text"
            value={shot.subtitle || ''}
            onChange={(e) => onUpdate({ ...shot, subtitle: e.target.value || null })}
            placeholder="Caption text..."
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Visual Asset */}
        <div>
          <label className="mb-1 block text-[10px] text-[var(--text-secondary)]">Visual Asset</label>
          <div className="flex items-center gap-1">
            <select
              value={shot.visual_asset_id || ''}
              onChange={(e) => onUpdate({ ...shot, visual_asset_id: e.target.value || null })}
              className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
            >
              <option value="">None</option>
              {videoAssets.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.type} — {a.id.slice(0, 8)}
                </option>
              ))}
            </select>
            {shot.visual_asset_id && (
              <button
                onClick={() => onUpdate({ ...shot, visual_asset_id: null })}
                className="rounded p-1 text-[var(--text-secondary)] hover:text-[var(--error)]"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Audio Asset */}
        <div>
          <label className="mb-1 block text-[10px] text-[var(--text-secondary)]">Audio Asset</label>
          <div className="flex items-center gap-1">
            <select
              value={shot.audio_asset_id || ''}
              onChange={(e) => onUpdate({ ...shot, audio_asset_id: e.target.value || null })}
              className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
            >
              <option value="">None</option>
              {audioAssets.map((a: any) => (
                <option key={a.id} value={a.id}>
                  audio — {a.id.slice(0, 8)}
                </option>
              ))}
            </select>
            {shot.audio_asset_id && (
              <button
                onClick={() => onUpdate({ ...shot, audio_asset_id: null })}
                className="rounded p-1 text-[var(--text-secondary)] hover:text-[var(--error)]"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
