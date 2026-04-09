const DEFAULT_UPSTREAM_BASE_URL = 'https://justmysocks6.net'

const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]

function getUpstreamBaseUrl() {
  const configured = process.env.JMS_UPSTREAM_BASE_URL?.trim() || DEFAULT_UPSTREAM_BASE_URL
  return configured.replace(/\/+$/, '')
}

function buildUpstreamUrl(pathSegments: string[], request: Request) {
  const upstreamUrl = new URL(`${getUpstreamBaseUrl()}/members/${pathSegments.join('/')}`)
  const incomingUrl = new URL(request.url)
  upstreamUrl.search = incomingUrl.search
  return upstreamUrl
}

function createUpstreamHeaders(requestHeaders: Headers) {
  const headers = new Headers()

  requestHeaders.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase())) {
      headers.set(key, value)
    }
  })

  return headers
}

function createResponseHeaders(upstreamHeaders: Headers) {
  const headers = new Headers()

  upstreamHeaders.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase())) {
      headers.set(key, value)
    }
  })

  return headers
}

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const upstreamUrl = buildUpstreamUrl(path ?? [], request)

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: createUpstreamHeaders(request.headers),
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
      redirect: 'manual',
    })

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: createResponseHeaders(upstreamResponse.headers),
    })
  } catch {
    return Response.json(
      {
        error: 'Failed to reach upstream service',
        upstream: getUpstreamBaseUrl(),
      },
      { status: 502 },
    )
  }
}

export const dynamic = 'force-dynamic'

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as OPTIONS, proxy as HEAD }
