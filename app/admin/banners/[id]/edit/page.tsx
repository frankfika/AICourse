import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { BannerForm } from '@/components/admin/banner-form'

export const metadata = {
  title: '编辑Banner - OpenCSG AI学院 后台',
}

export default async function EditBannerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const banner = await prisma.banner.findUnique({
    where: { id },
  })

  if (!banner) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">编辑Banner</h1>
        <p className="text-muted-foreground">更新Banner信息</p>
      </div>
      <BannerForm banner={banner} />
    </div>
  )
}

