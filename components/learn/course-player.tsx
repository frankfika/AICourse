'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  PlayCircle,
  Menu,
  X,
  Award
} from 'lucide-react'
import { formatDuration } from '@/lib/utils'

interface Chapter {
  id: string
  title: string
  duration: number
  videoUrl: string | null
  order: number
  topics: string[]
  completed: boolean
  lastPosition: number
}

interface Course {
  id: string
  title: string
  slug: string
  coverImage: string
  chapters: Chapter[]
  instructor: {
    name: string
    avatar: string
  }
}

interface Enrollment {
  id: string
  progress: number
}

interface CoursePlayerProps {
  course: Course
  enrollment: Enrollment
  userId: string
}

export function CoursePlayer({ course, enrollment, userId }: CoursePlayerProps) {
  const router = useRouter()
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0)
  const [showSidebar, setShowSidebar] = useState(false) // Default to false for mobile
  const [applying, setApplying] = useState(false)
  const currentChapter = course.chapters[currentChapterIndex]

  const handleMarkComplete = async () => {
    try {
      await fetch(`/api/chapters/${currentChapter.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      })

      // Move to next chapter
      if (currentChapterIndex < course.chapters.length - 1) {
        setCurrentChapterIndex(currentChapterIndex + 1)
      }

      // Refresh page to update progress
      router.refresh()
    } catch (err) {
      console.error('Failed to mark chapter complete:', err)
    }
  }

  const handleApplyCertificate = async () => {
    setApplying(true)
    try {
      const res = await fetch('/api/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'course',
          itemId: course.id,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || '申请失败')
        return
      }

      alert('证书已生成！')
      router.push('/my-certificates')
    } catch (err) {
      alert('申请失败，请稍后重试')
    } finally {
      setApplying(false)
    }
  }

  const completedCount = course.chapters.filter((ch) => ch.completed).length
  const progressPercent = Math.round((completedCount / course.chapters.length) * 100)
  const isCompleted = progressPercent === 100

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2 sm:px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSidebar(!showSidebar)}
              className="flex-shrink-0"
            >
              {showSidebar ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link
              href="/my-courses"
              className="hidden sm:flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              返回我的课程
            </Link>
            <Link
              href="/my-courses"
              className="sm:hidden flex items-center text-sm text-gray-600 dark:text-gray-400"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </div>

          <div className="flex-1 text-center min-w-0">
            <h1 className="text-sm sm:text-base md:text-lg font-semibold truncate px-2">{course.title}</h1>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              <span className="hidden sm:inline">进度: </span>{progressPercent}%
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar - Mobile overlay, Desktop side panel */}
        {showSidebar && (
          <>
            {/* Mobile overlay backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setShowSidebar(false)}
            />

            {/* Sidebar panel */}
            <aside className="fixed lg:relative inset-y-0 left-0 w-80 sm:w-96 lg:w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto z-50 lg:z-auto">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold">课程内容</h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSidebar(false)}
                    className="lg:hidden"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {completedCount} / {course.chapters.length} 章节已完成
                </div>
                <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>

            {isCompleted && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <Button
                  onClick={handleApplyCertificate}
                  disabled={applying}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <Award className="h-5 w-5 mr-2" />
                  {applying ? '申请中...' : '申请证书'}
                </Button>
              </div>
            )}

            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {course.chapters.map((chapter, index) => (
                <button
                  key={chapter.id}
                  onClick={() => {
                    setCurrentChapterIndex(index)
                    setShowSidebar(false) // Close sidebar on mobile when selecting chapter
                  }}
                  className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                    currentChapterIndex === index ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {chapter.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : currentChapterIndex === index ? (
                        <PlayCircle className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium mb-1 line-clamp-2">
                        {index + 1}. {chapter.title}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {formatDuration(chapter.duration)}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>
          </>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8">
            {/* Video Player */}
            <div className="mb-6 sm:mb-8">
              <div className="aspect-video bg-gray-900 rounded-lg sm:rounded-2xl overflow-hidden mb-4">
                {currentChapter.videoUrl ? (
                  <div className="w-full h-full flex items-center justify-center">
                    {currentChapter.videoUrl.includes('youtube.com') || currentChapter.videoUrl.includes('youtu.be') ? (
                      <iframe
                        src={currentChapter.videoUrl.replace('watch?v=', 'embed/')}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    ) : currentChapter.videoUrl.includes('bilibili.com') ? (
                      <iframe
                        src={currentChapter.videoUrl}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    ) : (
                      <a
                        href={currentChapter.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white underline"
                      >
                        打开视频链接
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <div className="text-center">
                      <PlayCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p>暂无视频</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                <Button
                  variant="outline"
                  onClick={() => setCurrentChapterIndex(Math.max(0, currentChapterIndex - 1))}
                  disabled={currentChapterIndex === 0}
                  className="h-11 sm:h-10"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  上一章
                </Button>

                {!currentChapter.completed && (
                  <Button
                    onClick={handleMarkComplete}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 h-11 sm:h-10"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    标记完成
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() =>
                    setCurrentChapterIndex(
                      Math.min(course.chapters.length - 1, currentChapterIndex + 1)
                    )
                  }
                  disabled={currentChapterIndex === course.chapters.length - 1}
                  className="h-11 sm:h-10"
                >
                  下一章
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>

            {/* Chapter Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-bold">
                  {currentChapterIndex + 1}. {currentChapter.title}
                </h2>
                {currentChapter.completed && (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    已完成
                  </Badge>
                )}
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400">
                时长: {formatDuration(currentChapter.duration)}
              </div>

              {currentChapter.topics.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">本章内容</h3>
                  <ul className="space-y-2">
                    {currentChapter.topics.map((topic, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span>{topic}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
