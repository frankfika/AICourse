import { prisma } from '@/lib/db'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'

export default async function AdminBannersPage() {
  const banners = await prisma.banner.findMany({
    orderBy: { order: 'asc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Banner 管理</h1>
          <p className="text-muted-foreground">管理首页轮播图</p>
        </div>
        <Link href="/admin/banners/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            添加 Banner
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {banners.map((banner) => (
          <Card key={banner.id}>
            <CardContent className="p-6">
              <div className="flex gap-6">
                <div className="relative w-64 h-36 rounded-lg overflow-hidden">
                  <Image
                    src={banner.image}
                    alt={banner.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-2">{banner.title}</h3>
                  {banner.link && (
                    <p className="text-sm text-blue-500 mb-2">{banner.link}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={banner.isActive ? 'default' : 'secondary'}>
                      {banner.isActive ? '已启用' : '未启用'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      排序: {banner.order}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

