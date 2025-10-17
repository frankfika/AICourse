'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
// Removed Select import - using native select
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'

const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })
import 'react-quill/dist/quill.snow.css'

interface NanoDegreeFormProps {
  nanoDegree?: any
  courses: any[]
}

export function NanoDegreeForm({ nanoDegree, courses }: NanoDegreeFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')

  const [formData, setFormData] = useState({
    title: nanoDegree?.title || '',
    slug: nanoDegree?.slug || '',
    shortDescription: nanoDegree?.shortDescription || '',
    description: nanoDegree?.description || '',
    coverImage: nanoDegree?.coverImage || '/placeholder-nanodegree.jpg',
    certificateImage: nanoDegree?.certificateImage || '/placeholder-certificate.jpg',
    certificateType: nanoDegree?.certificateType || '专业认证',
    certificateDescription: nanoDegree?.certificateDescription || '',
    completionCriteria: nanoDegree?.completionCriteria || '',
    level: nanoDegree?.level || 'intermediate',
    suggestedMonths: nanoDegree?.suggestedMonths || null,
    hoursPerWeek: nanoDegree?.hoursPerWeek || null,
    targetAudience: nanoDegree?.targetAudience || '',
    prerequisites: nanoDegree?.prerequisites || [''],
    skills: nanoDegree?.skills || [''],
    highlights: nanoDegree?.highlights || [''],
    learningPath: nanoDegree?.learningPath || '',
    status: nanoDegree?.status || 'draft',
    featured: nanoDegree?.featured || false,
  })

  const [selectedCourses, setSelectedCourses] = useState(
    nanoDegree?.courses?.map((c: any) => c.course.id) || []
  )
  const [faqs, setFaqs] = useState(nanoDegree?.faqs || [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        ...formData,
        suggestedMonths: formData.suggestedMonths ? parseInt(formData.suggestedMonths as any) : null,
        hoursPerWeek: formData.hoursPerWeek ? parseInt(formData.hoursPerWeek as any) : null,
        courseIds: selectedCourses,
        faqs: faqs.map((faq: any, index: number) => ({
          ...faq,
          order: index,
        })),
      }

      const url = nanoDegree
        ? `/api/admin/nano-degrees/${nanoDegree.id}`
        : '/api/admin/nano-degrees'
      const method = nanoDegree ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        router.push('/admin/nano-degrees')
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

  const addArrayItem = (field: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: [...(prev[field as keyof typeof prev] as any[]), ''],
    }))
  }

  const removeArrayItem = (field: string, index: number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: (prev[field as keyof typeof prev] as any[]).filter((_, i) => i !== index),
    }))
  }

  const updateArrayItem = (field: string, index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: (prev[field as keyof typeof prev] as any[]).map((item, i) =>
        i === index ? value : item
      ),
    }))
  }

  const toggleCourse = (courseId: string) => {
    setSelectedCourses((prev: string[]) =>
      prev.includes(courseId)
        ? prev.filter((id) => id !== courseId)
        : [...prev, courseId]
    )
  }

  const moveCourse = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === selectedCourses.length - 1)
    ) {
      return
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1
    const newCourses = [...selectedCourses]
    ;[newCourses[index], newCourses[newIndex]] = [newCourses[newIndex], newCourses[index]]
    setSelectedCourses(newCourses)
  }

  const addFaq = () => {
    setFaqs([...faqs, { question: '', answer: '' }])
  }

  const removeFaq = (index: number) => {
    setFaqs(faqs.filter((_: any, i: number) => i !== index))
  }

  const updateFaq = (index: number, field: string, value: string) => {
    setFaqs(
      faqs.map((faq: any, i: number) =>
        i === index ? { ...faq, [field]: value } : faq
      )
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">基本信息</TabsTrigger>
          <TabsTrigger value="content">内容详情</TabsTrigger>
          <TabsTrigger value="courses">课程选择</TabsTrigger>
          <TabsTrigger value="certificate">证书信息</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
        </TabsList>

        {/* Tab 1: Basic Info */}
        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">项目名称 *</Label>
                  <Input
                    id="title"
                    required
                    value={formData.title}
                    onChange={(e) => {
                      setFormData({ ...formData, title: e.target.value })
                      if (!nanoDegree) {
                        setFormData((prev) => ({
                          ...prev,
                          slug: e.target.value.toLowerCase().replace(/\s+/g, '-'),
                        }))
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL 标识 *</Label>
                  <Input
                    id="slug"
                    required
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({ ...formData, slug: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="shortDescription">简短描述 *</Label>
                <Textarea
                  id="shortDescription"
                  required
                  rows={2}
                  value={formData.shortDescription}
                  onChange={(e) =>
                    setFormData({ ...formData, shortDescription: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="level">难度 *</Label>
                  <select
                    id="level"
                    required
                    className="w-full px-3 py-2 border rounded-md"
                    value={formData.level}
                    onChange={(e) =>
                      setFormData({ ...formData, level: e.target.value })
                    }
                  >
                    <option value="beginner">初级</option>
                    <option value="intermediate">中级</option>
                    <option value="advanced">高级</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suggestedMonths">建议月数</Label>
                  <Input
                    id="suggestedMonths"
                    type="number"
                    value={formData.suggestedMonths || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        suggestedMonths: e.target.value as any,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hoursPerWeek">每周小时数</Label>
                  <Input
                    id="hoursPerWeek"
                    type="number"
                    value={formData.hoursPerWeek || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hoursPerWeek: e.target.value as any,
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="coverImage">封面图片 URL</Label>
                  <Input
                    id="coverImage"
                    value={formData.coverImage}
                    onChange={(e) =>
                      setFormData({ ...formData, coverImage: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="certificateImage">证书图片 URL</Label>
                  <Input
                    id="certificateImage"
                    value={formData.certificateImage}
                    onChange={(e) =>
                      setFormData({ ...formData, certificateImage: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">发布状态</Label>
                <select
                  id="status"
                  className="w-full px-3 py-2 border rounded-md"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                >
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="featured"
                  type="checkbox"
                  checked={formData.featured}
                  onChange={(e) =>
                    setFormData({ ...formData, featured: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <Label htmlFor="featured">设为热门项目</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Content */}
        <TabsContent value="content">
          <Card>
            <CardHeader>
              <CardTitle>内容详情</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>项目详细介绍</Label>
                <ReactQuill
                  value={formData.description}
                  onChange={(value) =>
                    setFormData({ ...formData, description: value })
                  }
                  theme="snow"
                />
              </div>

              <div className="space-y-2">
                <Label>学习路径说明</Label>
                <ReactQuill
                  value={formData.learningPath}
                  onChange={(value) =>
                    setFormData({ ...formData, learningPath: value })
                  }
                  theme="snow"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetAudience">适合人群</Label>
                <Textarea
                  id="targetAudience"
                  rows={3}
                  value={formData.targetAudience}
                  onChange={(e) =>
                    setFormData({ ...formData, targetAudience: e.target.value })
                  }
                />
              </div>

              {/* Skills */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>你将获得的技能</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addArrayItem('skills')}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加
                  </Button>
                </div>
                {formData.skills.map((item: string, index: number) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={item}
                      onChange={(e) =>
                        updateArrayItem('skills', index, e.target.value)
                      }
                      placeholder="输入技能"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeArrayItem('skills', index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Highlights */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>项目亮点</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addArrayItem('highlights')}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加
                  </Button>
                </div>
                {formData.highlights.map((item: string, index: number) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={item}
                      onChange={(e) =>
                        updateArrayItem('highlights', index, e.target.value)
                      }
                      placeholder="输入项目亮点"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeArrayItem('highlights', index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Prerequisites */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>先修要求</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addArrayItem('prerequisites')}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加
                  </Button>
                </div>
                {formData.prerequisites.map((item: string, index: number) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={item}
                      onChange={(e) =>
                        updateArrayItem('prerequisites', index, e.target.value)
                      }
                      placeholder="输入先修要求"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeArrayItem('prerequisites', index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Courses */}
        <TabsContent value="courses">
          <div className="grid grid-cols-2 gap-6">
            {/* Available Courses */}
            <Card>
              <CardHeader>
                <CardTitle>可选课程</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {courses
                    .filter((c) => !selectedCourses.includes(c.id))
                    .map((course) => (
                      <div
                        key={course.id}
                        className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleCourse(course.id)}
                      >
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => {}}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <p className="font-medium">{course.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {course.category.name} · {course.instructor.name}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* Selected Courses */}
            <Card>
              <CardHeader>
                <CardTitle>已选课程 ({selectedCourses.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {selectedCourses.map((courseId: string, index: number) => {
                    const course = courses.find((c) => c.id === courseId)
                    if (!course) return null

                    return (
                      <div
                        key={courseId}
                        className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30"
                      >
                        <div className="flex flex-col gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => moveCourse(index, 'up')}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => moveCourse(index, 'down')}
                            disabled={index === selectedCourses.length - 1}
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                        <Badge className="shrink-0">{index + 1}</Badge>
                        <div className="flex-1">
                          <p className="font-medium">{course.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {course.category.name}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => toggleCourse(courseId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: Certificate */}
        <TabsContent value="certificate">
          <Card>
            <CardHeader>
              <CardTitle>证书信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="certificateType">证书类型</Label>
                <Input
                  id="certificateType"
                  value={formData.certificateType}
                  onChange={(e) =>
                    setFormData({ ...formData, certificateType: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>证书说明</Label>
                <ReactQuill
                  value={formData.certificateDescription}
                  onChange={(value) =>
                    setFormData({ ...formData, certificateDescription: value })
                  }
                  theme="snow"
                />
              </div>

              <div className="space-y-2">
                <Label>获得条件</Label>
                <ReactQuill
                  value={formData.completionCriteria}
                  onChange={(value) =>
                    setFormData({ ...formData, completionCriteria: value })
                  }
                  theme="snow"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: FAQ */}
        <TabsContent value="faq">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>常见问题</CardTitle>
                <Button type="button" size="sm" onClick={addFaq}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加 FAQ
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {faqs.map((faq: any, index: number) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">FAQ {index + 1}</CardTitle>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeFaq(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>问题</Label>
                      <Input
                        value={faq.question}
                        onChange={(e) => updateFaq(index, 'question', e.target.value)}
                        placeholder="输入问题"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>答案</Label>
                      <ReactQuill
                        value={faq.answer}
                        onChange={(value) => updateFaq(index, 'answer', value)}
                        theme="snow"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Submit Button */}
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
          {loading ? '保存中...' : nanoDegree ? '更新项目' : '创建项目'}
        </Button>
      </div>
    </form>
  )
}

