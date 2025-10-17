'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Search } from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
}

interface Instructor {
  id: string
  name: string
}

export function CourseFilters({
  categories,
  instructors,
}: {
  categories: Category[]
  instructors: Instructor[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/courses?${params.toString()}`)
  }

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const search = formData.get('search') as string
    handleFilterChange('search', search)
  }

  const clearFilters = () => {
    router.push('/courses')
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">搜索</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              name="search"
              placeholder="搜索课程..."
              defaultValue={searchParams.get('search') || ''}
            />
            <Button type="submit" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Category Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">分类</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full px-3 py-2 border rounded-md"
            value={searchParams.get('category') || ''}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="">全部分类</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Level Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">难度</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full px-3 py-2 border rounded-md"
            value={searchParams.get('level') || ''}
            onChange={(e) => handleFilterChange('level', e.target.value)}
          >
            <option value="">全部难度</option>
            <option value="beginner">初级</option>
            <option value="intermediate">中级</option>
            <option value="advanced">高级</option>
          </select>
        </CardContent>
      </Card>

      {/* Sort */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">排序</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full px-3 py-2 border rounded-md"
            value={searchParams.get('sort') || 'latest'}
            onChange={(e) => handleFilterChange('sort', e.target.value)}
          >
            <option value="latest">最新发布</option>
            <option value="popular">最受欢迎</option>
            <option value="duration-asc">时长从短到长</option>
            <option value="duration-desc">时长从长到短</option>
          </select>
        </CardContent>
      </Card>

      {/* Clear Filters */}
      <Button variant="outline" className="w-full" onClick={clearFilters}>
        清除筛选
      </Button>
    </div>
  )
}

