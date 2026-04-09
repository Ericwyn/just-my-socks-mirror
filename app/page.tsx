import { HomeClient } from './ui/home-client'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams
  const service = typeof params.service === 'string' ? params.service : ''
  const id = typeof params.id === 'string' ? params.id : ''

  return <HomeClient initialService={service} initialId={id} />
}
