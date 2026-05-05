export const SINGAPORE_CENTER = { lng: 103.8198, lat: 1.3521 }
export const SINGAPORE_ZOOM = 11
export const SINGAPORE_BOUNDS: [[number, number], [number, number]] = [
  [103.60, 1.17],
  [104.05, 1.49],
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

