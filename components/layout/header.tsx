'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white/95 backdrop-blur-md border-b ${
        isScrolled
          ? 'border-gray-200 shadow-md'
          : 'border-transparent'
      }`}
    >
      <nav className="container-anthropic">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo */}
          <Link href="/" className="flex items-center group">
            <span className="text-xl sm:text-2xl font-bold text-foreground transition-all">
              OpenCSG <span className="text-primary group-hover:text-emerald-600 transition-colors">AI学院</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-2">
            <NavLink href="/">首页</NavLink>
            <NavLink href="/courses">课程</NavLink>
            <NavLink href="/nano-degrees">认证项目</NavLink>
          </div>

          {/* Right Actions */}
          <div className="hidden lg:flex items-center space-x-3">
            {/* 暂时隐藏用户登录注册功能 */}
            {/* {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-all"
                >
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.name}
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {user.name[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm font-medium">{user.name}</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 anthropic-card p-2 shadow-lg">
                    <Link
                      href="/my-courses"
                      className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-50 rounded-lg transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>我的课程</span>
                    </Link>
                    <Link
                      href="/my-orders"
                      className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-50 rounded-lg transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <ShoppingBag className="h-4 w-4" />
                      <span>我的订单</span>
                    </Link>
                    <Link
                      href="/my-certificates"
                      className="flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-50 rounded-lg transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Award className="h-4 w-4" />
                      <span>我的证书</span>
                    </Link>
                    <div className="my-1 h-px bg-gray-200"></div>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>退出登录</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login" className="px-4 py-2 text-sm font-medium hover:text-primary transition-colors">
                  登录
                </Link>
                <Link href="/register">
                  <Button size="sm" className="rounded-lg px-5 py-2 text-sm font-medium">
                    注册
                  </Button>
                </Link>
              </>
            )} */}

            {/* 管理后台入口已隐藏，请直接访问 /admin/login */}
            {/* <Link href="/admin/login">
              <Button variant="outline" size="sm" className="rounded-lg px-4 py-2 text-sm font-medium">
                管理后台
              </Button>
            </Link> */}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 -mr-2 transition-colors hover:text-primary"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-background/95 backdrop-blur-md border-t border-border">
          <div className="container-anthropic py-4 space-y-0.5">
            <MobileNavLink href="/" onClick={() => setIsMobileMenuOpen(false)}>
              首页
            </MobileNavLink>
            <MobileNavLink href="/courses" onClick={() => setIsMobileMenuOpen(false)}>
              课程
            </MobileNavLink>
            <MobileNavLink href="/nano-degrees" onClick={() => setIsMobileMenuOpen(false)}>
              认证项目
            </MobileNavLink>

            {/* 暂时隐藏用户登录注册功能 */}
            {/* {user ? (
              <>
                <div className="pt-3 pb-1 border-t border-border mt-3">
                  <MobileNavLink href="/my-courses" onClick={() => setIsMobileMenuOpen(false)}>
                    我的课程
                  </MobileNavLink>
                  <MobileNavLink href="/my-orders" onClick={() => setIsMobileMenuOpen(false)}>
                    我的订单
                  </MobileNavLink>
                  <MobileNavLink href="/my-certificates" onClick={() => setIsMobileMenuOpen(false)}>
                    我的证书
                  </MobileNavLink>
                  <MobileNavLink href="/profile" onClick={() => setIsMobileMenuOpen(false)}>
                    个人设置
                  </MobileNavLink>
                </div>
                <div className="pt-1">
                  <button
                    onClick={() => {
                      handleLogout()
                      setIsMobileMenuOpen(false)
                    }}
                    className="w-full text-left px-3.5 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors rounded-md"
                  >
                    退出登录
                  </button>
                </div>
              </>
            ) : (
              <div className="pt-3 border-t border-border mt-3 space-y-2">
                <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full">
                    登录
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button size="sm" className="w-full">
                    注册
                  </Button>
                </Link>
              </div>
            )} */}

            {/* 管理后台入口已隐藏，请直接访问 /admin/login */}
            {/* <div className="pt-2">
              <Link href="/admin/login" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">
                  管理后台
                </Button>
              </Link>
            </div> */}
          </div>
        </div>
      )}
    </header>
  )
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-primary hover:bg-gray-50 rounded-lg transition-colors"
    >
      {children}
    </Link>
  )
}

function MobileNavLink({
  href,
  children,
  onClick
}: {
  href: string
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-3.5 py-2.5 text-sm font-medium transition-colors hover:bg-muted rounded-md"
    >
      {children}
    </Link>
  )
}
