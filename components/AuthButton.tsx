'use client'

import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface Props {
  user: User | null
}

export default function AuthButton({ user }: Props) {
  const supabase = createClient()

  async function signIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    location.reload()
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={signOut}
          className="text-xs px-2.5 py-1.5 rounded-lg transition-colors"
          style={{
            fontFamily: 'var(--font-geist-mono)',
            background: 'var(--fm-paper)',
            border: '1px solid var(--fm-line-2)',
            color: 'var(--fm-ink-3)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          退出
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={signIn}
      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
      style={{
        fontFamily: 'var(--font-geist-sans)',
        background: 'var(--fm-paper)',
        border: '1px solid var(--fm-line-2)',
        color: 'var(--fm-ink-2)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
      }}
    >
      登录编辑
    </button>
  )
}
