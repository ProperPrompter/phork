'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Square, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { pollJob } from '@/lib/pollJob';
import { useStudioStore, computeFeedKey } from '@/stores/studio';
import {
  MODEL_REGISTRY, MODEL_LIST, getDefaultValues, getModelsByType,
  type ModelDef, type ModelParam,
} from '@/lib/modelRegistry';

interface GeneratePanelProps {
  projectId: string;
  workspaceId: string;
  onCreditsChange: () => void;
  onGenerated: () => void;
}

/* ── Param input renderers ─────────────────────── */

function ParamTextarea({
  param,
  value,
  onChange,
}: {
  param: Extract<ModelParam, { type: 'textarea' }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        {param.label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={param.placeholder}
        rows={param.rows || 4}
        maxLength={param.maxLength}
        className="w-full resize-none rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors focus:border-[var(--accent)] placeholder:text-[var(--text-muted)]"
      />
    </div>
  );
}

function ParamSlider({
  param,
  value,
  onChange,
}: {
  param: Extract<ModelParam, { type: 'slider' }>;
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - param.min) / (param.max - param.min)) * 100;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          {param.label}
        </label>
        <span className="text-xs font-medium text-[var(--text-primary)]">
          {param.step < 1 ? value.toFixed(1) : value}{param.unit || ''}
        </span>
      </div>
      <div className="relative h-6 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-[var(--bg-elevated)]" />
        <div
          className="absolute left-0 h-1.5 rounded-full"
          style={{ width: `${pct}%`, background: 'var(--accent)' }}
        />
        <input
          type="range"
          min={param.min}
          max={param.max}
          step={param.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative z-10 h-6 w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-[var(--accent)] [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
        />
      </div>
    </div>
  );
}

function ParamSelect({
  param,
  value,
  onChange,
}: {
  param: Extract<ModelParam, { type: 'select' }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        {param.label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent)]"
      >
        {param.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function ParamVariations({
  param,
  value,
  onChange,
}: {
  param: Extract<ModelParam, { type: 'variations' }>;
  value: number;
  onChange: (v: number) => void;
}) {
  const options = Array.from(
    { length: param.max - param.min + 1 },
    (_, i) => param.min + i,
  );

  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        {param.label}
      </label>
      <div className="flex gap-2">
        {options.map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`flex h-9 w-12 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
              value === n
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Main panel ────────────────────────────────── */

export function GeneratePanel({ projectId, workspaceId, onCreditsChange, onGenerated }: GeneratePanelProps) {
  const { selectedModel, setSelectedModel, addJob, updateJob, restoreFormValues, setRestoreFormValues } = useStudioStore();
  const model = MODEL_REGISTRY[selectedModel] || MODEL_LIST[0];

  const [values, setValues] = useState<Record<string, any>>(() => getDefaultValues(model));
  const [generating, setGenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const skipResetRef = useRef(false);

  // Consume restoreFormValues from store (retry button)
  useEffect(() => {
    if (restoreFormValues) {
      skipResetRef.current = true;
      if (restoreFormValues.modelId !== selectedModel) {
        setSelectedModel(restoreFormValues.modelId);
      }
      setValues(restoreFormValues.values);
      setRestoreFormValues(null);
    }
  }, [restoreFormValues]);

  // Reset form values when model changes (skip if restoring)
  useEffect(() => {
    if (skipResetRef.current) {
      skipResetRef.current = false;
      return;
    }
    setValues(getDefaultValues(model));
  }, [model.id]);

  // Close model picker on outside click
  useEffect(() => {
    if (!showModelPicker) return;
    const handler = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModelPicker]);

  const setValue = useCallback((key: string, v: any) => {
    setValues((prev) => ({ ...prev, [key]: v }));
  }, []);

  // Get the primary text field (prompt or text)
  const textKey = Object.entries(model.params).find(
    ([, p]) => p.type === 'textarea',
  )?.[0];
  const textValue = textKey ? ((values[textKey] as string) || '').trim() : '';
  const canGenerate = !generating && textValue.length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);

    const variations = (values.variations as number) || 1;
    const feedKey = computeFeedKey(model.id, textValue, values);
    const paramSnapshot = { ...values };

    try {
      for (let i = 0; i < variations; i++) {
        const jobEntry: import('@/stores/studio').GenerationJob = {
          id: '',
          type: model.type,
          modelId: model.id,
          status: 'queued' as const,
          prompt: textValue,
          assetId: null,
          feedKey,
          paramSnapshot,
          variationIndex: i,
          createdAt: Date.now(),
          completedAt: null,
        };

        // Build API payload based on model type
        let jobRes: any;
        if (model.type === 'video') {
          jobRes = await api.post('/jobs/gen-video', {
            projectId,
            workspaceId,
            prompt: textValue,
            duration: (values.duration || 5) * 1000,
            aspectRatio: values.aspectRatio || '16:9',
          });
        } else if (model.type === 'audio') {
          jobRes = await api.post('/jobs/gen-audio', {
            projectId,
            workspaceId,
            text: textValue,
            voice: values.voice || 'default',
            speed: values.speed || 1.0,
          });
        }

        if (!jobRes) continue;

        jobEntry.id = jobRes.id;
        addJob(jobEntry);

        // Fire-and-forget polling for each variation
        pollJob(jobRes.id)
          .then((result) => {
            updateJob(jobRes.id, {
              status: 'succeeded',
              assetId: result?.result?.assetId || null,
              completedAt: Date.now(),
            });
            onGenerated();
            onCreditsChange();
          })
          .catch((err: any) => {
            const isBlocked = err?.message?.includes('blocked');
            updateJob(jobRes.id, {
              status: isBlocked ? 'blocked' : 'failed',
              completedAt: Date.now(),
            });
          });
      }
    } catch (err: any) {
      console.error('Generation failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  const Icon = model.icon;

  return (
    <div className="flex h-full w-[380px] flex-shrink-0 flex-col border-r border-[var(--border-color)] bg-[var(--bg-secondary)]">
      {/* ── Header — clickable model selector ── */}
      <div className="relative flex-shrink-0 border-b border-[var(--border-color)]" ref={modelPickerRef}>
        <button
          onClick={() => setShowModelPicker(!showModelPicker)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{model.name}</h3>
            <p className="text-[10px] text-[var(--text-muted)]">{model.cost} credits per generation</p>
          </div>
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `var(--type-${model.type}-subtle)`, color: `var(--type-${model.type})` }}
          >
            <Icon size={16} />
          </div>
          <ChevronDown size={14} className="flex-shrink-0 text-[var(--text-muted)]" />
        </button>

        {/* Model picker dropdown */}
        {showModelPicker && (
          <div className="absolute left-0 right-0 top-full z-50 max-h-[60vh] overflow-y-auto border-b border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-lg">
            {getModelsByType().map((group) => (
              <div key={group.type}>
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {group.label}
                </div>
                {group.models.map((m) => {
                  const MIcon = m.icon;
                  const isActive = m.id === model.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(m.id);
                        setShowModelPicker(false);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-[10px] text-[var(--text-muted)]">{m.description}</div>
                      </div>
                      <MIcon size={16} className="flex-shrink-0 text-[var(--text-muted)]" />
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Scrollable form body ────────────── */}
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {Object.entries(model.params).map(([key, param]) => {
          if (key === 'variations') return null; // rendered separately below
          switch (param.type) {
            case 'textarea':
              return (
                <ParamTextarea
                  key={key}
                  param={param}
                  value={(values[key] as string) || ''}
                  onChange={(v) => setValue(key, v)}
                />
              );
            case 'slider':
              return (
                <ParamSlider
                  key={key}
                  param={param}
                  value={(values[key] as number) ?? param.default}
                  onChange={(v) => setValue(key, v)}
                />
              );
            case 'select':
              return (
                <ParamSelect
                  key={key}
                  param={param}
                  value={(values[key] as string) || param.default}
                  onChange={(v) => setValue(key, v)}
                />
              );
            default:
              return null;
          }
        })}

        {/* Variations (always rendered after other params) */}
        {model.params.variations && (
          <ParamVariations
            param={model.params.variations as Extract<ModelParam, { type: 'variations' }>}
            value={(values.variations as number) ?? 1}
            onChange={(v) => setValue('variations', v)}
          />
        )}

        {/* Advanced (collapsible placeholder) */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center gap-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Advanced
        </button>
        {showAdvanced && (
          <div className="rounded-lg border border-dashed border-[var(--border-color)] p-4 text-center text-xs text-[var(--text-muted)]">
            Advanced settings coming soon
          </div>
        )}
      </div>

      {/* ── Footer: Generate button ──────────── */}
      <div className="flex-shrink-0 border-t border-[var(--border-color)] p-4">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:opacity-40"
          style={{ background: canGenerate ? 'var(--accent)' : 'var(--bg-elevated)' }}
        >
          {generating ? (
            <>
              <Square size={14} className="fill-current" />
              Generating...
            </>
          ) : (
            'Generate'
          )}
        </button>
      </div>
    </div>
  );
}
