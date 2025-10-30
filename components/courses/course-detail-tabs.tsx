'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDuration } from '@/lib/utils'
import { COURSE_LEVELS } from '@/lib/constants'
import { CheckCircle, Clock } from 'lucide-react'

export function CourseDetailTabs({ course, chapters, faqs, relatedCourses = [] }: any) {
  const [activeTab, setActiveTab] = useState('intro')

  // Use the passed props or fallback to course properties
  const courseChapters = chapters || course.chapters || []
  const courseFaqs = faqs || course.faqs || []

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="intro">课程介绍</TabsTrigger>
        <TabsTrigger value="syllabus">课程大纲</TabsTrigger>
        <TabsTrigger value="instructor">讲师介绍</TabsTrigger>
        <TabsTrigger value="faq">FAQ</TabsTrigger>
        <TabsTrigger value="related">相关推荐</TabsTrigger>
      </TabsList>

      {/* Tab 1: Course Intro */}
      <TabsContent value="intro" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>课程详情</CardTitle>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <div dangerouslySetInnerHTML={{ __html: course.description }} />

            <h3 className="text-xl font-semibold mt-6 mb-4">你将学到什么</h3>
            <ul className="space-y-2">
              {Array.isArray(course.learningObjectives) 
                ? course.learningObjectives.map((obj: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{obj}</span>
                    </li>
                  ))
                : JSON.parse(course.learningObjectives || '[]').map((obj: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{obj}</span>
                    </li>
                  ))
              }
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-4">课程亮点</h3>
            <ul className="space-y-2">
              {Array.isArray(course.highlights) 
                ? course.highlights.map((highlight: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>{highlight}</span>
                    </li>
                  ))
                : JSON.parse(course.highlights || '[]').map((highlight: string, index: number) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>{highlight}</span>
                    </li>
                  ))
              }
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-4">适合人群</h3>
            <p>{course.targetAudience}</p>

            {(() => {
              const prereqs = Array.isArray(course.prerequisites) 
                ? course.prerequisites 
                : JSON.parse(course.prerequisites || '[]');
              return prereqs.length > 0 && (
                <>
                  <h3 className="text-xl font-semibold mt-6 mb-4">先修要求</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {prereqs.map((prereq: string, index: number) => (
                      <li key={index}>{prereq}</li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 2: Syllabus */}
      <TabsContent value="syllabus" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>课程大纲</CardTitle>
            <p className="text-sm text-muted-foreground">
              共 {courseChapters.length} 个章节 · 总时长 {formatDuration(course.duration)}
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {courseChapters.map((chapter: any, index: number) => (
                <div key={chapter.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">
                      第 {index + 1} 章: {chapter.title}
                    </h4>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{formatDuration(chapter.duration)}</span>
                    </div>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {Array.isArray(chapter.topics) 
                      ? chapter.topics.map((topic: string, topicIndex: number) => (
                          <li key={topicIndex} className="pl-4">
                            • {topic}
                          </li>
                        ))
                      : JSON.parse(chapter.topics || '[]').map((topic: string, topicIndex: number) => (
                          <li key={topicIndex} className="pl-4">
                            • {topic}
                          </li>
                        ))
                    }
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 3: Instructor */}
      <TabsContent value="instructor" className="mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-full overflow-hidden">
                <Image
                  src={course.instructor.avatar}
                  alt={course.instructor.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <CardTitle>{course.instructor.name}</CardTitle>
                <p className="text-muted-foreground">{course.instructor.title}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="prose max-w-none">
            <h3 className="text-xl font-semibold mb-2">个人简介</h3>
            <p>{course.instructor.bio}</p>

            {course.instructor.experience && (
              <>
                <h3 className="text-xl font-semibold mt-4 mb-2">教学经验</h3>
                <div dangerouslySetInnerHTML={{ __html: course.instructor.experience }} />
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 4: FAQ */}
      <TabsContent value="faq" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>常见问题</CardTitle>
          </CardHeader>
          <CardContent>
            {courseFaqs.length === 0 ? (
              <p className="text-muted-foreground">暂无常见问题</p>
            ) : (
              <div className="space-y-4">
                {courseFaqs.map((faq: any) => (
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

      {/* Tab 5: Related */}
      <TabsContent value="related" className="mt-6">
        <div className="space-y-6">
          {/* Nano Degrees containing this course */}
          {course.nanoDegreeCourses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>包含本课程的 Nano Degree</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {course.nanoDegreeCourses.map(({ nanoDegree }: any) => (
                    <Link key={nanoDegree.id} href={`/nano-degrees/${nanoDegree.slug}`}>
                      <div className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                        <h4 className="font-semibold mb-1">{nanoDegree.title}</h4>
                        <p className="text-sm text-muted-foreground">{nanoDegree.shortDescription}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Related Courses */}
          {relatedCourses && relatedCourses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>相关课程</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {relatedCourses.map((related: any) => (
                    <Link key={related.id} href={`/courses/${related.slug}`}>
                      <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader className="p-0">
                          <div className="relative w-full h-32">
                            <Image
                              src={related.coverImage}
                              alt={related.title}
                              fill
                              className="object-cover rounded-t-lg"
                            />
                          </div>
                        </CardHeader>
                        <CardContent className="p-4">
                          <Badge variant="secondary" className="mb-2">
                            {related.category.name}
                          </Badge>
                          <h4 className="font-semibold line-clamp-2 mb-2">{related.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {related.instructor.name}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}

