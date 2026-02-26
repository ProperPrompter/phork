'use client';

import { useProjectStore } from '@/stores/project';
import { useStudioStore } from '@/stores/studio';
import { GeneratePanel } from './GeneratePanel';
import { GenerationFeed } from './GenerationFeed';
import { LibraryPanel } from './LibraryPanel';
import { UpstreamLibrary } from './UpstreamLibrary';

interface GenerateViewProps {
  projectId: string;
  workspaceId: string;
  onCreditsChange: () => void;
  onUseInTimeline: (assetId: string, type: string) => void;
}

export function GenerateView({ projectId, workspaceId, onCreditsChange, onUseInTimeline }: GenerateViewProps) {
  const { project } = useProjectStore();
  const { bumpLibraryVersion } = useStudioStore();

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel — generation controls (380px) */}
      <GeneratePanel
        projectId={projectId}
        workspaceId={workspaceId}
        onCreditsChange={onCreditsChange}
        onGenerated={bumpLibraryVersion}
      />

      {/* Center — generation feed */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <GenerationFeed
          projectId={projectId}
          workspaceId={workspaceId}
          onUseInTimeline={onUseInTimeline}
        />

        {/* Upstream library for forked projects */}
        {project?.parentProjectId && (
          <div className="border-t border-[var(--border-color)]">
            <UpstreamLibrary
              parentProjectId={project.parentProjectId}
              forkedFromCommitId={project.forkedFromCommitId || ''}
              onUseInTimeline={onUseInTimeline}
            />
          </div>
        )}
      </div>

      {/* Right panel — library (320px) */}
      <LibraryPanel
        projectId={projectId}
        workspaceId={workspaceId}
        onUseInTimeline={onUseInTimeline}
      />
    </div>
  );
}
