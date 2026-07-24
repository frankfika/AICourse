/**
 * CookiesPage — Cookie 政策 (Cookie Notice)
 *
 * 重点:
 *   - 列出本平台使用的所有 Cookie (严格必要 / 功能 / 分析 / 营销)
 *   - 跟 backend Set-Cookie 行为一致 (refresh_token / auth_user / theme)
 *   - 满足 EU GDPR ePrivacy Directive + 中国《个人信息保护法》要求
 *   - 提供「管理 Cookie 偏好」入口 (跟 Layout 的 themeStore 类似, 走 zustand)
 */
import { LegalPage, type LegalSection } from './LegalPage';

const SECTIONS: LegalSection[] = [
  {
    id: 'what',
    title: '什么是 Cookie',
    content: (
      <>
        <p>
          Cookie 是浏览器在您访问网站时存储在您设备上的小型文本文件。Cookie 让我们能在您下次访问时识别您的浏览器,维持登录状态、记住偏好、提供个性化体验。
        </p>
        <p>
          除 Cookie 外,我们还使用 LocalStorage (持久化本地存储) 和 SessionStorage (会话级存储) 等同类技术,本政策统称"Cookie"。
        </p>
      </>
    ),
  },
  {
    id: 'types',
    title: '我们使用的 Cookie 类型',
    content: (
      <>
        <h3>1. 严格必要 (Strictly Necessary)</h3>
        <p>这些 Cookie 是网站运行所必需的,不能关闭。它们通常用于:</p>
        <ul>
          <li>身份验证:保持您的登录状态 (auth-user, refresh-token httpOnly)</li>
          <li>安全防护:防止跨站请求伪造 (CSRF token)</li>
          <li>会话管理:临时存储表单数据</li>
        </ul>
        <h3>2. 偏好 (Preferences)</h3>
        <p>用于记住您的偏好设置,例如:</p>
        <ul>
          <li>主题模式 (深色 / 浅色, key: <code>theme</code>)</li>
          <li>语言 (中文 / 英文, 跟随浏览器)</li>
        </ul>
        <h3>3. 分析 (Analytics)</h3>
        <p>
          帮助我们了解访问者如何使用本平台,以便改进。这些数据是聚合的、不识别个人身份:
        </p>
        <ul>
          <li>页面浏览量、跳出率、停留时长</li>
          <li>错误日志、性能指标</li>
        </ul>
        <h3>4. 营销 (Marketing)</h3>
        <p>
          目前<strong>未启用</strong>营销 Cookie。我们不会向第三方广告商共享您的数据。
        </p>
      </>
    ),
  },
  {
    id: 'list',
    title: '具体 Cookie 清单',
    content: (
      <>
        <div className="border border-[#171717]/15 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#EEEDE9]">
              <tr>
                <th className="text-left p-3 font-black">名称</th>
                <th className="text-left p-3 font-black">类型</th>
                <th className="text-left p-3 font-black">用途</th>
                <th className="text-left p-3 font-black">存储</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#171717]/10">
              <tr>
                <td className="p-3 font-mono">auth-user</td>
                <td className="p-3">必要</td>
                <td className="p-3">存储用户基本信息 (id / 角色 / 头像)</td>
                <td className="p-3 font-mono">LocalStorage</td>
              </tr>
              <tr>
                <td className="p-3 font-mono">refresh-token</td>
                <td className="p-3">必要</td>
                <td className="p-3">用于无感刷新 access token (httpOnly, JS 不可读)</td>
                <td className="p-3 font-mono">HttpOnly Cookie</td>
              </tr>
              <tr>
                <td className="p-3 font-mono">theme</td>
                <td className="p-3">偏好</td>
                <td className="p-3">深色 / 浅色主题模式</td>
                <td className="p-3 font-mono">LocalStorage</td>
              </tr>
              <tr>
                <td className="p-3 font-mono">access-token</td>
                <td className="p-3">必要</td>
                <td className="p-3">当前会话 access token (短时, 关闭 tab 即清)</td>
                <td className="p-3 font-mono">SessionStorage</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[#666666] mt-2">
          注:此清单会随技术更新调整,变更会在本页面公告。
        </p>
      </>
    ),
  },
  {
    id: 'third-party',
    title: '第三方 Cookie',
    content: (
      <>
        <p>本平台自身不使用第三方 Cookie。以下场景可能涉及:</p>
        <ul>
          <li>Google OAuth / GitHub OAuth 登录:跳转至第三方页面完成授权,不在本平台域名下设置 Cookie</li>
          <li>AI 助教调用:对话内容通过后端代理转发,不在前端直接调用第三方 API, 不设置第三方 Cookie</li>
        </ul>
      </>
    ),
  },
  {
    id: 'manage',
    title: '如何管理 Cookie',
    content: (
      <>
        <h3>浏览器设置</h3>
        <p>
          您可以通过浏览器设置拒绝或删除 Cookie。不同浏览器的操作方法不同,通常在"设置 → 隐私与安全"中。
        </p>
        <p>
          <strong>注意</strong>:禁用严格必要 Cookie 会导致您无法登录或使用部分功能。
        </p>
        <h3>本平台偏好</h3>
        <p>
          您可以在「设置 → 主题」中切换主题模式,选择不启用深色模式。
        </p>
        <h3>退出分析 Cookie</h3>
        <p>
          如您希望完全退出访问分析,请通过浏览器的"Do Not Track" (DNT) 信号告知我们。我们尊重 DNT 信号,不会收集您的访问数据。
        </p>
      </>
    ),
  },
  {
    id: 'changes',
    title: '政策更新',
    content: (
      <>
        <p>
          本政策随技术变化和法规更新会修订,变更会通过站内通知告知。
        </p>
      </>
    ),
  },
];

export function CookiesPage() {
  return (
    <LegalPage
      eyebrow="/ Legal · Cookies"
      title="Cookie 政策"
      subtitle="OpenCSG Academy 使用的 Cookie 和同类技术说明"
      lastUpdated="2026-07-24"
      sections={SECTIONS}
    />
  );
}
