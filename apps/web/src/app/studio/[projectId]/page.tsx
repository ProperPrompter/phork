'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useProjectStore } from '@/stores/project';
import { api } from '@/lib/api';
import { ShotList } from '@/components/ShotList';
import { ShotEditor } from '@/components/ShotEditor';
import { PreviewPlayer } from '@/components/PreviewPlayer';
import { ProvenancePanel } from '@/components/ProvenancePanel';
import { ForkDialog } from '@/components/ForkDialog';
import { PublishDialog } from '@/components/PublishDialog';
import { ReleaseDialog } from '@/components/ReleaseDialog';
import { FolderNav, type FolderTab } from '@/components/FolderNav';
import { AssetGrid } from '@/components/AssetGrid';
import { UpstreamLibrary } from '@/components/UpstreamLibrary';
import type { ShotSnapshot, TimelineSnapshot } from '@phork/shared';
import { GitFork, Play, Save, ArrowLeft, Info, Globe, Package, Eye } from 'lucide-react';

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
  const [showPublish, setShowPublish] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const [credits, setCredits] = useState(0);
  const [publishedRender, setPublishedRender] = useState<any>(null);

  // Folder nav state
  const [activeTab, setActiveTab] = useState<FolderTab>('timeline');
  const [folderAssets, setFolderAssets] = useState<any[]>([]);
  const [assetCounts, setAssetCounts] = useState({ used: 0, vault: 0, releases: 0, renders: 0 });
  const [releases, setReleases] = useState<any[]>([]);
  const [renderAssets, setRenderAssets] = useState<any[]>([]);

  useEffect(() => {
    if (!token) { router.push('/login'); return; }
    loadProject();
    loadCredits();
  }, [token, projectId]);

  useEffect(() => {
    if (activeTab !== 'timeline' && workspaceId) {
      loadFolderData();
    }
  }, [activeTab, workspaceId, projectId]);

  const loadProject = async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      setProject(res.project);
      setHeadCommit(res.headCommit);
      if (res.headCommit?.snapshot) {
        setShots((res.headCommit.snapshot as TimelineSnapshot).timeline || []);
      }
      // Check if published
      try {
        const pub = await api.get(`/publish/${projectId}`);
        setPublishedRender(pub.publishedRender);
      } catch { /* not published */ }
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

  const loadFolderData = async () => {
    try {
      if (activeTab === 'assets' || activeTab === 'vault') {
        const res = await api.get(`/assets?workspaceId=${workspaceId}&projectId=${projectId}&classification=${activeTab === 'assets' ? 'used' : 'vault'}`);
        setFolderAssets(res.data || []);
        setAssetCounts((prev) => ({ ...prev, used: res.usedCount, vault: res.vaultCount }));
      } else if (activeTab === 'releases') {
        const res = await api.get(`/projects/${projectId}/releases`);
        setReleases(res.data || []);
        setAssetCounts((prev) => ({ ...prev, releases: (res.data || []).length }));
      } else if (activeTab === 'renders') {
        const res = await api.get(`/assets?workspaceId=${workspaceId}&classification=all`);
        const renders = (res.data || []).filter((a: any) => a.type === 'render');
        setRenderAssets(renders);
        setAssetCounts((prev) => ({ ...prev, renders: renders.length }));
      }
    } catch (err) {
      console.error('Failed to load folder data:', err);
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
      await saveCommit();
      const res = await api.post('/jobs/render', {
        projectId,
        workspaceId,
        commitId: headCommit.id,
      });
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
    selectShot(shots.length);
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
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-secondary)]">{credits} credits</span>
          <button
            onClick={() => setShowProvenance(!showProvenance)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)]"
          >
            <Info size={14} /> Provenance
          </button>
          <button
            onClick={() => setShowReleaseDialog(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)]"
          >
            <Package size={14} /> Release
          </button>
          <button
            onClick={() => setShowFork(true)}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)]"
          >
            <GitFork size={14} /> Fork
          </button>
          {publishedRender && (
            <button
              onClick={() => router.push(`/viewer/${projectId}`)}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)]"
            >
              <Eye size={14} /> View
            </button>
          )}
          <button
            onClick={saveCommit}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setShowPublish(true)}
            disabled={!renderAssetId}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
            title={renderAssetId ? 'Publish this render' : 'Render first to publish'}
          >
            <Globe size={14} /> Publish
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
        {/* Left Panel: Folder Nav + Content */}
        <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden border-r border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <FolderNav activeTab={activeTab} onTabChange={setActiveTab} counts={assetCounts} />
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'timeline' && (
              <ShotList
                shots={shots}
                selectedIndex={selectedShotIndex}
                onSelect={selectShot}
                onAdd={handleAddShot}
                onRemove={removeShot}
                onReorder={reorderShots}
              />
            )}
            {(activeTab === 'assets' || activeTab === 'vault') && (
              <AssetGrid
                assets={folderAssets}
                emptyMessage={activeTab === 'assets' ? 'No used assets in timeline' : 'No unused assets in vault'}
              />
            )}
            {activeTab === 'releases' && (
              <div className="p-3">
                {releases.length === 0 ? (
                  <p className="text-center text-sm text-[var(--text-secondary)]">No releases yet</p>
                ) : (
                  <div className="space-y-2">
                    {releases.map((r: any) => (
                      <div key={r.id} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-xs">
                        <div className="font-medium">{r.name}</div>
                        <div className="mt-0.5 text-[var(--text-secondary)]">
                          {r.includeMode === 'used_only' ? 'Used only' : 'Used + extras'} — {r.assetCount} assets
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'renders' && (
              <AssetGrid assets={renderAssets} emptyMessage="No renders yet" />
            )}
            {/* Show upstream library for forked projects */}
            {project?.parentProjectId && activeTab === 'timeline' && (
              <UpstreamLibrary
                parentProjectId={project.parentProjectId}
                forkedFromCommitId={project.forkedFromCommitId || ''}
              />
            )}
          </div>
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

      {/* Dialogs */}
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

      {showPublish && renderAssetId && headCommit && (
        <PublishDialog
          projectId={projectId}
          renderAssetId={renderAssetId}
          commitId={headCommit.id}
          projectName={project?.name || 'Untitled'}
          onClose={() => setShowPublish(false)}
          onPublished={(pub) => {
            setPublishedRender(pub);
            setShowPublish(false);
          }}
        />
      )}

      {showReleaseDialog && (
        <ReleaseDialog
          projectId={projectId}
          workspaceId={workspaceId!}
          onClose={() => setShowReleaseDialog(false)}
          onCreated={(release) => {
            setReleases((prev) => [release, ...prev]);
            setShowReleaseDialog(false);
          }}
        />
      )}
    </div>
  );
}
