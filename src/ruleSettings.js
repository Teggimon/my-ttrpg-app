export const DEFAULT_RULE_SETTINGS = {
  rulesEdition: '2014',
  encumbranceMode: 'disabled',
  attunementLimit: 3,
  spellComponents: 'all',
  concentrationMode: 'raw',
  cantripScaling: 'character',
  hitDiceRecovery: 'all',
  longRestHpRecovery: 'full',
  longRestDuration: '8h',
  shortRestDuration: '1h',
  shortRestsPerLongRest: 2,
  levellingSystem: 'xp',
  multiclassing: 'enabled',
}

export const RULES_EDITION_OPTIONS = [
  {
    value: '2014',
    label: 'D&D 5e (2014)',
    sub: "Player's Handbook 2014 rules",
    system: 'dnd5e-2014',
    available: true,
  },
  {
    value: '2024',
    label: 'D&D 5.5e (2024)',
    sub: "Player's Handbook 2024 rules",
    system: 'dnd5e-2024',
    available: false,
    unavailableLabel: 'Coming later',
  },
]

export function normalizeRulesEdition(value) {
  return RULES_EDITION_OPTIONS.some(option => option.value === value) ? value : DEFAULT_RULE_SETTINGS.rulesEdition
}

export function isRulesEditionAvailable(value) {
  return RULES_EDITION_OPTIONS.find(option => option.value === normalizeRulesEdition(value))?.available !== false
}

export function normalizeAvailableRulesEdition(value) {
  const normalized = normalizeRulesEdition(value)
  return isRulesEditionAvailable(normalized) ? normalized : DEFAULT_RULE_SETTINGS.rulesEdition
}

export function rulesSystemForEdition(value) {
  return RULES_EDITION_OPTIONS.find(option => option.value === normalizeRulesEdition(value))?.system ?? 'dnd5e'
}

export const RULE_GROUPS = [
  {
    title: 'Rules System',
    rules: [
      {
        type: 'choice',
        key: 'rulesEdition',
        label: 'Rules edition',
        note: 'Used by character creation and rules-specific feature handling.',
        options: RULES_EDITION_OPTIONS.map(({ value, label, sub }) => ({ value, label, sub })),
      },
    ],
  },
  {
    title: 'Encumbrance & Equipment',
    rules: [
      {
        type: 'choice',
        key: 'encumbranceMode',
        label: 'Encumbrance',
        note: 'Hooked up in Gear. Basic and variant are currently tracked with STR x 15 until variant thresholds are added.',
        options: [
          { value: 'disabled', label: 'Disabled', sub: 'Table default' },
          { value: 'basic', label: 'Basic', sub: 'Track weight' },
          { value: 'variant', label: 'Variant', sub: 'STR x 15' },
        ],
      },
      {
        type: 'number',
        key: 'attunementLimit',
        label: 'Attunement limit',
        min: 0,
        note: 'Hooked up in Gear attunement.',
      },
    ],
  },
  {
    title: 'Spellcasting',
    rules: [
      {
        type: 'choice',
        key: 'spellComponents',
        label: 'Spell components',
        note: 'Stored for now. Needs spell component display/enforcement pass.',
        options: [
          { value: 'all', label: 'All required', sub: 'RAW' },
          { value: 'ignore-material', label: 'Ignore material' },
          { value: 'ignore-non-costly', label: 'Ignore non-costly' },
        ],
      },
      {
        type: 'choice',
        key: 'concentrationMode',
        label: 'Concentration',
        note: 'Combat casting starts concentration. RAW replaces the previous concentration spell; no-limit mode keeps the existing one.',
        options: [
          { value: 'raw', label: 'RAW' },
          { value: 'none', label: 'No limit', sub: 'High magic' },
        ],
      },
      {
        type: 'choice',
        key: 'cantripScaling',
        label: 'Cantrip scaling',
        note: 'Stored for now. Needs spell damage scaling pass.',
        options: [
          { value: 'character', label: 'Character level', sub: 'RAW' },
          { value: 'class', label: 'Class level' },
        ],
      },
    ],
  },
  {
    title: 'Resting',
    rules: [
      {
        type: 'choice',
        key: 'hitDiceRecovery',
        label: 'Hit Dice recovery on long rest',
        note: 'Hooked up in Long Rest.',
        options: [
          { value: 'half', label: 'Half total', sub: 'RAW' },
          { value: 'all', label: 'All HD' },
          { value: 'none', label: 'None' },
        ],
      },
      {
        type: 'choice',
        key: 'longRestHpRecovery',
        label: 'HP recovery on long rest',
        note: 'Hooked up in Long Rest.',
        options: [
          { value: 'full', label: 'Full', sub: 'RAW' },
          { value: 'hit-dice', label: 'Only via HD spend' },
        ],
      },
      {
        type: 'choice',
        key: 'longRestDuration',
        label: 'Long rest duration',
        note: 'Stored for now. Needs scheduling/session time behavior.',
        options: [
          { value: '8h', label: '8 hours', sub: 'RAW' },
          { value: '24h', label: '24 hours', sub: 'Gritty' },
        ],
      },
      {
        type: 'choice',
        key: 'shortRestDuration',
        label: 'Short rest duration',
        note: 'Stored for now. Needs session timer behavior.',
        options: [
          { value: '1h', label: '1 hour', sub: 'RAW' },
          { value: '5m', label: '5 minutes', sub: 'Heroic' },
        ],
      },
      {
        type: 'number',
        key: 'shortRestsPerLongRest',
        label: 'Short rests per long rest',
        min: 0,
        note: 'Stored for now. Needs rest counter enforcement.',
      },
    ],
  },
  {
    title: 'Progression',
    rules: [
      {
        type: 'choice',
        key: 'levellingSystem',
        label: 'Levelling system',
        note: 'Hooked up to automatic XP level-up prompts.',
        options: [
          { value: 'xp', label: 'XP', sub: 'RAW' },
          { value: 'milestone', label: 'Milestone' },
        ],
      },
      {
        type: 'choice',
        key: 'multiclassing',
        label: 'Multiclassing',
        note: 'Stored for now. Needs level-up class-choice enforcement.',
        options: [
          { value: 'enabled', label: 'Enabled', sub: 'RAW' },
          { value: 'disabled', label: 'Disabled' },
        ],
      },
    ],
  },
]

export function normalizeRuleSettings(settings = {}) {
  const levellingSystem = settings.levellingSystem ?? (settings.milestoneMode ? 'milestone' : 'xp')
  const encumbranceMode = settings.encumbranceMode ?? (settings.encumbranceTracking ? 'variant' : 'disabled')
  const rulesEdition = normalizeRulesEdition(settings.rulesEdition ?? settings.edition)
  return {
    ...DEFAULT_RULE_SETTINGS,
    ...settings,
    rulesEdition,
    levellingSystem,
    encumbranceMode,
    attunementLimit: settings.attunementLimit ?? DEFAULT_RULE_SETTINGS.attunementLimit,
    shortRestsPerLongRest: settings.shortRestsPerLongRest ?? DEFAULT_RULE_SETTINGS.shortRestsPerLongRest,
  }
}

export function patchForRuleSetting(key, value) {
  if (key === 'encumbranceMode') {
    return { encumbranceMode: value, encumbranceTracking: value !== 'disabled' }
  }
  if (key === 'levellingSystem') {
    return { levellingSystem: value, milestoneMode: value === 'milestone' }
  }
  return { [key]: value }
}
