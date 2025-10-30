import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/user-auth'
import { prisma } from '@/lib/db'
import { PaymentFlow } from '@/components/payment/payment-flow'

export const metadata = {
  title: '订单支付 - CourseAI',
}

export default async function OrderPaymentPage({
  params,
}: {
  params: { orderNo: string }
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const order = await prisma.order.findUnique({
    where: { orderNo: params.orderNo },
  })

  if (!order) {
    notFound()
  }

  if (order.userId !== user.id) {
    redirect('/my-orders')
  }

  // 如果订单已支付，跳转到我的课程
  if (order.status === 'paid') {
    redirect('/my-courses')
  }

  return <PaymentFlow order={order} />
}
