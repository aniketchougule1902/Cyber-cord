import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CyberCord – AI Cybersecurity Expert',
  description: 'AI-powered OSINT and cybersecurity investigation platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased font-sans">
        {children}
      </body>
    </html>
  )
}
