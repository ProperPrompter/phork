'use client';

import { useEffect, useState } from 'react';
import type { ShotSnapshot } from '@phork/shared';
import { api } from '@/lib/api';
import { X } from 'lucide-react';

interface ProvenancePanelProps {
  shot: ShotSnapshot;
  onClose: () => void;
}

export function ProvenancePanel({ shot, onClose }: ProvenancePanelProps) {
  const [visualProvenance, setVisualProvenance] = useState<any>(null);
  const [audioProvenance, setAudioProvenance] = useState<any>(null);

  useEffect(() => {
    if (shot.visual_asset_id) {
      api.get(`/assets/${shot.visual_asset_id}`).then((a) => setVisualProvenance(a.provenance)).catch(() => {});
    }
    if (shot.audio_asset_id) {
      api.get(`/assets/${shot.audio_asset_id}`).then((a) => setAudioProvenance(a.provenance)).catch(() => {});
    }
  }, [shot]);

  return (
    <div className="absolute right-0 top-0 z-10 h-full w-96 overflow-y-auto border-l border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Provenance</h3>
        <button onClick={onClose} className="rounded p-1 hover:bg-[var(--bg-tertiary)]">
          <X size={16} />
        </button>
      </div>

      {shot.visual_asset_id && visualProvenance && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-[var(--accent)] mb-2">Visual Asset</h4>
          <pre className="rounded-lg bg-[var(--bg-tertiary)] p-3 text-xs overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(visualProvenance, null, 2)}
          </pre>
        </div>
      )}

      {shot.audio_asset_id && audioProvenance && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-[var(--accent)] mb-2">Audio Asset</h4>
          <pre className="rounded-lg bg-[var(--bg-tertiary)] p-3 text-xs overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(audioProvenance, null, 2)}
          </pre>
        </div>
      )}

      {!shot.visual_asset_id && !shot.audio_asset_id && (
        <p className="text-sm text-[var(--text-secondary)]">No assets generated for this shot yet.</p>
      )}
    </div>
  );
}
