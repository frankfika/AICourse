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
import { Plus, Trash2 } from 'lucide-react'

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })
import 'react-quill/dist/quill.snow.css'

interface CourseFormProps {
  course?: any
  categories: any[]
  instructors: any[]
}

export function CourseForm({ course, categories, instructors }: CourseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')

  // Form state
  const [formData, setFormData] = useState({
    title: course?.title || '',
    slug: course?.slug || '',
    shortDescription: course?.shortDescription || '',
    description: course?.description || '',
    coverImage: course?.coverImage || '/placeholder-course.jpg',
    categoryId: course?.categoryId || '',
    instructorId: course?.instructorId || '',
    level: course?.level || 'beginner',
    duration: course?.duration || 0,
    suggestedWeeks: course?.suggestedWeeks || null,
    hoursPerWeek: course?.hoursPerWeek || null,
    targetAudience: course?.targetAudience || '',
    prerequisites: course?.prerequisites || [''],
    learningObjectives: course?.learningObjectives || [''],
    highlights: course?.highlights || [''],
    status: course?.status || 'draft',
    featured: course?.featured || false,
    price: course?.price || 0,
    originalPrice: course?.originalPrice || null,
    currency: course?.currency || 'CNY',
  })

  const [chapters, setChapters] = useState(course?.chapters || [])
  const [faqs, setFaqs] = useState(course?.faqs || [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        ...formData,
        duration: parseInt(formData.duration as any),
        suggestedWeeks: formData.suggestedWeeks ? parseInt(formData.suggestedWeeks as any) : null,
        hoursPerWeek: formData.hoursPerWeek ? parseInt(formData.hoursPerWeek as any) : null,
        price: parseFloat(formData.price as any),
        originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice as any) : null,
        chapters: chapters.map((ch: any, index: number) => ({
          ...ch,
          order: index,
          duration: parseInt(ch.duration || 0),
        })),
        faqs: faqs.map((faq: any, index: number) => ({
          ...faq,
          order: index,
        })),
      }

      const url = course
        ? `/api/admin/courses/${course.id}`
        : '/api/admin/courses'
      const method = course ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        router.push('/admin/courses')
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

  const addChapter = () => {
    setChapters([...chapters, { title: '', duration: 0, topics: [''] }])
  }

  const removeChapter = (index: number) => {
    setChapters(chapters.filter((_: any, i: number) => i !== index))
  }

  const updateChapter = (index: number, field: string, value: any) => {
    setChapters(
      chapters.map((ch: any, i: number) =>
        i === index ? { ...ch, [field]: value } : ch
      )
    )
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
          <TabsTrigger value="syllabus">课程大纲</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
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
                  <Label htmlFor="title">课程名称 *</Label>
                  <Input
                    id="title"
                    required
                    value={formData.title}
                    onChange={(e) => {
                      setFormData({ ...formData, title: e.target.value })
                      if (!course) {
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="categoryId">分类 *</Label>
                  <select
                    id="categoryId"
                    required
                    className="w-full px-3 py-2 border rounded-md"
                    value={formData.categoryId}
                    onChange={(e) =>
                      setFormData({ ...formData, categoryId: e.target.value })
                    }
                  >
                    <option value="">选择分类</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instructorId">讲师 *</Label>
                  <select
                    id="instructorId"
                    required
                    className="w-full px-3 py-2 border rounded-md"
                    value={formData.instructorId}
                    onChange={(e) =>
                      setFormData({ ...formData, instructorId: e.target.value })
                    }
                  >
                    <option value="">选择讲师</option>
                    {instructors.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
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
                  <Label htmlFor="duration">总时长（分钟） *</Label>
                  <Input
                    id="duration"
                    type="number"
                    required
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({ ...formData, duration: e.target.value as any })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suggestedWeeks">建议周数</Label>
                  <Input
                    id="suggestedWeeks"
                    type="number"
                    value={formData.suggestedWeeks || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        suggestedWeeks: e.target.value as any,
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
                <Label>课程详细介绍</Label>
                <ReactQuill
                  value={formData.description}
                  onChange={(value) =>
                    setFormData({ ...formData, description: value })
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

              {/* Learning Objectives */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>学习目标</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addArrayItem('learningObjectives')}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    添加
                  </Button>
                </div>
                {formData.learningObjectives.map((item: string, index: number) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={item}
                      onChange={(e) =>
                        updateArrayItem('learningObjectives', index, e.target.value)
                      }
                      placeholder="输入学习目标"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeArrayItem('learningObjectives', index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Highlights */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>课程亮点</Label>
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
                      placeholder="输入课程亮点"
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Syllabus */}
        <TabsContent value="syllabus">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>课程大纲</CardTitle>
                <Button type="button" size="sm" onClick={addChapter}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加章节
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {chapters.map((chapter: any, index: number) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        第 {index + 1} 章
                      </CardTitle>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeChapter(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>章节名称</Label>
                        <Input
                          value={chapter.title}
                          onChange={(e) =>
                            updateChapter(index, 'title', e.target.value)
                          }
                          placeholder="输入章节名称"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>时长（分钟）</Label>
                        <Input
                          type="number"
                          value={chapter.duration}
                          onChange={(e) =>
                            updateChapter(index, 'duration', e.target.value)
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>主题列表</Label>
                      {chapter.topics.map((topic: string, topicIndex: number) => (
                        <div key={topicIndex} className="flex gap-2">
                          <Input
                            value={topic}
                            onChange={(e) => {
                              const newTopics = [...chapter.topics]
                              newTopics[topicIndex] = e.target.value
                              updateChapter(index, 'topics', newTopics)
                            }}
                            placeholder="输入主题"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              const newTopics = chapter.topics.filter(
                                (_: any, i: number) => i !== topicIndex
                              )
                              updateChapter(index, 'topics', newTopics)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateChapter(index, 'topics', [...chapter.topics, ''])
                        }
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        添加主题
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: FAQ */}
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

        {/* Tab 5: Settings */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <Label htmlFor="featured">设为热门课程</Label>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="text-lg font-semibold mb-4">定价信息</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">课程价格 *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value as any })
                      }
                      placeholder="0 表示免费"
                    />
                    <p className="text-xs text-gray-500">输入 0 表示免费课程</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="originalPrice">原价（选填）</Label>
                    <Input
                      id="originalPrice"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.originalPrice || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          originalPrice: e.target.value as any,
                        })
                      }
                      placeholder="用于显示折扣"
                    />
                    <p className="text-xs text-gray-500">显示划线价格</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">货币单位</Label>
                    <select
                      id="currency"
                      className="w-full px-3 py-2 border rounded-md"
                      value={formData.currency}
                      onChange={(e) =>
                        setFormData({ ...formData, currency: e.target.value })
                      }
                    >
                      <option value="CNY">人民币 (¥)</option>
                      <option value="USD">美元 ($)</option>
                      <option value="EUR">欧元 (€)</option>
                    </select>
                  </div>
                </div>
              </div>
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
          {loading ? '保存中...' : course ? '更新课程' : '创建课程'}
        </Button>
      </div>
    </form>
  )
}

