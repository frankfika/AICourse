'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Banner {
  id: string
  title: string
  image: string
  link: string | null
  openInNewTab: boolean
}

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (banners.length <= 1) return

    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [banners.length])

  if (banners.length === 0) {
    return (
      <div className="w-full h-[400px] bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">暂无轮播图</p>
      </div>
    )
  }

  const Banner = banners[current]

  const content = (
    <div className="relative w-full h-[400px] bg-muted">
      <Image
        src={Banner.image}
        alt={Banner.title}
        fill
        className="object-cover"
        priority
      />
    </div>
  )

  return (
    <div className="relative w-full">
      {Banner.link ? (
        <Link
          href={Banner.link}
          target={Banner.openInNewTab ? '_blank' : undefined}
        >
          {content}
        </Link>
      ) : (
        content
      )}

      {/* Navigation Buttons */}
      {banners.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
            onClick={() => setCurrent((prev) => (prev - 1 + banners.length) % banners.length)}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
            onClick={() => setCurrent((prev) => (prev + 1) % banners.length)}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          {/* Indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
            {banners.map((_, index) => (
              <button
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === current ? 'w-8 bg-white' : 'w-2 bg-white/50'
                }`}
                onClick={() => setCurrent(index)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

