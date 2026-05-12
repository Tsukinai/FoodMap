import { searchOneMap, getPlanningArea } from './onemap'

export type ResolvedLocation =
  | { kind: 'areas'; areas: string[]; label: string }
  | {
      kind: 'point'
      lat: number
      lng: number
      radius_km: number
      label: string
      planning_area: string | null
    }

// Chinese place name → English geocode query for OneMap.
// OneMap doesn't index Chinese names, so we translate before calling it.
const CN_TO_EN: Record<string, string> = {
  '乌节路': 'Orchard Road',
  '牛车水': 'Chinatown',
  '芽笼': 'Geylang',
  '大巴窑': 'Toa Payoh',
  '碧山': 'Bishan',
  '义顺': 'Yishun',
  '淡滨尼': 'Tampines',
  '兀兰': 'Woodlands',
  '后港': 'Hougang',
  '盛港': 'Sengkang',
  '榜鹅': 'Punggol',
  '白沙': 'Pasir Ris',
  '勿洛': 'Bedok',
  '武吉班让': 'Bukit Panjang',
  '蔡厝港': 'Choa Chu Kang',
  '裕廊东': 'Jurong East',
  '裕廊西': 'Jurong West',
  '裕廊': 'Jurong East',
  '金文泰': 'Clementi',
  '武吉知马': 'Bukit Timah',
  '荷兰村': 'Holland Village',
  '丹戎巴葛': 'Tanjong Pagar',
  '女皇镇': 'Queenstown',
  '纽顿': 'Newton',
  '东陵': 'Tanglin',
  '诺维娜': 'Novena',
  '滨海湾': 'Marina Bay',
  '武吉美拉': 'Bukit Merah',
  '小印度': 'Little India',
  '武吉士': 'Bugis',
  '实龙岗': 'Serangoon',
  '宏茂桥': 'Ang Mo Kio',
  '巴耶利峇': 'Paya Lebar',
  '三巴旺': 'Sembawang',
  '万礼': 'Mandai',
  '先驱': 'Pioneer',
  '文礼': 'Boon Lay',
  '港湾': 'HarbourFront',
  '圣淘沙': 'Sentosa',
  '樟宜': 'Changi',
}

// Singapore region keyword → planning areas. Used to expand "中部"/"east" etc.
// Keep planning area names in OneMap's exact casing so intersection with
// availableAreas (also OneMap-sourced) succeeds.
const SG_REGIONS: Record<string, { aliases: string[]; areas: string[] }> = {
  central: {
    aliases: ['中部', '中区', '中心', '市中心', 'central'],
    areas: [
      'Orchard', 'Newton', 'Tanglin', 'Novena', 'Toa Payoh', 'Bishan',
      'Bukit Timah', 'Bukit Merah', 'Queenstown', 'Outram', 'Rochor', 'Museum',
      'Downtown Core', 'Marina South', 'Marina East', 'River Valley',
      'Singapore River', 'Kallang', 'Geylang', 'Marine Parade',
    ],
  },
  north: {
    aliases: ['北部', '北边', '北区', 'north'],
    areas: [
      'Yishun', 'Sembawang', 'Woodlands', 'Mandai',
      'Central Water Catchment', 'Lim Chu Kang',
    ],
  },
  east: {
    aliases: ['东部', '东边', '东区', 'east'],
    areas: ['Bedok', 'Tampines', 'Pasir Ris', 'Changi', 'Paya Lebar', 'Changi Bay'],
  },
  northeast: {
    aliases: ['东北部', '东北', 'northeast', 'north-east', 'north east'],
    areas: [
      'Ang Mo Kio', 'Hougang', 'Sengkang', 'Punggol', 'Serangoon', 'Seletar',
    ],
  },
  west: {
    aliases: ['西部', '西边', '西区', 'west'],
    areas: [
      'Clementi', 'Jurong East', 'Jurong West', 'Bukit Batok', 'Bukit Panjang',
      'Choa Chu Kang', 'Boon Lay', 'Pioneer', 'Tengah', 'Tuas',
    ],
  },
  south: {
    aliases: ['南部', '南边', '南区', 'south'],
    areas: ['HarbourFront', 'Bukit Merah', 'Sentosa', 'Southern Islands'],
  },
}

function matchRegion(query: string): { areas: string[] } | null {
  const lower = query.trim().toLowerCase()
  if (!lower) return null
  // Longest alias first so "northeast" beats "east".
  const all = Object.values(SG_REGIONS)
    .flatMap(r => r.aliases.map(alias => ({ alias: alias.toLowerCase(), areas: r.areas })))
    .sort((a, b) => b.alias.length - a.alias.length)
  for (const { alias, areas } of all) {
    const isCJK = /[一-鿿]/.test(alias)
    const matched = isCJK
      ? lower.includes(alias)
      // Word-boundary for English so "easter dinner" doesn't match "east".
      : lower === alias || new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lower)
    if (matched) return { areas }
  }
  return null
}

export async function resolveLocation(
  query: string,
  availableAreas: string[],
  opts?: { radiusHint?: number },
): Promise<ResolvedLocation | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  const areaMap = new Map(availableAreas.map(a => [a.toLowerCase(), a]))

  // 1. Exact case-insensitive planning area name (only those with data on the map).
  const exact = areaMap.get(trimmed.toLowerCase())
  if (exact) return { kind: 'areas', areas: [exact], label: exact }

  // 2. Region keyword (中部/east/...) intersected with availableAreas.
  const region = matchRegion(trimmed)
  if (region) {
    const intersected = region.areas
      .map(a => areaMap.get(a.toLowerCase()))
      .filter((a): a is string => !!a)
    if (intersected.length > 0) {
      return { kind: 'areas', areas: intersected, label: trimmed }
    }
    // Region matched but no data → fall through; OneMap won't know "中部"
    // either, so we'll likely return null and the route applies no geo filter.
  }

  // 3. OneMap geocode → point + radius. Reverse-look the planning area for
  // display context. Translate Chinese names first — OneMap doesn't index them.
  const geocodeQuery = CN_TO_EN[trimmed] ?? trimmed
  const geo = await searchOneMap(geocodeQuery)
  if (geo.length > 0) {
    const lat = parseFloat(geo[0].LATITUDE)
    const lng = parseFloat(geo[0].LONGITUDE)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const planning_area = await getPlanningArea(lat, lng)
      const radius_km = opts?.radiusHint ?? 2
      return { kind: 'point', lat, lng, radius_km, label: trimmed, planning_area }
    }
  }

  return null
}
