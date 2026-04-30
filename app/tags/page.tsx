export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { requireOwner, createClient } from '@/lib/supabase/server'
import TagsManager from './TagsManager'
import type { Tag } from '@/lib/types'

export default async function TagsPage() {
  const user = await requireOwner()
  if (!user) redirect('/')

  const supabase = await createClient()
  const { data } = await supabase.from('tags').select('*').order('name')
  const tags: Tag[] = data ?? []

  return <TagsManager initialTags={tags} />
}
