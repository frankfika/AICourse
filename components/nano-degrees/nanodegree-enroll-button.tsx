'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, ShoppingCart } from 'lucide-react'

interface NanoDegreeEnrollButtonProps {
  nanoDegreeId: string
  nanoDegreeSlug: string
  price: number
  originalPrice?: number | null
}

export function NanoDegreeEnrollButton({
  nanoDegreeId,
  nanoDegreeSlug,
  price,
  originalPrice,
}: NanoDegreeEnrollButtonProps) {
  const router = useRouter()
  const [enrolled, setEnrolled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingEnrollment, setCheckingEnrollment] = useState(true)

  const isFree = price === 0

  useEffect(() => {
    async function checkEnrollment() {
      try {
        const res = await fetch(`/api/nano-degrees/${nanoDegreeId}/enrollment-status`)
        if (res.ok) {
          const data = await res.json()
          setEnrolled(data.enrolled)
        }
      } catch (error) {
        console.error('检查注册状态失败:', error)
      } finally {
        setCheckingEnrollment(false)
      }
    }

    checkEnrollment()
  }, [nanoDegreeId])

  const handlePurchase = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: 'nanodegree',
          itemId: nanoDegreeId,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        if (res.status === 401) {
          router.push(`/login?redirect=/nano-degrees/${nanoDegreeSlug}`)
          return
        }
        alert(error.error || '购买失败，请重试')
        return
      }

      const data = await res.json()

      if (data.type === 'free') {
        // Free enrollment
        setEnrolled(true)
        alert('注册成功！')
        router.refresh()
      } else if (data.order) {
        // Paid course, redirect to payment
        router.push(`/orders/${data.order.orderNo}`)
      }
    } catch (error) {
      console.error('购买失败:', error)
      alert('购买失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleContinueLearning = () => {
    router.push(`/nano-degrees/${nanoDegreeSlug}/learn`)
  }

  if (checkingEnrollment) {
    return (
      <Button size="lg" disabled className="w-full">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        加载中...
      </Button>
    )
  }

  if (enrolled) {
    return (
      <Button
        size="lg"
        onClick={handleContinueLearning}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        <CheckCircle2 className="h-5 w-5 mr-2" />
        继续学习
      </Button>
    )
  }

  return (
    <Button
      size="lg"
      onClick={handlePurchase}
      disabled={loading}
      className="w-full bg-blue-600 hover:bg-blue-700"
    >
      {loading ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          处理中...
        </>
      ) : isFree ? (
        '免费注册'
      ) : (
        <>
          <ShoppingCart className="h-5 w-5 mr-2" />
          立即购买
        </>
      )}
    </Button>
  )
}
