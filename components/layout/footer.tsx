import Link from 'next/link'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="section-divider bg-muted/20 backdrop-blur-sm">
      <div className="container-anthropic py-20 sm:py-24">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 lg:gap-16">
          {/* About */}
          <div className="space-y-5">
            <h3 className="text-2xl font-semibold tracking-tight">
              Course<span className="text-primary font-bold">AI</span>
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              系统化学习 AI 技术，从基础到进阶，助力你的职业成长
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-5">
            <h4 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">快速链接</h4>
            <ul className="space-y-3.5 text-sm">
              <li>
                <Link href="/courses" className="text-foreground hover:text-primary transition-all hover:translate-x-1 inline-block font-medium">
                  浏览课程
                </Link>
              </li>
              <li>
                <Link href="/nano-degrees" className="text-foreground hover:text-primary transition-all hover:translate-x-1 inline-block font-medium">
                  认证项目
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-foreground hover:text-primary transition-all hover:translate-x-1 inline-block font-medium">
                  关于我们
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-foreground hover:text-primary transition-all hover:translate-x-1 inline-block font-medium">
                  博客
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-5">
            <h4 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">学习资源</h4>
            <ul className="space-y-3.5 text-sm">
              <li>
                <Link href="/courses?category=machine-learning" className="text-foreground hover:text-primary transition-all hover:translate-x-1 inline-block font-medium">
                  机器学习
                </Link>
              </li>
              <li>
                <Link href="/courses?category=deep-learning" className="text-foreground hover:text-primary transition-all hover:translate-x-1 inline-block font-medium">
                  深度学习
                </Link>
              </li>
              <li>
                <Link href="/courses?category=nlp" className="text-foreground hover:text-primary transition-all hover:translate-x-1 inline-block font-medium">
                  自然语言处理
                </Link>
              </li>
              <li>
                <Link href="/courses?category=computer-vision" className="text-foreground hover:text-primary transition-all hover:translate-x-1 inline-block font-medium">
                  计算机视觉
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-5">
            <h4 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">支持</h4>
            <ul className="space-y-3.5 text-sm">
              <li>
                <Link href="/help" className="text-foreground hover:text-primary transition-all hover:translate-x-1 inline-block font-medium">
                  帮助中心
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-foreground hover:text-primary transition-all hover:translate-x-1 inline-block font-medium">
                  联系我们
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-foreground hover:text-primary transition-all hover:translate-x-1 inline-block font-medium">
                  隐私政策
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-foreground hover:text-primary transition-all hover:translate-x-1 inline-block font-medium">
                  服务条款
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-20 pt-8 border-t border-border/50 text-center">
          <p className="text-sm text-muted-foreground font-medium">
            &copy; {currentYear} CourseAI. 保留所有权利。
          </p>
        </div>
      </div>
    </footer>
  )
}
