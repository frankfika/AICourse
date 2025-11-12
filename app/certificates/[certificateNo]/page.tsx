import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { CertificateView } from '@/components/certificates/certificate-view'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ certificateNo: string }>
}) {
  const { certificateNo } = await params
  const certificate = await prisma.certificate.findUnique({
    where: { certificateNo },
  })

  if (!certificate) {
    return { title: '证书未找到' }
  }

  return {
    title: `${certificate.itemTitle} - 完成证书`,
    description: `${certificate.itemTitle}完成证书`,
  }
}

export default async function CertificateDetailPage({
  params,
}: {
  params: Promise<{ certificateNo: string }>
}) {
  const { certificateNo } = await params
  const certificate = await prisma.certificate.findUnique({
    where: {
      certificateNo,
      status: 'active',
    },
    include: {
      user: true,
    },
  })

  if (!certificate) {
    notFound()
  }

  const certData = certificate.certificateData
    ? JSON.parse(certificate.certificateData)
    : {}

  return (
    <CertificateView
      certificate={{
        ...certificate,
        certData,
      }}
    />
  )
}
