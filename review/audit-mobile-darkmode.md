# 移动端 + 暗色模式 + 响应式 Audit

**目标**: 检查断点切换 / 暗色 token 一致性 / 触摸友好 / 移动端未适配组件

**只读模式**: 不修改代码,只读源码 + Tailwind class 扫,产出 audit 报告

**项目**: /Users/fangchen/Baidu/GitHub/AICourse
**范围**: apps/web/src/** (重点 components/, features/dashboard/, Layout.tsx, HomePage.tsx, 设计系统 pages)
**对照**: docs/USER_MANUAL §17 移动端 + §18 主题无障碍

## 审计维度

### 1. 断点一致性

扫所有页面的 Tailwind class,看断点前缀使用是否一致:
- `sm:` (≥640)
- `md:` (≥768) 
- `lg:` (≥1024)
- `xl:` (≥1280)
- `2xl:` (≥1536)

重点查:
- [ ] 是否有页面只用 `md:`,没考虑 `sm:` / `lg:`
- [ ] 是否有 hardcoded width (e.g. `w-[300px]`) 在响应式容器里没换断点
- [ ] 是否有 grid 用固定 `grid-cols-3` 没做 `grid-cols-1 md:grid-cols-3`
- [ ] 是否有 `hidden md:block` / `md:hidden` 用错位置(隐藏内容 vs 切换显示)

### 2. 移动端特定功能

对照 USER_MANUAL §17 移动端体验:
- [ ] 5 宫格 bottom tab 真在 < 768 显示?
- [ ] FAB 在移动端在 bottom tab 上方不重叠?
- [ ] 学习中心 < md 切 3 tab (大纲/视频/AI) 切换?
- [ ] 课程列表 < md 筛选侧栏折成顶部一行 + filter sheet?
- [ ] 管理员页 (< md) 重定向到"请用桌面"提示?
- [ ] 搜索弹层 < md 全屏 modal?

### 3. 触摸友好

- [ ] 按钮最小点击区 ≥ 44×44 (iOS HIG)
- [ ] 表单 input 字号 ≥ 16px (iOS 防止自动缩放)
- [ ] 链接 / 文本可点击区够大 (尤其 footer / 卡片)
- [ ] 滑动手势冲突(暂不实现 swipe,确认无 SWIPER 类库)

### 4. 暗色模式 token 一致性

- [ ] 全项目用 `bg-neutral-*` `text-neutral-*` 走 token,没用 `bg-white` `bg-black` `text-gray-500` 硬编
- [ ] 透明度变体走 token:`bg-brand-500/20` 模式,而不是 `bg-brand-200`
- [ ] 暗色变量正确切换(在 <html class="dark"> 生效)
- [ ] 第三方组件 / icon 颜色在暗色下够亮
- [ ] 渐变 / shadow 在暗色下不"飘"(比如 `shadow-md` 暗色看不见)

### 5. 暗色模式实际切换

- [ ] Layout 主题切换按钮真触发 useTheme?
- [ ] 持久化到 localStorage?
- [ ] 首次访问读 prefers-color-scheme?
- [ ] DashboardLayout 自己的 useDashboardTheme 跟 Layout 同步吗 (是独立实现还是复用)

### 6. a11y (无障碍)

- [ ] 焦点环可见(无 `outline-none` 滥用)
- [ ] icon-only button 有 aria-label
- [ ] loading 状态 role="status" / aria-busy
- [ ] 表单 label 关联 (htmlFor)
- [ ] 跳过导航(skip to content) — 通常没有,记录缺口
- [ ] 颜色对比 — token 设计上是否 ≥ 4.5:1

### 7. 性能 / 移动端

- [ ] 大图用 lazy loading?
- [ ] 字体用 font-display: swap?
- [ ] 动画 transform / opacity(不走 top/left 重排)
- [ ] 移动端 < md 是否禁用 hover 效果(hover: 在触屏无效)
- [ ] 第三方字体不阻塞渲染

## 重点查页面

- Layout.tsx (顶层 nav / theme toggle / FAB / bottom tab)
- HomePage.tsx (8 段位响应式)
- DashboardLayout.tsx (3 栏响应式)
- CourseListPage.tsx (筛选侧栏响应式)
- SearchPage.tsx (结果列表响应式)
- CommandPalette.tsx (弹层响应式)
- HomePage 的 home (mobile 优化)
- Admin pages (移动端重定向?)

## 输出格式

写到 `/Users/fangchen/Baidu/GitHub/AICourse/review/audit-mobile-darkmode.md`:

```markdown
# 移动端 + 暗色 Audit

## 摘要
- 检查页面数: N
- 移动端 OK: N
- 暗色 OK: N
- 触摸友好 OK: N
- a11y OK: N

## P0 (移动端用户立刻撞到)

### 问题 1: [页面] 在 < md 下 [现象]
- 位置: file:line
- 现状: [实际渲染 / 行为]
- 缺口: [断点/触摸/字号问题]
- 用户故事: "用户在 375px iPhone 打开 X 页..."

## P1 (暗色 / a11y)

...

## 不一致点

- [比如:Layout 跟 DashboardLayout 的 useTheme 各自实现,可能不同步]
- [比如:暗色下 5 处用硬编 `bg-white` 没走 token]
- [比如:< sm 字号 < 16px iOS 触发自动缩放]

## 附录:按断点的不一致矩阵

| 页面 | < sm | sm-md | md-lg | lg+ | 暗色 | a11y |
|------|------|-------|-------|-----|------|------|
| / | ✓ | ✓ | ✓ | ✓ | ✗ | - |
| /dashboard | ✗ | ✗ | ✓ | ✓ | - | - |
| ... | ... | ... | ... | ... | ... | ... |
```

**重要约束**:
- **不写"建议"**,只描述现状
- **每条引述 file:line**
- **500-1500 中文字**
- **不修改代码**
- **写完即结束**
