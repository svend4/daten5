import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Rationalization Platform',
  description: 'B2B Operating System for the Internet',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
