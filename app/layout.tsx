import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import NextTopLoader from 'nextjs-toploader'
import './globals.css'
import { Header } from '@/components/layout/header'
import { Footer } from '@/components/layout/footer'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OpenCSG AI学院 - 开启你的 AI 学习之旅',
  description: '专注于 AI 教育的在线学习平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <NextTopLoader 
          color="#10b981"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #10b981,0 0 5px #10b981"
        />
        <Providers>
        <div className="flex min-h-screen flex-col">
          <Header />
            <main className="flex-1 pt-16">{children}</main>
          <Footer />
        </div>
        <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  )
}

