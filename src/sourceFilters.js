export const ALL_SOURCES = 'all'

const SOURCE_ORDER = [
  'PHB', 'XPHB', 'DMG', 'XDMG', 'MM', 'XMM',
  'TCE', 'XGE', 'SCAG', 'MPMM', 'MOT', 'FTD',
]

const SOURCE_EQUIVALENTS = {
  PHB: ['XPHB'],
  XPHB: ['PHB'],
  DMG: ['XDMG'],
  XDMG: ['DMG'],
  MM: ['XMM'],
  XMM: ['MM'],
}

export function sourceCode(item) {
  return item?.sourceBook || item?.source || 'Unknown'
}

export function sourceOptions(items) {
  return [...new Set((items ?? []).map(sourceCode).filter(Boolean))]
    .sort((a, b) => {
      const ai = SOURCE_ORDER.indexOf(a)
      const bi = SOURCE_ORDER.indexOf(b)
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      return a.localeCompare(b)
    })
}

export function matchesSource(item, selectedSource) {
  return selectedSource === ALL_SOURCES || sourceCode(item) === selectedSource
}

export function effectiveSourceFilter(items, selectedSource) {
  if (selectedSource === ALL_SOURCES) return ALL_SOURCES

  const available = new Set((items ?? []).map(sourceCode))
  if (available.has(selectedSource)) return selectedSource

  const equivalent = (SOURCE_EQUIVALENTS[selectedSource] ?? []).find(source => available.has(source))
  return equivalent ?? ALL_SOURCES
}

export function filterBySearchAndSource(items, search, selectedSource, getSearchText = item => item?.name ?? '') {
  const q = search.trim().toLowerCase()
  const effectiveSource = effectiveSourceFilter(items, selectedSource)
  return (items ?? []).filter(item => {
    if (!matchesSource(item, effectiveSource)) return false
    if (!q) return true
    return getSearchText(item).toLowerCase().includes(q)
  })
}
