/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  // 已有
  readonly VITE_API_BASE_URL?: string;

  // 站点级 env(2026-07-21 mock-audit 引入, 用于替换硬编码文案)
  /** 全站平台名(footer 用), 默认 'AI Academy' */
  readonly VITE_PUBLIC_PLATFORM_NAME?: string;
  /** ICP 备案号（footer 用），未设置时不显示备案信息 */
  readonly VITE_ICP?: string;
  /** 企业培训联系邮箱；不设则只展示站内咨询表单 */
  readonly VITE_PUBLIC_ENTERPRISE_EMAIL?: string;
  /** 企业培训联系电话, 不设则不展示电话行 */
  readonly VITE_PUBLIC_ENTERPRISE_PHONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
