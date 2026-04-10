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

const RESPONSE_HEADERS_TO_STRIP = ['content-encoding', 'content-length']

type FixedMembersProxyOptions = {
  request: Request
  pathname: string
  searchParams?: URLSearchParams
}

type SecureProxyConfig = {
  keys: string[]
  service: string
  id: string
}

function normalizeEnvValue(value: string | undefined) {
  const normalized = value?.trim() ?? ''
  return normalized || null
}

function normalizeEnvList(value: string | undefined) {
  const normalized = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return normalized && normalized.length > 0 ? normalized : null
}

export function getUpstreamBaseUrl() {
  const configured = normalizeEnvValue(process.env.JMS_UPSTREAM_BASE_URL) || DEFAULT_UPSTREAM_BASE_URL
  return configured.replace(/\/+$/, '')
}

export function createMembersUpstreamUrl(pathSegments: string[], request: Request) {
  const upstreamUrl = new URL(`${getUpstreamBaseUrl()}/members/${pathSegments.join('/')}`)
  const incomingUrl = new URL(request.url)
  upstreamUrl.search = incomingUrl.search
  return upstreamUrl
}

export function createFixedMembersUpstreamUrl({ pathname, request, searchParams }: FixedMembersProxyOptions) {
  const upstreamUrl = new URL(`${getUpstreamBaseUrl()}/members/${pathname}`)
  upstreamUrl.search = (searchParams ?? new URL(request.url).searchParams).toString()
  return upstreamUrl
}

export function createUpstreamHeaders(requestHeaders: Headers) {
  const headers = new Headers()

  requestHeaders.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase())) {
      headers.set(key, value)
    }
  })

  return headers
}

export function createResponseHeaders(upstreamHeaders: Headers) {
  const headers = new Headers()

  upstreamHeaders.forEach((value, key) => {
    const normalizedKey = key.toLowerCase()

    if (!HOP_BY_HOP_HEADERS.includes(normalizedKey) && !RESPONSE_HEADERS_TO_STRIP.includes(normalizedKey)) {
      headers.set(key, value)
    }
  })

  return headers
}

export async function proxyToUpstream(request: Request, upstreamUrl: URL) {
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

export function getSecureProxyConfig(): SecureProxyConfig | null {
  const keys = normalizeEnvList(process.env.SEC_KEY)
  const service = normalizeEnvValue(process.env.SEC_SERVICE)
  const id = normalizeEnvValue(process.env.SEC_ID)

  if (!keys || !service || !id) {
    return null
  }

  return { keys, service, id }
}

export function authorizeSecureProxy(request: Request) {
  const config = getSecureProxyConfig()

  if (!config) {
    return {
      config: null,
      errorResponse: Response.json(
        {
          error: 'Secure proxy is not configured',
        },
        { status: 500 },
      ),
    }
  }

  const key = new URL(request.url).searchParams.get('key')?.trim() ?? ''

  if (!key) {
    return {
      config: null,
      errorResponse: Response.json(
        {
          error: 'Missing key',
        },
        { status: 401 },
      ),
    }
  }

  if (!config.keys.includes(key)) {
    return {
      config: null,
      errorResponse: Response.json(
        {
          error: 'Invalid key',
        },
        { status: 403 },
      ),
    }
  }

  return {
    config,
    errorResponse: null,
  }
}

export function createSecureSearchParams(request: Request, config: SecureProxyConfig) {
  const searchParams = new URL(request.url).searchParams
  const forwarded = new URLSearchParams()

  searchParams.forEach((value, key) => {
    if (key !== 'key' && key !== 'service' && key !== 'id') {
      forwarded.append(key, value)
    }
  })

  forwarded.set('service', config.service)
  forwarded.set('id', config.id)

  return forwarded
}
