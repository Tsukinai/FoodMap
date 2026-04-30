export type TagType = 'cuisine' | 'dish' | 'taste' | 'scene'

export interface Tag {
  id: string
  name: string
  type: TagType
  created_at: string
}

export type RestaurantStatus = 'want' | 'visited'

export interface Restaurant {
  id: string
  name: string
  address: string | null
  postal_code: string | null
  location_lng: number
  location_lat: number
  cost_min: number | null
  cost_max: number | null
  notes: string | null
  signature_dishes: string[]
  status: RestaurantStatus
  created_at: string
  updated_at: string
  tags: Tag[]
}

export interface RestaurantFormData {
  name: string
  address: string
  postal_code: string
  lng: number
  lat: number
  cost_min: number | null
  cost_max: number | null
  notes: string
  signature_dishes: string[]
  status: RestaurantStatus
  cuisine_tag_ids: string[]
  dish_tag_ids: string[]
  taste_tag_ids: string[]
  scene_tag_ids: string[]
}

export interface FilterPayload {
  cuisine_tags: string[]
  dish_tags: string[]
  taste_tags: string[]
  scene_tags: string[]
  max_cost: number | null
  min_cost: number | null
  area_keyword: string | null
  regions: string[]
  status: RestaurantStatus[]
}

export interface OneMapResult {
  SEARCHVAL: string
  BLK_NO: string
  ROAD_NAME: string
  BUILDING: string
  ADDRESS: string
  POSTAL: string
  LATITUDE: string
  LONGITUDE: string
}
