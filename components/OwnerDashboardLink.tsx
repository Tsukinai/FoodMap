'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function OwnerDashboardLink() {
  const pathname = usePathname()
  const [isOwner, setIsOwner] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsOwner(!!user && user.id === process.env.NEXT_PUBLIC_OWNER_USER_ID)
    })
  }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  if (!isOwner || pathname === '/dashboard') return null
  // Desktop homepage: header already has the link
  if (pathname === '/' && !isMobile) return null

  return (
    <Link
      href="/dashboard"
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        zIndex: 200,
        height: 32,
        padding: '0 14px',
        borderRadius: 8,
        background: 'var(--fm-paper)',
        border: '1px solid var(--fm-line-2)',
        color: 'var(--fm-ink-3)',
        fontSize: 12.5,
        fontFamily: 'var(--font-geist-sans)',
        fontWeight: 500,
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      仪表盘
    </Link>
  )
}
