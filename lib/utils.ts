import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Tag, TagType } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getTagsByType(tags: Tag[], type: TagType): Tag[] {
  return tags.filter((t) => t.type === type)
}

export function formatCostRange(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return `S$ ${min}–${max}`
  if (min !== null) return `S$ ${min}+`
  if (max !== null) return `≤ S$ ${max}`
  return null
}
