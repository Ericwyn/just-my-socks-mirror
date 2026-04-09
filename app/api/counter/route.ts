import { authorizeSecureProxy, createFixedMembersUpstreamUrl, createSecureSearchParams, proxyToUpstream } from '@/app/lib/proxy'

async function handle(request: Request) {
  const { config, errorResponse } = authorizeSecureProxy(request)

  if (!config) {
    return errorResponse
  }

  const upstreamUrl = createFixedMembersUpstreamUrl({
    pathname: 'getbwcounter.php',
    request,
    searchParams: createSecureSearchParams(request, config),
  })

  return proxyToUpstream(request, upstreamUrl)
}

export const dynamic = 'force-dynamic'

export { handle as GET }
