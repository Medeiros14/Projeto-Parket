import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Parket AI Squad',
  description: 'Plataforma de gerenciamento de agentes de IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1A1A1A',
              color: '#F5F5F5',
              border: '1px solid #333333',
              borderRadius: 8,
              fontSize: 13,
            },
            success: { iconTheme: { primary: '#4CAF50', secondary: '#1A1A1A' } },
            error:   { iconTheme: { primary: '#F44336', secondary: '#1A1A1A' } },
          }}
        />
      </body>
    </html>
  )
}
