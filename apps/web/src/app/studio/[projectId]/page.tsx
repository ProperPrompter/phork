'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useProjectStore } from '@/stores/project';
import { api } from '@/lib/api';
import { pollJob } from '@/lib/pollJob';
import { Sidebar } from '@/components/Sidebar';
import { GenerateView } from '@/components/GenerateView';
import { TimelineView } from '@/components/TimelineView';
import { ProvenancePanel } from '@/components/ProvenancePanel';
import { ForkDialog } from '@/components/ForkDialog';
import { PublishDialog } from '@/components/PublishDialog';
import { ReleaseDialog } from '@/components/ReleaseDialog';
import type { ShotSnapshot, TimelineSnapshot } from '@phork/shared';

export default function ProjectStudioPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { token, workspaceId } = useAuthStore();
  const {
    project, headCommit, shots, selectedShotIndex, activeSection,
    setProject, setHeadCommit, setShots, selectShot, updateShot,
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
      const job = await pollJob(res.id);
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
    } catch (err: any) {
      console.error('Render failed:', err);
      setRendering(false);
      alert(err.message || 'Render failed');
    }
  };

  /** Called from GenerateView "Use in Timeline" button */
  const handleUseInTimeline = (assetId: string, assetType: string) => {
    if (selectedShotIndex !== null && shots[selectedShotIndex]) {
      const shot = shots[selectedShotIndex];
      if (assetType === 'audio') {
        updateShot(selectedShotIndex, { ...shot, audio_asset_id: assetId });
      } else {
        updateShot(selectedShotIndex, { ...shot, visual_asset_id: assetId });
      }
    } else {
      // Create a new shot with this asset
      const newShot: ShotSnapshot = {
        shot_id: crypto.randomUUID(),
        visual_asset_id: assetType !== 'audio' ? assetId : null,
        audio_asset_id: assetType === 'audio' ? assetId : null,
        duration_ms: 4000,
        trim_in_ms: 0,
        trim_out_ms: 4000,
        subtitle: null,
      };
      useProjectStore.getState().addShot(newShot);
      selectShot(shots.length);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading project...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        onRelease={() => setShowReleaseDialog(true)}
        onPublish={() => setShowPublish(true)}
        onFork={() => setShowFork(true)}
        onBack={() => router.push('/studio')}
        canPublish={!!renderAssetId}
        credits={credits}
        onToggleProvenance={() => setShowProvenance(!showProvenance)}
      />

      {/* Main area */}
      <div className="relative flex-1 overflow-hidden">
        {activeSection === 'generate' ? (
          <GenerateView
            projectId={projectId}
            workspaceId={workspaceId!}
            onCreditsChange={loadCredits}
            onUseInTimeline={handleUseInTimeline}
          />
        ) : (
          <TimelineView
            projectId={projectId}
            workspaceId={workspaceId!}
            renderAssetId={renderAssetId}
            renderDownloadUrl={renderDownloadUrl}
            onSave={saveCommit}
            onRender={startRender}
            onUseInTimeline={handleUseInTimeline}
            saving={saving}
            rendering={rendering}
          />
        )}

        {/* Provenance overlay */}
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
            setShowReleaseDialog(false);
          }}
        />
      )}
    </div>
  );
}
