import { Video, Volume2, Image } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/* ── Parameter field types ──────────────────────── */

export interface TextareaParam {
  type: 'textarea';
  label: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  rows?: number;
}

export interface SliderParam {
  type: 'slider';
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export interface SelectParam {
  type: 'select';
  label: string;
  options: { value: string; label: string }[];
  default: string;
}

export interface VariationsParam {
  type: 'variations';
  label: string;
  min: number;
  max: number;
  default: number;
}

export type ModelParam = TextareaParam | SliderParam | SelectParam | VariationsParam;

/* ── Model definition ───────────────────────────── */

export interface ModelDef {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  icon: LucideIcon;
  description: string;
  cost: number;
  /** Ordered map of param key → field config. Keys map to API request fields. */
  params: Record<string, ModelParam>;
}

/* ── Shared option sets ─────────────────────────── */

const VIDEO_ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 (1280×720)' },
  { value: '9:16', label: '9:16 (720×1280)' },
  { value: '1:1', label: '1:1 (720×720)' },
  { value: '4:3', label: '4:3 (960×720)' },
  { value: '3:4', label: '3:4 (720×960)' },
];

const IMAGE_ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 (1024×1024)' },
  { value: '16:9', label: '16:9 (1344×768)' },
  { value: '9:16', label: '9:16 (768×1344)' },
  { value: '4:3', label: '4:3 (1152×896)' },
  { value: '3:4', label: '3:4 (896×1152)' },
];

const VOICE_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'narrator', label: 'Narrator' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'dramatic', label: 'Dramatic' },
];

/* ── Registry ───────────────────────────────────── */

export const MODEL_REGISTRY: Record<string, ModelDef> = {
  /* ── Video models ──────────────────────── */
  'ltx-video': {
    id: 'ltx-video',
    name: 'LTX-2 Video',
    type: 'video',
    icon: Video,
    description: 'Fast video generation with high coherence',
    cost: 25,
    params: {
      prompt: {
        type: 'textarea',
        label: 'Prompt',
        placeholder: 'Describe the visual for your video clip...',
        required: true,
        maxLength: 2000,
        rows: 4,
      },
      aspectRatio: {
        type: 'select',
        label: 'Aspect Ratio',
        options: VIDEO_ASPECT_RATIOS,
        default: '16:9',
      },
      duration: {
        type: 'slider',
        label: 'Duration',
        min: 1,
        max: 10,
        step: 1,
        default: 5,
        unit: 's',
      },
      variations: {
        type: 'variations',
        label: 'Variations',
        min: 1,
        max: 4,
        default: 1,
      },
    },
  },

  'wan-video': {
    id: 'wan-video',
    name: 'Wan 2.1',
    type: 'video',
    icon: Video,
    description: 'Cinematic quality video with fine detail',
    cost: 35,
    params: {
      prompt: {
        type: 'textarea',
        label: 'Prompt',
        placeholder: 'Describe a cinematic scene...',
        required: true,
        maxLength: 2000,
        rows: 4,
      },
      aspectRatio: {
        type: 'select',
        label: 'Aspect Ratio',
        options: VIDEO_ASPECT_RATIOS,
        default: '16:9',
      },
      duration: {
        type: 'slider',
        label: 'Duration',
        min: 2,
        max: 8,
        step: 1,
        default: 4,
        unit: 's',
      },
      variations: {
        type: 'variations',
        label: 'Variations',
        min: 1,
        max: 4,
        default: 1,
      },
    },
  },

  'kling-video': {
    id: 'kling-video',
    name: 'Kling 1.6',
    type: 'video',
    icon: Video,
    description: 'Motion-rich video with strong dynamics',
    cost: 30,
    params: {
      prompt: {
        type: 'textarea',
        label: 'Prompt',
        placeholder: 'Describe an action-packed scene...',
        required: true,
        maxLength: 2000,
        rows: 4,
      },
      aspectRatio: {
        type: 'select',
        label: 'Aspect Ratio',
        options: VIDEO_ASPECT_RATIOS,
        default: '16:9',
      },
      duration: {
        type: 'slider',
        label: 'Duration',
        min: 2,
        max: 10,
        step: 1,
        default: 5,
        unit: 's',
      },
      variations: {
        type: 'variations',
        label: 'Variations',
        min: 1,
        max: 4,
        default: 1,
      },
    },
  },

  /* ── Image models ──────────────────────── */
  'flux-image': {
    id: 'flux-image',
    name: 'Flux 1.1 Pro',
    type: 'image',
    icon: Image,
    description: 'Photorealistic image generation',
    cost: 10,
    params: {
      prompt: {
        type: 'textarea',
        label: 'Prompt',
        placeholder: 'Describe the image you want to create...',
        required: true,
        maxLength: 2000,
        rows: 4,
      },
      aspectRatio: {
        type: 'select',
        label: 'Aspect Ratio',
        options: IMAGE_ASPECT_RATIOS,
        default: '1:1',
      },
      variations: {
        type: 'variations',
        label: 'Variations',
        min: 1,
        max: 4,
        default: 1,
      },
    },
  },

  'sdxl-image': {
    id: 'sdxl-image',
    name: 'SDXL Turbo',
    type: 'image',
    icon: Image,
    description: 'Fast stylized image generation',
    cost: 5,
    params: {
      prompt: {
        type: 'textarea',
        label: 'Prompt',
        placeholder: 'Describe an artistic image...',
        required: true,
        maxLength: 2000,
        rows: 4,
      },
      aspectRatio: {
        type: 'select',
        label: 'Aspect Ratio',
        options: IMAGE_ASPECT_RATIOS,
        default: '1:1',
      },
      variations: {
        type: 'variations',
        label: 'Variations',
        min: 1,
        max: 4,
        default: 1,
      },
    },
  },

  /* ── Audio models ──────────────────────── */
  'tts-default': {
    id: 'tts-default',
    name: 'Text to Speech',
    type: 'audio',
    icon: Volume2,
    description: 'Generate natural speech from text',
    cost: 5,
    params: {
      text: {
        type: 'textarea',
        label: 'Text',
        placeholder: 'Enter text for speech generation...',
        required: true,
        maxLength: 5000,
        rows: 4,
      },
      voice: {
        type: 'select',
        label: 'Voice',
        options: VOICE_OPTIONS,
        default: 'default',
      },
      speed: {
        type: 'slider',
        label: 'Speed',
        min: 0.5,
        max: 2.0,
        step: 0.1,
        default: 1.0,
        unit: 'x',
      },
      variations: {
        type: 'variations',
        label: 'Variations',
        min: 1,
        max: 4,
        default: 1,
      },
    },
  },

  'sfx-gen': {
    id: 'sfx-gen',
    name: 'SFX Generator',
    type: 'audio',
    icon: Volume2,
    description: 'Generate sound effects from descriptions',
    cost: 8,
    params: {
      text: {
        type: 'textarea',
        label: 'Description',
        placeholder: 'Describe the sound effect...',
        required: true,
        maxLength: 1000,
        rows: 3,
      },
      duration: {
        type: 'slider',
        label: 'Duration',
        min: 1,
        max: 15,
        step: 1,
        default: 5,
        unit: 's',
      },
      variations: {
        type: 'variations',
        label: 'Variations',
        min: 1,
        max: 4,
        default: 1,
      },
    },
  },

  'music-gen': {
    id: 'music-gen',
    name: 'Music Gen',
    type: 'audio',
    icon: Volume2,
    description: 'Generate background music from a prompt',
    cost: 15,
    params: {
      text: {
        type: 'textarea',
        label: 'Prompt',
        placeholder: 'Describe the mood and style of music...',
        required: true,
        maxLength: 2000,
        rows: 4,
      },
      duration: {
        type: 'slider',
        label: 'Duration',
        min: 5,
        max: 60,
        step: 5,
        default: 15,
        unit: 's',
      },
      variations: {
        type: 'variations',
        label: 'Variations',
        min: 1,
        max: 4,
        default: 1,
      },
    },
  },
};

/* ── Helpers ─────────────────────────────────────── */

export const MODEL_LIST = Object.values(MODEL_REGISTRY);
export const DEFAULT_MODEL_ID = 'ltx-video';

/** Get models grouped by type for the picker UI */
export function getModelsByType(): { type: string; label: string; models: ModelDef[] }[] {
  const groups: Record<string, ModelDef[]> = {};
  for (const model of MODEL_LIST) {
    if (!groups[model.type]) groups[model.type] = [];
    groups[model.type].push(model);
  }
  const typeLabels: Record<string, string> = { video: 'Video', image: 'Image', audio: 'Audio' };
  const typeOrder = ['video', 'image', 'audio'];
  return typeOrder
    .filter((t) => groups[t])
    .map((t) => ({ type: t, label: typeLabels[t] || t, models: groups[t] }));
}

/** Get the default param values for a model */
export function getDefaultValues(model: ModelDef): Record<string, any> {
  const defaults: Record<string, any> = {};
  for (const [key, param] of Object.entries(model.params)) {
    if (param.type === 'textarea') {
      defaults[key] = '';
    } else if ('default' in param) {
      defaults[key] = param.default;
    }
  }
  return defaults;
}
