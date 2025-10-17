import Link from 'next/link'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">CourseAI</h3>
            <p className="text-sm text-muted-foreground">
              开启你的 AI 学习之旅
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-semibold">快速链接</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/courses" className="text-muted-foreground hover:text-primary">
                  课程
                </Link>
              </li>
              <li>
                <Link href="/nano-degrees" className="text-muted-foreground hover:text-primary">
                  Nano Degree
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-muted-foreground hover:text-primary">
                  关于我们
                </Link>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div className="space-y-4">
            <h4 className="font-semibold">课程分类</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/courses/category/machine-learning" className="text-muted-foreground hover:text-primary">
                  机器学习
                </Link>
              </li>
              <li>
                <Link href="/courses/category/deep-learning" className="text-muted-foreground hover:text-primary">
                  深度学习
                </Link>
              </li>
              <li>
                <Link href="/courses/category/nlp" className="text-muted-foreground hover:text-primary">
                  自然语言处理
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-semibold">联系我们</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>邮箱: contact@courseai.com</li>
              <li>
                <Link href="/contact" className="hover:text-primary">
                  联系表单
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; {currentYear} CourseAI. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

