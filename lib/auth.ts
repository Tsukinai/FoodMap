import { createClient } from '@/lib/supabase/client'

export async function signIn() {
  const supabase = createClient()
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/auth/callback` },
  })
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  location.reload()
}
