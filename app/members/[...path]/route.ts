import { createMembersUpstreamUrl, proxyToUpstream } from '@/app/lib/proxy'

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const upstreamUrl = createMembersUpstreamUrl(path ?? [], request)
  return proxyToUpstream(request, upstreamUrl)
}

export const dynamic = 'force-dynamic'

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as OPTIONS, proxy as HEAD }
