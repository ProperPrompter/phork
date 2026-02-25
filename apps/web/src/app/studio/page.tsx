'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import { Plus } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  parentProjectId: string | null;
}

export default function StudioPage() {
  const router = useRouter();
  const { token, user, workspaceId, logout } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    loadProjects();
    loadTemplates();
  }, [token]);

  const loadTemplates = async () => {
    try {
      const res = await api.get('/projects/templates');
      setTemplates(res.data || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await api.get(`/projects?workspaceId=${workspaceId}`);
      setProjects(res.data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async () => {
    if (!newName.trim()) return;
    try {
      const body: any = { workspaceId, name: newName.trim() };
      if (templateId) body.templateId = templateId;
      const res = await api.post('/projects', body);
      setNewName('');
      setShowCreate(false);
      router.push(`/studio/${res.project.id}`);
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--border-color)] px-6 py-4">
        <h1 className="text-xl font-bold">
          <span className="text-[var(--accent)]">Phork</span> Studio
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--text-secondary)]">{user?.email}</span>
          <button
            onClick={logout}
            className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)]"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-5xl p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Projects</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={16} /> New Project
          </button>
        </div>

        {/* Create Project Modal */}
        {showCreate && (
          <div className="mb-6 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6">
            <h3 className="mb-4 text-lg font-medium">Create New Project</h3>

            {/* Template selector */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              <button
                onClick={() => setTemplateId('')}
                className="rounded-lg border p-3 text-left text-sm transition-colors"
                style={{
                  borderColor: !templateId ? 'var(--accent)' : 'var(--border-color)',
                  backgroundColor: !templateId ? 'rgba(124, 58, 237, 0.1)' : 'var(--bg-tertiary)',
                }}
              >
                <div className="font-medium">Blank Project</div>
                <div className="mt-0.5 text-xs text-[var(--text-secondary)]">Start from scratch</div>
              </button>
              {templates.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className="rounded-lg border p-3 text-left text-sm transition-colors"
                  style={{
                    borderColor: templateId === t.id ? 'var(--accent)' : 'var(--border-color)',
                    backgroundColor: templateId === t.id ? 'rgba(124, 58, 237, 0.1)' : 'var(--bg-tertiary)',
                  }}
                >
                  <div className="font-medium">{t.name}</div>
                  <div className="mt-0.5 text-xs text-[var(--text-secondary)]">{t.shots.length} shots, {t.defaultAspectRatio}</div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createProject()}
                placeholder="Project name"
                className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
                autoFocus
              />
              <button
                onClick={createProject}
                className="rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
              >
                Create
              </button>
              <button
                onClick={() => { setShowCreate(false); setTemplateId(''); }}
                className="rounded-lg border border-[var(--border-color)] px-4 py-2.5 text-sm hover:bg-[var(--bg-tertiary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Project Grid */}
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-color)] p-12 text-center">
            <p className="text-[var(--text-secondary)]">No projects yet. Create your first project to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => router.push(`/studio/${project.id}`)}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 text-left transition-colors hover:border-[var(--accent)]"
              >
                <h3 className="font-medium">{project.name}</h3>
                {project.description && (
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{project.description}</p>
                )}
                {project.parentProjectId && (
                  <span className="mt-2 inline-block rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-xs text-[var(--accent)]">
                    Forked
                  </span>
                )}
                <p className="mt-3 text-xs text-[var(--text-secondary)]">
                  {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
