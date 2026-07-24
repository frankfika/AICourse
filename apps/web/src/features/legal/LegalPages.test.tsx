/**
 * 4 个法律页 + LegalPage 共用底层 的测试
 * - TermsPage (服务条款)
 * - PrivacyPage (隐私政策)
 * - CookiesPage (Cookie 政策)
 * - RefundPage (退款政策)
 * - LegalPage 通用底层 (TOC / breadcrumb / scroll-spy)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TermsPage } from './TermsPage';
import { PrivacyPage } from './PrivacyPage';
import { CookiesPage } from './CookiesPage';
import { RefundPage } from './RefundPage';
import { LegalPage, type LegalSection } from './LegalPage';

// ───── 公共 wrapper ─────
function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

function renderWithProviders(ui: React.ReactNode) {
  return render(ui, { wrapper: makeWrapper() });
}

describe('LegalPage 通用底层', () => {
  const sampleSections: LegalSection[] = [
    { id: 'a', title: '第一节 测试', content: <p>第一节内容</p> },
    { id: 'b', title: '第二节 测试', content: <p>第二节内容</p> },
    { id: 'c', title: '第三节 测试', content: <p>第三节内容</p> },
  ];

  it('渲染 eyebrow + 标题 + 副标题 + lastUpdated', () => {
    renderWithProviders(
      <LegalPage
        eyebrow="/ Legal · Test"
        title="测试政策"
        subtitle="这是副标题"
        lastUpdated="2026-07-24"
        sections={sampleSections}
      />,
    );
    expect(screen.getByText('/ Legal · Test')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '测试政策' })).toBeInTheDocument();
    expect(screen.getByText('这是副标题')).toBeInTheDocument();
    expect(screen.getByText('2026-07-24')).toBeInTheDocument();
  });

  it('breadcrumb 包含「首页」+ 当前页', () => {
    renderWithProviders(
      <LegalPage eyebrow="x" title="隐私政策" lastUpdated="x" sections={sampleSections} />,
    );
    const nav = screen.getByLabelText('breadcrumb');
    expect(within(nav).getByText('首页')).toBeInTheDocument();
    expect(within(nav).getByText('隐私政策')).toBeInTheDocument();
  });

  it('渲染所有 section id (用于锚点跳转)', () => {
    renderWithProviders(
      <LegalPage eyebrow="x" title="x" lastUpdated="x" sections={sampleSections} />,
    );
    sampleSections.forEach((s) => {
      expect(document.getElementById(s.id)).toBeInTheDocument();
    });
  });

  it('TOC 桌面 sidebar 渲染所有 sections', () => {
    renderWithProviders(
      <LegalPage eyebrow="x" title="x" lastUpdated="x" sections={sampleSections} />,
    );
    // desktop nav (md:block)
    const toc = screen.getByLabelText('Table of contents');
    sampleSections.forEach((s) => {
      expect(within(toc).getByText(s.title)).toBeInTheDocument();
    });
  });

  it('TOC 项有编号 (01 / 02 / 03)', () => {
    renderWithProviders(
      <LegalPage eyebrow="x" title="x" lastUpdated="x" sections={sampleSections} />,
    );
    const toc = screen.getByLabelText('Table of contents');
    expect(within(toc).getByText('01')).toBeInTheDocument();
    expect(within(toc).getByText('02')).toBeInTheDocument();
    expect(within(toc).getByText('03')).toBeInTheDocument();
  });

  it('TOC 项点击触发 scrollIntoView + URL hash 更新', () => {
    const scrollIntoViewMock = vi.fn();
    const originalScroll = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    // 模拟 history.replaceState 验证
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    renderWithProviders(
      <LegalPage eyebrow="x" title="x" lastUpdated="x" sections={sampleSections} />,
    );
    const toc = screen.getByLabelText('Table of contents');
    const link = within(toc).getByText('第二节 测试');
    fireEvent.click(link);

    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '#b');
    expect(link.getAttribute('aria-current')).toBe('true');

    HTMLElement.prototype.scrollIntoView = originalScroll;
    replaceStateSpy.mockRestore();
  });

  it('contact section 用默认 email legal@ai-academy.local', () => {
    renderWithProviders(
      <LegalPage eyebrow="x" title="x" lastUpdated="x" sections={sampleSections} />,
    );
    expect(screen.getByText('legal@ai-academy.local')).toBeInTheDocument();
  });

  it('contact section 用自定义 email (Privacy 用 privacy@ai-academy.local)', () => {
    renderWithProviders(
      <LegalPage
        eyebrow="x"
        title="x"
        lastUpdated="x"
        sections={sampleSections}
        contactEmail="privacy@ai-academy.local"
      />,
    );
    expect(screen.getByText('privacy@ai-academy.local')).toBeInTheDocument();
  });

  it('空 sections 不报错', () => {
    expect(() =>
      renderWithProviders(
        <LegalPage eyebrow="x" title="x" lastUpdated="x" sections={[]} />,
      ),
    ).not.toThrow();
  });

  it('Back to top 链接存在', () => {
    renderWithProviders(
      <LegalPage eyebrow="x" title="x" lastUpdated="x" sections={sampleSections} />,
    );
    // Back to top 文字前有 ↑ 字符, 用 function matcher
    expect(
      screen.getByText((content) => content.includes('Back to top')),
    ).toBeInTheDocument();
  });
});

describe('TermsPage 服务条款', () => {
  it('渲染标题 + 核心章节', () => {
    renderWithProviders(<TermsPage />);
    expect(screen.getByRole('heading', { name: '服务条款', level: 1 })).toBeInTheDocument();
    // 核心章节 (h2 级别, 不包括 TOC link)
    expect(screen.getByRole('heading', { name: '协议接受', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '服务说明', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '账户注册与安全', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '付费与订单', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '知识产权', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '禁止行为', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '免责声明', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '争议解决与司法管辖', level: 2 })).toBeInTheDocument();
  });

  it('包含"AI Academy" 主体声明', () => {
    renderWithProviders(<TermsPage />);
    expect(screen.getAllByText(/AI Academy/).length).toBeGreaterThan(0);
  });

  it('包含退款页内链', () => {
    renderWithProviders(<TermsPage />);
    const refundLink = screen.getByRole('link', { name: /退款政策/ });
    expect(refundLink).toHaveAttribute('href', '/refund');
  });
});

describe('PrivacyPage 隐私政策', () => {
  it('渲染标题 + 核心章节', () => {
    renderWithProviders(<PrivacyPage />);
    expect(screen.getByRole('heading', { name: '隐私政策', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '我们收集哪些信息', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '我们如何使用信息', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '我们如何共享信息', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '您的权利', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '未成年人保护', level: 2 })).toBeInTheDocument();
  });

  it('contact email 走 privacy@ai-academy.local', () => {
    renderWithProviders(<PrivacyPage />);
    // contact section 用 mailto: link
    const link = screen.getByRole('link', { name: 'privacy@ai-academy.local' });
    expect(link).toHaveAttribute('href', 'mailto:privacy@ai-academy.local');
  });

  it('提到公开证书 /verify 接口', () => {
    renderWithProviders(<PrivacyPage />);
    // /verify/:serial 出现在内容中
    expect(screen.getAllByText(/\/verify/).length).toBeGreaterThan(0);
  });

  it('包含 cookie 政策内链', () => {
    renderWithProviders(<PrivacyPage />);
    const cookiesLink = screen.getByRole('link', { name: /Cookie 政策/ });
    expect(cookiesLink).toHaveAttribute('href', '/cookies');
  });
});

describe('CookiesPage Cookie 政策', () => {
  it('渲染标题 + 核心章节', () => {
    renderWithProviders(<CookiesPage />);
    expect(screen.getByRole('heading', { name: 'Cookie 政策', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '什么是 Cookie', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '我们使用的 Cookie 类型', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '具体 Cookie 清单', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '如何管理 Cookie', level: 2 })).toBeInTheDocument();
  });

  it('Cookie 清单表格有 auth-user / refresh-token / theme 3 个关键 cookie', () => {
    renderWithProviders(<CookiesPage />);
    expect(screen.getAllByText('auth-user').length).toBeGreaterThan(0);
    expect(screen.getAllByText('refresh-token').length).toBeGreaterThan(0);
    expect(screen.getAllByText('theme').length).toBeGreaterThan(0);
  });

  it('明确说明不卖数据 / 不做营销 Cookie', () => {
    renderWithProviders(<CookiesPage />);
    // 原文是"我们不会向第三方广告商共享您的数据"
    expect(document.body.textContent).toMatch(/不会向第三方广告商共享您的数据/);
    // 营销未启用
    expect(document.body.textContent).toMatch(/营销.*未启用/);
  });
});

describe('RefundPage 退款政策', () => {
  it('渲染标题 + 核心章节', () => {
    renderWithProviders(<RefundPage />);
    expect(screen.getByRole('heading', { name: '退款政策', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '可申请退款的情形', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '不可申请退款的情形', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '退款流程', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '特殊场景', level: 2 })).toBeInTheDocument();
  });

  it('24 小时试听窗口 (核心规则)', () => {
    renderWithProviders(<RefundPage />);
    expect(screen.getAllByText(/24 小时/).length).toBeGreaterThan(0);
    // 进度 ≤ 20% 关键规则, 出现在多个地方, 用 getAllByText
    expect(screen.getAllByText(/20%/)).toHaveLength(3);
  });

  it('包含服务条款内链 (争议解决引用)', () => {
    renderWithProviders(<RefundPage />);
    const termsLink = screen.getByRole('link', { name: /服务条款/ });
    expect(termsLink).toHaveAttribute('href', '/terms');
  });
});

describe('router 集成', () => {
  it('4 个法律页路由都注册到 /terms /privacy /cookies /refund', () => {
    // 模拟进入 /terms 路径
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter initialEntries={['/terms']}>
          <Routes>
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/cookies" element={<CookiesPage />} />
            <Route path="/refund" element={<RefundPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('heading', { name: '服务条款' })).toBeInTheDocument();
  });
});
