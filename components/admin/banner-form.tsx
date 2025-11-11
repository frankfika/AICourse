'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface BannerFormProps {
  banner?: any
}

export function BannerForm({ banner }: BannerFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: banner?.title || '',
    image: banner?.image || '',
    link: banner?.link || '',
    openInNewTab: banner?.openInNewTab || false,
    isActive: banner?.isActive !== undefined ? banner.isActive : true,
    order: banner?.order || 0,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = banner
        ? `/api/admin/banners/${banner.id}`
        : '/api/admin/banners'
      const method = banner ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '操作失败')
        return
      }

      alert(banner ? 'Banner更新成功！' : 'Banner创建成功！')
      router.push('/admin/banners')
      router.refresh()
    } catch (error) {
      console.error('Submit error:', error)
      alert('操作失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.push('/admin/banners')
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>Banner信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Banner标题 *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
              placeholder="例如：欢迎来到OpenCSG AI学院"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">图片URL *</Label>
            <Input
              id="image"
              type="url"
              value={formData.image}
              onChange={(e) =>
                setFormData({ ...formData, image: e.target.value })
              }
              required
              placeholder="https://example.com/banner.jpg"
            />
            {formData.image && (
              <div className="mt-2">
                <img
                  src={formData.image}
                  alt="预览"
                  className="max-w-md h-32 object-cover rounded-lg border"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-banner.jpg'
                  }}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="link">链接地址</Label>
            <Input
              id="link"
              type="url"
              value={formData.link}
              onChange={(e) =>
                setFormData({ ...formData, link: e.target.value })
              }
              placeholder="https://example.com/target-page（可选）"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="order">排序 *</Label>
              <Input
                id="order"
                type="number"
                value={formData.order}
                onChange={(e) =>
                  setFormData({ ...formData, order: parseInt(e.target.value) || 0 })
                }
                required
                min="0"
              />
              <p className="text-xs text-muted-foreground">
                数字越小越靠前
              </p>
            </div>

            <div className="space-y-2">
              <Label>状态</Label>
              <div className="flex items-center space-x-4 pt-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={formData.isActive}
                    onChange={() =>
                      setFormData({ ...formData, isActive: true })
                    }
                    className="w-4 h-4"
                  />
                  <span>启用</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!formData.isActive}
                    onChange={() =>
                      setFormData({ ...formData, isActive: false })
                    }
                    className="w-4 h-4"
                  />
                  <span>禁用</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="openInNewTab"
              type="checkbox"
              checked={formData.openInNewTab}
              onChange={(e) =>
                setFormData({ ...formData, openInNewTab: e.target.checked })
              }
              className="w-4 h-4"
            />
            <Label htmlFor="openInNewTab" className="cursor-pointer">
              在新标签页中打开链接
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={loading}
        >
          取消
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? '保存中...' : banner ? '更新Banner' : '创建Banner'}
        </Button>
      </div>
    </form>
  )
}

