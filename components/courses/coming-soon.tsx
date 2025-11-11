'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Calendar, Clock, Mail, Check } from 'lucide-react'

interface ComingSoonProps {
  courseId: string
  courseTitle: string
  startDate: Date
  shortDescription: string
}

export function ComingSoon({ courseId, courseTitle, startDate, shortDescription }: ComingSoonProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [error, setError] = useState('')

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/courses/${courseId}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '订阅失败')
        return
      }

      setSubscribed(true)
      setEmail('')
    } catch (err) {
      setError('订阅失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getDaysUntilStart = () => {
    const now = new Date()
    const start = new Date(startDate)
    const diffTime = start.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const daysLeft = getDaysUntilStart()

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/30 via-white to-green-50/20 py-32">
      <div className="container-anthropic">
        <div className="max-w-3xl mx-auto">
          {/* 状态标签 */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-orange-100 border-2 border-orange-200">
              <Clock className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-bold text-orange-700">即将开始</span>
            </div>
          </div>

          {/* 主要内容 */}
          <div className="bg-white rounded-3xl border-2 border-gray-100 p-10 lg:p-12 shadow-2xl">
            <div className="text-center space-y-8">
              {/* 标题 */}
              <h1 className="text-4xl sm:text-5xl font-black text-gray-900 leading-tight">
                {courseTitle}
              </h1>

              {/* 描述 */}
              <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
                {shortDescription}
              </p>

              {/* 倒计时 */}
              <div className="py-10">
                <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-primary/10 to-emerald-500/10 border-4 border-primary/20 mb-6">
                  <div className="text-center">
                    <div className="text-5xl font-black text-primary">{daysLeft}</div>
                    <div className="text-sm font-semibold text-gray-600 mt-1">天后开课</div>
                  </div>
                </div>

                {/* 开课日期 */}
                <div className="flex items-center justify-center gap-2 text-lg text-gray-700">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span className="font-semibold">{formatDate(startDate)}</span>
                  <span>正式开课</span>
                </div>
              </div>

              {/* 分割线 */}
              <div className="border-t-2 border-gray-100"></div>

              {/* 订阅表单 */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-gray-900">开课提醒</h3>
                  <p className="text-gray-600">
                    留下您的邮箱，课程开始时我们会第一时间通知您
                  </p>
                </div>

                {subscribed ? (
                  <div className="inline-flex items-center gap-3 px-6 py-4 bg-green-50 border-2 border-green-200 rounded-2xl">
                    <div className="flex items-center justify-center w-10 h-10 bg-green-500 rounded-full">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-green-700">订阅成功！</div>
                      <div className="text-sm text-green-600">我们会在课程开始时通知您</div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubscribe} className="max-w-md mx-auto space-y-4">
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-12 h-14 text-base rounded-xl border-2 border-gray-200 focus:border-primary"
                        required
                      />
                    </div>
                    
                    {error && (
                      <div className="text-sm text-red-600 text-center">{error}</div>
                    )}

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary to-emerald-600 hover:from-emerald-600 hover:to-primary rounded-xl shadow-lg hover:shadow-xl transition-all"
                    >
                      {loading ? '订阅中...' : '订阅开课提醒'}
                    </Button>
                  </form>
                )}
              </div>

              {/* 提示信息 */}
              <div className="pt-6 border-t-2 border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-3xl mb-2">📚</div>
                    <div className="text-sm font-semibold text-gray-700">系统化内容</div>
                  </div>
                  <div>
                    <div className="text-3xl mb-2">👨‍🏫</div>
                    <div className="text-sm font-semibold text-gray-700">专业讲师</div>
                  </div>
                  <div>
                    <div className="text-3xl mb-2">🎓</div>
                    <div className="text-sm font-semibold text-gray-700">权威证书</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

