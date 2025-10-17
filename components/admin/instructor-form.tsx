'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })
import 'react-quill/dist/quill.snow.css'

interface InstructorFormProps {
  instructor?: any
}

export function InstructorForm({ instructor }: InstructorFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: instructor?.name || '',
    title: instructor?.title || '',
    bio: instructor?.bio || '',
    avatar: instructor?.avatar || '/placeholder-avatar.jpg',
    experience: instructor?.experience || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = instructor
        ? `/api/admin/instructors/${instructor.id}`
        : '/api/admin/instructors'
      const method = instructor ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        router.push('/admin/instructors')
        router.refresh()
      } else {
        alert('操作失败')
      }
    } catch (error) {
      alert('操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>讲师信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">姓名 *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">职称 *</Label>
              <Input
                id="title"
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">个人简介 *</Label>
            <Textarea
              id="bio"
              required
              rows={4}
              value={formData.bio}
              onChange={(e) =>
                setFormData({ ...formData, bio: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatar">头像 URL</Label>
            <Input
              id="avatar"
              value={formData.avatar}
              onChange={(e) =>
                setFormData({ ...formData, avatar: e.target.value })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>教学经验</Label>
            <ReactQuill
              value={formData.experience}
              onChange={(value) =>
                setFormData({ ...formData, experience: value })
              }
              theme="snow"
            />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          取消
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? '保存中...' : instructor ? '更新' : '创建'}
        </Button>
      </div>
    </form>
  )
}

