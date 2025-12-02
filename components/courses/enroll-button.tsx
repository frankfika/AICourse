'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BookOpen, Check, Clipboard } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import Image from 'next/image'

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
  const [assistantQrUrl, setAssistantQrUrl] = useState<string | null>(null)
  const [assistantWechatId, setAssistantWechatId] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)

  useEffect(() => {
    checkEnrollment()
    fetchAssistantInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const fetchAssistantInfo = async () => {
    try {
      const resAll = await fetch(`/api/site-config`)
      const data = await resAll.json()
      setAssistantQrUrl(data.assistantQrUrl || null)
      setAssistantWechatId(data.assistantWechatId || null)
    } catch (e) {}
  }

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
      if (!isFree) {
        setShowQr(true)
        return
      }
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType: 'course', itemId: courseId }),
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
    <>
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
            {isFree ? '免费报名' : '联系小助手开通'}
          </>
        )}
      </Button>

      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>付费课程开通</DialogTitle>
            <DialogDescription>请扫描二维码联系课程小助手开通权限</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {assistantQrUrl ? (
              <div className="w-full flex items-center justify-center">
                <Image src={assistantQrUrl} alt="课程小助手二维码" width={400} height={400} className="rounded-lg object-cover" />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">管理员未配置二维码</div>
            )}
            {assistantWechatId && (
              <div className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span>微信号：{assistantWechatId}</span>
                <Button
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(assistantWechatId)}
                >
                  <Clipboard className="h-4 w-4 mr-2" />复制
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowQr(false)} variant="outline">关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
