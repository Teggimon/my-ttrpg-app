import { useState, useMemo } from 'react'
import './LevelUpModal.css'

// ── D&D 5e data ───────────────────────────────────────────────

const HIT_DICE = {
  barbarian: 12, fighter: 10, paladin: 10, ranger: 10,
  monk: 8, bard: 8, cleric: 8, druid: 8, rogue: 8, warlock: 8,
  artificer: 8, wizard: 6, sorcerer: 6,
}

const PROF_BONUS = [2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6]

const XP_THRESHOLDS = [0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000]

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
const SUBCLASS_LEVELS = {
  barbarian: [3], bard: [3], cleric: [1], druid: [2],
  fighter: [3], monk: [3], paladin: [3], ranger: [3],
  rogue: [3], sorcerer: [1], warlock: [1], wizard: [2],
  artificer: [3],
}

// Subclass options (condensed SRD set)
const SUBCLASSES = {
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
const FEATS = [
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

const SKILLS = [
  'Acrobatics','Animal Handling','Arcana','Athletics','Deception',
  'History','Insight','Intimidation','Investigation','Medicine',
  'Nature','Perception','Performance','Persuasion','Religion',
  'Sleight of Hand','Stealth','Survival',
]

const ABILITY_SCORES = ['STR','DEX','CON','INT','WIS','CHA']

// ── D&D logic helpers ─────────────────────────────────────────

export function xpToLevel(xp) {
  return Math.max(1, XP_THRESHOLDS.filter(t => xp >= t).length)
}

function rollHpIncrease(className, conMod) {
  const die = HIT_DICE[className?.toLowerCase()] ?? 8
  const roll = Math.floor(Math.random() * die) + 1
  return { roll, conMod, total: Math.max(1, roll + conMod), die }
}

function getConMod(char) {
  const con = char.stats?.abilityScores?.con ?? char.stats?.CON ?? char.abilities?.constitution ?? 10
  return Math.floor((con - 10) / 2)
}

// Total levels assigned across all classes (the distribution)
function assignedLevel(char) {
  return (char.identity?.class ?? []).reduce((s, c) => s + (c.level ?? 0), 0)
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
  return !already && (SUBCLASS_LEVELS[cls] ?? []).includes(lvl)
}

// Build step list once class is chosen
function buildSteps(char, classIdx) {
  const steps = []
  const isMulticlass = (char.identity?.class ?? []).length > 1
  if (isMulticlass && classIdx == null) {
    steps.push({ type: 'classChoice' })
    return steps
  }
  const idx = classIdx ?? 0
  steps.push({ type: 'features' })
  if (hasASI(char, idx))           steps.push({ type: 'asi' })
  if (hasSubclassChoice(char, idx)) steps.push({ type: 'subclass' })
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
function ClassChoiceStep({ char, onNext, onBack }) {
  const classes = char.identity?.class ?? []
  const [selected, setSelected] = useState(null)
  return (
    <div className="lu-step">
      <div className="lu-title">⬆ Level Up — Choose Class</div>
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
      </div>
      <div className="lu-actions">
        <button className="lu-btn lu-btn--ghost" onClick={onBack}>← Back</button>
        <button
          className="lu-btn lu-btn--primary"
          onClick={() => onNext({ type: 'classChoice', classIdx: selected })}
          disabled={selected == null}
        >Next →</button>
      </div>
    </div>
  )
}

// ── Step: New Features (simple level) ────────────────────────
function FeaturesStep({ char, classIdx, hpResult, onNext, isLast }) {
  const lvl        = nextClassLevel(char, classIdx)
  const cls        = char.identity?.class?.[classIdx]?.name ?? 'your class'
  const totalLvl   = assignedLevel(char) + 1
  const oldProf    = PROF_BONUS[totalLvl - 2] ?? 2
  const newProf    = PROF_BONUS[totalLvl - 1] ?? 2
  const profChange = newProf > oldProf

  return (
    <div className="lu-step">
      <div className="lu-title">⬆ Level Up — {cls} {lvl}</div>
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
            Max HP increases by 1d{hpResult.die} + CON modifier.{' '}
            Auto-applied:{' '}
            <strong className="lu-hp-gain">+{hpResult.total} HP</strong>
            {' '}(rolled {hpResult.roll} + CON {hpResult.conMod >= 0 ? '+' : ''}{hpResult.conMod})
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
  const [featSearch, setFeatSearch]     = useState('')

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

  const canConfirm =
    (choice === 'asi' && pointsUsed === 2) ||
    (choice === 'feat' && selectedFeat)

  const handleConfirm = () => {
    onNext({
      type: 'asi',
      choice,
      asiDeltas:   choice === 'asi' ? asiPoints : null,
      selectedFeat: choice === 'feat' ? selectedFeat : null,
    })
  }

  return (
    <div className="lu-step">
      <div className="lu-title lu-title--gold">⬆ Level {nextClassLevel(char, classIdx)} — Improvement</div>
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
          <button className="lu-change-choice" onClick={() => { setChoice(null); setSelectedFeat(null) }}>← Change choice</button>
          <input
            className="lu-feat-search"
            placeholder="Search feats…"
            value={featSearch}
            onChange={e => setFeatSearch(e.target.value)}
          />
          <div className="lu-feat-list">
            {filteredFeats.map(feat => (
              <button
                key={feat.name}
                className={`lu-feat-row${selectedFeat?.name === feat.name ? ' lu-feat-row--selected' : ''}`}
                onClick={() => setSelectedFeat(feat)}
              >
                <div className="lu-feat-header">
                  <div className="lu-feat-name">{feat.name}</div>
                  {feat.prereq && <div className="lu-feat-prereq">Requires: {feat.prereq}</div>}
                </div>
                <div className="lu-feat-desc">{feat.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="lu-warning lu-warning--gold">
        ⚠ This is a permanent character-defining choice.
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
function SubclassStep({ char, classIdx, onNext, onBack }) {
  const [selected, setSelected] = useState(null)
  const clsObj   = char.identity?.class?.[classIdx] ?? char.identity?.class?.[0]
  const cls      = (clsObj?.name ?? '').toLowerCase()
  const lvl      = nextClassLevel(char, classIdx)
  const options  = SUBCLASSES[cls] ?? []

  return (
    <div className="lu-step">
      <div className="lu-title lu-title--gold">Choose Your Archetype</div>
      <div className="lu-sub">
        At {clsObj?.name} level {lvl}, you choose a subclass that defines your path.
      </div>

      <div className="lu-warning lu-warning--gold">
        ⚠ This is a permanent choice. It cannot be changed later.
      </div>

      <div className="lu-subclass-list">
        {options.map(name => (
          <button
            key={name}
            className={`lu-subclass-card${selected === name ? ' lu-subclass-card--selected' : ''}`}
            onClick={() => setSelected(name)}
          >
            <div className="lu-subclass-radio">
              <div className={`lu-radio-dot${selected === name ? ' lu-radio-dot--active' : ''}`} />
            </div>
            <div className="lu-subclass-name">{name}</div>
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

// ════════════════════════════════════════════════════════════════
//  Main LevelUpModal
// ════════════════════════════════════════════════════════════════
export default function LevelUpModal({ char, onConfirm, onClose }) {
  const isMulticlass = (char.identity?.class ?? []).length > 1
  const [chosenClassIdx, setChosenClassIdx] = useState(isMulticlass ? null : 0)
  const steps     = useMemo(() => buildSteps(char, chosenClassIdx), [char, chosenClassIdx])
  const [stepIdx, setStepIdx] = useState(0)
  const [results, setResults] = useState([])

  // Pre-roll HP increase for the chosen class
  const hpResult = useMemo(() => {
    const idx    = chosenClassIdx ?? 0
    const clsName = char.identity?.class?.[idx]?.name ?? ''
    return rollHpIncrease(clsName, getConMod(char))
  }, [char, chosenClassIdx])

  const currentStep = steps[stepIdx]
  const isLast      = stepIdx === steps.length - 1

  const handleNext = (result = null) => {
    if (result?.type === 'classChoice') {
      setChosenClassIdx(result.classIdx)
      setStepIdx(0)
      setResults([])
      return
    }
    const newResults = result ? [...results, result] : results
    if (isLast) {
      applyLevelUp(newResults)
    } else {
      setResults(newResults)
      setStepIdx(i => i + 1)
    }
  }

  const handleBack = () => {
    if (stepIdx === 0) {
      if (isMulticlass) { setChosenClassIdx(null); return }
      onClose(); return
    }
    setResults(prev => prev.slice(0, -1))
    setStepIdx(i => i - 1)
  }

  const applyLevelUp = (allResults) => {
    const classIdx = chosenClassIdx ?? 0
    const cls      = char.identity?.class ?? []
    const newCls   = cls.map((c, i) => i === classIdx ? { ...c, level: (c.level ?? 0) + 1 } : c)

    let updatedChar = {
      ...char,
      identity: { ...char.identity, class: newCls },
      combat: {
        ...char.combat,
        hpMax:     (char.combat?.hpMax ?? 10) + hpResult.total,
        hpCurrent: (char.combat?.hpCurrent ?? 10) + hpResult.total,
      },
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
        const feats = [...(updatedChar.feats ?? []), { name: r.selectedFeat.name, desc: r.selectedFeat.desc }]
        updatedChar = { ...updatedChar, feats }
      }
      if (r.type === 'subclass' && r.subclass) {
        const updatedCls = (updatedChar.identity.class ?? []).map((c, i) =>
          i === classIdx ? { ...c, subclass: r.subclass } : c
        )
        updatedChar = {
          ...updatedChar,
          identity: { ...updatedChar.identity, subclass: r.subclass, class: updatedCls },
        }
      }
    })

    onConfirm(updatedChar)
  }

  return (
    <div className="lu-overlay" onClick={onClose}>
      <div className="lu-sheet" onClick={e => e.stopPropagation()}>
        <div className="lu-handle" />

        <StepIndicator total={steps.length} current={stepIdx} />

        {currentStep?.type === 'classChoice' && (
          <ClassChoiceStep char={char} onNext={handleNext} onBack={onClose} />
        )}

        {currentStep?.type === 'features' && chosenClassIdx != null && (
          <FeaturesStep
            char={char}
            classIdx={chosenClassIdx}
            hpResult={hpResult}
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
