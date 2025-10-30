import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/user-auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShoppingBag, Clock, CheckCircle2, XCircle, Receipt } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export const metadata = {
  title: '我的订单 - CourseAI',
}

const statusConfig = {
  pending: { label: '待支付', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: Clock },
  paid: { label: '已支付', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle2 },
  cancelled: { label: '已取消', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: XCircle },
  refunded: { label: '已退款', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: Receipt },
}

export default async function MyOrdersPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="min-h-screen pt-24 pb-16 bg-gray-50 dark:bg-gray-900">
      <div className="container-custom">
        <div className="mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">我的订单</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            管理您的购买记录
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingBag className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              还没有订单
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              快去选购您喜欢的课程吧！
            </p>
            <Link href="/courses">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600">
                浏览课程
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const status = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.pending
              const StatusIcon = status.icon

              return (
                <Card key={order.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      {/* 商品信息 */}
                      <div className="flex-1 p-6">
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
                            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                              <span>订单号：{order.orderNo}</span>
                              <span>•</span>
                              <span>{formatDate(order.createdAt)}</span>
                            </div>
                            <div className="mt-2">
                              <Badge className={status.color}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {status.label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 价格和操作 */}
                      <div className="border-t md:border-t-0 md:border-l p-6 md:w-64 flex flex-col justify-between bg-gray-50 dark:bg-gray-800">
                        <div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            实付金额
                          </div>
                          <div className="text-2xl font-bold text-blue-600 mb-4">
                            ¥{order.amount}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {order.status === 'pending' && (
                            <Link href={`/orders/${order.orderNo}`}>
                              <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600">
                                继续支付
                              </Button>
                            </Link>
                          )}
                          {order.status === 'paid' && (
                            <Link href="/my-courses">
                              <Button className="w-full" variant="outline">
                                查看课程
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
