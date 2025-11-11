'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BookOpen, Check } from 'lucide-react'

interface EnrollButtonProps {
  courseId: string
  courseSlug: string
  price: number
  originalPrice?: number | null
}

export function EnrollButton({ courseId, courseSlug, price, originalPrice }: EnrollButtonProps) {
  const router = useRouter()
  const [enrolled, setEnrolled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  const isFree = price === 0

  useEffect(() => {
    checkEnrollment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const checkEnrollment = async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/enroll`)
      const data = await res.json()
      setEnrolled(data.enrolled)
    } catch (err) {
      console.error('Check enrollment error:', err)
    } finally {
      setChecking(false)
    }
  }

  const handlePurchase = async () => {
    setLoading(true)

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: 'course',
          itemId: courseId,
        }),
      })

      if (res.status === 401) {
        router.push(`/login?redirect=/courses/${courseSlug}`)
        return
      }

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '购买失败')
        return
      }

      // 如果是免费课程，直接报名成功
      if (data.type === 'free') {
        setEnrolled(true)
        router.refresh()
        return
      }

      // 如果是付费课程，跳转到支付页面
      if (data.order) {
        router.push(`/orders/${data.order.orderNo}`)
      }
    } catch (err) {
      alert('操作失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleGoToLearn = () => {
    router.push(`/learn/${courseSlug}`)
  }

  if (checking) {
    return (
      <Button size="lg" disabled className="anthropic-button">
        检查状态...
      </Button>
    )
  }

  if (enrolled) {
    return (
      <div className="space-y-3">
        <Button
          size="lg"
          onClick={handleGoToLearn}
          className="anthropic-button"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          继续学习
        </Button>
        <div className="flex items-center justify-center text-sm text-muted-foreground">
          <Check className="h-4 w-4 mr-1.5 text-primary" />
          已购买
        </div>
      </div>
    )
  }

  return (
    <Button
      size="lg"
      onClick={handlePurchase}
      disabled={loading}
      className="anthropic-button"
    >
      {loading ? (
        '处理中...'
      ) : (
        <>
          <BookOpen className="h-4 w-4 mr-2" />
          {isFree ? '免费报名' : '立即购买'}
        </>
      )}
    </Button>
  )
}
