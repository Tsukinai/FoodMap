import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '食迹 — 新加坡美食地图',
    short_name: '食迹',
    description: '记录新加坡美食的个人地图',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbf8f1',
    theme_color: '#d96b2c',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
