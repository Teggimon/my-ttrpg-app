const BASE = 'https://raw.githubusercontent.com/Teggimon/ttrpg-srd-content/master/5e_PHB_2014'
const cache = {}

async function load(file) {
  if (cache[file]) return cache[file]
  const res = await fetch(`${BASE}/${file}`)
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`)
  const data = await res.json()
  cache[file] = data
  return data
}

export const getSpells = () => load('5e-SRD-Spells.json')
export const getEquipment = () => load('5e-SRD-Equipment.json')
export const getMagicItems = () => load('5e-SRD-Magic-Items.json')
export const getClasses = () => load('5e-SRD-Classes.json')
export const getRaces = () => load('5e-SRD-Races.json')
export const getSubraces = () => load('5e-SRD-Subraces.json')
export const getBackgrounds = () => load('5e-SRD-Backgrounds.json')
export const getConditions = () => load('5e-SRD-Conditions.json')
export const getMonsters = () => load('5e-SRD-Monsters.json')
