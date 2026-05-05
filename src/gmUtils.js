const CHAR_REPO = 'ttrpg-characters'

// ─── GitHub Fetching ──────────────────────────────────────────────────────────

/**
 * Fetch all character JSON files from a player's ttrpg-characters repo.
 * Returns array of parsed character objects with _username and _fileName attached.
 */
export async function fetchPlayerCharacters(username) {
  const listUrl = `https://api.github.com/repos/${username}/${CHAR_REPO}/contents/characters`
  const listRes = await fetch(listUrl, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  })

  if (!listRes.ok) {
    if (listRes.status === 404) {
      throw new Error(
        `No character repo found for @${username}. They may not have set up the app yet.`
      )
    }
    if (listRes.status === 403) {
      throw new Error(
        `Rate limited by GitHub. Wait a moment and try again.`
      )
    }
    throw new Error(`Could not reach @${username}'s repo (HTTP ${listRes.status})`)
  }

  const files = await listRes.json()
  const jsonFiles = files.filter(f => f.name.endsWith('.json'))

  if (jsonFiles.length === 0) {
    throw new Error(`@${username} has no characters yet.`)
  }

  const chars = await Promise.all(
    jsonFiles.map(async f => {
      const res = await fetch(f.download_url)
      if (!res.ok) throw new Error(`Failed to load ${f.name}`)
      const char = await res.json()
      return { ...char, _username: username, _fileName: f.name }
    })
  )

  return chars
}

/**
 * Fetch a single character file by username + fileName.
 * Cache-busted so polling always gets fresh data.
 */
export async function fetchSingleCharacter(username, fileName) {
  const url = `https://raw.githubusercontent.com/${username}/${CHAR_REPO}/main/characters/${fileName}?_=${Date.now()}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Could not load ${fileName} for @${username}`)
  }
  return res.json()
}

// ─── Derived Stat Helpers ─────────────────────────────────────────────────────

export function profBonus(char) {
  const level = char.identity?.class?.[0]?.level ?? 1
  return Math.ceil(1 + level / 4)
}

export function abilityMod(score) {
  return Math.floor(((score ?? 10) - 10) / 2)
}

export function fmtMod(n) {
  return n >= 0 ? `+${n}` : `${n}`
}

export function passivePerception(char) {
  const wis = char.stats?.abilityScores?.wis ?? 10
  const wisMod = abilityMod(wis)
  const prof = char.stats?.skills?.perception?.proficient ? profBonus(char) : 0
  const expert = char.stats?.skills?.perception?.expertise ? profBonus(char) : 0
  return 10 + wisMod + prof + expert
}

export function initiativeMod(char) {
  const dex = char.stats?.abilityScores?.dex ?? 10
  return fmtMod(abilityMod(dex))
}

/**
 * Returns { dc, atk } for spellcasting characters, or null for non-casters.
 */
export function spellStats(char) {
  const ab = char.spells?.spellcastingAbility
  if (!ab) return null
  const score = char.stats?.abilityScores?.[ab.toLowerCase()] ?? 10
  const mod = abilityMod(score)
  const pb = profBonus(char)
  return {
    dc: 8 + mod + pb,
    atk: fmtMod(mod + pb),
  }
}

export function hpPercent(char) {
  if (!char.combat?.hpMax) return 0
  return Math.min(100, Math.round((char.combat.hpCurrent / char.combat.hpMax) * 100))
}

export function hpColour(pct) {
  if (pct > 50) return 'var(--hp-high)'
  if (pct > 25) return 'var(--hp-mid)'
  return 'var(--hp-low)'
}

export function isWarning(char) {
  return hpPercent(char) < 25 || (char.combat?.conditions?.length ?? 0) > 0
}

/**
 * Returns the total character level across all multiclass levels.
 */
export function totalLevel(char) {
  return (char.identity?.class ?? []).reduce((sum, c) => sum + (c.level ?? 0), 0)
}

/**
 * Short class/level string e.g. "Ranger 8" or "Ranger 6 / Druid 2"
 */
export function classLine(char) {
  return (char.identity?.class ?? [])
    .map(c => `${c.name} ${c.level}`)
    .join(' / ')
}
