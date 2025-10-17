'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDuration } from '@/lib/utils'
import { CheckCircle, ArrowRight } from 'lucide-react'

export function NanoDegreeDetailTabs({ nanoDegree }: any) {
  const [activeTab, setActiveTab] = useState('intro')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="intro">项目介绍</TabsTrigger>
        <TabsTrigger value="path">学习路径</TabsTrigger>
        <TabsTrigger value="certificate">证书信息</TabsTrigger>
        <TabsTrigger value="guide">学习建议</TabsTrigger>
        <TabsTrigger value="faq">FAQ</TabsTrigger>
      </TabsList>

      {/* Tab 1: Project Intro */}
      <TabsContent value="intro" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>项目介绍</CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <div dangerouslySetInnerHTML={{ __html: nanoDegree.description }} />

            <h3 className="text-xl font-semibold mt-6 mb-4">你将获得的技能</h3>
            <div className="flex flex-wrap gap-2 mb-6">
              {nanoDegree.skills.map((skill: string, index: number) => (
                <Badge key={index} variant="secondary" className="text-sm">
                  {skill}
                </Badge>
              ))}
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-4">项目亮点</h3>
            <ul className="space-y-2">
              {nanoDegree.highlights.map((highlight: string, index: number) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-4">适合人群</h3>
            <p>{nanoDegree.targetAudience}</p>

            {nanoDegree.prerequisites.length > 0 && (
              <>
                <h3 className="text-xl font-semibold mt-6 mb-4">先修要求</h3>
                <ul className="list-disc list-inside space-y-1">
                  {nanoDegree.prerequisites.map((prereq: string, index: number) => (
                    <li key={index}>{prereq}</li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 2: Learning Path */}
      <TabsContent value="path" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>学习路径</CardTitle>
            <p className="text-sm text-muted-foreground">
              按照推荐顺序学习，循序渐进掌握技能
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {nanoDegree.courses.map((item: any, index: number) => (
                <div key={item.id} className="relative">
                  {index < nanoDegree.courses.length - 1 && (
                    <div className="absolute left-6 top-20 w-0.5 h-full bg-border -z-10" />
                  )}
                  <div className="flex gap-4">
                    {/* Number Badge */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      {index + 1}
                    </div>

                    {/* Course Card */}
                    <div className="flex-1">
                      <Card className="hover:shadow-lg transition-shadow">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
                          <div className="md:col-span-1">
                            <div className="relative w-full h-32">
                              <Image
                                src={item.course.coverImage}
                                alt={item.course.title}
                                fill
                                className="object-cover rounded-lg"
                              />
                            </div>
                          </div>
                          <div className="md:col-span-3">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <Badge variant="secondary" className="mb-2">
                                  {item.course.category.name}
                                </Badge>
                                <h4 className="font-semibold text-lg mb-1">
                                  {item.course.title}
                                </h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                  讲师: {item.course.instructor.name}
                                </p>
                              </div>
                              <Link href={`/courses/${item.course.slug}`}>
                                <Button variant="ghost" size="sm">
                                  查看详情 <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {item.course.shortDescription}
                            </p>
                            <div className="mt-2 text-sm text-muted-foreground">
                              时长: {formatDuration(item.course.duration)}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 3: Certificate */}
      <TabsContent value="certificate" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>证书信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4">证书预览</h3>
                <div className="relative w-full h-64 rounded-lg overflow-hidden border">
                  <Image
                    src={nanoDegree.certificateImage}
                    alt="证书"
                    fill
                    className="object-contain"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">证书类型</h4>
                  <p className="text-muted-foreground">{nanoDegree.certificateType}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">证书说明</h4>
                  <div
                    className="text-muted-foreground prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: nanoDegree.certificateDescription }}
                  />
                </div>
                <div>
                  <h4 className="font-semibold mb-2">获得条件</h4>
                  <div
                    className="text-muted-foreground prose max-w-none"
                    dangerouslySetInnerHTML={{ __html: nanoDegree.completionCriteria }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 4: Study Guide */}
      <TabsContent value="guide" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>学习建议</CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <div dangerouslySetInnerHTML={{ __html: nanoDegree.learningPath }} />

            {nanoDegree.suggestedMonths && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold mb-2">推荐学习计划</h4>
                <p className="text-muted-foreground">
                  建议在 {nanoDegree.suggestedMonths} 个月内完成所有课程学习
                  {nanoDegree.hoursPerWeek && `，每周投入约 ${nanoDegree.hoursPerWeek} 小时`}。
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 5: FAQ */}
      <TabsContent value="faq" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>常见问题</CardTitle>
          </CardHeader>
          <CardContent>
            {nanoDegree.faqs.length === 0 ? (
              <p className="text-muted-foreground">暂无常见问题</p>
            ) : (
              <div className="space-y-4">
                {nanoDegree.faqs.map((faq: any) => (
                  <div key={faq.id} className="border-b pb-4 last:border-0">
                    <h4 className="font-semibold mb-2">{faq.question}</h4>
                    <div
                      className="text-muted-foreground prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: faq.answer }}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

