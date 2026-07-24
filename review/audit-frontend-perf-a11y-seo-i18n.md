# 前端 Audit · 性能 / a11y / SEO / i18n

## 1. 性能

- 角色 Frank 想分页/虚拟滚动翻 1k+ 课程,实际是 `courses/CourseListPage.tsx:194-228` 一次拉全 courses 做内存过滤,无分页;`admin/AdminUsersPage.tsx:161-169` `?limit=100` 一次拿,`AdminCoursesPage.tsx:479` `courses?.map` 全量渲染。
- 角色 Frank 想省带宽懒加载图,实际是 6 处 `<img>` (`OrderDetailPage.tsx:259`,`OrdersPage.tsx:298`,`CourseDetailPage.tsx:285`,`DegreeDetailPage.tsx:225`,`HackathonDetailPage.tsx:105`,`AiGeneratePanel.tsx:145`) 全无 `loading="lazy"`,全仓 grep 0 命中。
- 角色 Frank 想控制首页 bundle,实际是 `index.html` 无 font preload,`dist/assets/index-*.js` 600K + css 56K;`HomePage.tsx:26-37` 一次引入 10 个 lucide 图标(部分仅用 1-2 次),全仓 51 个文件 `from 'lucide-react'`,`AdminUsersPage.tsx:28-41` 一次性 import 13 个图标无 `void` 兜底。
- 角色 Frank 想 query 别 refetch,实际是 `lib/queryClient.ts:6` 全局 `staleTime: 5min`,但 `CourseListPage.tsx:202` 单独降为 30s,`HackathonListPage.tsx:37` / `DegreeListPage.tsx:12` 不写 staleTime(走全局),且只有 `lib/cms.ts:87` 一处 `refetchOnWindowFocus: false`,其余走默认 true — 切回标签页 courses/hackathons/degrees 全 refetch。
- 角色 Frank 想 debounce 搜索,实际是 `AdminUsersPage.tsx:156,250` / `HackathonListPage.tsx:24,118` 搜索 onChange 直绑 useState,无 setTimeout;只有 `CourseListPage.tsx:181-191` 做了 300ms debounce。
- `router.tsx:25-50` 已 `lazy()` admin/dashboard/search/enterprise,首页拆 chunk 符合预期,无新增问题。

## 2. a11y

- 角色屏读用户想听 7 组筛选折叠,实际是 `CourseListPage.tsx:679-702` `FilterSection` 仅 `aria-expanded` 配 button,无 `aria-controls`;line 696 toggle button 无 `type="button"`(form 上下文会冒泡 submit)。
- 角色键盘用户想看清焦点,实际是 `AdminUsersPage.tsx:251,444,721,730` 与 `HackathonListPage.tsx:120` 手写 `<input>/<select>` 用 `focus:outline-none focus:bg-[#EEEDE9]` 抹掉 outline 不补 ring,焦点不可见;`Button.tsx:32` 有 ring 但 `CourseListPage.tsx:319-326` 自定义 button 没继承。
- 角色 Frank 想装饰图跳过屏读,实际是 6 个 `<img>` 全是描述性 alt,`AiGeneratePanel.tsx:147` `alt="draft"` 是 placeholder 非真描述;无 `alt=""` 装饰图用例。
- 角色 Frank 想 AA 对比度,实际是 `DegreeListPage.tsx:81` `text-[#A3A3A3]` on `#F5F4F0` 约 2.0:1(不达标),`Input.tsx:95` `placeholder:text-neutral-400` 在白底约 2.9:1(不达标 4.5:1);`text-[#666666]` on `#F5F4F0` 4.7:1(过)。
- 角色 Frank 想表单有 label,实际是 `AdminUsersPage.tsx:246-252` / `HackathonListPage.tsx:115-120` 两个搜索 `<input>` 完全无 `<label>` 无 `aria-label`,只有 placeholder;`Input.tsx:60-66` 组件有 htmlFor+useId 但被旁路。

## 3. SEO

- 角色投资人想看课程详情 OG 卡,实际是 `CourseDetailPage.tsx` 全文无 `<Helmet>`(grep "Helmet" = 0),title 走静态;`CourseListPage.tsx:281-284` / `DegreeListPage.tsx:33-36` / `DegreeDetailPage.tsx:157-160` / `HackathonListPage.tsx:63-66` / `HackathonDetailPage.tsx:83-86` 有 Helmet 但**只有 title+description,无 og:image/og:url/og:type/twitter:card**;全仓 `meta property` 仅 6 处。
- 角色 Googlebot 想爬站点地图,实际是 `apps/web/public/` 仅 `wechat-qr.jpg`,**无 `robots.txt` 也无 `sitemap.xml`**(全仓 grep 0);`index.html:1-9` 8 行,无默认 description/canonical/hreflang。
- 角色 Googlebot 想拿结构化数据,实际是**全仓 grep `JSON-LD/application/ld+json/itemscope/itemtype` 0 命中**,Course/Hackathon 详情页均无 Schema.org markup。
- 角色 Frank 想 canonical 集中权重,实际是**全仓 grep `canonical` 0 命中**,5 个 Helmet 页 + index.html 均无。

## 4. i18n

- 角色 Frank 想管理员切英文后台能看懂,实际是 `AdminUsersPage.tsx` **整页 29 处硬编码中文**(`'学员'/'讲师'/'管理员'`,`'搜索邮箱/昵称...'`,`'用户管理'`,`'加载用户列表失败'`,line 105-115/186/191/203/219/226/231/248/259/337/494),完全没 import `useI18n`。
- 角色 Frank 想 i18n 统一,实际是 `CourseListPage.tsx:396,415,442,464,489,514,538` 7 个 `FilterSection title="分类/难度/时长/收费/标签/讲师/评分"` 全硬编码,不走 `t()`;line 78-83 5 个 `if (t.includes('rag'))` 分支返回完全相同 gradient(死代码)。
- 角色 Frank 想卡片 i18n,实际是 `HackathonCard.tsx:1-6` 无 `useI18n`,line 25-28 `'报名截止'/'距开赛'/'距开始'` 硬编码,line 38/40/44/74 new Date 重复 4 次未 memo;`DegreeListPage.tsx:133,136` `{count} Courses` + `{count} Chapters` 英文硬编码,但 line 140 "小时" 又中文 — 同一行中英混杂;line 94,97 `'Free'` / `'¥${...}'` 也硬编码。
- 角色 Frank 想日期按 locale 统一,实际是 `grep toLocaleString` 35 处,**8 处 `.toLocaleString()` 不传 locale**(`AdminDashboardPage.tsx:284,290,449,523,530,541,575`),依赖浏览器默认;`AdminHackathonsPage.tsx:325,327` / `AdminReviewsPage.tsx:177` 等传 `'zh-CN'` 硬编码,英文用户拿到中文日期 — 无 `useI18n().locale`。
- 角色 Frank 想表格 column 走 i18n,实际是 `AdminCoursesPage.tsx:471-477` `'#'/'Title'/'Instructor'/'Cost'/'Price'/'Source'/'Action'` 英文硬编码,line 364/365/379/406/412/419/428/436/444 `<Field label="课程标题/讲师/时长/价格/...">` 12+ 处中文硬编码。
