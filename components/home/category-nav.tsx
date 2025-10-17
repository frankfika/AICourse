import Link from 'next/link'
import { Card } from '@/components/ui/card'

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
}

export function CategoryNav({ categories }: { categories: Category[] }) {
  return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="text-2xl font-bold mb-6">课程分类</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map((category) => (
          <Link key={category.id} href={`/courses/category/${category.slug}`}>
            <Card className="p-4 text-center hover:shadow-lg transition-shadow cursor-pointer">
              <h3 className="font-semibold">{category.name}</h3>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}

