import { BookOpen, Award, Users } from 'lucide-react'

export function StatsSection({ courseCount, nanoDegreeCount }: { courseCount: number; nanoDegreeCount: number }) {
  const stats = [
    { icon: BookOpen, label: '精品课程', value: courseCount },
    { icon: Award, label: 'Nano Degree', value: nanoDegreeCount },
    { icon: Users, label: '学习人数', value: '10,000+' },
  ]

  return (
    <section className="bg-primary text-primary-foreground py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          {stats.map((stat, index) => (
            <div key={index} className="flex flex-col items-center">
              <stat.icon className="h-12 w-12 mb-4" />
              <div className="text-4xl font-bold mb-2">{stat.value}</div>
              <div className="text-lg">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

