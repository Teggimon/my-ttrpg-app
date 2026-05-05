const CHAR_REPO = 'ttrpg-characters'

export async function fetchPlayerCharacters(username) {
  const url = `https://api.github.com/repos/${username}/${CHAR_REPO}/contents/characters`
  const res = await fetch(url, { headers: { Accept: 'application/vnd.github.v3+json' } })

  if (!res.ok) {
    if (res.status === 404) throw new Error(`No character repo found for @${username}. Have they set up the app yet?`)
    if (res.status === 403) throw new Error('GitHub rate limit hit — wait a moment and try again.')
    throw new Error(`Could not reach @${username}'s repo (HTTP ${res.status})`)
  }

  const files = await res.json()
  const jsonFiles = files.filter(f => f.name.endsWith('.json'))
  if (!jsonFiles.length) throw new Error(`@${username} has no characters yet.`)

  return Promise.all(
    jsonFiles.map(async f => {
      const r = await fetch(f.download_url)
      if (!r.ok) throw new Error(`Failed to load ${f.name}`)
      const char = await r.json()
      return { ...char, _username: username, _fileName: f.name }
    })
  )
}

export async function fetchSingleCharacter(username, fileName) {
  const url = `https://raw.githubusercontent.com/${username}/${CHAR_REPO}/main/characters/${fileName}?_=${Date.now()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${fileName} for @${username}`)
  return res.json()
}

export function profBonus(char) {
  const level = (char.identity?.class ?? []).reduce((s, c) => s + (c.level ?? 0), 0) || 1
  return Math.ceil(1 + level / 4)
}

export function abilityMod(score) { return Math.floor(((score ?? 10) - 10) / 2) }
export function fmtMod(n) { return n >= 0 ? `+${n}` : `${n}` }

export function passivePerception(char) {
  const wis  = char.stats?.abilityScores?.wis ?? 10
  const prof  = char.stats?.skills?.perception?.proficient  ? profBonus(char) : 0
  const extra = char.stats?.skills?.perception?.expertise   ? profBonus(char) : 0
  return 10 + abilityMod(wis) + prof + extra
}

export function initiativeMod(char) {
  return fmtMod(abilityMod(char.stats?.abilityScores?.dex ?? 10))
}

export function spellStats(char) {
  const ab = char.spells?.spellcastingAbility
  if (!ab) return null
  const mod = abilityMod(char.stats?.abilityScores?.[ab.toLowerCase()] ?? 10)
  const pb  = profBonus(char)
  return { dc: 8 + mod + pb, atk: fmtMod(mod + pb) }
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

export function classLine(char) {
  return (char.identity?.class ?? []).map(c => `${c.name} ${c.level}`).join(' / ')
}
