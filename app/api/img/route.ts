import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge' // rapide sur Vercel Edge

// Autorise uniquement quelques domaines sûrs
const ALLOWED = [
  'cdn.discordapp.com',
  'media.discordapp.net',
  'media.tenor.com',
  'i.imgur.com',
]

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u')
  if (!u) return new NextResponse('missing u', { status: 400 })

  try {
    const url = new URL(u)
    if (!ALLOWED.includes(url.hostname)) {
      return new NextResponse('forbidden host', { status: 403 })
    }

    // Pas de referrer, UA navigateur classique
    const r = await fetch(url.toString(), {
      headers: { 'User-Agent': req.headers.get('user-agent') || 'Mozilla/5.0' },
      referrer: '',
      referrerPolicy: 'no-referrer',
      // on peut aussi mettre: cache: 'no-store'
    })
    if (!r.ok) return new NextResponse(`upstream ${r.status}`, { status: 502 })

    const type = r.headers.get('content-type') || 'image/gif'
    const buf = await r.arrayBuffer()

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'content-type': type,
        // cache côté CDN
        'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return new NextResponse('fetch_failed', { status: 502 })
  }
}
