'use client';

import { useState } from 'react';
import type { ShotSnapshot } from '@phork/shared';
import { api } from '@/lib/api';
import { Wand2, Volume2, Loader2 } from 'lucide-react';

interface ShotEditorProps {
  shot: ShotSnapshot;
  shotIndex: number;
  projectId: string;
  workspaceId: string;
  onUpdate: (shot: ShotSnapshot) => void;
  onCreditsChange: () => void;
}

export function ShotEditor({ shot, shotIndex, projectId, workspaceId, onUpdate, onCreditsChange }: ShotEditorProps) {
  const [visualPrompt, setVisualPrompt] = useState('');
  const [audioText, setAudioText] = useState('');
  const [generatingVisual, setGeneratingVisual] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);

  const generateVisual = async () => {
    if (!visualPrompt.trim()) return;
    setGeneratingVisual(true);
    try {
      const jobRes = await api.post('/jobs/gen-video', {
        projectId,
        workspaceId,
        prompt: visualPrompt.trim(),
        duration: shot.duration_ms,
      });

      // Poll for completion
      const result = await pollJob(jobRes.id);
      if (result?.result?.assetId) {
        onUpdate({ ...shot, visual_asset_id: result.result.assetId });
        onCreditsChange();
      }
    } catch (err: any) {
      alert(err.message || 'Generation failed');
    } finally {
      setGeneratingVisual(false);
    }
  };

  const generateAudio = async () => {
    if (!audioText.trim()) return;
    setGeneratingAudio(true);
    try {
      const jobRes = await api.post('/jobs/gen-audio', {
        projectId,
        workspaceId,
        text: audioText.trim(),
      });

      const result = await pollJob(jobRes.id);
      if (result?.result?.assetId) {
        onUpdate({ ...shot, audio_asset_id: result.result.assetId });
        onCreditsChange();
      }
    } catch (err: any) {
      alert(err.message || 'Generation failed');
    } finally {
      setGeneratingAudio(false);
    }
  };

  const pollJob = async (jobId: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const poll = setInterval(async () => {
        try {
          const job = await api.get(`/jobs/${jobId}`);
          if (job.status === 'succeeded') {
            clearInterval(poll);
            resolve(job);
          } else if (job.status === 'failed' || job.status === 'blocked') {
            clearInterval(poll);
            reject(new Error(job.error?.message || `Job ${job.status}`));
          }
        } catch (err) {
          clearInterval(poll);
          reject(err);
        }
      }, 2000);
    });
  };

  return (
    <div className="p-4 space-y-6">
      <h3 className="text-sm font-semibold border-b border-[var(--border-color)] pb-2">
        Shot {shotIndex + 1}
      </h3>

      {/* Duration */}
      <div>
        <label className="mb-1 block text-xs text-[var(--text-secondary)]">Duration (seconds)</label>
        <input
          type="number"
          min={1}
          max={30}
          step={0.5}
          value={shot.duration_ms / 1000}
          onChange={(e) => {
            const ms = Math.round(parseFloat(e.target.value) * 1000);
            onUpdate({ ...shot, duration_ms: ms, trim_out_ms: ms });
          }}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* Visual Generation */}
      <div>
        <label className="mb-1 block text-xs text-[var(--text-secondary)]">Visual Prompt</label>
        <textarea
          value={visualPrompt}
          onChange={(e) => setVisualPrompt(e.target.value)}
          placeholder="Describe the visual for this shot..."
          rows={3}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-none"
        />
        <button
          onClick={generateVisual}
          disabled={generatingVisual || !visualPrompt.trim()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {generatingVisual ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          {generatingVisual ? 'Generating...' : 'Generate Visual'}
        </button>
        {shot.visual_asset_id && (
          <p className="mt-1 text-xs text-[var(--success)]">Visual asset ready</p>
        )}
      </div>

      {/* Audio Generation */}
      <div>
        <label className="mb-1 block text-xs text-[var(--text-secondary)]">Audio / Dialogue Text</label>
        <textarea
          value={audioText}
          onChange={(e) => setAudioText(e.target.value)}
          placeholder="Text for TTS, or leave empty for silence..."
          rows={3}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-none"
        />
        <button
          onClick={generateAudio}
          disabled={generatingAudio || !audioText.trim()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
        >
          {generatingAudio ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
          {generatingAudio ? 'Generating...' : 'Generate Audio'}
        </button>
        {shot.audio_asset_id && (
          <p className="mt-1 text-xs text-[var(--success)]">Audio asset ready</p>
        )}
      </div>

      {/* Subtitle */}
      <div>
        <label className="mb-1 block text-xs text-[var(--text-secondary)]">Subtitle (optional)</label>
        <input
          type="text"
          value={shot.subtitle || ''}
          onChange={(e) => onUpdate({ ...shot, subtitle: e.target.value || null })}
          placeholder="Caption text..."
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>
    </div>
  );
}
