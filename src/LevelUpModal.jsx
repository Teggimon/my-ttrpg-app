import { useState, useMemo, useEffect } from 'react'
import { getClasses, getOptionalFeatures, getSpells } from './srdContent'
import './LevelUpModal.css'

// ── D&D 5e data ───────────────────────────────────────────────

const HIT_DICE = {
  barbarian: 12, fighter: 10, paladin: 10, ranger: 10,
  monk: 8, bard: 8, cleric: 8, druid: 8, rogue: 8, warlock: 8,
  artificer: 8, wizard: 6, sorcerer: 6,
}

const PROF_BONUS = [2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6]

const XP_THRESHOLDS = [0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000]

const MULTICLASS_PREREQS = {
  barbarian: { str: 13 },
  bard: { cha: 13 },
  cleric: { wis: 13 },
  druid: { wis: 13 },
  fighter: { strOrDex: 13 },
  monk: { dex: 13, wis: 13 },
  paladin: { str: 13, cha: 13 },
  ranger: { dex: 13, wis: 13 },
  rogue: { dex: 13 },
  sorcerer: { cha: 13 },
  warlock: { cha: 13 },
  wizard: { int: 13 },
  artificer: { int: 13 },
}

const MULTICLASS_PROFICIENCIES = {
  barbarian: { Armour: ['Shield proficiency'], Weapons: ['Simple weapon proficiency', 'Martial weapon proficiency'] },
  bard: { Armour: ['Light armor proficiency'] },
  cleric: { Armour: ['Light armor proficiency', 'Medium armor proficiency', 'Shield proficiency'] },
  druid: { Armour: ['Light armor proficiency', 'Medium armor proficiency', 'Shield proficiency'] },
  fighter: { Armour: ['Light armor proficiency', 'Medium armor proficiency', 'Shield proficiency'], Weapons: ['Simple weapon proficiency', 'Martial weapon proficiency'] },
  monk: { Weapons: ['Simple weapon proficiency', 'Shortsword proficiency'] },
  paladin: { Armour: ['Light armor proficiency', 'Medium armor proficiency', 'Shield proficiency'], Weapons: ['Simple weapon proficiency', 'Martial weapon proficiency'] },
  ranger: { Armour: ['Light armor proficiency', 'Medium armor proficiency', 'Shield proficiency'], Weapons: ['Simple weapon proficiency', 'Martial weapon proficiency'] },
  rogue: { Armour: ['Light armor proficiency'], Tools: ["Thieves' tools"] },
  warlock: { Armour: ['Light armor proficiency'], Weapons: ['Simple weapon proficiency'] },
  artificer: { Armour: ['Light armor proficiency', 'Medium armor proficiency', 'Shield proficiency'], Tools: ["Thieves' tools", "Tinker's tools"] },
}

const MULTICLASS_SKILL_CHOICES = {
  bard: { choose: 1, mode: 'proficiency', title: 'Bard Multiclass Skill', desc: 'Choose one skill proficiency from multiclassing into Bard.' },
  ranger: { choose: 1, mode: 'proficiency', title: 'Ranger Multiclass Skill', desc: 'Choose one skill from the Ranger class skill list.' },
  rogue: { choose: 1, mode: 'proficiency', title: 'Rogue Multiclass Skill', desc: 'Choose one skill from the Rogue class skill list.' },
  artificer: { choose: 1, mode: 'proficiency', title: 'Artificer Multiclass Skill', desc: 'Choose one skill from the Artificer class skill list.' },
}

// ASI levels per class
const ASI_LEVELS = {
  barbarian: [4,8,12,16,19],
  bard:      [4,8,12,16,19],
  cleric:    [4,8,12,16,19],
  druid:     [4,8,12,16,19],
  fighter:   [4,6,8,12,14,16,19],
  monk:      [4,8,12,16,19],
  paladin:   [4,8,12,16,19],
  ranger:    [4,8,12,16,19],
  rogue:     [4,8,10,12,16,19],
  sorcerer:  [4,8,12,16,19],
  warlock:   [4,8,12,16,19],
  wizard:    [4,8,12,16,19],
  artificer: [4,8,12,16,19],
}

// Subclass pick levels per class
export const SUBCLASS_LEVELS = {
  barbarian: [3], bard: [3], cleric: [1], druid: [2],
  fighter: [3], monk: [3], paladin: [3], ranger: [3],
  rogue: [3], sorcerer: [1], warlock: [1], wizard: [2],
  artificer: [3],
}

// Subclass options (condensed SRD set)
export const SUBCLASSES = {
  fighter:   ['Champion','Battle Master','Eldritch Knight'],
  wizard:    ['Evocation','Abjuration','Divination','Illusion','Necromancy','Conjuration','Transmutation','Enchantment'],
  rogue:     ['Thief','Assassin','Arcane Trickster'],
  ranger:    ['Hunter','Beast Master'],
  cleric:    ['Life','Light','Nature','Tempest','Trickery','War','Knowledge'],
  paladin:   ['Devotion','Ancients','Vengeance','Oathbreaker'],
  druid:     ['Land','Moon','Dreams','Shepherd'],
  bard:      ['Lore','Valor','Glamour','Swords','Whispers'],
  barbarian: ['Berserker','Totem Warrior','Ancestral Guardian','Storm Herald','Zealot'],
  monk:      ['Open Hand','Shadow','Four Elements'],
  sorcerer:  ['Draconic Bloodline','Wild Magic','Storm Sorcery','Shadow Magic'],
  warlock:   ['Archfey','Fiend','Great Old One','Celestial','Hexblade'],
  artificer: ['Alchemist','Armorer','Artillerist','Battle Smith'],
}

// SRD feats (expanded from SRD + common PHB ones)
export const FEATS = [
  { name: 'Alert',              prereq: null,            desc: 'Always on the lookout for danger. +5 initiative, can\'t be surprised while conscious, hidden creatures don\'t get advantage against you.' },
  { name: 'Athlete',            prereq: 'STR or DEX 13', desc: '+1 STR or DEX. Climb speed equals walk speed. Standing from prone costs 5ft. Long/high jump distance doesn\'t require running start.' },
  { name: 'Actor',              prereq: null,            desc: '+1 CHA. Mimic speech of a person or sounds of a creature. Advantage on Deception and Performance when impersonating.' },
  { name: 'Charger',            prereq: null,            desc: 'After Dashing, can bonus action melee attack or shove (+5 damage or 10ft push if you moved 10+ ft in straight line).' },
  { name: 'Crossbow Expert',    prereq: null,            desc: 'Ignore loading. No disadvantage within 5ft. When attacking with one-handed weapon, bonus action attack with hand crossbow.' },
  { name: 'Defensive Duelist',  prereq: 'DEX 13',        desc: 'When attacked while holding a finesse weapon, use reaction to add proficiency bonus to AC against that attack.' },
  { name: 'Dual Wielder',       prereq: null,            desc: '+1 AC while wielding two melee weapons. Use two-weapon fighting without light weapons. Draw/stow two weapons per turn.' },
  { name: 'Dungeon Delver',     prereq: null,            desc: 'Advantage to detect secret doors. Advantage on saves vs traps, resistance to trap damage. Search for traps at normal pace.' },
  { name: 'Durable',            prereq: null,            desc: '+1 CON. Minimum roll on Hit Dice equals twice CON modifier.' },
  { name: 'Elemental Adept',    prereq: 'Spellcasting',  desc: 'Choose a damage type. Spells ignore resistance to that type. Treat 1s as 2s when rolling that damage type.' },
  { name: 'Grappler',           prereq: 'STR 13',        desc: 'Advantage on attacks against creatures you are grappling. Can try to pin a grappled creature (both Restrained on success).' },
  { name: 'Great Weapon Master', prereq: null,           desc: 'On critical hit or reducing to 0 HP with heavy weapon, bonus action melee attack. Can take -5 to hit for +10 damage.' },
  { name: 'Healer',             prereq: null,            desc: 'Non-magical healing kit stabilises at 1 HP. Use healer\'s kit as action to restore 1d6+4+max HD HP. One use per creature per rest.' },
  { name: 'Heavily Armoured',   prereq: 'Medium Armour', desc: '+1 STR. Gain heavy armour proficiency.' },
  { name: 'Heavy Armour Master', prereq: 'Heavy Armour', desc: '+1 STR. While in heavy armour, nonmagical bludgeoning/piercing/slashing damage reduced by 3.' },
  { name: 'Inspiring Leader',   prereq: 'CHA 13',        desc: '10-min speech gives up to 6 creatures temp HP equal to level + CHA modifier.' },
  { name: 'Keen Mind',          prereq: null,            desc: '+1 INT. Always know north. Know hours since sunrise/sunset. Accurately recall anything seen/heard in past month.' },
  { name: 'Lightly Armoured',   prereq: null,            desc: '+1 STR or DEX. Gain light armour proficiency.' },
  { name: 'Lucky',              prereq: null,            desc: '3 luck points per long rest. Spend to roll an extra d20 on attack, ability check, or saving throw, choosing either result. Or force disadvantage on attacks against you.' },
  { name: 'Mage Slayer',        prereq: null,            desc: 'React to attack a spellcaster within 5ft. Spells cast within 5ft use disadvantage on concentration save. Advantage on saves vs nearby casters.' },
  { name: 'Magic Initiate',     prereq: null,            desc: 'Choose a class. Learn 2 cantrips + 1 1st-level spell from that class. Cast the spell once per long rest without a slot.' },
  { name: 'Martial Adept',      prereq: null,            desc: 'Learn 2 maneuvers (Fighter Battle Master list). Gain 1 superiority die (d6) that refreshes on a short or long rest.' },
  { name: 'Medium Armour Master', prereq: 'Medium Armour', desc: '+1 STR or DEX. No disadvantage on Stealth in medium armour. Max DEX bonus for medium armour becomes +3.' },
  { name: 'Mobile',             prereq: null,            desc: '+10ft speed. After melee attack, ignore opportunity attacks from target until end of turn. Difficult terrain doesn\'t slow Dash.' },
  { name: 'Moderately Armoured', prereq: 'Light Armour', desc: '+1 STR or DEX. Gain medium armour and shield proficiency.' },
  { name: 'Mounted Combatant',  prereq: null,            desc: 'Advantage on melee against unmounted smaller creatures. Force attacks targeting mount to target you. Mount passes Dex saves on success.' },
  { name: 'Observant',          prereq: null,            desc: '+1 INT or WIS. Read lips. +5 passive Perception and Investigation.' },
  { name: 'Polearm Master',     prereq: null,            desc: 'After polearm attack, bonus action attack with butt end (1d4 bludgeoning). Opportunity attack when creature enters your reach.' },
  { name: 'Resilient',          prereq: null,            desc: '+1 to chosen ability score. Gain proficiency in saving throws using that ability.' },
  { name: 'Ritual Caster',      prereq: 'INT or WIS 13', desc: 'Gain a ritual book with 2 rituals from your chosen class. Can add rituals found in adventures. Cast without expending a spell slot.' },
  { name: 'Savage Attacker',    prereq: null,            desc: 'Once per turn when you roll weapon damage, reroll the damage dice and use either result.' },
  { name: 'Sentinel',           prereq: null,            desc: 'Opportunity attacks reduce target speed to 0. Can make opportunity attacks on Disengage. Can react to attack creatures that attack allies within 5ft.' },
  { name: 'Sharpshooter',       prereq: null,            desc: 'Ignore cover. No disadvantage at long range. Can take -5 to hit for +10 damage.' },
  { name: 'Shield Master',      prereq: null,            desc: 'After attacking, bonus action shove. Add shield bonus to Dex saves. If you succeed a Dex save, take no damage instead of half.' },
  { name: 'Skilled',            prereq: null,            desc: 'Gain proficiency in any 3 skills or tools of your choice.' },
  { name: 'Skulker',            prereq: 'DEX 13',        desc: 'Hide when lightly obscured. Missing a ranged attack while hidden doesn\'t reveal you. Dim light doesn\'t impose disadvantage on Perception.' },
  { name: 'Spell Sniper',       prereq: 'Spellcasting',  desc: 'Double range of spells requiring attack rolls. Ignore cover. Learn 1 attack roll cantrip from any class.' },
  { name: 'Tavern Brawler',     prereq: null,            desc: '+1 STR or CON. Proficient with improvised weapons. Unarmed strike is 1d4. Grapple as bonus action after hitting with unarmed or improvised weapon.' },
  { name: 'Tough',              prereq: null,            desc: 'HP maximum increases by 2 per level (including at this level and all future levels).' },
  { name: 'War Caster',         prereq: 'Spellcasting',  desc: 'Advantage on concentration saves. Can perform somatic components with weapons/shield in hand. Cast a spell as opportunity attack.' },
  { name: 'Weapon Master',      prereq: null,            desc: '+1 STR or DEX. Gain proficiency with 4 weapons of your choice.' },
]

const ABILITY_SCORES = ['STR','DEX','CON','INT','WIS','CHA']
const ABILITY_LABEL_BY_KEY = { str:'STR', dex:'DEX', con:'CON', int:'INT', wis:'WIS', cha:'CHA' }
const DAMAGE_TYPES = ['Acid', 'Cold', 'Fire', 'Lightning', 'Thunder']
const MAGIC_INITIATE_CLASSES = ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard']
const RITUAL_CASTER_CLASSES = ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard']
const WEAPON_MASTER_OPTIONS = [
  'Battleaxe', 'Blowgun', 'Flail', 'Glaive', 'Greataxe', 'Greatsword',
  'Halberd', 'Hand Crossbow', 'Heavy Crossbow', 'Lance', 'Longbow',
  'Longsword', 'Maul', 'Morningstar', 'Net', 'Pike', 'Rapier',
  'Scimitar', 'Shortsword', 'Trident', 'War Pick', 'Warhammer', 'Whip',
]

const FEAT_RULES = {
  Alert: { initiativeBonus: 5 },
  Athlete: { abilityOptions: ['str', 'dex'], abilityIncrease: 1 },
  Actor: { abilityOptions: ['cha'], abilityIncrease: 1 },
  Durable: { abilityOptions: ['con'], abilityIncrease: 1 },
  'Heavily Armoured': { abilityOptions: ['str'], abilityIncrease: 1 },
  'Heavy Armour Master': { abilityOptions: ['str'], abilityIncrease: 1 },
  'Keen Mind': { abilityOptions: ['int'], abilityIncrease: 1 },
  'Lightly Armoured': { abilityOptions: ['str', 'dex'], abilityIncrease: 1, proficiencies: { Armour: ['Light armor proficiency'] } },
  Mobile: { speedBonus: 10 },
  'Moderately Armoured': { abilityOptions: ['str', 'dex'], abilityIncrease: 1, proficiencies: { Armour: ['Medium armor proficiency', 'Shield proficiency'] } },
  Observant: { abilityOptions: ['int', 'wis'], abilityIncrease: 1, passiveBonus: 5 },
  Resilient: { abilityOptions: ['str', 'dex', 'con', 'int', 'wis', 'cha'], abilityIncrease: 1, savingThrowChoice: true },
  'Elemental Adept': { damageTypeChoice: true },
  'Magic Initiate': { spellClassChoice: true, cantripsKnown: 2, spellsKnown: 1 },
  'Martial Adept': { maneuverChoices: 2 },
  'Ritual Caster': { ritualClassChoice: true, ritualSpellsKnown: 2 },
  Skilled: { skillProficiencies: 3 },
  'Spell Sniper': { cantripFromAnyClass: 1 },
  'Tavern Brawler': { abilityOptions: ['str', 'con'], abilityIncrease: 1 },
  Tough: { hpPerLevel: 2 },
  'Weapon Master': { abilityOptions: ['str', 'dex'], abilityIncrease: 1, weaponProficiencies: 4 },
}

function getClassIndex(cls) {
  return cls?.index ?? cls?.name?.toLowerCase?.().replace(/\s+/g, '-')
}

function characterLevel(char) {
  return (char.identity?.class ?? []).reduce((sum, cls) => sum + (cls.level ?? 0), 0) || 1
}

function abilityScore(char, key) {
  return char.stats?.abilityScores?.[key] ?? 10
}

function multiclassPrereqLabel(classIndex) {
  const req = MULTICLASS_PREREQS[classIndex]
  if (!req) return 'No prerequisite'
  if (req.strOrDex) return `STR or DEX ${req.strOrDex}`
  return Object.entries(req)
    .map(([key, value]) => `${ABILITY_LABEL_BY_KEY[key] ?? key.toUpperCase()} ${value}`)
    .join(', ')
}

function meetsClassPrereq(char, classIndex) {
  const req = MULTICLASS_PREREQS[classIndex]
  if (!req) return true
  if (req.strOrDex) return abilityScore(char, 'str') >= req.strOrDex || abilityScore(char, 'dex') >= req.strOrDex
  return Object.entries(req).every(([key, value]) => abilityScore(char, key) >= value)
}

function canMulticlassInto(char, classIndex) {
  const currentClasses = char.identity?.class ?? []
  return currentClasses.every(cls => meetsClassPrereq(char, getClassIndex(cls))) && meetsClassPrereq(char, classIndex)
}

function hasSpellcasting(char) {
  return !!char.spells?.spellcastingAbility || (char.spells?.known ?? []).length > 0 || Object.keys(char.spells?.slots ?? {}).length > 0
}

function proficiencyList(char, category) {
  const proficiencies = char.stats?.proficiencies
  if (Array.isArray(proficiencies)) return proficiencies
  if (proficiencies && typeof proficiencies === 'object') return proficiencies[category] ?? []
  return []
}

function meetsFeatPrereq(feat, char) {
  const prereq = feat.prereq
  if (!prereq) return true
  if (/spellcasting/i.test(prereq)) return hasSpellcasting(char)

  const abilityParts = String(prereq).match(/(STR|DEX|CON|INT|WIS|CHA)(?:\s+or\s+(STR|DEX|CON|INT|WIS|CHA))*\s+(\d+)/i)
  if (abilityParts) {
    const required = Number(abilityParts[3])
    const abilities = [...String(prereq).matchAll(/STR|DEX|CON|INT|WIS|CHA/gi)].map(match => match[0].toLowerCase())
    return abilities.some(key => abilityScore(char, key) >= required)
  }

  if (/light armour|light armor/i.test(prereq)) {
    return proficiencyList(char, 'Armour').some(name => /light/i.test(name))
  }
  if (/medium armour|medium armor/i.test(prereq)) {
    return proficiencyList(char, 'Armour').some(name => /medium/i.test(name))
  }
  if (/heavy armour|heavy armor/i.test(prereq)) {
    return proficiencyList(char, 'Armour').some(name => /heavy/i.test(name))
  }
  return true
}

function featRule(feat) {
  return FEAT_RULES[feat?.name] ?? {}
}

function classLabel(index) {
  return String(index ?? '')
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function spellListForClass(spells, classIndex) {
  return spells.filter(spell => spell.classes?.some(cls => cls.index === classIndex))
}

function toggleLimitedOption(current, option, max, key = 'index') {
  if (current.some(item => item[key] === option[key])) return current.filter(item => item[key] !== option[key])
  if (current.length >= max) return current
  return [...current, option]
}

// ── Spell slot tables ─────────────────────────────────────────

// Full caster slots per class level (index 0 = level 1)
const FULL_CASTER_SLOTS = [
  [2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],
  [4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],
  [4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],
  [4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],
  [4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
]

// Half caster (Paladin, Ranger) — only 5 spell levels, starts at class lv 2
const HALF_CASTER_SLOTS = [
  [0,0,0,0,0],[2,0,0,0,0],[3,0,0,0,0],[3,0,0,0,0],[4,2,0,0,0],
  [4,2,0,0,0],[4,3,0,0,0],[4,3,0,0,0],[4,3,2,0,0],[4,3,2,0,0],
  [4,3,3,0,0],[4,3,3,0,0],[4,3,3,1,0],[4,3,3,1,0],[4,3,3,2,0],
  [4,3,3,2,0],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2],
]

// Warlock Pact Magic — all slots at same slot level
const WARLOCK_PACT = [
  {lv:1,n:1},{lv:1,n:2},{lv:2,n:2},{lv:2,n:2},{lv:3,n:2},
  {lv:3,n:2},{lv:4,n:2},{lv:4,n:2},{lv:5,n:2},{lv:5,n:2},
  {lv:5,n:3},{lv:5,n:3},{lv:5,n:3},{lv:5,n:3},{lv:5,n:3},
  {lv:5,n:3},{lv:5,n:4},{lv:5,n:4},{lv:5,n:4},{lv:5,n:4},
]

const FULL_CASTERS = new Set(['bard','cleric','druid','sorcerer','wizard'])
const HALF_CASTERS = new Set(['paladin','ranger'])

const THIRD_CASTER_SLOTS = [
  [0,0,0,0],
  [0,0,0,0],
  [2,0,0,0],
  [3,0,0,0],
  [3,0,0,0],
  [3,0,0,0],
  [4,2,0,0],
  [4,2,0,0],
  [4,2,0,0],
  [4,3,0,0],
  [4,3,0,0],
  [4,3,0,0],
  [4,3,2,0],
  [4,3,2,0],
  [4,3,2,0],
  [4,3,3,0],
  [4,3,3,0],
  [4,3,3,0],
  [4,3,3,1],
  [4,3,3,1],
]

const SPELLCASTING_ABILITY = {
  bard: 'cha', cleric: 'wis', druid: 'wis', paladin: 'cha',
  ranger: 'wis', sorcerer: 'cha', warlock: 'cha', wizard: 'int',
  eldritchKnight: 'int', arcaneTrickster: 'int',
}

const SUBCLASS_SPELLCASTING = {
  'fighter:eldritch knight': {
    key: 'eldritchKnight',
    sourceClass: 'wizard',
    cantripsKnown: { 3: 2, 10: 3 },
    spellsKnown: { 3: 3, 4: 4, 7: 5, 8: 6, 10: 7, 11: 8, 13: 9, 14: 10, 16: 11, 19: 12, 20: 13 },
    spellLevels: [1],
    preferredSchools: ['Abjuration', 'Evocation'],
  },
  'rogue:arcane trickster': {
    key: 'arcaneTrickster',
    sourceClass: 'wizard',
    cantripsKnown: { 3: 3, 10: 4 },
    spellsKnown: { 3: 3, 4: 4, 7: 5, 8: 6, 10: 7, 11: 8, 13: 9, 14: 10, 16: 11, 19: 12, 20: 13 },
    spellLevels: [1],
    preferredSchools: ['Enchantment', 'Illusion'],
    requiredCantrip: 'mage-hand',
  },
}

const SUBCLASS_SKILL_CHOICES = {
  'bard:lore:3': {
    mode: 'proficiency',
    choose: 3,
    title: 'Bonus Proficiencies',
    desc: 'College of Lore grants proficiency in three skills of your choice.',
  },
}

const SKILL_OPTIONS = [
  { key:'acrobatics', index:'skill-acrobatics', label:'Acrobatics' },
  { key:'animalHandling', index:'skill-animal-handling', label:'Animal Handling' },
  { key:'arcana', index:'skill-arcana', label:'Arcana' },
  { key:'athletics', index:'skill-athletics', label:'Athletics' },
  { key:'deception', index:'skill-deception', label:'Deception' },
  { key:'history', index:'skill-history', label:'History' },
  { key:'insight', index:'skill-insight', label:'Insight' },
  { key:'intimidation', index:'skill-intimidation', label:'Intimidation' },
  { key:'investigation', index:'skill-investigation', label:'Investigation' },
  { key:'medicine', index:'skill-medicine', label:'Medicine' },
  { key:'nature', index:'skill-nature', label:'Nature' },
  { key:'perception', index:'skill-perception', label:'Perception' },
  { key:'performance', index:'skill-performance', label:'Performance' },
  { key:'persuasion', index:'skill-persuasion', label:'Persuasion' },
  { key:'religion', index:'skill-religion', label:'Religion' },
  { key:'sleightOfHand', index:'skill-sleight-of-hand', label:'Sleight of Hand' },
  { key:'stealth', index:'skill-stealth', label:'Stealth' },
  { key:'survival', index:'skill-survival', label:'Survival' },
]

function skillKeyFromIndex(index) {
  const key = String(index ?? '').replace(/^skill-/, '')
  if (key === 'animal-handling') return 'animalHandling'
  if (key === 'sleight-of-hand') return 'sleightOfHand'
  return key
}

export function getSlotsForClass(classIndex, classLevel) {
  if (!classIndex || classLevel < 1) return {}
  const idx = classLevel - 1
  if (classIndex === 'eldritchKnight' || classIndex === 'arcaneTrickster') {
    const row = THIRD_CASTER_SLOTS[idx]
    const slots = {}
    row?.forEach((count, i) => { if (count > 0) slots[i + 1] = { total: count, used: 0 } })
    return slots
  }
  if (classIndex === 'warlock') {
    const row = WARLOCK_PACT[idx]
    return row ? { [row.lv]: { total: row.n, used: 0 } } : {}
  }
  const table = FULL_CASTERS.has(classIndex) ? FULL_CASTER_SLOTS
    : HALF_CASTERS.has(classIndex) ? HALF_CASTER_SLOTS : null
  if (!table || !table[idx]) return {}
  const slots = {}
  table[idx].forEach((count, i) => { if (count > 0) slots[i + 1] = { total: count, used: 0 } })
  return slots
}

// Merge new slot totals with existing used counts (used capped at new total)
export function mergeSlots(existing, newSlots) {
  const merged = {}
  for (const [lvl, slot] of Object.entries(newSlots)) {
    const prev = existing?.[lvl]
    merged[lvl] = { total: slot.total, used: Math.min(prev?.used ?? 0, slot.total) }
  }
  return merged
}

export function getSlotsForCharacter(classes = []) {
  const normalCasterLevel = classes.reduce((sum, cls) => {
    const idx = getClassIndex(cls)
    const level = cls.level ?? 0
    const subclass = String(cls.subclass ?? '').toLowerCase()
    if (FULL_CASTERS.has(idx)) return sum + level
    if (idx === 'artificer') return sum + Math.ceil(level / 2)
    if (HALF_CASTERS.has(idx)) return sum + Math.floor(level / 2)
    if (idx === 'fighter' && subclass === 'eldritch knight') return sum + Math.floor(level / 3)
    if (idx === 'rogue' && subclass === 'arcane trickster') return sum + Math.floor(level / 3)
    return sum
  }, 0)
  const warlock = classes.find(cls => getClassIndex(cls) === 'warlock')
  if (normalCasterLevel > 0) {
    const row = FULL_CASTER_SLOTS[Math.max(0, Math.min(19, normalCasterLevel - 1))]
    const slots = {}
    row?.forEach((count, i) => { if (count > 0) slots[i + 1] = { total: count, used: 0 } })
    if (warlock) {
      const pact = WARLOCK_PACT[(warlock.level ?? 1) - 1]
      return { slots, pactSlots: pact ? { [pact.lv]: { total: pact.n, used: 0 } } : {} }
    }
    return { slots, pactSlots: {} }
  }
  if (warlock) return { slots: getSlotsForClass('warlock', warlock.level ?? 1), pactSlots: {} }
  return { slots: {}, pactSlots: {} }
}

// Starting cantrips and spells known per class at level 1
export const CANTRIPS_KNOWN = { bard:2, cleric:3, druid:2, sorcerer:4, warlock:2, wizard:3 }
export const SPELLS_KNOWN_L1 = { bard:2, sorcerer:2, warlock:2, wizard:6, cleric:4, druid:4 }

// ── D&D logic helpers ─────────────────────────────────────────

export function xpToLevel(xp) {
  return Math.max(1, XP_THRESHOLDS.filter(t => xp >= t).length)
}

function rollHpIncrease(className, conMod) {
  const die = HIT_DICE[className?.toLowerCase()] ?? 8
  const roll = Math.floor(Math.random() * die) + 1
  return { roll, conMod, total: Math.max(1, roll + conMod), die }
}

function hpIncreaseForMode(mode, rolled, manualValue) {
  const averageRoll = Math.floor(rolled.die / 2) + 1
  const manual = Math.max(1, parseInt(manualValue, 10) || 1)
  if (mode === 'average') return { ...rolled, roll: averageRoll, total: Math.max(1, averageRoll + rolled.conMod), mode }
  if (mode === 'max') return { ...rolled, roll: rolled.die, total: Math.max(1, rolled.die + rolled.conMod), mode }
  if (mode === 'manual') return { ...rolled, roll: manual - rolled.conMod, total: manual, mode }
  return { ...rolled, mode: 'roll' }
}

function getConMod(char) {
  const con = char.stats?.abilityScores?.con ?? char.stats?.CON ?? char.abilities?.constitution ?? 10
  return Math.floor((con - 10) / 2)
}

// Total levels assigned across all classes (the distribution)
function assignedLevel(char) {
  return characterLevel(char)
}

// Level the chosen class will become after this level-up
function nextClassLevel(char, classIdx) {
  return (char.identity?.class?.[classIdx]?.level ?? 0) + 1
}

function hasASI(char, classIdx) {
  const cls = (char.identity?.class?.[classIdx]?.name ?? '').toLowerCase()
  const lvl = nextClassLevel(char, classIdx)
  return (ASI_LEVELS[cls] ?? []).includes(lvl)
}

function hasSubclassChoice(char, classIdx) {
  const cls = (char.identity?.class?.[classIdx]?.name ?? '').toLowerCase()
  const lvl = nextClassLevel(char, classIdx)
  const already = char.identity?.class?.[classIdx]?.subclass
    ?? (classIdx === 0 ? char.identity?.subclass : undefined)
  if (already) return false
  const subclassLevels = SUBCLASS_LEVELS[cls] ?? []
  // Fire at the exact subclass level, OR catch up if they're past it and never chose
  return subclassLevels.includes(lvl) || subclassLevels.some(sl => sl < lvl)
}

function featureKey(feature) {
  return `${feature.classIndex ?? feature.className ?? ''}:${feature.gainedAtLevel ?? feature.level ?? ''}:${feature.index ?? feature.name}`
}

function classFeaturesForLevel(srdClasses, cls, level, subclassOverride = null) {
  const idx = getClassIndex(cls)
  const srdClass = srdClasses[idx]
  const classFeatures = (srdClass?.features_by_level?.[String(level)] ?? []).map(feature => ({
    ...feature,
    classIndex: idx,
    className: cls?.name ?? feature.className ?? '',
    gainedAtLevel: level,
  }))
  const subclassName = String(subclassOverride ?? cls?.subclass ?? '').toLowerCase()
  const subclass = (srdClass?.subclasses ?? []).find(option =>
    String(option.name ?? '').toLowerCase() === subclassName ||
    String(option.fullName ?? '').toLowerCase() === subclassName
  )
  const subclassFeatures = (subclass?.features_by_level?.[String(level)] ?? []).map(feature => ({
    ...feature,
    classIndex: idx,
    className: cls?.name ?? feature.className ?? '',
    subclassName: subclass.name,
    gainedAtLevel: level,
  }))
  return [...classFeatures, ...subclassFeatures]
}

function subclassSpellcastingSpec(cls, subclass) {
  const idx = getClassIndex(cls)
  const subclassIndex = String(subclass ?? cls?.subclass ?? '').toLowerCase().replace(/\s+/g, ' ')
  return SUBCLASS_SPELLCASTING[`${idx}:${subclassIndex}`] ?? null
}

function spellsKnownAt(spec, classLevel) {
  const levels = Object.keys(spec?.spellsKnown ?? {}).map(Number).sort((a, b) => a - b)
  return spec?.spellsKnown?.[levels.filter(level => level <= classLevel).pop()] ?? 0
}

function cantripsKnownAt(spec, classLevel) {
  const levels = Object.keys(spec?.cantripsKnown ?? {}).map(Number).sort((a, b) => a - b)
  return spec?.cantripsKnown?.[levels.filter(level => level <= classLevel).pop()] ?? 0
}

function spellPickNeeds(char, cls, level, subclass) {
  const spec = subclassSpellcastingSpec(cls, subclass)
  if (!spec) return null
  const known = char.spells?.known ?? []
  const cantripNeed = Math.max(0, cantripsKnownAt(spec, level) - known.filter(spell => spell.level === 0).length)
  const spellNeed = Math.max(0, spellsKnownAt(spec, level) - known.filter(spell => spell.level > 0).length)
  if (cantripNeed <= 0 && spellNeed <= 0) return null
  return { spec, cantripNeed, spellNeed }
}

function needsSubclassSpellChoice(char, classIdx, subclass) {
  const cls = char.identity?.class?.[classIdx]
  const level = nextClassLevel(char, classIdx)
  return !!spellPickNeeds(char, cls, level, subclass)
}

function skillChoiceForFeatures(features) {
  const expertise = features.find(feature => /expertise/i.test(feature.name ?? ''))
  if (expertise) return { feature: expertise, choose: 2, mode: 'expertise' }

  const match = features.find(feature => {
    const text = `${feature.name ?? ''} ${feature.desc?.join(' ') ?? ''}`.toLowerCase()
    return /skill/.test(text) && /gain proficiency|proficiency in|become proficient/.test(text)
  })
  if (!match) return null
  const choose = Number(match.desc?.join(' ').match(/(?:one|1)\s+(?:skill|of)/i)?.[1] ?? 1)
  return { feature: match, choose, mode: 'proficiency' }
}

function optionChoicesForFeatures(features) {
  return features.flatMap(feature =>
    (feature.choices ?? []).map(choice => ({
      ...choice,
      choiceKey: `${feature.index}:${choice.choiceIndex ?? 0}`,
      feature: {
        index: feature.index,
        name: feature.name,
        className: feature.className,
        classIndex: feature.classIndex,
        level: feature.gainedAtLevel ?? feature.level,
      },
    }))
  )
}

function subclassSkillChoice(cls, subclass, level) {
  const classIndex = cls?.index ?? cls?.name?.toLowerCase?.().replace(/\s+/g, '-')
  const subclassIndex = String(subclass ?? '').toLowerCase().replace(/\s+/g, ' ')
  return SUBCLASS_SKILL_CHOICES[`${classIndex}:${subclassIndex}:${level}`] ?? null
}

function classSkillChoiceForMulticlass(cls) {
  const idx = getClassIndex(cls)
  const base = MULTICLASS_SKILL_CHOICES[idx]
  if (!base) return null
  const srdOptions = cls?.proficiency_choices?.flatMap(choice =>
    choice.from?.options
      ?.filter(option => option.item?.index?.startsWith('skill-'))
      ?.map(option => ({
        key: skillKeyFromIndex(option.item.index),
        index: option.item.index,
        label: option.item.name?.replace('Skill: ', '') ?? option.item.index,
      })) ?? []
  ) ?? []
  return { ...base, options: srdOptions.length ? srdOptions : undefined }
}

// Build step list once class is chosen
function buildSteps(char, classIdx, selectedSubclass, srdClasses, newClassData = null) {
  const steps = []
  if (classIdx == null) {
    steps.push({ type: 'classChoice' })
    return steps
  }
  const isNewClass = classIdx === 'new'
  const idx = isNewClass ? null : classIdx
  const lvl = isNewClass ? 1 : nextClassLevel(char, idx)
  const cls = isNewClass ? newClassData : char.identity?.class?.[idx]
  if (!cls) return [{ type: 'classChoice' }]
  const subclass = selectedSubclass ?? cls?.subclass
  const gainedFeatures = classFeaturesForLevel(srdClasses, cls, lvl, subclass)
  steps.push({ type: 'features' })
  if (!isNewClass && hasASI(char, idx))           steps.push({ type: 'asi' })
  if (SUBCLASS_LEVELS[getClassIndex(cls)]?.includes(lvl) && !cls.subclass) steps.push({ type: 'subclass' })
  if (!isNewClass && subclass && needsSubclassSpellChoice(char, idx, subclass)) steps.push({ type: 'spells' })
  optionChoicesForFeatures(gainedFeatures).forEach(choice => steps.push({ type: 'featureOption', choice }))
  const skillChoices = [
    isNewClass ? classSkillChoiceForMulticlass(cls) : null,
    subclassSkillChoice(cls, subclass, lvl),
    skillChoiceForFeatures(gainedFeatures),
  ].filter(Boolean)
  skillChoices.forEach(skillChoice => steps.push({ type: 'skills', skillChoice }))
  return steps
}

// ── Step indicator ────────────────────────────────────────────
function StepIndicator({ total, current }) {
  return (
    <div className="lu-step-indicator">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`lu-step-dot${i < current ? ' lu-step-dot--done' : i === current ? ' lu-step-dot--active' : ''}`}
        />
      ))}
    </div>
  )
}

// ── Step: Class choice (multiclass) ──────────────────────────
function ClassChoiceStep({ char, srdClasses, allowNewClass, onNext, onBack }) {
  const classes = char.identity?.class ?? []
  const [selected, setSelected] = useState(null)
  const [selectedNewClass, setSelectedNewClass] = useState(null)
  const existingIndexes = new Set(classes.map(getClassIndex))
  const newClassOptions = Object.values(srdClasses ?? {})
    .filter(cls => !existingIndexes.has(cls.index))
    .sort((a, b) => a.name.localeCompare(b.name))
  const selectedNewClassData = newClassOptions.find(cls => cls.index === selectedNewClass)
  return (
    <div className="lu-step">
      <div className="lu-title">Level Up — Choose Class</div>
      <div className="lu-sub">Which class gains this level?</div>
      <div className="lu-class-choices">
        {classes.map((cls, i) => (
          <button
            key={i}
            className={`lu-class-choice-btn${selected === i ? ' lu-class-choice-btn--active' : ''}`}
            onClick={() => setSelected(i)}
          >
            <span className="lu-class-choice-name">{cls.name}</span>
            <span className="lu-class-choice-level">Lv {cls.level} → {cls.level + 1}</span>
          </button>
        ))}
        {allowNewClass && (
          <button
            className={`lu-class-choice-btn${selected === 'new' ? ' lu-class-choice-btn--active' : ''}`}
            onClick={() => setSelected('new')}
          >
            <span className="lu-class-choice-name">Add New Class</span>
            <span className="lu-class-choice-level">Multiclass level 1</span>
          </button>
        )}
      </div>
      {selected === 'new' && (
        <div className="lu-choice-block">
          <div className="lu-choice-head">
            <span>New Class</span>
            <span className="lu-choice-hint">multiclass prerequisites enforced</span>
          </div>
          <div className="lu-class-choices">
            {newClassOptions.map(cls => {
              const qualifies = canMulticlassInto(char, cls.index)
              return (
                <button
                  key={cls.index}
                  className={`lu-class-choice-btn${selectedNewClass === cls.index ? ' lu-class-choice-btn--active' : ''}`}
                  onClick={() => qualifies && setSelectedNewClass(cls.index)}
                  disabled={!qualifies}
                  title={!qualifies ? `Requires ${multiclassPrereqLabel(cls.index)} and prerequisites for current classes` : undefined}
                >
                  <span className="lu-class-choice-name">{cls.name}</span>
                  <span className="lu-class-choice-level">Requires {multiclassPrereqLabel(cls.index)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="lu-actions">
        <button className="lu-btn lu-btn--ghost" onClick={onBack}>← Back</button>
        <button
          className="lu-btn lu-btn--primary"
          onClick={() => onNext({
            type: 'classChoice',
            classIdx: selected,
            classData: selected === 'new' ? selectedNewClassData : null,
          })}
          disabled={selected == null || (selected === 'new' && !selectedNewClassData)}
        >Next →</button>
      </div>
    </div>
  )
}

// ── Step: New Features (simple level) ────────────────────────
function FeaturesStep({ char, classIdx, newClassData, hpResult, hpMode, onHpMode, manualHp, onManualHp, srdClasses, onNext, isLast }) {
  const isNewClass = classIdx === 'new'
  const lvl        = isNewClass ? 1 : nextClassLevel(char, classIdx)
  const clsData    = isNewClass ? newClassData : char.identity?.class?.[classIdx]
  const cls        = clsData?.name ?? 'your class'
  const totalLvl   = assignedLevel(char) + 1
  const oldProf    = PROF_BONUS[totalLvl - 2] ?? 2
  const newProf    = PROF_BONUS[totalLvl - 1] ?? 2
  const profChange = newProf > oldProf
  const gainedFeatures = classFeaturesForLevel(srdClasses, clsData, lvl)

  return (
    <div className="lu-step">
      <div className="lu-title">Level Up — {cls} {lvl}</div>
      <div className="lu-sub">
        {hasASI(char, classIdx) || hasSubclassChoice(char, classIdx)
          ? 'You gain the following automatically. More choices coming next.'
          : 'No choices required at this level. Everything below is applied automatically.'
        }
      </div>

      <div className="lu-feature-list">
        {/* HP */}
        <div className="lu-feature-row">
          <div className="lu-feature-name">Hit Points</div>
          <div className="lu-feature-desc">
            Choose how max HP increases for this level. Current result:{' '}
            <strong className="lu-hp-gain">+{hpResult.total} HP</strong>
            {' '}({hpMode === 'manual' ? 'manual' : `${hpResult.roll} + CON ${hpResult.conMod >= 0 ? '+' : ''}${hpResult.conMod}`})
            <div className="lu-hp-options">
              {[
                ['roll', 'Rolled'],
                ['average', 'Average'],
                ['max', 'Max'],
                ['manual', 'Manual'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`lu-hp-option${hpMode === value ? ' lu-hp-option--active' : ''}`}
                  onClick={() => onHpMode(value)}
                >
                  {label}
                </button>
              ))}
              {hpMode === 'manual' && (
                <input
                  className="lu-hp-manual"
                  type="number"
                  min="1"
                  value={manualHp}
                  onChange={e => onManualHp(e.target.value)}
                  aria-label="Manual HP increase"
                />
              )}
            </div>
          </div>
        </div>

        {/* Proficiency bonus */}
        <div className="lu-feature-row">
          <div className="lu-feature-name">Proficiency Bonus</div>
          <div className="lu-feature-desc">
            {profChange
              ? <><strong className="lu-prof-gain">Increases to +{newProf}</strong> at this level.</>
              : <>Unchanged at this level. Remains <strong>+{newProf}</strong>.</>
            }
          </div>
        </div>

        {/* Hit Die */}
        <div className="lu-feature-row">
          <div className="lu-feature-name">Hit Dice</div>
          <div className="lu-feature-desc">
            Gained 1 Hit Die (1d{hpResult.die}). Now have {lvl}d{hpResult.die} total.
          </div>
        </div>

        {gainedFeatures.map(feature => (
          <div key={featureKey(feature)} className="lu-feature-row">
            <div className="lu-feature-name">{feature.name}</div>
            {feature.desc?.[0] && (
              <div className="lu-feature-desc">
                {feature.desc[0].slice(0, 260)}{feature.desc[0].length > 260 ? '…' : ''}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="lu-actions">
        <button className="lu-btn lu-btn--primary" onClick={onNext}>
          {isLast ? 'Confirm Level Up ✓' : 'Next →'}
        </button>
      </div>
    </div>
  )
}

// ── Step: ASI or Feat ─────────────────────────────────────────
function ASIStep({ char, classIdx, onNext, onBack }) {
  const [choice, setChoice]     = useState(null)  // 'asi' | 'feat'
  const [asiPoints, setAsiPoints] = useState({ STR:0, DEX:0, CON:0, INT:0, WIS:0, CHA:0 })
  const [selectedFeat, setSelectedFeat] = useState(null)
  const [featAbility, setFeatAbility] = useState(null)
  const [featSkills, setFeatSkills] = useState([])
  const [featDamageType, setFeatDamageType] = useState(null)
  const [featSpellClass, setFeatSpellClass] = useState(null)
  const [featCantrips, setFeatCantrips] = useState([])
  const [featSpells, setFeatSpells] = useState([])
  const [featManeuvers, setFeatManeuvers] = useState([])
  const [featWeapons, setFeatWeapons] = useState([])
  const [featSearch, setFeatSearch]     = useState('')
  const [allSpells, setAllSpells] = useState([])
  const [optionalFeatures, setOptionalFeatures] = useState([])

  useEffect(() => {
    getSpells().then(setAllSpells).catch(() => setAllSpells([]))
    getOptionalFeatures().then(setOptionalFeatures).catch(() => setOptionalFeatures([]))
  }, [])

  const pointsUsed = Object.values(asiPoints).reduce((a, b) => a + b, 0)
  const pointsLeft = 2 - pointsUsed

  const ab = char.stats?.abilityScores ?? {}
  const currentScores = {
    STR: ab.str ?? char.stats?.STR ?? 10,
    DEX: ab.dex ?? char.stats?.DEX ?? 10,
    CON: ab.con ?? char.stats?.CON ?? 10,
    INT: ab.int ?? char.stats?.INT ?? 10,
    WIS: ab.wis ?? char.stats?.WIS ?? 10,
    CHA: ab.cha ?? char.stats?.CHA ?? 10,
  }

  const toggleASI = (stat) => {
    const current = asiPoints[stat]
    const score   = currentScores[stat] + current
    if (current === 0 && pointsLeft > 0 && score < 20) {
      setAsiPoints(p => ({ ...p, [stat]: 1 }))
    } else if (current === 1 && pointsLeft > 0 && score < 20) {
      setAsiPoints(p => ({ ...p, [stat]: 2 }))
    } else {
      setAsiPoints(p => ({ ...p, [stat]: 0 }))
    }
  }

  const filteredFeats = FEATS.filter(f =>
    f.name.toLowerCase().includes(featSearch.toLowerCase()) ||
    f.desc.toLowerCase().includes(featSearch.toLowerCase())
  )
  const selectedFeatRule = featRule(selectedFeat)
  const knownSpellIds = new Set((char.spells?.known ?? []).map(spell => spell.index))
  const featClassSpells = featSpellClass ? spellListForClass(allSpells, featSpellClass) : []
  const featCantripOptions = selectedFeatRule.cantripFromAnyClass
    ? allSpells.filter(spell => spell.level === 0 && !knownSpellIds.has(spell.index))
    : featClassSpells.filter(spell => spell.level === 0 && !knownSpellIds.has(spell.index))
  const featSpellOptions = selectedFeatRule.ritualSpellsKnown
    ? featClassSpells.filter(spell => spell.level === 1 && spell.ritual && !knownSpellIds.has(spell.index))
    : featClassSpells.filter(spell => spell.level === 1 && !knownSpellIds.has(spell.index))
  const maneuverOptions = optionalFeatures.filter(feature => (feature.featureType ?? []).includes('MV:B'))
  const availableFeatSkills = SKILL_OPTIONS.filter(skill => {
    const current = char.stats?.skills?.[skill.key]
    const level = typeof current === 'number' ? current : current?.proficient ? 1 : 0
    return level === 0
  })
  const featNeedsAbility = (selectedFeatRule.abilityOptions ?? []).length > 0
  const featNeedsSkills = (selectedFeatRule.skillProficiencies ?? 0) > 0
  const featNeedsDamageType = !!selectedFeatRule.damageTypeChoice
  const featNeedsSpellClass = !!selectedFeatRule.spellClassChoice || !!selectedFeatRule.ritualClassChoice
  const featNeedsCantrips = !!(selectedFeatRule.cantripsKnown || selectedFeatRule.cantripFromAnyClass)
  const featNeedsSpells = !!(selectedFeatRule.spellsKnown || selectedFeatRule.ritualSpellsKnown)
  const featNeedsManeuvers = !!selectedFeatRule.maneuverChoices
  const featNeedsWeapons = !!selectedFeatRule.weaponProficiencies

  const canConfirm =
    (choice === 'asi' && pointsUsed === 2) ||
    (choice === 'feat' && selectedFeat
      && (!featNeedsAbility || featAbility)
      && (!featNeedsSkills || featSkills.length === selectedFeatRule.skillProficiencies)
      && (!featNeedsDamageType || featDamageType)
      && (!featNeedsSpellClass || featSpellClass)
      && (!featNeedsCantrips || featCantrips.length === (selectedFeatRule.cantripsKnown ?? selectedFeatRule.cantripFromAnyClass))
      && (!featNeedsSpells || featSpells.length === (selectedFeatRule.spellsKnown ?? selectedFeatRule.ritualSpellsKnown))
      && (!featNeedsManeuvers || featManeuvers.length === selectedFeatRule.maneuverChoices)
      && (!featNeedsWeapons || featWeapons.length === selectedFeatRule.weaponProficiencies))

  const handleConfirm = () => {
    onNext({
      type: 'asi',
      choice,
      asiDeltas:   choice === 'asi' ? asiPoints : null,
      selectedFeat: choice === 'feat' ? selectedFeat : null,
      featChoices: choice === 'feat'
        ? {
            ability: featAbility,
            skills: featSkills,
            damageType: featDamageType,
            spellClass: featSpellClass,
            cantrips: featCantrips,
            spells: featSpells,
            maneuvers: featManeuvers,
            weapons: featWeapons,
          }
        : null,
    })
  }

  const selectFeat = (feat) => {
    if (!meetsFeatPrereq(feat, char)) return
    setSelectedFeat(feat)
    setFeatAbility(null)
    setFeatSkills([])
    setFeatDamageType(null)
    setFeatSpellClass(null)
    setFeatCantrips([])
    setFeatSpells([])
    setFeatManeuvers([])
    setFeatWeapons([])
  }

  const toggleFeatSkill = (skill) => {
    const max = selectedFeatRule.skillProficiencies ?? 0
    setFeatSkills(prev => {
      if (prev.some(item => item.key === skill.key)) return prev.filter(item => item.key !== skill.key)
      if (prev.length >= max) return prev
      return [...prev, skill]
    })
  }

  const setFeatClass = (classIndex) => {
    setFeatSpellClass(classIndex)
    setFeatCantrips([])
    setFeatSpells([])
  }

  const toggleFeatCantrip = (spell) => {
    const max = selectedFeatRule.cantripsKnown ?? selectedFeatRule.cantripFromAnyClass ?? 0
    setFeatCantrips(prev => toggleLimitedOption(prev, toKnownSpell({ ...spell, origin: selectedFeat?.name }), max))
  }

  const toggleFeatSpell = (spell) => {
    const max = selectedFeatRule.spellsKnown ?? selectedFeatRule.ritualSpellsKnown ?? 0
    setFeatSpells(prev => toggleLimitedOption(prev, toKnownSpell({ ...spell, origin: selectedFeat?.name }), max))
  }

  const toggleFeatManeuver = (maneuver) => {
    setFeatManeuvers(prev => toggleLimitedOption(prev, maneuver, selectedFeatRule.maneuverChoices ?? 0, 'id'))
  }

  const toggleFeatWeapon = (weapon) => {
    setFeatWeapons(prev => toggleLimitedOption(prev, { name: weapon }, selectedFeatRule.weaponProficiencies ?? 0, 'name'))
  }

  return (
    <div className={`lu-step${choice === 'feat' ? ' lu-step--feat' : ''}`}>
      <div className="lu-title lu-title--gold">Level {nextClassLevel(char, classIdx)} — Improvement</div>
      <div className="lu-sub">Choose between an Ability Score Improvement or a Feat.</div>

      {/* Choice selector */}
      {!choice && (
        <div className="lu-option-grid">
          <button className="lu-option-card" onClick={() => setChoice('asi')}>
            <div className="lu-option-radio" />
            <div>
              <div className="lu-option-name">Ability Score Improvement</div>
              <div className="lu-option-desc">Increase one score by +2, or two scores by +1 each. Maximum 20.</div>
            </div>
          </button>
          <button className="lu-option-card" onClick={() => setChoice('feat')}>
            <div className="lu-option-radio" />
            <div>
              <div className="lu-option-name">Feat</div>
              <div className="lu-option-desc">Gain a feat from the feat list. Some feats have prerequisites.</div>
            </div>
          </button>
        </div>
      )}

      {/* ASI grid */}
      {choice === 'asi' && (
        <div className="lu-asi-section">
          <button className="lu-change-choice" onClick={() => { setChoice(null); setAsiPoints({ STR:0,DEX:0,CON:0,INT:0,WIS:0,CHA:0 }) }}>← Change choice</button>
          <div className="lu-asi-header">
            <span className="lu-asi-label">Choose stat increases</span>
            <span className={`lu-asi-counter${pointsLeft === 0 ? ' lu-asi-counter--done' : ''}`}>
              {pointsUsed} / 2 points used
            </span>
          </div>
          <div className="lu-asi-grid">
            {ABILITY_SCORES.map(stat => {
              const base    = currentScores[stat]
              const added   = asiPoints[stat]
              const newVal  = base + added
              const maxed   = newVal >= 20
              const hasPoint = added > 0
              return (
                <button
                  key={stat}
                  className={`lu-asi-tile${hasPoint ? ' lu-asi-tile--active' : ''}${maxed && !hasPoint ? ' lu-asi-tile--maxed' : ''}`}
                  onClick={() => toggleASI(stat)}
                  disabled={maxed && added === 0}
                >
                  <div className="lu-asi-stat">{stat}</div>
                  <div className="lu-asi-score">{base}</div>
                  {hasPoint
                    ? <div className="lu-asi-delta">+{added} ●</div>
                    : maxed
                      ? <div className="lu-asi-maxed">MAX</div>
                      : <div className="lu-asi-open">+0</div>
                  }
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Feat picker */}
      {choice === 'feat' && (
        <div className="lu-feat-section">
          <button
            className="lu-change-choice"
            onClick={() => {
              setChoice(null)
              setSelectedFeat(null)
              setFeatAbility(null)
              setFeatSkills([])
              setFeatDamageType(null)
              setFeatSpellClass(null)
              setFeatCantrips([])
              setFeatSpells([])
              setFeatManeuvers([])
              setFeatWeapons([])
            }}
          >← Change choice</button>
          <input
            className="lu-feat-search"
            placeholder="Search feats…"
            value={featSearch}
            onChange={e => setFeatSearch(e.target.value)}
          />
          <div className="lu-feat-list">
            {filteredFeats.map(feat => (
              (() => {
                const qualifies = meetsFeatPrereq(feat, char)
                return (
              <button
                key={feat.name}
                className={`lu-feat-row${selectedFeat?.name === feat.name ? ' lu-feat-row--selected' : ''}`}
                onClick={() => selectFeat(feat)}
                disabled={!qualifies}
                title={!qualifies ? `Prerequisite not met: ${feat.prereq}` : undefined}
              >
                <div className="lu-feat-header">
                  <div className="lu-feat-name">{feat.name}</div>
                  {feat.prereq && <div className="lu-feat-prereq">Requires: {feat.prereq}</div>}
                </div>
                <div className="lu-feat-desc">{feat.desc}</div>
              </button>
                )
              })()
            ))}
          </div>
          {selectedFeat && featNeedsAbility && (
            <div className="lu-choice-block">
              <div className="lu-choice-head">
                <span>Ability Increase</span>
                <span className="lu-choice-hint">choose one</span>
              </div>
              <div className="lu-skill-grid">
                {selectedFeatRule.abilityOptions.map(key => (
                  <button
                    key={key}
                    className={`lu-skill-chip${featAbility === key ? ' lu-skill-chip--selected' : ''}`}
                    onClick={() => setFeatAbility(key)}
                    disabled={(currentScores[ABILITY_LABEL_BY_KEY[key]] ?? 10) >= 20}
                  >
                    {ABILITY_LABEL_BY_KEY[key]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedFeat && featNeedsSkills && (
            <div className="lu-choice-block">
              <div className="lu-choice-head">
                <span>Skill Proficiencies</span>
                <span className="lu-choice-hint">{featSkills.length}/{selectedFeatRule.skillProficiencies}</span>
              </div>
              <div className="lu-skill-grid">
                {availableFeatSkills.map(skill => {
                  const active = featSkills.some(item => item.key === skill.key)
                  return (
                    <button
                      key={skill.key}
                      className={`lu-skill-chip${active ? ' lu-skill-chip--selected' : ''}`}
                      onClick={() => toggleFeatSkill(skill)}
                    >
                      {skill.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {selectedFeat && featNeedsDamageType && (
            <div className="lu-choice-block">
              <div className="lu-choice-head">
                <span>Damage Type</span>
                <span className="lu-choice-hint">choose one</span>
              </div>
              <div className="lu-skill-grid">
                {DAMAGE_TYPES.map(type => (
                  <button
                    key={type}
                    className={`lu-skill-chip${featDamageType === type ? ' lu-skill-chip--selected' : ''}`}
                    onClick={() => setFeatDamageType(type)}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedFeat && featNeedsSpellClass && (
            <div className="lu-choice-block">
              <div className="lu-choice-head">
                <span>Spell List</span>
                <span className="lu-choice-hint">choose one class</span>
              </div>
              <div className="lu-skill-grid">
                {(selectedFeatRule.ritualClassChoice ? RITUAL_CASTER_CLASSES : MAGIC_INITIATE_CLASSES).map(classIndex => (
                  <button
                    key={classIndex}
                    className={`lu-skill-chip${featSpellClass === classIndex ? ' lu-skill-chip--selected' : ''}`}
                    onClick={() => setFeatClass(classIndex)}
                  >
                    {classLabel(classIndex)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedFeat && featNeedsCantrips && (!featNeedsSpellClass || featSpellClass) && (
            <div className="lu-choice-block">
              <div className="lu-choice-head">
                <span>Cantrips</span>
                <span className="lu-choice-hint">{featCantrips.length}/{selectedFeatRule.cantripsKnown ?? selectedFeatRule.cantripFromAnyClass}</span>
              </div>
              <div className="lu-picker-list">
                {featCantripOptions.slice(0, 80).map(spell => {
                  const active = featCantrips.some(item => item.index === spell.index)
                  return (
                    <button
                      key={spell.index}
                      className={`lu-picker-row${active ? ' lu-picker-row--selected' : ''}`}
                      onClick={() => toggleFeatCantrip(spell)}
                    >
                      <span className="lu-picker-radio">{active ? '●' : '○'}</span>
                      <span className="lu-picker-name">{spell.name}</span>
                      <span className="lu-picker-meta">{spell.school?.name}{selectedFeatRule.cantripFromAnyClass ? ` · ${spell.classes?.map(cls => cls.name).slice(0, 2).join(', ')}` : ''}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {selectedFeat && featNeedsSpells && featSpellClass && (
            <div className="lu-choice-block">
              <div className="lu-choice-head">
                <span>{selectedFeatRule.ritualSpellsKnown ? 'Ritual Spells' : '1st-Level Spell'}</span>
                <span className="lu-choice-hint">{featSpells.length}/{selectedFeatRule.spellsKnown ?? selectedFeatRule.ritualSpellsKnown}</span>
              </div>
              <div className="lu-picker-list">
                {featSpellOptions.slice(0, 80).map(spell => {
                  const active = featSpells.some(item => item.index === spell.index)
                  return (
                    <button
                      key={spell.index}
                      className={`lu-picker-row${active ? ' lu-picker-row--selected' : ''}`}
                      onClick={() => toggleFeatSpell(spell)}
                    >
                      <span className="lu-picker-radio">{active ? '●' : '○'}</span>
                      <span className="lu-picker-name">{spell.name}</span>
                      <span className="lu-picker-meta">Lv {spell.level} · {spell.school?.name}{spell.ritual ? ' · Ritual' : ''}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {selectedFeat && featNeedsManeuvers && (
            <div className="lu-choice-block">
              <div className="lu-choice-head">
                <span>Maneuvers</span>
                <span className="lu-choice-hint">{featManeuvers.length}/{selectedFeatRule.maneuverChoices}</span>
              </div>
              <div className="lu-picker-list">
                {maneuverOptions.slice(0, 80).map(maneuver => {
                  const active = featManeuvers.some(item => item.id === maneuver.id)
                  return (
                    <button
                      key={maneuver.id}
                      className={`lu-picker-row${active ? ' lu-picker-row--selected' : ''}`}
                      onClick={() => toggleFeatManeuver(maneuver)}
                    >
                      <span className="lu-picker-radio">{active ? '●' : '○'}</span>
                      <span className="lu-picker-name">{maneuver.name}</span>
                      <span className="lu-picker-meta">{maneuver.source}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {selectedFeat && featNeedsWeapons && (
            <div className="lu-choice-block">
              <div className="lu-choice-head">
                <span>Weapon Proficiencies</span>
                <span className="lu-choice-hint">{featWeapons.length}/{selectedFeatRule.weaponProficiencies}</span>
              </div>
              <div className="lu-skill-grid">
                {WEAPON_MASTER_OPTIONS.map(weapon => {
                  const active = featWeapons.some(item => item.name === weapon)
                  return (
                    <button
                      key={weapon}
                      className={`lu-skill-chip${active ? ' lu-skill-chip--selected' : ''}`}
                      onClick={() => toggleFeatWeapon(weapon)}
                    >
                      {weapon}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="lu-warning lu-warning--gold">
        This is a permanent character-defining choice.
      </div>

      <div className="lu-actions">
        <button className="lu-btn lu-btn--ghost" onClick={onBack}>← Back</button>
        <button
          className="lu-btn lu-btn--gold"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          Confirm Choice →
        </button>
      </div>
    </div>
  )
}

// ── Step: Subclass choice ─────────────────────────────────────
function SubclassStep({ char, classIdx, newClassData, srdClasses, onNext, onBack }) {
  const [selected, setSelected] = useState(null)
  const clsObj   = classIdx === 'new' ? newClassData : char.identity?.class?.[classIdx] ?? char.identity?.class?.[0]
  const cls      = getClassIndex(clsObj)
  const lvl      = classIdx === 'new' ? 1 : nextClassLevel(char, classIdx)
  const dataOptions = srdClasses?.[cls]?.subclasses ?? []
  const options  = dataOptions.length > 0
    ? dataOptions
    : (SUBCLASSES[cls] ?? []).map(name => ({ name, source: 'manual' }))

  return (
    <div className="lu-step">
      <div className="lu-title lu-title--gold">Choose Your Archetype</div>
      <div className="lu-sub">
        At {clsObj?.name} level {lvl}, you choose a subclass that defines your path.
      </div>

      <div className="lu-warning lu-warning--gold">
        This is a permanent choice. It cannot be changed later.
      </div>

      <div className="lu-subclass-list">
        {options.map(option => (
          <button
            key={`${option.name}:${option.source ?? ''}`}
            className={`lu-subclass-card${selected === option.name ? ' lu-subclass-card--selected' : ''}`}
            onClick={() => setSelected(option.name)}
          >
            <div className="lu-subclass-radio">
              <div className={`lu-radio-dot${selected === option.name ? ' lu-radio-dot--active' : ''}`} />
            </div>
            <div className="lu-subclass-name">{option.name}</div>
            {option.source && <div className="lu-choice-hint">{option.source}</div>}
          </button>
        ))}
      </div>

      <div className="lu-actions">
        <button className="lu-btn lu-btn--ghost" onClick={onBack}>← Back</button>
        <button
          className="lu-btn lu-btn--gold"
          onClick={() => onNext({ type: 'subclass', subclass: selected })}
          disabled={!selected}
        >
          Confirm Archetype →
        </button>
      </div>
    </div>
  )
}

// ── Step: Spell unlocks from subclass ───────────────────────────────────────
function SpellUnlockStep({ char, classIdx, subclass, onNext, onBack }) {
  const [allSpells, setAllSpells] = useState([])
  const [selectedCantrips, setSelectedCantrips] = useState([])
  const [selectedSpells, setSelectedSpells] = useState([])

  const cls = char.identity?.class?.[classIdx]
  const level = nextClassLevel(char, classIdx)
  const needs = spellPickNeeds(char, cls, level, subclass)
  const spec = needs?.spec
  const knownIds = useMemo(() => new Set((char.spells?.known ?? []).map(spell => spell.index)), [char.spells?.known])

  useEffect(() => {
    getSpells().then(setAllSpells).catch(() => setAllSpells([]))
  }, [])

  useEffect(() => {
    if (!spec?.requiredCantrip || selectedCantrips.length || knownIds.has(spec.requiredCantrip)) return
    const required = allSpells.find(spell => spell.index === spec.requiredCantrip)
    if (required) setSelectedCantrips([toKnownSpell(required)])
  }, [allSpells, knownIds, selectedCantrips.length, spec?.requiredCantrip])

  if (!needs) {
    return (
      <div className="lu-step">
        <div className="lu-title">Spellcasting</div>
        <div className="lu-sub">No new spells are required at this level.</div>
        <div className="lu-actions">
          <button className="lu-btn lu-btn--ghost" onClick={onBack}>← Back</button>
          <button className="lu-btn lu-btn--primary" onClick={() => onNext({ type: 'spells', spells: [], cantrips: [] })}>Next →</button>
        </div>
      </div>
    )
  }

  const sourceClass = spec.sourceClass
  const sourceSpells = allSpells.filter(spell => spell.classes?.some(c => c.index === sourceClass))
  const cantrips = sourceSpells.filter(spell => spell.level === 0 && !knownIds.has(spell.index))
  const leveledSpells = sourceSpells.filter(spell =>
    spec.spellLevels.includes(spell.level) &&
    !knownIds.has(spell.index)
  )

  const toggleCantrip = (spell) => {
    if (spec.requiredCantrip && spell.index === spec.requiredCantrip && !knownIds.has(spec.requiredCantrip)) return
    setSelectedCantrips(prev => {
      if (prev.some(s => s.index === spell.index)) return prev.filter(s => s.index !== spell.index)
      if (prev.length >= needs.cantripNeed) return prev
      return [...prev, toKnownSpell(spell)]
    })
  }

  const toggleSpell = (spell) => {
    setSelectedSpells(prev => {
      if (prev.some(s => s.index === spell.index)) return prev.filter(s => s.index !== spell.index)
      if (prev.length >= needs.spellNeed) return prev
      return [...prev, toKnownSpell(spell)]
    })
  }

  const done = selectedCantrips.length === needs.cantripNeed && selectedSpells.length === needs.spellNeed

  return (
    <div className="lu-step">
      <div className="lu-title lu-title--gold">{subclass} Spellcasting</div>
      <div className="lu-sub">
        Choose spells from the {sourceClass} list for this subclass.
        {spec.preferredSchools?.length ? ` ${spec.preferredSchools.join(' and ')} are the usual schools for this archetype.` : ''}
      </div>

      {needs.cantripNeed > 0 && (
        <SpellChoiceList
          label={`Cantrips (${selectedCantrips.length}/${needs.cantripNeed})`}
          spells={cantrips}
          selected={selectedCantrips}
          onToggle={toggleCantrip}
          requiredIndex={spec.requiredCantrip}
        />
      )}

      {needs.spellNeed > 0 && (
        <SpellChoiceList
          label={`1st-level spells (${selectedSpells.length}/${needs.spellNeed})`}
          spells={leveledSpells}
          selected={selectedSpells}
          onToggle={toggleSpell}
          preferredSchools={spec.preferredSchools}
        />
      )}

      <div className="lu-actions">
        <button className="lu-btn lu-btn--ghost" onClick={onBack}>← Back</button>
        <button
          className="lu-btn lu-btn--gold"
          onClick={() => onNext({ type: 'spells', cantrips: selectedCantrips, spells: selectedSpells, spec })}
          disabled={!done}
        >
          Confirm Spells →
        </button>
      </div>
    </div>
  )
}

function SpellChoiceList({ label, spells, selected, onToggle, preferredSchools, requiredIndex }) {
  const [search, setSearch] = useState('')
  const selectedIds = new Set(selected.map(spell => spell.index))
  const filtered = spells
    .filter(spell => !search || spell.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aPref = preferredSchools?.includes(a.school?.name) ? 0 : 1
      const bPref = preferredSchools?.includes(b.school?.name) ? 0 : 1
      return aPref - bPref || a.name.localeCompare(b.name)
    })
    .slice(0, 80)

  return (
    <div className="lu-choice-block">
      <div className="lu-choice-head">
        <span>{label}</span>
        {preferredSchools?.length > 0 && <span className="lu-choice-hint">preferred: {preferredSchools.join(', ')}</span>}
      </div>
      <input
        className="lu-search-input"
        placeholder="Search spells..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="lu-picker-list">
        {filtered.map(spell => {
          const selectedSpell = selectedIds.has(spell.index)
          const required = requiredIndex === spell.index
          return (
            <button
              key={spell.index}
              className={`lu-picker-row${selectedSpell ? ' lu-picker-row--selected' : ''}`}
              onClick={() => onToggle(spell)}
              disabled={required}
            >
              <span className="lu-picker-radio">{selectedSpell ? '●' : '○'}</span>
              <span className="lu-picker-name">{spell.name}</span>
              <span className="lu-picker-meta">{spell.level === 0 ? 'Cantrip' : `Lv ${spell.level}`} · {spell.school?.name}</span>
              {required && <span className="lu-picker-badge">required</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function toKnownSpell(spell) {
  return {
    id: spell.index,
    index: spell.index,
    name: spell.name,
    source: spell.source,
    level: spell.level,
    ...(spell.origin && { origin: spell.origin }),
    ...(spell.ritual && { ritual: true }),
  }
}

function addProficiencies(existing, additions = {}) {
  if (Array.isArray(existing)) {
    return [...new Set([...existing, ...Object.values(additions).flat()])]
  }
  const next = { ...(existing ?? {}) }
  for (const [category, values] of Object.entries(additions)) {
    next[category] = [...new Set([...(next[category] ?? []), ...values])]
  }
  return next
}

function applyMulticlassProficiencies(char, classIndex) {
  const additions = MULTICLASS_PROFICIENCIES[classIndex]
  if (!additions) return char
  return {
    ...char,
    stats: {
      ...(char.stats ?? {}),
      proficiencies: addProficiencies(char.stats?.proficiencies, additions),
    },
  }
}

function applyFeatRules(char, feat, choices = {}) {
  const rule = featRule(feat)
  let updated = char

  if (rule.abilityIncrease && choices.ability) {
    const key = choices.ability
    const scores = updated.stats?.abilityScores ?? {}
    updated = {
      ...updated,
      stats: {
        ...(updated.stats ?? {}),
        abilityScores: {
          ...scores,
          [key]: Math.min(20, (scores[key] ?? 10) + rule.abilityIncrease),
        },
      },
    }
  }

  if (rule.savingThrowChoice && choices.ability) {
    const savingThrows = updated.stats?.savingThrows ?? {}
    updated = {
      ...updated,
      stats: {
        ...(updated.stats ?? {}),
        savingThrows: {
          ...savingThrows,
          [choices.ability]: { ...(savingThrows[choices.ability] ?? {}), proficient: true },
        },
      },
    }
  }

  if (rule.skillProficiencies && choices.skills?.length) {
    const skills = { ...(updated.stats?.skills ?? {}) }
    for (const skill of choices.skills) {
      skills[skill.key] = typeof skills[skill.key] === 'number'
        ? Math.max(skills[skill.key], 1)
        : { ...(skills[skill.key] ?? {}), proficient: true }
    }
    updated = { ...updated, stats: { ...(updated.stats ?? {}), skills } }
  }

  if (choices.cantrips?.length || choices.spells?.length) {
    const nextKnown = [...(updated.spells?.known ?? [])]
    for (const spell of [...(choices.cantrips ?? []), ...(choices.spells ?? [])]) {
      if (!nextKnown.some(existing => existing.index === spell.index)) {
        nextKnown.push({ ...spell, origin: feat.name })
      }
    }
    updated = {
      ...updated,
      spells: {
        ...(updated.spells ?? {}),
        known: nextKnown,
      },
    }
  }

  if (choices.weapons?.length) {
    updated = {
      ...updated,
      stats: {
        ...(updated.stats ?? {}),
        proficiencies: addProficiencies(updated.stats?.proficiencies, {
          Weapons: choices.weapons.map(weapon => `${weapon.name} proficiency`),
        }),
      },
    }
  }

  if (rule.proficiencies) {
    updated = {
      ...updated,
      stats: {
        ...(updated.stats ?? {}),
        proficiencies: addProficiencies(updated.stats?.proficiencies, rule.proficiencies),
      },
    }
  }

  if (rule.initiativeBonus) {
    updated = {
      ...updated,
      combat: {
        ...(updated.combat ?? {}),
        initiativeBonus: (updated.combat?.initiativeBonus ?? 0) + rule.initiativeBonus,
      },
    }
  }

  if (rule.speedBonus) {
    updated = {
      ...updated,
      combat: {
        ...(updated.combat ?? {}),
        speed: (updated.combat?.speed ?? 30) + rule.speedBonus,
      },
    }
  }

  if (rule.hpPerLevel) {
    const gain = rule.hpPerLevel * characterLevel(updated)
    updated = {
      ...updated,
      combat: {
        ...(updated.combat ?? {}),
        hpMax: (updated.combat?.hpMax ?? 1) + gain,
        hpCurrent: (updated.combat?.hpCurrent ?? 1) + gain,
      },
    }
  }

  if (rule.passiveBonus) {
    updated = {
      ...updated,
      stats: {
        ...(updated.stats ?? {}),
        passiveBonuses: {
          ...(updated.stats?.passiveBonuses ?? {}),
          perception: (updated.stats?.passiveBonuses?.perception ?? 0) + rule.passiveBonus,
          investigation: (updated.stats?.passiveBonuses?.investigation ?? 0) + rule.passiveBonus,
        },
      },
    }
  }

  if (choices.damageType || choices.maneuvers?.length || choices.spellClass || choices.weapons?.length) {
    const currentChoices = updated.customContent?.featChoices ?? []
    const nextChoices = [
      ...currentChoices.filter(choice => choice.featName !== feat.name),
      {
        featName: feat.name,
        damageType: choices.damageType ?? null,
        spellClass: choices.spellClass ?? null,
        cantrips: choices.cantrips ?? [],
        spells: choices.spells ?? [],
        maneuvers: choices.maneuvers ?? [],
        weapons: choices.weapons ?? [],
      },
    ]
    updated = {
      ...updated,
      customContent: {
        ...(updated.customContent ?? {}),
        featChoices: nextChoices,
      },
    }
  }

  return updated
}

// ── Step: Generic feature option choice ─────────────────────────────────────
function FeatureOptionStep({ choice, onNext, onBack }) {
  const [selected, setSelected] = useState([])
  const choose = choice?.choose ?? 1

  const toggle = (option) => {
    setSelected(prev => {
      if (prev.some(item => item.id === option.id)) return prev.filter(item => item.id !== option.id)
      if (prev.length >= choose) return prev
      return [...prev, option]
    })
  }

  return (
    <div className="lu-step">
      <div className="lu-title lu-title--gold">{choice?.feature?.name ?? 'Feature Choice'}</div>
      <div className="lu-sub">Choose {choose} {choose === 1 ? 'option' : 'options'} for this feature.</div>

      <div className="lu-feature-option-list">
        {(choice?.options ?? []).map(option => {
          const active = selected.some(item => item.id === option.id)
          return (
            <button
              key={option.id}
              className={`lu-feature-option-card${active ? ' lu-feature-option-card--selected' : ''}`}
              onClick={() => toggle(option)}
            >
              <span className="lu-feature-option-radio">{active ? '●' : '○'}</span>
              <span className="lu-feature-option-body">
                <span className="lu-feature-option-name">{option.name}</span>
                {option.desc?.[0] && <span className="lu-feature-option-desc">{option.desc[0].slice(0, 220)}{option.desc[0].length > 220 ? '…' : ''}</span>}
              </span>
              {option.source && <span className="lu-feature-option-source">{option.source}</span>}
            </button>
          )
        })}
      </div>

      <div className="lu-actions">
        <button className="lu-btn lu-btn--ghost" onClick={onBack}>← Back</button>
        <button
          className="lu-btn lu-btn--gold"
          onClick={() => onNext({ type: 'featureOption', choiceKey: choice.choiceKey, feature: choice.feature, options: selected })}
          disabled={selected.length !== choose}
        >
          Confirm Choice →
        </button>
      </div>
    </div>
  )
}

// ── Step: Skill proficiency choice ──────────────────────────────────────────
function SkillChoiceStep({ char, skillChoice, onNext, onBack }) {
  const [selected, setSelected] = useState([])
  const skills = char.stats?.skills ?? {}
  const mode = skillChoice?.mode ?? 'proficiency'
  const skillLevel = (key) => {
    const value = skills[key]
    if (typeof value === 'number') return value
    if (value?.expertise) return 2
    if (value?.proficient) return 1
    return 0
  }
  const options = skillChoice?.options?.length
    ? skillChoice.options.filter(skill => mode === 'expertise' ? skillLevel(skill.key) === 1 : skillLevel(skill.key) === 0)
    : mode === 'expertise'
    ? SKILL_OPTIONS.filter(skill => skillLevel(skill.key) === 1)
    : SKILL_OPTIONS.filter(skill => skillLevel(skill.key) === 0)
  const choose = skillChoice?.choose ?? 1
  const title = skillChoice?.title ?? skillChoice?.feature?.name ?? (mode === 'expertise' ? 'Expertise' : 'New Skill Proficiency')
  const description = skillChoice?.desc
    ?? (mode === 'expertise'
      ? `Choose ${choose} proficient ${choose === 1 ? 'skill' : 'skills'} to upgrade to expertise.`
      : `Choose ${choose} new skill ${choose === 1 ? 'proficiency' : 'proficiencies'} granted by this level.`)

  const toggle = (skill) => {
    setSelected(prev => {
      if (prev.some(s => s.key === skill.key)) return prev.filter(s => s.key !== skill.key)
      if (prev.length >= choose) return prev
      return [...prev, skill]
    })
  }

  return (
    <div className="lu-step">
      <div className="lu-title lu-title--gold">{title}</div>
      <div className="lu-sub">{description}</div>

      <div className="lu-skill-grid">
        {options.map(skill => {
          const active = selected.some(s => s.key === skill.key)
          return (
            <button
              key={skill.key}
              className={`lu-skill-chip${active ? ' lu-skill-chip--selected' : ''}`}
              onClick={() => toggle(skill)}
            >
              {skill.label}
            </button>
          )
        })}
      </div>

      <div className="lu-actions">
        <button className="lu-btn lu-btn--ghost" onClick={onBack}>← Back</button>
        <button
          className="lu-btn lu-btn--gold"
          onClick={() => onNext({ type: 'skills', mode, skills: selected })}
          disabled={selected.length !== choose}
        >
          Confirm Skills →
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  Main LevelUpModal
// ════════════════════════════════════════════════════════════════
export default function LevelUpModal({ char, onConfirm, onClose }) {
  const allowNewClass = char.settings?.multiclassing !== 'disabled'
  const shouldChooseClass = allowNewClass || (char.identity?.class ?? []).length > 1
  const [chosenClassIdx, setChosenClassIdx] = useState(shouldChooseClass ? null : 0)
  const [newClassData, setNewClassData] = useState(null)
  const [srdClasses, setSrdClasses] = useState({})
  const [stepIdx, setStepIdx] = useState(0)
  const [results, setResults] = useState([])
  const [hpMode, setHpMode] = useState('roll')
  const [manualHp, setManualHp] = useState('1')
  const selectedSubclass = results.find(result => result?.type === 'subclass')?.subclass
  const steps = useMemo(
    () => buildSteps(char, chosenClassIdx, selectedSubclass, srdClasses, newClassData),
    [char, chosenClassIdx, selectedSubclass, srdClasses, newClassData]
  )

  useEffect(() => {
    getClasses()
      .then(classes => setSrdClasses(Object.fromEntries(classes.map(cls => [cls.index, cls]))))
      .catch(() => setSrdClasses({}))
  }, [])

  // Pre-roll HP increase for the chosen class
  const rolledHpResult = useMemo(() => {
    const idx = chosenClassIdx ?? 0
    const clsName = chosenClassIdx === 'new'
      ? newClassData?.name ?? ''
      : char.identity?.class?.[idx]?.name ?? ''
    return rollHpIncrease(clsName, getConMod(char))
  }, [char, chosenClassIdx, newClassData])
  const hpResult = useMemo(
    () => hpIncreaseForMode(hpMode, rolledHpResult, manualHp),
    [hpMode, manualHp, rolledHpResult]
  )

  const currentStep = steps[stepIdx]
  const isLast      = stepIdx === steps.length - 1

  const handleNext = (result = null) => {
    if (result?.type === 'classChoice') {
      setChosenClassIdx(result.classIdx)
      setNewClassData(result.classData ?? null)
      setStepIdx(0)
      setResults([])
      return
    }
    const newResults = result ? [...results, result] : results
    const nextSelectedSubclass = result?.type === 'subclass'
      ? result.subclass
      : newResults.find(r => r?.type === 'subclass')?.subclass
    const nextSteps = buildSteps(char, chosenClassIdx, nextSelectedSubclass, srdClasses, newClassData)
    const nextIsLast = stepIdx === nextSteps.length - 1
    if (nextIsLast) {
      applyLevelUp(newResults)
    } else {
      setResults(newResults)
      setStepIdx(i => i + 1)
    }
  }

  const handleBack = () => {
    if (stepIdx === 0) {
      if (shouldChooseClass) { setChosenClassIdx(null); setNewClassData(null); return }
      onClose(); return
    }
    setResults(prev => prev.slice(0, -1))
    setStepIdx(i => i - 1)
  }

  const applyLevelUp = (allResults) => {
    const isNewClass = chosenClassIdx === 'new'
    const classIdx = chosenClassIdx ?? 0
    const cls      = char.identity?.class ?? []
    const previousCls = isNewClass ? newClassData : cls[classIdx]
    const nextLevel = isNewClass ? 1 : (previousCls?.level ?? 0) + 1
    const chosenSubclass = allResults.find(r => r.type === 'subclass')?.subclass ?? previousCls?.subclass
    const newClassEntry = isNewClass && newClassData
      ? { name: newClassData.name, index: newClassData.index, level: 1, subclass: chosenSubclass ?? null }
      : null
    const newCls = isNewClass
      ? [...cls, newClassEntry].filter(Boolean)
      : cls.map((c, i) => i === classIdx ? { ...c, level: (c.level ?? 0) + 1 } : c)
    const existingFeatures = char.customContent?.classFeatures ?? []
    const gainedFeatures = classFeaturesForLevel(srdClasses, previousCls, nextLevel, chosenSubclass)
    const featureKeys = new Set(existingFeatures.map(featureKey))
    const classFeatures = [
      ...existingFeatures,
      ...gainedFeatures.filter(feature => !featureKeys.has(featureKey(feature))),
    ]

    let updatedChar = {
      ...char,
      identity: { ...char.identity, class: newCls },
      customContent: {
        ...(char.customContent ?? {}),
        classFeatures,
      },
      combat: {
        ...char.combat,
        hpMax:     (char.combat?.hpMax ?? 10) + hpResult.total,
        hpCurrent: (char.combat?.hpCurrent ?? 10) + hpResult.total,
      },
    }
    if (isNewClass && newClassData) {
      updatedChar = applyMulticlassProficiencies(updatedChar, newClassData.index)
      if (SPELLCASTING_ABILITY[newClassData.index] && !updatedChar.spells?.spellcastingAbility) {
        updatedChar = {
          ...updatedChar,
          spells: {
            ...(updatedChar.spells ?? {}),
            spellcastingAbility: SPELLCASTING_ABILITY[newClassData.index],
          },
        }
      }
    }

    allResults.forEach(r => {
      if (r.type === 'asi' && r.choice === 'asi' && r.asiDeltas) {
        const prevAb = updatedChar.stats?.abilityScores ?? {}
        const newAb  = { ...prevAb }
        Object.entries(r.asiDeltas).forEach(([stat, delta]) => {
          if (delta > 0) {
            const key = stat.toLowerCase()
            newAb[key] = Math.min(20, (prevAb[key] ?? 10) + delta)
          }
        })
        updatedChar = { ...updatedChar, stats: { ...updatedChar.stats, abilityScores: newAb } }
      }
      if (r.type === 'asi' && r.choice === 'feat' && r.selectedFeat) {
        const feats = [
          ...(updatedChar.feats ?? []),
          {
            name: r.selectedFeat.name,
            desc: r.selectedFeat.desc,
            prereq: r.selectedFeat.prereq ?? null,
            choices: r.featChoices ?? {},
          },
        ]
        updatedChar = applyFeatRules({ ...updatedChar, feats }, r.selectedFeat, r.featChoices ?? {})
      }
      if (r.type === 'subclass' && r.subclass) {
        const targetIdx = isNewClass ? (updatedChar.identity.class ?? []).length - 1 : classIdx
        const updatedCls = (updatedChar.identity.class ?? []).map((c, i) =>
          i === targetIdx ? { ...c, subclass: r.subclass } : c
        )
        updatedChar = {
          ...updatedChar,
          identity: { ...updatedChar.identity, ...(targetIdx === 0 && { subclass: r.subclass }), class: updatedCls },
        }
      }
      if (r.type === 'spells') {
        const nextKnown = [...(updatedChar.spells?.known ?? [])]
        const nextPrepared = [...(updatedChar.spells?.prepared ?? [])]
        for (const spell of [...(r.cantrips ?? []), ...(r.spells ?? [])]) {
          if (!nextKnown.some(existing => existing.index === spell.index)) nextKnown.push(spell)
          if (spell.level > 0 && !nextPrepared.includes(spell.id)) nextPrepared.push(spell.id)
        }
        updatedChar = {
          ...updatedChar,
          spells: {
            ...(updatedChar.spells ?? {}),
            spellcastingAbility: updatedChar.spells?.spellcastingAbility ?? SPELLCASTING_ABILITY[r.spec?.key] ?? null,
            known: nextKnown,
            prepared: nextPrepared,
          },
        }
      }
      if (r.type === 'skills') {
        const currentSkills = updatedChar.stats?.skills ?? {}
        const nextSkills = { ...currentSkills }
        for (const skill of (r.skills ?? [])) {
          const previous = nextSkills[skill.key]
          if (r.mode === 'expertise') {
            nextSkills[skill.key] = typeof previous === 'number'
              ? 2
              : { ...(previous ?? {}), proficient: true, expertise: true }
          } else {
            nextSkills[skill.key] = typeof previous === 'number'
              ? Math.max(previous, 1)
              : { ...(previous ?? {}), proficient: true }
          }
        }
        updatedChar = {
          ...updatedChar,
          stats: { ...(updatedChar.stats ?? {}), skills: nextSkills },
        }
      }
      if (r.type === 'featureOption') {
        const currentChoices = updatedChar.customContent?.classFeatureChoices ?? []
        const nextChoices = [
          ...currentChoices.filter(choice => (choice.choiceKey ?? choice.featureIndex) !== (r.choiceKey ?? r.feature?.index)),
          {
            choiceKey: r.choiceKey,
            featureIndex: r.feature?.index,
            featureName: r.feature?.name,
            className: r.feature?.className,
            classIndex: r.feature?.classIndex,
            gainedAtLevel: r.feature?.level,
            options: (r.options ?? []).map(option => ({
              id: option.id,
              name: option.name,
              source: option.source,
              desc: option.desc,
              featureType: option.featureType,
            })),
          },
        ]
        updatedChar = {
          ...updatedChar,
          customContent: {
            ...(updatedChar.customContent ?? {}),
            classFeatureChoices: nextChoices,
          },
        }
      }
    })

    const slotData = getSlotsForCharacter(updatedChar.identity.class ?? [])
    if (Object.keys(slotData.slots).length > 0 || Object.keys(slotData.pactSlots).length > 0) {
      updatedChar = {
        ...updatedChar,
        spells: {
          ...(updatedChar.spells ?? {}),
          slots: mergeSlots(updatedChar.spells?.slots ?? {}, slotData.slots),
          pactSlots: mergeSlots(updatedChar.spells?.pactSlots ?? {}, slotData.pactSlots),
        },
      }
    }

    onConfirm(updatedChar)
  }

  return (
    <div className="lu-overlay" onClick={onClose}>
      <div className="lu-sheet" onClick={e => e.stopPropagation()}>
        <div className="lu-handle" />

        <StepIndicator total={steps.length} current={stepIdx} />

        {currentStep?.type === 'classChoice' && (
          <ClassChoiceStep
            char={char}
            srdClasses={srdClasses}
            allowNewClass={allowNewClass}
            onNext={handleNext}
            onBack={onClose}
          />
        )}

        {currentStep?.type === 'features' && chosenClassIdx != null && (
          <FeaturesStep
            char={char}
            classIdx={chosenClassIdx}
            newClassData={newClassData}
            hpResult={hpResult}
            hpMode={hpMode}
            onHpMode={setHpMode}
            manualHp={manualHp}
            onManualHp={setManualHp}
            srdClasses={srdClasses}
            onNext={() => handleNext()}
            onBack={handleBack}
            isLast={isLast}
          />
        )}

        {currentStep?.type === 'asi' && chosenClassIdx != null && (
          <ASIStep
            char={char}
            classIdx={chosenClassIdx}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep?.type === 'subclass' && chosenClassIdx != null && (
          <SubclassStep
            char={char}
            classIdx={chosenClassIdx}
            newClassData={newClassData}
            srdClasses={srdClasses}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep?.type === 'spells' && chosenClassIdx != null && (
          <SpellUnlockStep
            char={char}
            classIdx={chosenClassIdx}
            subclass={selectedSubclass ?? char.identity?.class?.[chosenClassIdx]?.subclass}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep?.type === 'featureOption' && chosenClassIdx != null && (
          <FeatureOptionStep
            choice={currentStep.choice}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep?.type === 'skills' && chosenClassIdx != null && (
          <SkillChoiceStep
            char={char}
            skillChoice={currentStep.skillChoice}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  )
}

// ── Helper export for triggering the modal ────────────────────
export function checkLevelUp(char) {
  if (char.settings?.milestoneMode) return false
  const xp       = char.identity?.xp ?? 0
  const total    = xpToLevel(xp)
  const assigned = assignedLevel(char)
  return total > assigned && assigned < 20
}
