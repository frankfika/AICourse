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
  Trophy,
} from 'lucide-react';

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: '入门',
  intermediate: '中级',
  advanced: '高级',
  expert: '专家',
};

const TYPE_LABELS: Record<string, string> = {
  model_deployment: '模型部署',
  model_training: '模型训练',
  model_inference: '模型推理',
  api_integration: 'API 集成',
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

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['practices', courseId],
    queryFn: () => practicesApi.getProjectsByCourse(courseId!),
    enabled: !!courseId,
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['practices-progress', courseId],
    queryFn: () => practicesApi.getUserProgress(courseId),
    enabled: !!user,
  });

  const startMutation = useMutation({
    mutationFn: (projectId: string) => practicesApi.startProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practices-progress'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: ({ projectId, data }: any) => practicesApi.completeProject(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practices-progress'] });
      setActiveProject(null);
      setSubmissionUrl('');
      setNotes('');
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
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[#171717]" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="border-2 border-[#171717] bg-white text-center py-20">
        <BookOpen className="w-10 h-10 mx-auto mb-3 text-[#A3A3A3]" />
        <p className="text-sm text-[#666666]">暂无实践项目</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notice bar */}
      <div className="border-2 border-[#171717] bg-white p-4 flex items-start gap-3">
        <AlertCircle className="w-4 h-4 text-[#171717] shrink-0 mt-0.5" />
        <div className="text-sm font-medium text-[#171717]">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#666666] mr-2">/ Tip</span>
          完成视频学习后，通过实践项目巩固知识。每个项目都关联到 OpenCSG 的开源产品，让你在真实环境中学习。
        </div>
      </div>

      <div className="space-y-0 border-t border-[#171717]">
        {projects.map((project: any) => {
          const status = getProjectStatus(project.id);
          const isCompleted = status?.status === 'completed';
          const isInProgress = status?.status === 'in_progress';
          const isSkipped = status?.status === 'skipped';

          return (
            <div
              key={project.id}
              className={`p-6 border-b border-[#171717] hover:bg-[#F5F4F0] transition-colors ${
                isCompleted ? 'bg-[#171717] text-white hover:bg-[#262626]' : 'bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <h3 className={`text-lg font-black tracking-tight ${isCompleted ? 'text-white' : 'text-[#171717]'}`}>
                      {project.title}
                    </h3>
                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                      isCompleted
                        ? 'border border-white text-white'
                        : 'bg-[#171717] text-white'
                    }`}>
                      {DIFFICULTY_LABELS[project.difficulty] ?? project.difficulty}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                      isCompleted ? 'border border-white/30 text-white/70' : 'border border-[#171717] text-[#171717]'
                    }`}>
                      {TYPE_LABELS[project.projectType] ?? project.projectType}
                    </span>
                  </div>

                  <p className={`text-sm leading-relaxed mb-4 ${isCompleted ? 'text-white/70' : 'text-[#666666]'}`}>
                    {project.description}
                  </p>

                  <div className={`flex items-center gap-4 text-[10px] font-black uppercase tracking-widest mb-4 ${
                    isCompleted ? 'text-white/50' : 'text-[#666666]'
                  }`}>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 约 {project.estimatedTime} 分钟
                    </span>
                    {isCompleted && status.completedAt && (
                      <span className="flex items-center gap-1 text-white">
                        <Trophy className="w-3 h-3" /> 已完成
                      </span>
                    )}
                  </div>

                  {project.objectives && (
                    <div className={`p-3 border ${isCompleted ? 'border-white/20 bg-white/5' : 'border-[#EEEDE9] bg-[#F5F4F0]'} text-sm`}>
                      <div className="flex items-start gap-2">
                        <Target className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isCompleted ? 'text-white/60' : 'text-[#666666]'}`} />
                        <div>
                          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isCompleted ? 'text-white/60' : 'text-[#666666]'}`}>
                            学习目标
                          </p>
                          <p className={`leading-relaxed ${isCompleted ? 'text-white/80' : 'text-[#171717]'}`}>
                            {project.objectives}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeProject === project.id && (
                    <div className={`mt-4 p-4 border space-y-3 ${
                      isCompleted ? 'border-white/20 bg-white/5' : 'border-[#EEEDE9] bg-[#F5F4F0]'
                    }`}>
                      <div>
                        <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isCompleted ? 'text-white/60' : 'text-[#666666]'}`}>
                          提交链接（可选）
                        </label>
                        <input
                          type="url"
                          value={submissionUrl}
                          onChange={(e) => setSubmissionUrl(e.target.value)}
                          placeholder="https://github.com/your-repo"
                          className={`w-full px-3 py-2 border text-sm focus:outline-none transition-colors ${
                            isCompleted
                              ? 'border-white/30 bg-transparent text-white placeholder-white/30 focus:bg-white/10'
                              : 'border-[#171717] bg-white text-[#171717] focus:bg-[#EEEDE9]'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[10px] font-black uppercase tracking-widest mb-1 ${isCompleted ? 'text-white/60' : 'text-[#666666]'}`}>
                          学习笔记（可选）
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="记录你的学习心得..."
                          rows={3}
                          className={`w-full px-3 py-2 border text-sm focus:outline-none resize-none transition-colors ${
                            isCompleted
                              ? 'border-white/30 bg-transparent text-white placeholder-white/30 focus:bg-white/10'
                              : 'border-[#171717] bg-white text-[#171717] focus:bg-[#EEEDE9]'
                          }`}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleComplete(project.id)}
                          disabled={completeMutation.isPending}
                          className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-50 ${
                            isCompleted
                              ? 'bg-white text-[#171717] hover:bg-[#EEEDE9]'
                              : 'bg-[#171717] text-white hover:bg-[#262626]'
                          }`}
                        >
                          {completeMutation.isPending ? '提交中...' : '标记完成'}
                        </button>
                        <button
                          onClick={() => setActiveProject(null)}
                          className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                            isCompleted
                              ? 'border border-white/30 text-white/70 hover:bg-white/10'
                              : 'border border-[#171717] text-[#171717] hover:bg-[#EEEDE9]'
                          }`}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {!isCompleted && !isSkipped && (
                    <>
                      <button
                        onClick={() => handleStart(project.id, project.projectUrl)}
                        disabled={startMutation.isPending}
                        className="px-4 py-2 bg-[#171717] text-white text-xs font-black uppercase tracking-widest hover:bg-[#262626] transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        {isInProgress ? '继续实践' : '开始实践'}
                      </button>
                      {isInProgress && activeProject !== project.id && (
                        <button
                          onClick={() => setActiveProject(project.id)}
                          className="px-4 py-2 border border-[#171717] text-[#171717] text-xs font-black uppercase tracking-widest hover:bg-[#171717] hover:text-white transition-colors flex items-center gap-2"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
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
                      className="px-4 py-2 border border-white/30 text-white text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
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
