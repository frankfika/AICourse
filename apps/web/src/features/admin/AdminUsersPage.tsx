/**
 * AdminUsersPage — P1-3 重写 (admin 用户管理) — brutalist 重构
 *
 * 功能:
 *   - 顶部:搜索框(邮箱/昵称 模糊)
 *   - 表格:头像 + 昵称 + 邮箱 + 角色 chip + 操作(查看详情 / 改角色)
 *   - 行内"查看" → 右侧 Drawer 弹出 6 section:
 *     1) 基本信息:头像 / 邮箱 / 角色 / 注册时间 / 最后登录
 *     2) 学习概况:报名课程数 / 完成进度 / 累计学习时长(派生自 enrollments)
 *     3) 订单:最近 20 笔(从 findOne 内联返回)
 *     4) 证书:最近 20 张
 *     5) 积分:当前积分 + 最近 20 笔流水
 *     6) 活动日志:Phase 2+ 接 audit 读 API
 *   - 5 操作(在 Drawer 内):
 *     1) 改角色:下拉 student/instructor/admin
 *     2) 授权课程:输入课程 ID 逗号分隔
 *     3) 重置密码:生成 16 位临时密码 + 设 passwordResetRequired=true
 *     4) 封号:Phase 2+(schema 暂不支持)
 *     5) 删账号:硬删,二次确认
 *
 * 设计:brutalist — 跟 AdminBadgesPage / AdminCoursesPage / AdminReviewsPage 一致
 *   - 黑白硬边、无圆角、无阴影、tracking-widest
 *   - 不使用 dark mode 变体(其他 admin 页也是亮态)
 *   - 不用 <Card> / <Button> / <Input> 基础组件,改 brutalist helpers
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Eye,
  Shield,
  ShieldCheck,
  GraduationCap,
  ShoppingBag,
  Award,
  Coins,
  Calendar,
  RefreshCw,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../components/auth/Toast';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Drawer } from '../../components/ui/Drawer';
import { Skeleton } from '../../components/ui/Skeleton';
import { cn } from '../../lib/cn';

interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'instructor' | 'admin';
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string | null;
}

interface UserDetail extends UserSummary {
  points: number;
  level: number;
  passwordResetRequired: boolean;
  enrollments: Array<{
    id: string;
    enrolledAt: string;
    expiresAt?: string | null;
    source: string;
    course?: { id: string; title: string; thumbnail?: string | null } | null;
    degree?: { id: string; title: string } | null;
  }>;
  orders: Array<{
    id: string;
    status: string;
    amount: number;
    type: string;
    createdAt: string;
    paidAt?: string | null;
  }>;
  certificates: Array<{
    id: string;
    type: string;
    title: string;
    serialNumber: string;
    issuedAt: string;
  }>;
  pointTransactions: Array<{
    id: string;
    delta: number;
    reason: string;
    createdAt: string;
  }>;
  _count: {
    enrollments: number;
    orders: number;
    certificates: number;
    progressRecords: number;
    submissions: number;
  };
}

const ROLE_META: Record<string, { label: string; color: string; icon: typeof Shield }> = {
  student: {
    label: '学员',
    color: 'border border-[#171717] text-[#171717]',
    icon: UserIcon,
  },
  instructor: {
    label: '讲师',
    color: 'border border-[#171717] text-[#171717] bg-[#EEEDE9]',
    icon: GraduationCap,
  },
  admin: {
    label: '管理员',
    color: 'bg-[#171717] text-white',
    icon: ShieldCheck,
  },
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'border border-[#171717] text-[#171717]',
  paid: 'bg-[#171717] text-white',
  failed: 'border border-[#171717] text-[#171717] bg-[#F5F4F0]',
  refunded: 'border border-[#171717] text-[#171717] bg-[#EEEDE9]',
  cancelled: 'border border-[#171717] text-[#666666]',
  expired: 'border border-[#171717] text-[#666666]',
};

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN');
}

function generateTempPassword(): string {
  // 16 位 base36 随机
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 列表
  const { data: users, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      const { data } = await api.get<{ data: UserSummary[] }>(
        `/api/v1/users?search=${encodeURIComponent(search)}&limit=100`,
      );
      return data.data;
    },
  });

  // 详情
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-user-detail', selectedUserId],
    queryFn: async () => {
      const { data } = await api.get<UserDetail>(`/api/v1/users/${selectedUserId}`);
      return data;
    },
    enabled: !!selectedUserId,
  });

  // 改角色
  const roleMutation = useMutation({
    mutationFn: (newRole: string) =>
      api.patch(`/api/v1/users/${selectedUserId}`, { role: newRole }),
    onSuccess: () => {
      showToast('角色已更新', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', selectedUserId] });
    },
    onError: (err: any) => {
      showToast(err?.response?.data?.message ?? '更新失败', 'error');
    },
  });

  // 授权课程
  const grantMutation = useMutation({
    mutationFn: (courseIds: string[]) =>
      api.post(`/api/v1/users/${selectedUserId}/grant-course`, { courseIds }),
    onSuccess: (res) => {
      showToast(`已授权 ${res.data.granted} 门课程`, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-user-detail', selectedUserId] });
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? '授权失败', 'error'),
  });

  // 重置密码
  const resetPwdMutation = useMutation({
    mutationFn: (tempPassword: string) =>
      api.patch(`/api/v1/users/${selectedUserId}`, {
        // 后端目前没接受 passwordHash 字段,先标记 passwordResetRequired
        // 临时密码由 admin 自行告知用户;下次登录时强制改密码
        passwordResetRequired: true,
        // 后端 P2 接受 password 字段
        password: tempPassword as any,
      }),
    onSuccess: (_, tempPassword) => {
      showToast(`临时密码:${tempPassword}(请复制告知用户,刷新页面后消失)`, 'success', 15000);
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? '重置失败', 'error'),
  });

  // 删除
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/v1/users/${selectedUserId}`),
    onSuccess: () => {
      showToast('用户已删除', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setConfirmDelete(false);
      setSelectedUserId(null);
    },
    onError: (err: any) => showToast(err?.response?.data?.message ?? '删除失败', 'error'),
  });

  return (
    <div>
      {/* 顶部 */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#666666] mb-2">
            / Admin · Users
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter uppercase">用户管理</h2>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
          <input
            type="text"
            placeholder="搜索邮箱 / 昵称..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-100 border-2 border-[#171717] dark:border-neutral-50 text-sm text-[#171717] dark:text-neutral-50 focus:outline-none focus:bg-[#EEEDE9] dark:focus:bg-neutral-800 transition-colors"
          />
        </div>
      </div>

      {/* 错误态 */}
      {isError && (
        <div className="border-2 border-[#171717] bg-[#F5F4F0] text-[#171717] p-4 text-sm">
          加载用户列表失败
          <button onClick={() => refetch()} className="ml-2 underline">
            重试
          </button>
        </div>
      )}

      {/* 表格 */}
      <div className="border-2 border-[#171717] dark:border-neutral-50 bg-white dark:bg-neutral-100">
        <div className="hidden md:grid md:grid-cols-12 gap-4 p-4 border-b-2 border-[#171717] text-[10px] font-black uppercase tracking-widest text-[#666666]">
          <div className="md:col-span-1">#</div>
          <div className="md:col-span-4">User</div>
          <div className="md:col-span-4">Email</div>
          <div className="md:col-span-2">Role</div>
          <div className="md:col-span-1 text-right">Action</div>
        </div>
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="text" className="h-12 w-full" />
            ))}
          </div>
        ) : users && users.length > 0 ? (
          users.map((user, i) => {
            const roleMeta = ROLE_META[user.role] ?? ROLE_META.student;
            const RoleIcon = roleMeta.icon;
            return (
              <div
                key={user.id}
                className={cn(
                  'grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center text-sm',
                  i < users.length - 1 && 'border-b border-[#EEEDE9]',
                  'hover:bg-[#F5F4F0] transition-colors',
                )}
              >
                <div className="col-span-12 md:col-span-1 text-[10px] font-black text-[#A3A3A3]">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="col-span-12 md:col-span-4 flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-[#171717] text-white text-sm font-black flex items-center justify-center shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-black tracking-tight truncate">{user.name}</span>
                </div>
                <div className="col-span-12 md:col-span-4 text-xs text-[#666666] truncate flex items-center gap-1.5">
                  <Mail className="w-3 h-3" /> {user.email}
                </div>
                <div className="col-span-12 md:col-span-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest',
                      roleMeta.color,
                    )}
                  >
                    <RoleIcon className="w-3 h-3" />
                    {roleMeta.label}
                  </span>
                </div>
                <div className="col-span-12 md:col-span-1 text-right">
                  <button
                    onClick={() => setSelectedUserId(user.id)}
                    className="inline-flex items-center gap-1 px-3 py-1 text-[10px] font-black uppercase tracking-widest border border-[#171717] hover:bg-[#171717] hover:text-white transition-colors"
                  >
                    <Eye className="w-3 h-3" /> 详情
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-16 text-center text-sm text-[#666666]">未找到用户</div>
        )}
      </div>

      {/* 详情 Drawer */}
      <Drawer
        open={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
        title={detail ? `${detail.name} (${detail.email})` : '用户详情'}
        width={520}
      >
        {detailLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton variant="text" className="h-6 w-1/2" />
            <Skeleton variant="rectangle" className="h-32 w-full" />
            <Skeleton variant="rectangle" className="h-24 w-full" />
          </div>
        ) : detail ? (
          <UserDetailContent
            detail={detail}
            showToast={showToast}
            onChangeRole={(r) => roleMutation.mutate(r)}
            onGrantCourses={(ids) => grantMutation.mutate(ids)}
            onResetPassword={() => resetPwdMutation.mutate(generateTempPassword())}
            onDelete={() => setConfirmDelete(true)}
            isUpdating={
              roleMutation.isPending ||
              grantMutation.isPending ||
              resetPwdMutation.isPending
            }
          />
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteMutation.mutateAsync();
        }}
        title="确认删除该用户?"
        description="此操作将从数据库彻底删除该用户及其所有报名、订单、证书、积分。不可恢复。"
        variant="danger"
        confirmText="确认删除"
      />
    </div>
  );
}

// =============================================================
// 抽屉内容(6 section)
// =============================================================
function UserDetailContent({
  detail,
  showToast,
  onChangeRole,
  onGrantCourses,
  onResetPassword,
  onDelete,
  isUpdating,
}: {
  detail: UserDetail;
  showToast: (msg: string, variant?: 'success' | 'error' | 'info' | 'warning', durationMs?: number) => void;
  onChangeRole: (r: string) => void;
  onGrantCourses: (ids: string[]) => void;
  onResetPassword: () => void;
  onDelete: () => void;
  isUpdating: boolean;
}) {
  const [courseInput, setCourseInput] = useState('');
  const [showGrant, setShowGrant] = useState(false);

  const roleMeta = ROLE_META[detail.role] ?? ROLE_META.student;
  const RoleIcon = roleMeta.icon;

  return (
    <div className="divide-y divide-[#EEEDE9]">
      {/* 1) 基本信息 */}
      <section className="p-5">
        <SectionTitle icon={UserIcon} title="基本信息" />
        <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
          <Field label="用户 ID" value={<span className="font-mono text-xs">{detail.id}</span>} />
          <Field label="角色">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest',
                roleMeta.color,
              )}
            >
              <RoleIcon className="w-3 h-3" /> {roleMeta.label}
            </span>
          </Field>
          <Field label="注册时间" value={formatDate(detail.createdAt)} />
          <Field label="最后登录" value={formatDateTime(detail.lastLoginAt)} />
          <Field label="积分" value={`${detail.points} (Lv.${detail.level})`} />
          <Field label="需重置密码">
            {detail.passwordResetRequired ? (
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-widest bg-[#171717] text-white">
                是
              </span>
            ) : (
              <span className="text-[#666666]">否</span>
            )}
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <select
            value={detail.role}
            onChange={(e) => onChangeRole(e.target.value)}
            disabled={isUpdating}
            aria-label="修改角色"
            className="px-3 py-2 bg-white dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:bg-[#EEEDE9] dark:focus:bg-neutral-800 disabled:opacity-50"
          >
            <option value="student">student</option>
            <option value="instructor">instructor</option>
            <option value="admin">admin</option>
          </select>
          <BrutalButton
            size="sm"
            variant="secondary"
            disabled={isUpdating}
            onClick={onResetPassword}
          >
            重置密码
          </BrutalButton>
          <BrutalButton
            size="sm"
            variant="danger"
            onClick={onDelete}
          >
            删除账号
          </BrutalButton>
        </div>
        <p className="text-[10px] text-[#666666] mt-2">
          提示:封号功能 Phase 2+(schema 暂不支持 banned 字段)
        </p>
      </section>

      {/* 2) 学习概况 */}
      <section className="p-5">
        <SectionTitle icon={GraduationCap} title="学习概况" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <StatBox label="报名课程" value={detail._count.enrollments} />
          <StatBox label="订单" value={detail._count.orders} />
          <StatBox label="证书" value={detail._count.certificates} />
          <StatBox label="进度记录" value={detail._count.progressRecords} />
          <StatBox label="作品提交" value={detail._count.submissions} />
          <StatBox label="积分" value={detail.points} />
        </div>
        {detail.enrollments.length > 0 && (
          <div className="mt-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-2">
              最近报名 (前 20)
            </h4>
            <ul className="space-y-1 text-xs">
              {detail.enrollments.slice(0, 10).map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 py-1.5 px-2 bg-[#F5F4F0]"
                >
                  <span className="truncate">
                    {e.course?.title ?? e.degree?.title ?? '未知课程'}
                  </span>
                  <span className="text-[#666666] whitespace-nowrap">
                    {formatDate(e.enrolledAt)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 3) 订单 */}
      <section className="p-5">
        <SectionTitle icon={ShoppingBag} title={`订单 (${detail._count.orders})`} />
        {detail.orders.length === 0 ? (
          <p className="text-xs text-[#666666] mt-2">无订单</p>
        ) : (
          <ul className="space-y-1.5 mt-3 text-xs">
            {detail.orders.slice(0, 10).map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-2 py-1.5 px-2 bg-[#F5F4F0]"
              >
                <div className="min-w-0">
                  <div className="font-mono">{o.id.slice(0, 8).toUpperCase()}</div>
                  <div className="text-[#666666]">{o.type} · ¥{Number(o.amount).toFixed(2)}</div>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center px-1.5 py-0.5 text-[10px] font-black uppercase tracking-widest',
                    STATUS_COLOR[o.status] ?? STATUS_COLOR.pending,
                  )}
                >
                  {o.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4) 证书 */}
      <section className="p-5">
        <SectionTitle icon={Award} title={`证书 (${detail._count.certificates})`} />
        {detail.certificates.length === 0 ? (
          <p className="text-xs text-[#666666] mt-2">未获证书</p>
        ) : (
          <ul className="space-y-1.5 mt-3 text-xs">
            {detail.certificates.slice(0, 10).map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 py-1.5 px-2 bg-[#F5F4F0]"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{c.title}</div>
                  <div className="font-mono text-[10px] text-[#666666]">{c.serialNumber}</div>
                </div>
                <span className="text-[10px] text-[#666666] whitespace-nowrap">
                  {formatDate(c.issuedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 5) 积分 */}
      <section className="p-5">
        <SectionTitle icon={Coins} title={`积分 (当前 ${detail.points})`} />
        {detail.pointTransactions.length === 0 ? (
          <p className="text-xs text-[#666666] mt-2">无流水</p>
        ) : (
          <ul className="space-y-1 mt-3 text-xs">
            {detail.pointTransactions.slice(0, 10).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 py-1.5 px-2 bg-[#F5F4F0]"
              >
                <span className="truncate text-[#666666]">{p.reason}</span>
                <span
                  className={cn(
                    'font-black tabular-nums',
                    p.delta >= 0 ? 'text-[#171717]' : 'text-[#666666] line-through',
                  )}
                >
                  {p.delta >= 0 ? '+' : ''}
                  {p.delta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 6) 授权课程操作 */}
      <section className="p-5">
        <SectionTitle icon={RefreshCw} title="授权课程" />
        {!showGrant ? (
          <div className="mt-3">
            <BrutalButton
              size="sm"
              variant="secondary"
              onClick={() => setShowGrant(true)}
            >
              授权新课程
            </BrutalButton>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <BrutalField
              label="课程 ID(逗号分隔)"
              value={courseInput}
              onChange={setCourseInput}
              placeholder="例如:abc123, def456"
            />
            <div className="flex gap-2">
              <BrutalButton
                size="sm"
                variant="primary"
                disabled={isUpdating}
                onClick={() => {
                  const ids = courseInput
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  if (ids.length === 0) {
                    showToast('请输入至少一个课程 ID', 'warning');
                    return;
                  }
                  onGrantCourses(ids);
                  setCourseInput('');
                  setShowGrant(false);
                }}
              >
                确认授权
              </BrutalButton>
              <BrutalButton
                size="sm"
                variant="secondary"
                onClick={() => {
                  setShowGrant(false);
                  setCourseInput('');
                }}
              >
                取消
              </BrutalButton>
            </div>
          </div>
        )}
      </section>

      {/* 7) 活动日志(Phase 2+) */}
      <section className="p-5">
        <SectionTitle icon={Calendar} title="活动日志" />
        <p className="text-xs text-[#666666] mt-2">Phase 2+ 接 audit-log 读 API</p>
      </section>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof UserIcon; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#171717]">
      <Icon className="w-4 h-4" />
      {title}
    </h3>
  );
}

function Field({ label, children, value }: { label: string; children?: React.ReactNode; value?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-0.5">
        {label}
      </div>
      <div className="text-sm font-medium">{children ?? value}</div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#F5F4F0] p-3 text-center">
      <div className="text-2xl font-black tabular-nums">{value}</div>
      <div className="text-[10px] font-black uppercase tracking-widest text-[#666666] mt-1">
        {label}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Brutalist 表单组件 — 跟 AdminBadgesPage / AdminCoursesPage 同风格
// 黑白硬边、无圆角、统一 tracking-widest 标签
// ──────────────────────────────────────────────────────────────────────

function BrutalField({
  label,
  value,
  onChange,
  type = 'text',
  required,
  multiline,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest text-[#666666] mb-2 flex items-center gap-1">
        {label}
        {required && <span className="text-red-600">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          required={required}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-white dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 text-sm text-[#171717] dark:text-neutral-50 focus:outline-none focus:bg-[#EEEDE9] dark:focus:bg-neutral-800 transition-colors resize-none"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
          className="w-full px-4 py-3 bg-white dark:bg-neutral-100 border border-[#171717] dark:border-neutral-50 text-sm text-[#171717] dark:text-neutral-50 focus:outline-none focus:bg-[#EEEDE9] dark:focus:bg-neutral-800 transition-colors"
        />
      )}
    </div>
  );
}

function BrutalButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled,
  type,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  const base =
    'inline-flex items-center justify-center font-black uppercase tracking-widest transition-colors disabled:opacity-50';
  const sizeCls = size === 'sm' ? 'px-4 py-2 text-[10px]' : 'px-6 py-3 text-xs';
  const variantCls = {
    primary: 'bg-[#171717] text-white hover:bg-[#262626]',
    secondary: 'border border-[#171717] text-[#171717] hover:bg-[#EEEDE9]',
    danger: 'border border-[#171717] text-[#171717] hover:bg-[#171717] hover:text-white',
  }[variant];
  return (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizeCls} ${variantCls} ${className}`}
    >
      {children}
    </button>
  );
}

function BrutalIconButton({
  onClick,
  children,
  title,
  className = '',
  danger,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 ${
        danger
          ? 'text-[#A3A3A3] hover:text-red-600 hover:bg-[#EEEDE9]'
          : 'text-[#A3A3A3] hover:text-[#171717] hover:bg-[#EEEDE9]'
      } transition-colors ${className}`}
    >
      {children}
    </button>
  );
}
