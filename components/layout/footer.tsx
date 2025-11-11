import Link from 'next/link'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="container-anthropic py-10">
        <div className="flex flex-col items-center gap-6">
          {/* Logo */}
          <Link href="/" className="text-2xl font-black">
            OpenCSG <span className="text-primary">AI学院</span>
          </Link>
          
          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-gray-600">
            <Link href="/courses" className="hover:text-primary transition-colors">
              课程
            </Link>
            <span className="text-gray-300">·</span>
            <Link href="/nano-degrees" className="hover:text-primary transition-colors">
              认证项目
            </Link>
            <span className="text-gray-300">·</span>
            <Link href="/about" className="hover:text-primary transition-colors">
              关于
            </Link>
          </div>
          
          {/* Copyright */}
          <p className="text-sm text-gray-400">
            &copy; {currentYear} OpenCSG AI学院. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
