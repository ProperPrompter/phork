// Basic safety policy for Phase 1
// This uses keyword matching. Replace with ML-based classification later.

interface SafetyResult {
  blocked: boolean;
  category?: string;
  entity?: string;
  reason?: string;
  warnings?: string[];
}

// Blocked entity categories (Phase 1: basic keyword policy)
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; category: string; reason: string }> = [
  // Real person likeness (celebrities, politicians, etc.)
  {
    pattern: /\b(deepfake|face\s*swap)\b/i,
    category: 'deepfake_attempt',
    reason: 'Deepfake or face swap content is not allowed',
  },
  // Explicit violence
  {
    pattern: /\b(gore|mutilat|dismember|torture)\b/i,
    category: 'extreme_violence',
    reason: 'Extreme violence content is not allowed',
  },
  // CSAM
  {
    pattern: /\b(child|minor|underage)\b.*\b(nude|naked|sexual|explicit)\b/i,
    category: 'csam',
    reason: 'Content involving minors in sexual contexts is strictly prohibited',
  },
];

// Warning patterns (logged but not blocked)
const WARNING_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(weapon|gun|knife|bomb)\b/i, category: 'weapon_reference' },
  { pattern: /\b(blood|violent|fight)\b/i, category: 'violence_reference' },
];

export async function checkSafety(prompt: string): Promise<SafetyResult> {
  const warnings: string[] = [];

  // Check blocked patterns
  for (const rule of BLOCKED_PATTERNS) {
    if (rule.pattern.test(prompt)) {
      return {
        blocked: true,
        category: rule.category,
        reason: rule.reason,
      };
    }
  }

  // Check warning patterns
  for (const rule of WARNING_PATTERNS) {
    if (rule.pattern.test(prompt)) {
      warnings.push(rule.category);
    }
  }

  return {
    blocked: false,
    warnings,
  };
}
