import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/user-auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Award, Download, Eye, Printer } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export const metadata = {
  title: '我的证书 - OpenCSG AI学院',
}

export default async function MyCertificatesPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const certificates = await prisma.certificate.findMany({
    where: {
      userId: user.id,
      status: 'active',
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="container-custom">
        <div className="mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold mb-4">我的证书</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            查看和管理您获得的所有证书
          </p>
        </div>

        {certificates.length === 0 ? (
          <div className="text-center py-20">
            <Award className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              还没有证书
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              完成课程学习后即可获得证书
            </p>
            <Link href="/my-courses">
              <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600">
                我的课程
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((certificate) => {
              const certData = certificate.certificateData
                ? JSON.parse(certificate.certificateData)
                : {}

              return (
                <Card key={certificate.id} className="overflow-hidden group hover:shadow-xl transition-shadow">
                  <CardContent className="p-0">
                    {/* 证书预览 */}
                    <div className="relative h-48 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 p-6 flex flex-col justify-center items-center text-white">
                      <Award className="h-16 w-16 mb-4 opacity-90" />
                      <h3 className="text-center text-sm font-medium opacity-90">
                        完成证书
                      </h3>
                      <div className="absolute top-4 right-4">
                        <Badge className="bg-white/20 text-white border-0">
                          {certificate.type === 'course' ? '课程' : '认证项目'}
                        </Badge>
                      </div>
                    </div>

                    {/* 证书信息 */}
                    <div className="p-6 space-y-4">
                      <div>
                        <h3 className="font-bold text-lg line-clamp-2 mb-2">
                          {certificate.itemTitle}
                        </h3>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <p>证书编号：{certificate.certificateNo}</p>
                          <p>完成时间：{formatDate(certificate.completedAt)}</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link
                          href={`/certificates/${certificate.certificateNo}`}
                          className="flex-1"
                        >
                          <Button variant="outline" size="sm" className="w-full">
                            <Eye className="h-4 w-4 mr-2" />
                            查看
                          </Button>
                        </Link>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Printer className="h-4 w-4" />
                        </Button>
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
