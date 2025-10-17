export const SITE_NAME = 'CourseAI'
export const SITE_DESCRIPTION = '开启你的 AI 学习之旅'

export const COURSE_LEVELS = {
  beginner: '初级',
  intermediate: '中级',
  advanced: '高级',
} as const

export const COURSE_STATUS = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
} as const

export const ADMIN_ROLES = {
  admin: '管理员',
  super_admin: '超级管理员',
} as const

export const ITEMS_PER_PAGE = 12
export const ADMIN_ITEMS_PER_PAGE = 20

export const NAV_LINKS = [
  { href: '/', label: '首页' },
  { href: '/courses', label: '课程' },
  { href: '/nano-degrees', label: 'Nano Degree' },
  { href: '/about', label: '关于我们' },
  { href: '/contact', label: '联系我们' },
]

export const ADMIN_NAV_LINKS = [
  { href: '/admin', label: '仪表盘', icon: 'LayoutDashboard' },
  { href: '/admin/courses', label: '课程管理', icon: 'BookOpen' },
  { href: '/admin/nano-degrees', label: 'Nano Degree', icon: 'Award' },
  { href: '/admin/instructors', label: '讲师管理', icon: 'Users' },
  { href: '/admin/categories', label: '分类管理', icon: 'FolderTree' },
  { href: '/admin/banners', label: 'Banner 管理', icon: 'Image' },
  { href: '/admin/settings', label: '网站配置', icon: 'Settings' },
]

