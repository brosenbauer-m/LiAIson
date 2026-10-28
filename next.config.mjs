/** @type {import('next').NextConfig} */

// Browser security headers on every page and API response:
// no embedding in other sites (clickjacking), no MIME sniffing, no full URLs
// leaked to other sites, no access to camera / location; the microphone only
// for this site itself (voice in the chat, asked only when the mic is pressed).
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(), browsing-topics=()' },
]

const nextConfig = {
  serverExternalPackages: ['mammoth', 'unpdf', 'canvas'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
