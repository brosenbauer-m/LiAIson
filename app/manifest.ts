import type { MetadataRoute } from 'next'

// Lets people add LiAIson to their phone's home screen and open it like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LiAIson',
    short_name: 'LiAIson',
    description: 'Your personal AI representative.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#FAF6F0',
    theme_color: '#FAF6F0',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
