'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, CreditCard, Loader2 } from 'lucide-react'

interface Order {
  id: string
  orderNo: string
  itemTitle: string
  itemCoverImage: string | null
  amount: number
  originalAmount: number
  currency: string
  status: string
  createdAt: Date
}

interface PaymentFlowProps {
  order: Order
}

export function PaymentFlow({ order }: PaymentFlowProps) {
  const router = useRouter()
  const [paying, setPaying] = useState(false)
  const [success, setSuccess] = useState(false)

  const handlePay = async () => {
    setPaying(true)

    try {
      const res = await fetch(`/api/orders/${order.orderNo}/pay`, {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '支付失败')
        setPaying(false)
        return
      }

      // 显示成功状态
      setSuccess(true)

      // 3秒后跳转到我的课程
      setTimeout(() => {
        router.push('/my-courses')
        router.refresh()
      }, 3000)
    } catch (err) {
      alert('支付失败，请稍后重试')
      setPaying(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
        <Card className="w-full max-w-md border-0 shadow-2xl">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">支付成功！</h2>
              <p className="text-gray-600 dark:text-gray-400">
                正在跳转到我的课程...
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                加载中
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">订单支付</h1>
          <p className="text-gray-600 dark:text-gray-400">
            订单号：{order.orderNo}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：商品信息 */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold mb-4">订单详情</h2>
                <div className="flex gap-4">
                  {order.itemCoverImage && (
                    <div className="relative w-32 h-24 flex-shrink-0 rounded-lg overflow-hidden">
                      <Image
                        src={order.itemCoverImage}
                        alt={order.itemTitle}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">
                      {order.itemTitle}
                    </h3>
                    <Badge variant="outline">在线课程</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：支付信息 */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-4">支付信息</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        原价
                      </span>
                      <span className="line-through text-gray-500">
                        ¥{order.originalAmount}
                      </span>
                    </div>
                    {order.originalAmount > order.amount && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">
                          优惠
                        </span>
                        <span className="text-red-600">
                          -¥{(order.originalAmount - order.amount).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">实付金额</span>
                        <span className="text-2xl font-bold text-blue-600">
                          ¥{order.amount}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={handlePay}
                    disabled={paying}
                    className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-base font-medium"
                  >
                    {paying ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        支付中...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5 mr-2" />
                        模拟支付
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push('/my-orders')}
                    disabled={paying}
                  >
                    取消订单
                  </Button>
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400 text-center space-y-1">
                  <p>• 这是模拟支付，仅用于测试</p>
                  <p>• 点击支付后将立即完成购买</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
