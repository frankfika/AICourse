'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Menu, X, User, BookOpen, LogOut, Settings, ShoppingBag, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface UserData {
  id: string
  name: string
  email: string
  avatar?: string
}

export function Header() {
  const router = useRouter()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<UserData | null>(null)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    // Fetch current user
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user)
        }
      })
      .catch(() => {})
  }, [])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setUser(null)
      setShowUserMenu(false)
      router.push('/')
      router.refresh()
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-background/95 backdrop-blur-xl border-b border-border/60 shadow-sm'
          : 'bg-background/60 backdrop-blur-md'
      }`}
    >
      <nav className="container-anthropic">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo - 精致文字 */}
          <Link href="/" className="flex items-center group">
            <span className="text-xl sm:text-2xl font-semibold tracking-tight">
              Course<span className="text-primary font-bold">AI</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            <NavLink href="/">首页</NavLink>
            <NavLink href="/courses">课程</NavLink>
            <NavLink href="/nano-degrees">认证项目</NavLink>
          </div>

          {/* Right Actions */}
          <div className="hidden lg:flex items-center space-x-5">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-3 transition-all hover:text-primary text-sm group"
                >
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.name}
                      width={32}
                      height={32}
                      className="rounded-full ring-2 ring-border group-hover:ring-primary/40 transition-all"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary text-sm font-semibold ring-2 ring-border group-hover:ring-primary/40 transition-all">
                      {user.name[0].toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium">{user.name}</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-3 w-56 anthropic-card py-2 shadow-lg">
                    <Link
                      href="/my-courses"
                      className="flex items-center space-x-3 px-4 py-2.5 transition-colors hover:bg-muted rounded-lg mx-2 text-sm font-medium"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>我的课程</span>
                    </Link>
                    <Link
                      href="/my-orders"
                      className="flex items-center space-x-3 px-4 py-2.5 transition-colors hover:bg-muted rounded-lg mx-2 text-sm font-medium"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <ShoppingBag className="h-4 w-4" />
                      <span>我的订单</span>
                    </Link>
                    <Link
                      href="/my-certificates"
                      className="flex items-center space-x-3 px-4 py-2.5 transition-colors hover:bg-muted rounded-lg mx-2 text-sm font-medium"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Award className="h-4 w-4" />
                      <span>我的证书</span>
                    </Link>
                    <Link
                      href="/profile"
                      className="flex items-center space-x-3 px-4 py-2.5 transition-colors hover:bg-muted rounded-lg mx-2 text-sm font-medium"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Settings className="h-4 w-4" />
                      <span>个人设置</span>
                    </Link>
                    <hr className="my-2 border-border/50" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center space-x-3 px-4 py-2.5 transition-colors hover:bg-destructive/10 rounded-lg mx-2 text-destructive text-sm font-medium"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>退出登录</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login" className="text-sm font-medium transition-colors hover:text-primary">
                  登录
                </Link>
                <Link href="/register">
                  <Button size="sm" className="rounded-2xl px-6">注册</Button>
                </Link>
              </>
            )}

            <Link href="/admin/login">
              <Button variant="outline" size="sm" className="rounded-2xl px-5">管理后台</Button>
            </Link>
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

            {user ? (
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
            )}

            <div className="pt-2">
              <Link href="/admin/login" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full">
                  管理后台
                </Button>
              </Link>
            </div>
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
      className="text-sm font-medium transition-all hover:text-primary relative group py-1"
    >
      {children}
      <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full rounded-full"></span>
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
