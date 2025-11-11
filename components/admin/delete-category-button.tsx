'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

interface DeleteCategoryButtonProps {
  categoryId: string
  hasCourses: boolean
}

export function DeleteCategoryButton({ categoryId, hasCourses }: DeleteCategoryButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (hasCourses) {
      alert('该分类下还有课程，无法删除')
      return
    }

    if (!confirm('确定要删除这个分类吗？此操作无法撤销。')) {
      return
    }

    setLoading(true)

    try {
      const res = await fetch(`/api/admin/categories/${categoryId}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '删除失败')
        return
      }

      alert('分类删除成功！')
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
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      disabled={loading || hasCourses}
      title={hasCourses ? '该分类下还有课程，无法删除' : '删除分类'}
    >
      <Trash2 className={`h-4 w-4 ${hasCourses ? 'text-gray-400' : 'text-red-500'}`} />
    </Button>
  )
}

