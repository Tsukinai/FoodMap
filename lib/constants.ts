export const SINGAPORE_CENTER = { lng: 103.8198, lat: 1.3521 }
export const SINGAPORE_ZOOM = 11
export const SINGAPORE_BOUNDS: [[number, number], [number, number]] = [
  [103.60, 1.17],
  [104.05, 1.49],
]


export const POSTAL_SECTOR_TO_REGION: Record<string, string> = {
  // D01: Raffles Place, Cecil, Marina, People's Park
  '01': 'Chinatown/CBD', '02': 'Chinatown/CBD', '03': 'Chinatown/CBD',
  '04': 'Chinatown/CBD', '05': 'Chinatown/CBD', '06': 'Chinatown/CBD',
  // D02: Anson, Tanjong Pagar
  '07': 'Tanjong Pagar', '08': 'Tanjong Pagar',
  // D04: Telok Blangah, Harbourfront
  '09': 'Harbourfront', '10': 'Harbourfront',
  // D05: Pasir Panjang, West Coast, Clementi New Town
  '11': 'Clementi', '12': 'Clementi', '13': 'Clementi',
  // D03: Queenstown, Tiong Bahru, Redhill
  '14': 'Queenstown', '15': 'Queenstown', '16': 'Queenstown',
  // D06: High Street, Clarke Quay
  '17': 'Clarke Quay', '18': 'Bugis',
  // D07: Beach Road, Bugis, Golden Mile
  '19': 'Bugis', '20': 'Little India',
  // D08: Little India, Farrer Park, Serangoon Road
  '21': 'Little India', '22': 'Orchard', '23': 'Orchard',
  // D09: Orchard, Cairnhill, River Valley
  '24': 'Orchard', '25': 'Orchard', '26': 'Orchard', '27': 'Bukit Timah/Holland',
  // D10: Ardmore, Bukit Timah, Holland Road, Tanglin
  '28': 'Bukit Timah/Holland', '29': 'Bukit Timah/Holland', '30': 'Bukit Timah/Holland',
  // D11: Watten Estate, Novena, Thomson
  '31': 'Novena/Thomson', '32': 'Novena/Thomson', '33': 'Novena/Thomson',
  // D12: Balestier, Toa Payoh, Serangoon
  '34': 'Toa Payoh', '35': 'Toa Payoh', '36': 'Toa Payoh', '37': 'Toa Payoh',
  // D13: Macpherson, Braddell
  '38': 'Macpherson', '39': 'Macpherson', '40': 'Macpherson', '41': 'Macpherson',
  // D14: Geylang, Eunos
  '42': 'Geylang', '43': 'Geylang', '44': 'Geylang', '45': 'Geylang',
  // D15: Katong, Joo Chiat, Amber Road
  '46': 'East Coast', '47': 'East Coast', '48': 'East Coast', '49': 'East Coast', '50': 'East Coast',
  // D16: Bedok, Upper East Coast
  '51': 'Bedok', '52': 'Bedok', '53': 'Bedok', '54': 'Bedok', '55': 'Bedok',
  // D17: Loyang, Changi
  '56': 'Changi', '57': 'Changi',
  // D18: Tampines, Pasir Ris
  '58': 'Tampines/Pasir Ris', '59': 'Tampines/Pasir Ris',
  // D19: Jurong East, Jurong West, Boon Lay
  '60': 'Jurong/Boon Lay', '61': 'Jurong/Boon Lay', '62': 'Jurong/Boon Lay',
  '63': 'Jurong/Boon Lay', '64': 'Jurong/Boon Lay',
  // D20: Bishan, Ang Mo Kio
  '65': 'Ang Mo Kio', '66': 'Ang Mo Kio', '67': 'Ang Mo Kio', '68': 'Ang Mo Kio',
  // D21: Upper Bukit Timah, Clementi Park, Ulu Pandan
  '69': 'Clementi', '70': 'Clementi', '71': 'Clementi',
  // D22: Jurong, Boon Lay
  '72': 'Jurong/Boon Lay', '73': 'Jurong/Boon Lay',
  // D23: Hillview, Dairy Farm, Bukit Panjang, Choa Chu Kang
  '75': 'Choa Chu Kang', '76': 'Choa Chu Kang',
  // D24: Lim Chu Kang, Tengah
  '77': 'Lim Chu Kang', '78': 'Lim Chu Kang',
  // D25: Kranji, Woodlands
  '79': 'Woodlands', '80': 'Woodlands',
  // D26: Upper Thomson, Springleaf
  '81': 'Upper Thomson', '82': 'Upper Thomson',
  // D27: Yishun, Sembawang
  '83': 'Yishun/Sembawang', '84': 'Yishun/Sembawang',
  '85': 'Yishun/Sembawang', '86': 'Yishun/Sembawang',
  // D28: Seletar, Punggol, Sengkang
  '87': 'Seletar/Punggol', '88': 'Seletar/Punggol', '89': 'Seletar/Punggol',
  '90': 'Seletar/Punggol', '91': 'Seletar/Punggol',
}

export const REGION_ORDER = [
  // Central
  'Chinatown/CBD', 'Tanjong Pagar', 'Harbourfront', 'Queenstown',
  'Clarke Quay', 'Bugis', 'Little India', 'Orchard',
  'Bukit Timah/Holland', 'Novena/Thomson', 'Toa Payoh', 'Macpherson',
  // East
  'Geylang', 'East Coast', 'Bedok', 'Changi', 'Tampines/Pasir Ris',
  // North-East
  'Hougang/Punggol', 'Ang Mo Kio', 'Upper Thomson',
  // West
  'Pasir Panjang', 'Clementi', 'Jurong/Boon Lay', 'Choa Chu Kang',
  // North
  'Lim Chu Kang', 'Woodlands', 'Yishun/Sembawang', 'Seletar/Punggol',
] as const

export function postalCodeToRegion(postalCode: string | null | undefined): string | null {
  if (!postalCode) return null
  return POSTAL_SECTOR_TO_REGION[postalCode.trim().slice(0, 2)] ?? null
}

export const SINGAPORE_REGION_GROUPS: { label: string; areas: string[] }[] = [
  {
    label: '中部',
    areas: ['BISHAN', 'BUKIT MERAH', 'BUKIT TIMAH', 'DOWNTOWN CORE', 'GEYLANG', 'KALLANG', 'MARINA EAST', 'MARINA SOUTH', 'MUSEUM', 'NEWTON', 'NOVENA', 'OUTRAM', 'QUEENSTOWN', 'RIVER VALLEY', 'ROCHOR', 'SINGAPORE RIVER', 'SOUTHERN ISLANDS', 'STRAITS VIEW', 'TANGLIN', 'TOA PAYOH'],
  },
  {
    label: '东部',
    areas: ['BEDOK', 'CHANGI', 'CHANGI BAY', 'PASIR RIS', 'PAYA LEBAR', 'TAMPINES'],
  },
  {
    label: '北部',
    areas: ['CENTRAL WATER CATCHMENT', 'LIM CHU KANG', 'MANDAI', 'SEMBAWANG', 'SIMPANG', 'SUNGEI KADUT', 'WOODLANDS', 'YISHUN'],
  },
  {
    label: '东北部',
    areas: ['ANG MO KIO', 'HOUGANG', 'NORTH-EASTERN ISLANDS', 'PUNGGOL', 'SENGKANG', 'SERANGOON'],
  },
  {
    label: '西部',
    areas: ['BOON LAY', 'BUKIT BATOK', 'BUKIT PANJANG', 'CHOA CHU KANG', 'CLEMENTI', 'JURONG EAST', 'JURONG WEST', 'PIONEER', 'TENGAH', 'TUAS', 'WESTERN ISLANDS', 'WESTERN WATER CATCHMENT'],
  },
]

export const CUISINE_STYLES: Record<string, { color: string; bg: string }> = {
  // Singapore-specific cuisines
  '海南': { color: '#b8820a', bg: '#fdf5e0' },
  '娘惹': { color: '#d96b2c', bg: '#fdf0e6' },
  '潮州': { color: '#a43d1f', bg: '#fae8e0' },
  '粤式': { color: '#2a5c6b', bg: '#e0eef2' },
  '本地': { color: '#3a5c38', bg: '#e4ede4' },
  '烧烤': { color: '#3a5c38', bg: '#e4ede4' },
  '西式': { color: '#6b3a5c', bg: '#eee0ee' },
  '法式': { color: '#4a3a6b', bg: '#e8e0f2' },
  '日式': { color: '#2a4a6b', bg: '#e0e8f2' },
  '韩式': { color: '#6b2a2a', bg: '#f2e0e0' },
  '印度': { color: '#b87020', bg: '#fdf0e0' },
  '马来': { color: '#3a6b2a', bg: '#e4f2e0' },
  '泰式': { color: '#16a085', bg: '#e8f8f5' },
  '越南': { color: '#d35400', bg: '#fdf0e6' },
  '海鲜': { color: '#1a6b8a', bg: '#e3f2f9' },
  '素食': { color: '#52b788', bg: '#edf7f0' },
  // Preset cuisine tags
  '中餐':    { color: '#c0392b', bg: '#fdecea' },
  '东南亚菜': { color: '#1e7e5a', bg: '#e3f2ed' },
  '韩餐':    { color: '#8e44ad', bg: '#f5eefb' },
  '日料':    { color: '#2980b9', bg: '#e8f4fd' },
  '泰餐':    { color: '#16a085', bg: '#e8f8f5' },
  '西餐':    { color: '#2c3e50', bg: '#eaecee' },
  '甜品':    { color: '#c2359b', bg: '#fce4f4' },
  // Chinese sub-cuisines
  '粤菜':    { color: '#a03020', bg: '#faeae5' },
  '川菜':    { color: '#cc3311', bg: '#fde8e4' },
  '云南菜':  { color: '#7a4e20', bg: '#f5ede0' },
  '湘菜':    { color: '#8b1c1c', bg: '#f9e5e5' },
  '新疆菜':  { color: '#8c6620', bg: '#f7f0e0' },
  // Legacy names
  '印度菜':  { color: '#e67e22', bg: '#fef5e7' },
  '马来菜':  { color: '#27ae60', bg: '#eafaf1' },
  '越南菜':  { color: '#d35400', bg: '#fdf0e6' },
  '本地菜':  { color: '#f4a261', bg: '#fff8f0' },
}

