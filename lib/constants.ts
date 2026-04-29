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

export const PRESET_TASTE_TAGS = ['辣', '清淡', '甜', '咸鲜', '酸', '鲜香', '浓郁', '爽口', '烟熏']
export const PRESET_SCENE_TAGS = ['约会', '家庭', '快速午餐', '聚餐', '一人食', '深夜', '特殊场合', '平价']
