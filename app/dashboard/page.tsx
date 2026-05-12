import { redirect } from 'next/navigation'
import { requireOwner } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const owner = await requireOwner()
  if (!owner) redirect('/')

  return <DashboardClient />
}
