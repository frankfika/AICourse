'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-react'

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

  const hasFilters = Array.from(searchParams.keys()).length > 0

  return (
    <div className="space-y-6 sticky top-24">
      {/* Search */}
      <div className="anthropic-card p-7">
        <h3 className="text-sm font-semibold mb-5 uppercase tracking-widest text-muted-foreground">搜索</h3>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            name="search"
            placeholder="搜索课程..."
            defaultValue={searchParams.get('search') || ''}
            className="flex-1 rounded-2xl border-border/60 focus:border-primary h-11 text-sm"
          />
          <Button type="submit" size="icon" variant="outline" className="rounded-2xl h-11 w-11">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Category Filter */}
      <div className="anthropic-card p-7">
        <h3 className="text-sm font-semibold mb-5 uppercase tracking-widest text-muted-foreground">分类</h3>
        <select
          className="w-full px-5 py-3 border-2 border-border/60 rounded-2xl bg-background text-sm font-medium transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
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
      </div>

      {/* Level Filter */}
      <div className="anthropic-card p-7">
        <h3 className="text-sm font-semibold mb-5 uppercase tracking-widest text-muted-foreground">难度</h3>
        <select
          className="w-full px-5 py-3 border-2 border-border/60 rounded-2xl bg-background text-sm font-medium transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
          value={searchParams.get('level') || ''}
          onChange={(e) => handleFilterChange('level', e.target.value)}
        >
          <option value="">全部难度</option>
          <option value="beginner">初级</option>
          <option value="intermediate">中级</option>
          <option value="advanced">高级</option>
        </select>
      </div>

      {/* Sort */}
      <div className="anthropic-card p-7">
        <h3 className="text-sm font-semibold mb-5 uppercase tracking-widest text-muted-foreground">排序</h3>
        <select
          className="w-full px-5 py-3 border-2 border-border/60 rounded-2xl bg-background text-sm font-medium transition-all hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 cursor-pointer"
          value={searchParams.get('sort') || 'latest'}
          onChange={(e) => handleFilterChange('sort', e.target.value)}
        >
          <option value="latest">最新发布</option>
          <option value="popular">最受欢迎</option>
          <option value="duration-asc">时长从短到长</option>
          <option value="duration-desc">时长从长到短</option>
        </select>
      </div>

      {/* Clear Filters */}
      {hasFilters && (
        <Button
          variant="outline"
          className="w-full rounded-2xl h-11 font-medium transition-all hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
          onClick={clearFilters}
        >
          <X className="h-4 w-4 mr-2" />
          清除筛选
        </Button>
      )}
    </div>
  )
}
