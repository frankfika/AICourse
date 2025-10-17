'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Search, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'glass-effect shadow-lg'
          : 'bg-transparent'
      }`}
    >
      <nav className="container-custom">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl font-bold text-xl">
                Course<span className="font-light">AI</span>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            <NavLink href="/">首页</NavLink>
            <NavLink href="/courses">课程</NavLink>
            <NavLink href="/nano-degrees">认证项目</NavLink>
          </div>

          {/* Right Actions */}
          <div className="hidden lg:flex items-center space-x-4">
            <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
              <Search className="h-5 w-5" />
            </button>
            <Link href="/admin/login">
              <Button className="modern-button rounded-full px-6">
                登录后台
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden glass-effect border-t">
          <div className="container-custom py-6 space-y-4">
            <MobileNavLink href="/" onClick={() => setIsMobileMenuOpen(false)}>
              首页
            </MobileNavLink>
            <MobileNavLink href="/courses" onClick={() => setIsMobileMenuOpen(false)}>
              课程
            </MobileNavLink>
            <MobileNavLink href="/nano-degrees" onClick={() => setIsMobileMenuOpen(false)}>
              认证项目
            </MobileNavLink>
            <div className="pt-4">
              <Link href="/admin/login" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full modern-button rounded-full">
                  登录后台
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
      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
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
      className="block px-4 py-3 text-lg font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      {children}
    </Link>
  )
}
