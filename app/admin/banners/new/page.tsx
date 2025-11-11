import { BannerForm } from '@/components/admin/banner-form'

export const metadata = {
  title: '添加Banner - OpenCSG AI学院 后台',
}

export default function NewBannerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">添加Banner</h1>
        <p className="text-muted-foreground">创建新的首页轮播图</p>
      </div>
      <BannerForm />
    </div>
  )
}

