import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { practicesApi } from '../../lib/practicesApi';
import { useAuthStore } from '../../stores/authStore';
import {
  PlayCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  BookOpen,
  Target,
  AlertCircle,
  Loader2,
  Trophy
} from 'lucide-react';

const DIFFICULTY_COLORS = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-blue-100 text-blue-800',
  advanced: 'bg-orange-100 text-orange-800',
  expert: 'bg-red-100 text-red-800',
};

const DIFFICULTY_LABELS = {
  beginner: '初级',
  intermediate: '中级',
  advanced: '高级',
  expert: '专家',
};

const TYPE_LABELS = {
  model_deployment: '模型部署',
  model_training: '模型训练',
  model_inference: '模型推理',
  api_integration: 'API集成',
  notebook: 'Notebook',
  sandbox: '在线沙箱',
  repository: '代码仓库',
  csghub_space: 'CSGHub Space',
};

export function CoursePracticesTab() {
  const { id: courseId } = useParams();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [activeProject, setActiveProject] = useState<string | null>(null);

  // 获取实践项目列表
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['practices', courseId],
    queryFn: () => practicesApi.getProjectsByCourse(courseId!),
    enabled: !!courseId,
  });

  // 获取用户进度
  const { data: progress = [] } = useQuery({
    queryKey: ['practices-progress', courseId],
    queryFn: () => practicesApi.getUserProgress(courseId),
    enabled: !!user,
  });

  // 开始项目
  const startMutation = useMutation({
    mutationFn: (projectId: string) => practicesApi.startProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practices-progress'] });
    },
  });

  // 完成项目
  const completeMutation = useMutation({
    mutationFn: ({ projectId, data }: any) => practicesApi.completeProject(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practices-progress'] });
      setActiveProject(null);
      setSubmissionUrl('');
      setNotes('');
    },
  });

  // 跳过项目
  const skipMutation = useMutation({
    mutationFn: (projectId: string) => practicesApi.skipProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practices-progress'] });
    },
  });

  const getProjectStatus = (projectId: string) => {
    return progress.find((p: any) => p.projectId === projectId);
  };

  const handleStart = (projectId: string, projectUrl: string) => {
    if (!user) {
      window.location.href = '/login';
      return;
    }

    startMutation.mutate(projectId);
    window.open(projectUrl, '_blank');
  };

  const handleComplete = (projectId: string) => {
    if (!user) return;

    completeMutation.mutate({
      projectId,
      data: {
        submissionUrl: submissionUrl || undefined,
        notes: notes || undefined,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#171717]" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <BookOpen className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">暂无实践项目</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">💡 实践建议</p>
            <p>完成视频学习后，通过实践项目巩固知识。每个项目都关联到 OpenCSG 的开源产品，让你在真实环境中学习。</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {projects.map((project: any) => {
          const status = getProjectStatus(project.id);
          const isCompleted = status?.status === 'completed';
          const isInProgress = status?.status === 'in_progress';
          const isSkipped = status?.status === 'skipped';

          return (
            <div
              key={project.id}
              className={`bg-white border rounded-lg p-6 transition-all ${
                isCompleted ? 'border-green-300 bg-green-50' : 'border-[#EEEDE9] hover:border-[#171717]'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold text-[#171717]">{project.title}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${DIFFICULTY_COLORS[project.difficulty]}`}>
                      {DIFFICULTY_LABELS[project.difficulty]}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                      {TYPE_LABELS[project.projectType]}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">{project.description}</p>

                  <div className="flex items-center gap-6 text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>约 {project.estimatedTime} 分钟</span>
                    </div>
                    {isCompleted && status.completedAt && (
                      <div className="flex items-center gap-1 text-green-600">
                        <Trophy className="w-4 h-4" />
                        <span>已完成</span>
                      </div>
                    )}
                  </div>

                  {project.objectives && (
                    <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
                      <div className="flex items-start gap-2">
                        <Target className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-gray-700 mb-1">学习目标：</p>
                          <p className="text-gray-600">{project.objectives}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeProject === project.id && (
                    <div className="mt-4 p-4 bg-gray-50 rounded space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          提交链接（可选）
                        </label>
                        <input
                          type="url"
                          value={submissionUrl}
                          onChange={(e) => setSubmissionUrl(e.target.value)}
                          placeholder="https://github.com/your-repo"
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          学习笔记（可选）
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="记录你的学习心得..."
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#171717]"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleComplete(project.id)}
                          disabled={completeMutation.isPending}
                          className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          {completeMutation.isPending ? '提交中...' : '✓ 标记为已完成'}
                        </button>
                        <button
                          onClick={() => setActiveProject(null)}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {!isCompleted && !isSkipped && (
                    <>
                      <button
                        onClick={() => handleStart(project.id, project.projectUrl)}
                        disabled={startMutation.isPending}
                        className="px-4 py-2 bg-[#171717] text-white rounded flex items-center gap-2 text-sm font-medium hover:bg-[#262626] disabled:opacity-50"
                      >
                        <PlayCircle className="w-4 h-4" />
                        {isInProgress ? '继续实践' : '开始实践'}
                      </button>
                      {isInProgress && activeProject !== project.id && (
                        <button
                          onClick={() => setActiveProject(project.id)}
                          className="px-4 py-2 border border-green-600 text-green-600 rounded flex items-center gap-2 text-sm font-medium hover:bg-green-50"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          标记完成
                        </button>
                      )}
                    </>
                  )}
                  {isCompleted && (
                    <a
                      href={project.projectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded flex items-center gap-2 text-sm font-medium hover:bg-gray-50"
                    >
                      <ExternalLink className="w-4 h-4" />
                      再次查看
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
