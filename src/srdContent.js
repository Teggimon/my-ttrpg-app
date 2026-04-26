const REPO_BASE = 'https://raw.githubusercontent.com/Teggimon/ttrpg-srd-content/main'

const cache = {}

async function fetchJSON(path) {
  if (cache[path]) return cache[path]
  
  const response = await fetch(`${REPO_BASE}/${path}`)
  const data = await response.json()
  cache[path] = data
  return data
}

export async function getClasses() {
  return fetchJSON('classes/classes.json')
}

export async function getRaces() {
  return fetchJSON('races/races.json')
}

export async function getBackgrounds() {
  return fetchJSON('backgrounds/backgrounds.json')
}