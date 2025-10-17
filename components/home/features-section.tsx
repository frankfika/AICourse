import { Zap, Target, Award, Users } from 'lucide-react'

export function FeaturesSection() {
  const features = [
    {
      icon: Zap,
      title: '系统化学习',
      description: '从基础到进阶，循序渐进的课程体系',
    },
    {
      icon: Target,
      title: '项目驱动',
      description: '通过实战项目掌握核心技能',
    },
    {
      icon: Award,
      title: '专业认证',
      description: '获得行业认可的 Nano Degree 证书',
    },
    {
      icon: Users,
      title: '顶尖讲师',
      description: '业界专家亲自授课，分享实战经验',
    },
  ]

  return (
    <section className="container mx-auto px-4 py-16">
      <h2 className="text-3xl font-bold text-center mb-12">为什么选择 CourseAI？</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {features.map((feature, index) => (
          <div key={index} className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
              <feature.icon className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
            <p className="text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

