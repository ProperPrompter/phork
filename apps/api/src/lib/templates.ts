import type { TemplateDefinition } from '@phork/shared';

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'forkable-short',
    name: 'Forkable Short',
    description: 'A 3-shot short-form video template optimized for forking',
    defaultAspectRatio: '9:16',
    shots: [
      { shot_id: 'shot-001', duration_ms: 3000, subtitle: null, label: 'Opening Hook' },
      { shot_id: 'shot-002', duration_ms: 5000, subtitle: null, label: 'Main Content' },
      { shot_id: 'shot-003', duration_ms: 2000, subtitle: null, label: 'Call to Action' },
    ],
  },
  {
    id: 'episode-starter',
    name: 'Episode Starter',
    description: 'An 8-shot episodic template for longer-form content',
    defaultAspectRatio: '16:9',
    shots: [
      { shot_id: 'shot-001', duration_ms: 4000, subtitle: null, label: 'Cold Open' },
      { shot_id: 'shot-002', duration_ms: 3000, subtitle: null, label: 'Title Card' },
      { shot_id: 'shot-003', duration_ms: 5000, subtitle: null, label: 'Setup' },
      { shot_id: 'shot-004', duration_ms: 5000, subtitle: null, label: 'Rising Action 1' },
      { shot_id: 'shot-005', duration_ms: 5000, subtitle: null, label: 'Rising Action 2' },
      { shot_id: 'shot-006', duration_ms: 6000, subtitle: null, label: 'Climax' },
      { shot_id: 'shot-007', duration_ms: 4000, subtitle: null, label: 'Resolution' },
      { shot_id: 'shot-008', duration_ms: 3000, subtitle: null, label: 'Outro' },
    ],
  },
];

export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
