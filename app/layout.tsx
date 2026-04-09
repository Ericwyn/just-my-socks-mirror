import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Just My Socks Mirror',
  description: 'A simple Just My Socks mirror for subscription links and bandwidth usage.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
