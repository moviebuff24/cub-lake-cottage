import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { url } = body as { url: string }

  // Validate URL
  let parsed: URL
  try {
    parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreview/1.0; +https://cub-lake-cottage.vercel.app)',
      },
    })
    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()

    // Try both attribute orderings for og: meta tags
    const getOg = (property: string): string => {
      const a = html.match(
        new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']+)["']`, 'i')
      )
      const b = html.match(
        new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:${property}["']`, 'i')
      )
      return (a?.[1] || b?.[1] || '').trim()
    }

    let thumbnail = getOg('image')
    // Resolve relative og:image paths
    if (thumbnail && !thumbnail.startsWith('http')) {
      try {
        thumbnail = new URL(thumbnail, parsed.origin).toString()
      } catch {
        thumbnail = ''
      }
    }

    return NextResponse.json({
      title: getOg('title') || parsed.hostname,
      description: getOg('description'),
      thumbnail,
    })
  } catch {
    // Timeout, network error, or unparseable response — return a safe fallback
    return NextResponse.json({
      title: parsed.hostname,
      description: '',
      thumbnail: '',
    })
  }
}
