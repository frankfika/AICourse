/**
 * ProfilePage — P0-6 改为薄壳
 *
 * 旧版个人中心(原 /profile 路由)由 P0-6 新版「学习中心」(/dashboard)取代。
 * 保留本文件 + ProfilePage export,仅作为 /profile 老链接的 redirect target,
 * 不再渲染任何旧版 UI。后续若确认无人访问 /profile,可直接删除本文件。
 *
 * 重定向:`/profile` → `/dashboard`(replace,不污染 history)
 */
import { Navigate } from 'react-router-dom';

export function ProfilePage() {
  return <Navigate to="/dashboard" replace />;
}

/* ────────────────────────────────────────────────────────────────
 * 旧版实现已废弃,完整代码保留在 git history(commit 8fed8e1 P0-5 之前)。
 * 如果 Frank 决定彻底删除 /profile,直接 delete 本文件 + 移除 router.tsx import 即可。
 * ──────────────────────────────────────────────────────────────── */
