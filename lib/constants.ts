export const SINGAPORE_CENTER = { lng: 103.8198, lat: 1.3521 }
export const SINGAPORE_ZOOM = 11
export const SINGAPORE_BOUNDS: [[number, number], [number, number]] = [
  [103.60, 1.17],
  [104.05, 1.49],
]

// Approximate bounding boxes per region [west, south, east, north]
export const REGION_BOUNDS: Record<string, [number, number, number, number]> = {
  '中部':     [103.780, 1.250, 103.900, 1.390],
  '东部':     [103.880, 1.290, 104.050, 1.420],
  '西部':     [103.620, 1.270, 103.800, 1.410],
  '北部':     [103.750, 1.390, 103.900, 1.490],
  '东北部':   [103.840, 1.340, 103.970, 1.440],
  'CBD/滨海湾': [103.840, 1.270, 103.870, 1.310],
  '牛车水':   [103.840, 1.275, 103.855, 1.288],
  '小印度':   [103.848, 1.303, 103.862, 1.316],
  '甘榜格南': [103.855, 1.298, 103.875, 1.313],
}

export const REGIONS = Object.keys(REGION_BOUNDS)

export const BROAD_REGIONS = ['中部', '东部', '西部', '北部', '东北部']
export const HOOD_REGIONS  = ['CBD/滨海湾', '牛车水', '小印度', '甘榜格南']

export const CUISINE_COLORS: Record<string, string> = {
  // Singapore-specific cuisines
  '海南': '#b8820a',
  '娘惹': '#d96b2c',
  '潮州': '#a43d1f',
  '粤式': '#2a5c6b',
  '本地': '#3a5c38',
  '烧烤': '#3a5c38',
  '西式': '#6b3a5c',
  '法式': '#4a3a6b',
  '日式': '#2a4a6b',
  '韩式': '#6b2a2a',
  '印度': '#b87020',
  '马来': '#3a6b2a',
  '泰式': '#16a085',
  '越南': '#d35400',
  '海鲜': '#1a6b8a',
  '素食': '#52b788',
  // Legacy names kept for backward compatibility
  '中餐':   '#c0392b',
  '日料':   '#2980b9',
  '韩餐':   '#8e44ad',
  '印度菜': '#e67e22',
  '马来菜': '#27ae60',
  '西餐':   '#2c3e50',
  '泰餐':   '#16a085',
  '越南菜': '#d35400',
  '本地菜': '#f4a261',
}

export const CUISINE_BG: Record<string, string> = {
  // Singapore-specific cuisines
  '海南': '#fdf5e0',
  '娘惹': '#fdf0e6',
  '潮州': '#fae8e0',
  '粤式': '#e0eef2',
  '本地': '#e4ede4',
  '烧烤': '#e4ede4',
  '西式': '#eee0ee',
  '法式': '#e8e0f2',
  '日式': '#e0e8f2',
  '韩式': '#f2e0e0',
  '印度': '#fdf0e0',
  '马来': '#e4f2e0',
  '泰式': '#e8f8f5',
  '越南': '#fdf0e6',
  '海鲜': '#e3f2f9',
  '素食': '#edf7f0',
  // Legacy names kept for backward compatibility
  '中餐':   '#fdecea',
  '日料':   '#e8f4fd',
  '韩餐':   '#f5eefb',
  '印度菜': '#fef5e7',
  '马来菜': '#eafaf1',
  '西餐':   '#eaecee',
  '泰餐':   '#e8f8f5',
  '越南菜': '#fdf0e6',
  '本地菜': '#fff8f0',
}

export const PRESET_TASTE_TAGS = ['清淡', '不辣', '微辣', '特辣', '偏甜', '偏酸']
export const PRESET_SCENE_TAGS = ['早餐', 'brunch', '正餐', '夜宵', '约会', '家庭', '商务']
