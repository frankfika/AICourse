'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BookOpen,
  Award,
  Users,
  FolderTree,
  Image as ImageIcon,
  Settings,
} from 'lucide-react'

const menuItems = [
  { href: '/admin', icon: LayoutDashboard, label: '仪表盘' },
  { href: '/admin/courses', icon: BookOpen, label: '课程管理' },
  { href: '/admin/nano-degrees', icon: Award, label: 'Nano Degree' },
  { href: '/admin/instructors', icon: Users, label: '讲师管理' },
  { href: '/admin/categories', icon: FolderTree, label: '分类管理' },
  { href: '/admin/banners', icon: ImageIcon, label: 'Banner 管理' },
  { href: '/admin/settings', icon: Settings, label: '网站配置' },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background hidden lg:block">
      <div className="flex h-full flex-col gap-2">
        {/* Logo */}
        <div className="flex h-14 items-center border-b px-6">
          <Link href="/admin" className="flex items-center gap-2 font-semibold">
            <span className="text-xl">CourseAI</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-4 py-4">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || 
                (item.href !== '/admin' && pathname.startsWith(item.href))
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:bg-accent',
                      isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t px-6 py-4">
          <p className="text-xs text-muted-foreground">
            CourseAI 后台管理系统
          </p>
        </div>
      </div>
    </aside>
  )
}

