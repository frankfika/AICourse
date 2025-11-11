'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

interface DeleteBannerButtonProps {
  bannerId: string
}

export function DeleteBannerButton({ bannerId }: DeleteBannerButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm('确定要删除这个Banner吗？此操作无法撤销。')) {
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`/api/admin/banners/${bannerId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '删除失败')
        return
      }

      alert('Banner删除成功！')
      router.refresh()
    } catch (error) {
      console.error('Delete error:', error)
      alert('删除失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={loading}
      className="w-full"
    >
      <Trash2 className="h-4 w-4 mr-2" />
      {loading ? '删除中...' : '删除'}
    </Button>
  )
}

