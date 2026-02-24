'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useProjectStore } from '@/stores/project';
import { api } from '@/lib/api';
import { ShotList } from '@/components/ShotList';
import { ShotEditor } from '@/components/ShotEditor';
import { PreviewPlayer } from '@/components/PreviewPlayer';
import { ProvenancePanel } from '@/components/ProvenancePanel';
import { ForkDialog } from '@/components/ForkDialog';
import type { ShotSnapshot, TimelineSnapshot } from '@phork/shared';
import { GitFork, Play, Save, ArrowLeft, Info } from 'lucide-react';

export default function ProjectStudioPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { token, workspaceId } = useAuthStore();
  const {
    project, headCommit, shots, selectedShotIndex,
    setProject, setHeadCommit, setShots, selectShot,
    addShot, removeShot, reorderShots, updateShot,
  } = useProjectStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderAssetId, setRenderAssetId] = useState<string | null>(null);
  const [renderDownloadUrl, setRenderDownloadUrl] = useState<string | null>(null);
  const [showFork, setShowFork] = useState(false);
  const [showProvenance, setShowProvenance] = useState(false);
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    loadProject();
    loadCredits();
  }, [token, projectId]);

  const loadProject = async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      setProject(res.project);
      setHeadCommit(res.headCommit);
      if (res.headCommit?.snapshot) {
        setShots((res.headCommit.snapshot as TimelineSnapshot).timeline || []);
      }
    } catch (err) {
      console.error('Failed to load project:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCredits = async () => {
    try {
      const res = await api.get(`/credits/balance?workspaceId=${workspaceId}`);
      setCredits(res.balance);
    } catch (err) {
      console.error('Failed to load credits:', err);
    }
  };

  const saveCommit = async () => {
    setSaving(true);
    try {
      const snapshot: TimelineSnapshot = { timeline: shots };
      const res = await api.post(`/projects/${projectId}/commits`, {
        message: `Update timeline (${shots.length} shots)`,
        snapshot,
      });
      setHeadCommit(res);
    } catch (err: any) {
      console.error('Failed to save:', err);
      alert(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const startRender = async () => {
    if (!headCommit) return;
    setRendering(true);
    setRenderAssetId(null);
    setRenderDownloadUrl(null);
    try {
      // Save first
      await saveCommit();
      const res = await api.post('/jobs/render', {
        projectId,
        workspaceId,
        commitId: headCommit.id,
      });
      // Poll for completion
      pollJob(res.id);
    } catch (err: any) {
      console.error('Render failed:', err);
      setRendering(false);
    }
  };

  const pollJob = async (jobId: string) => {
    const poll = setInterval(async () => {
      try {
        const job = await api.get(`/jobs/${jobId}`);
        if (job.status === 'succeeded') {
          clearInterval(poll);
          setRendering(false);
          const assetId = job.result?.assetId || null;
          setRenderAssetId(assetId);
          if (assetId) {
            try {
              const assetMeta = await api.get(`/assets/${assetId}`);
              setRenderDownloadUrl(assetMeta.downloadUrl || null);
            } catch (err) {
              console.error('Failed to fetch asset download URL:', err);
            }
          }
          loadCredits();
        } else if (job.status === 'failed' || job.status === 'blocked') {
          clearInterval(poll);
          setRendering(false);
          alert(`Job ${job.status}: ${job.error?.message || 'Unknown error'}`);
        }
      } catch {
        clearInterval(poll);
        setRendering(false);
      }
    }, 2000);
  };

  const handleAddShot = () => {
    const newShot: ShotSnapshot = {
      shot_id: crypto.randomUUID(),
      visual_asset_id: null,
      audio_asset_id: null,
      duration_ms: 4000,
      trim_in_ms: 0,
      trim_out_ms: 4000,
      subtitle: null,
    };
    addShot(newShot);
    selectShot(shots.length); // Select the newly added shot
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading project...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/studio')} className="rounded-lg p-1.5 hover:bg-[var(--bg-tertiary)]">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-semibold">{project?.name || 'Project'}</h1>
          {project?.parentProjectId && (
            <span className="rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-xs text-[var(--accent)]">Forked</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-secondary)]">{credits} credits</span>
          <button
            onClick={() => setShowProvenance(!showProvenance)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)]"
          >
            <Info size={14} /> Provenance
          </button>
          <button
            onClick={() => setShowFork(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)]"
          >
            <GitFork size={14} /> Fork
          </button>
          <button
            onClick={saveCommit}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={startRender}
            disabled={rendering || shots.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            <Play size={14} /> {rendering ? 'Rendering...' : 'Render'}
          </button>
        </div>
      </header>

      {/* Main Studio Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Shot List */}
        <div className="w-64 flex-shrink-0 overflow-y-auto border-r border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <ShotList
            shots={shots}
            selectedIndex={selectedShotIndex}
            onSelect={selectShot}
            onAdd={handleAddShot}
            onRemove={removeShot}
            onReorder={reorderShots}
          />
        </div>

        {/* Center: Preview */}
        <div className="flex flex-1 flex-col">
          <PreviewPlayer
            shots={shots}
            renderAssetId={renderAssetId}
            renderDownloadUrl={renderDownloadUrl}
          />
        </div>

        {/* Right Panel: Shot Editor */}
        <div className="w-80 flex-shrink-0 overflow-y-auto border-l border-[var(--border-color)] bg-[var(--bg-secondary)]">
          {selectedShotIndex !== null && shots[selectedShotIndex] ? (
            <ShotEditor
              shot={shots[selectedShotIndex]}
              shotIndex={selectedShotIndex}
              projectId={projectId}
              workspaceId={workspaceId!}
              onUpdate={(updated) => updateShot(selectedShotIndex, updated)}
              onCreditsChange={loadCredits}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-[var(--text-secondary)]">
              Select a shot or add a new one to get started
            </div>
          )}
        </div>

        {/* Provenance Panel (overlay) */}
        {showProvenance && selectedShotIndex !== null && shots[selectedShotIndex] && (
          <ProvenancePanel
            shot={shots[selectedShotIndex]}
            onClose={() => setShowProvenance(false)}
          />
        )}
      </div>

      {/* Fork Dialog */}
      {showFork && (
        <ForkDialog
          projectId={projectId}
          onClose={() => setShowFork(false)}
          onForked={(newProjectId) => {
            setShowFork(false);
            router.push(`/studio/${newProjectId}`);
          }}
        />
      )}
    </div>
  );
}
