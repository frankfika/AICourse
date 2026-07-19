# OpenCSG Academy 术语表 (Glossary)

> OpenCSG Academy 涉及的核心 AI / LLM / 教育领域术语速查。
> 用户在课程、文档、AI 助教回答中会高频遇到这些词,本表用「学习者能懂的语言」解释。
>
> 最后更新:2026-07-19

---

## 通用 AI / 大模型

### **LLM (Large Language Model)**
大语言模型。OpenCSG Academy 课程的核心,泛指参数规模亿级以上的语言模型(ChatGPT、Claude、Llama、Qwen、DeepSeek 等都是 LLM)。
**用法**:"这门课讲 LLM 推理优化"。

### **Prompt / 提示词**
发给 LLM 的输入文本。设计 prompt 的技术叫「**Prompt Engineering**」。
**例子**:"你是一位 Python 专家,帮我写一个爬虫"比"写爬虫"效果更好。

### **Token**
LLM 处理文本的最小单位。中文约 1.5 字 / token,英文约 0.75 词 / token。LLM 的「上下文窗口」(context window) 以 token 计数(如 GPT-4 是 128K tokens,Claude 是 200K)。
**用法**:"这段 prompt 太长,超 token 限制了"。

### **Context / 上下文**
LLM 当前对话中可见的所有信息,包括:
- system prompt(系统设定)
- 历史消息
- 当前问题
- 外部检索结果(RAG 时)
**例子**:Claude 200K context = 它能「记住」你最近 15 万字的对话。

### **Temperature**
LLM 生成的「随机性」参数。0 = 完全确定(总选概率最高),1 = 标准,2 = 高度随机(适合创意)。代码生成推荐 0,创意写作推荐 0.7-1。

### **Hallucination / 幻觉**
LLM 一本正经地胡说八道的现象。看起来可信但事实错误。
**应对**:重要信息要查源,AI 助教 disclaimer「回答可能不准确,请以视频内容为准」。

### **Fine-tuning / 微调**
在预训练好的 LLM 基础上,用特定数据继续训练,让它擅长某领域。成本高(算力 + 数据),但效果精准。

### **RLHF (Reinforcement Learning from Human Feedback)**
人类反馈强化学习。ChatGPT 类模型的「对齐」训练方法,让模型回答更符合人类偏好(有用、无害、诚实)。

### **Inference / 推理**
用训练好的模型生成输出的过程。区别于「训练」——训练耗算力大、推理相对轻。
**用法**:"vLLM 是推理加速框架"。

### **Quantization / 量化**
把模型参数从 32-bit 浮点降到 8-bit / 4-bit。代价:精度略降;收益:显存减少 4-8 倍,推理快 2-3 倍。
**例子**:Qwen-7B 原始 14GB 显存,INT4 量化后 4GB 就能跑。

### **Embedding / 嵌入**
把文本转成一串数字(向量),让计算机能「算相似度」。RAG 的基础。
**例子**:"我搜'苹果'能匹配到'iPhone' 是因为它们 embedding 接近"。

---

## RAG (Retrieval-Augmented Generation)

### **RAG / 检索增强生成**
LLM 回答问题时,先去外部知识库搜相关文档,把搜索结果塞进 prompt,再让 LLM 基于这些文档回答。
**为什么**:LLM 知识有截止日期,RAG 让它能回答「今天的新闻」或「公司内部文档」。

### **Vector DB / 向量数据库**
存 embedding 的数据库,支持「找出最相似的 N 个向量」。常见:Chroma、Milvus、Pinecone、Weaviate。
**用法**:RAG 系统的核心组件。

### **Chunking / 分块**
把长文档切成小段(几百字一段),每段单独做 embedding,方便检索。
**坑**:切太大 → 不精准;切太小 → 丢上下文。

### **Rerank / 重排**
向量检索返回 Top-K 后,用更精细的模型(交叉编码器)再排一遍,提升 Top 结果的质量。

### **RAGAS / RAG 评估**
评估 RAG 系统质量的指标框架:Faithfulness(忠实度)、Answer Relevancy(答案相关性)、Context Precision(上下文精确度)、Context Recall(上下文召回率)。

---

## Agent / AI 工具

### **Agent / 智能体**
LLM + 工具 + 规划的组合。能自己思考「下一步做什么」、调用工具(搜索、代码、API)、自我纠错。
**例子**:AutoGPT、Devin、CrewAI 都是 Agent 框架。

### **Function Calling / 函数调用**
LLM 输出结构化「我要调这个函数 + 参数」,系统执行后把结果喂回 LLM。是 Agent 调工具的标准方式。

### **MCP (Model Context Protocol)**
Anthropic 提出的「Agent 工具协议」,标准化 LLM 调外部工具的方式(类似 USB-C for AI)。

### **ReAct**
Agent 的经典范式:Reason(推理) + Act(行动) 交替。LLM 先想「我要做什么」,再执行,然后观察结果再想下一步。

### **Tool Use / 工具使用**
Agent 调用外部能力(搜索 / 代码 / 数据库) 的统称。

### **Multi-Agent / 多智能体**
多个 Agent 协作,各自负责不同子任务,通过消息传递完成复杂任务。框架:CrewAI、AutoGen、LangGraph。

---

## MLOps / 工程化

### **MLOps**
机器学习运维。把 ML 模型从「notebook 能跑」推到「生产环境稳定运行」,涉及训练流水线、部署、监控、迭代。

### **Inference Endpoint / 推理端点**
部署 LLM 后对外提供服务的 URL(类似 REST API)。

### **vLLM**
主流的开源 LLM 推理加速框架,吞吐量比原生 HuggingFace 高 10-24 倍。

### **Ollama**
本地跑 LLM 的工具,一键安装 + 命令行,适合开发测试。

### **Hugging Face**
开源 ML 模型 / 数据集 / 工具的 GitHub,主流 LLM 基本都托管在这里。

### **LangChain / LlamaIndex**
LLM 应用开发框架。LangChain 偏「链式组合」,LlamaIndex 偏「RAG 数据接入」。

### **Promptfoo**
Prompt 评估框架,批量跑 prompt 看哪个效果最好。

---

## 教育 / 课程术语

### **Nano Degree / 纳米学位**
多门课的体系化打包(OpenCSG Academy 术语)。完成全部课程 + 项目 → 颁发学位证书。源自 Udacity 的产品形态。

### **Capstone / 毕业项目**
学位路径的最后一关,通常需要提交一个完整作品(代码 / 报告 / 演示)。是「**做出来才算**」的核心理念。

### **Lesson / 课时**
课程内最小学习单元,通常 5-30 分钟视频 + 配套资料。

### **Chapter / 章节**
课程内逻辑分组的容器,包含 3-10 个 lesson。

### **Syllabus / 教学大纲**
课程整体规划(目标 / 章节列表 / 时长 / 先修要求),通常在课程详情页顶部可见。

### **Prerequisite / 先修**
学这门课前需要掌握的知识 / 学过的其他课。报名前要看。

### **Cohort / 同期班**
同期学习同一门课的一批人(常见于有开课时间的 MOOC,OpenCSG Academy 是 self-paced 所以不强调 cohort,但某些学位会开 cohort)。

---

## 平台功能术语

### **Enrollment / 报名**
学员注册某门课,系统记录「这个用户学这门课」的关系。状态:`active` / `completed` / `cancelled`。

### **Progress / 进度**
学员在某课的学习进度,0-100%。计算:完成的 lesson 时长 / 课程总时长。

### **Badge / 徽章**
学员解锁的可视化成就标识,展示在 profile 或 dashboard 顶部。

### **Points / 积分**
学员的学习行为积分(完成课、获得徽章、赢得黑客松)。目前只读,Phase 2+ 会有商城。

### **Certificate / 证书**
完成课程 / 学位 / 黑客松后颁发的电子凭证,可在 `/verify/:serial` 公开验证。

### **Hackathon / 黑客松**
限时编程 / 创意比赛。OpenCSG Academy 聚焦 AI / LLM 应用。

### **Verification / 验证**
公开 URL `/verify/:serial` 给第三方核实证书真伪的机制。

---

## 安全 / 合规

### **SSRF (Server-Side Request Forgery)**
攻击者让服务器请求恶意内部 URL(比如 169.254.169.254 AWS metadata 服务)。OpenCSG Academy 的 URL 导入做了 SSRF 防护,只允许白名单 host。

### **CSRF (Cross-Site Request Forgery)**
跨站请求伪造。OpenCSG Academy 用 httpOnly Cookie + SameSite 防护。

### **XSS (Cross-Site Scripting)**
跨站脚本。OpenCSG Academy 用 React 默认转义 + CSP 头防 XSS。Access token 不存 localStorage(防 XSS 盗取)。

### **Rate Limiting / 限流**
限制单位时间请求数,防滥用和暴力破解。OpenCSG Academy 全局 60 req/min/IP,登录 5 req/min。

### **JWT (JSON Web Token)**
自包含的认证令牌。OpenCSG Academy 用 access token (15 min, 内存) + refresh token (7 day, httpOnly cookie) 双 token 机制。

### **httpOnly Cookie**
JS 读不到的 cookie。XSS 攻击拿不到它,适合放 refresh token。

---

## 商业 / 支付

### **SKU (Stock Keeping Unit)**
最小商品单元。OpenCSG Academy 的 SKU = 一门课 / 一个学位 / 一次黑客松报名。

### **Stripe**
国际信用卡支付通道。OpenCSG Academy 用它处理海外用户(Visa / Master / Amex)。

### **退款窗口 / Refund Window**
用户可申请退款的时间段。OpenCSG Academy 政策见 `USER_MANUAL.md` §12.4。

### **公益课 / Charity Course**
OpenCSG Academy 的特色定价模型。**0 元购 + 全额捐赠**:用户免费学,平台把等额金额捐给公益项目(根据课程页说明)。

---

## 其他

### **OIDC (OpenID Connect)**
基于 OAuth 2.0 的身份认证协议。OpenCSG Academy Phase 2+ 会接入 Google / GitHub / 微信等 OIDC。

### **SAML**
企业 SSO 用的协议,比 OIDC 老。Phase 2+ 企业版会支持。

### **CSP (Content Security Policy)**
HTTP 响应头,告诉浏览器「这个页面只能加载这些资源」,防 XSS。

### **HSTS (HTTP Strict Transport Security)**
强制浏览器用 HTTPS 访问。

### **Monorepo**
一个 Git 仓库管多个子项目。OpenCSG Academy 是 monorepo(`apps/api` + `apps/web` + `packages/shared-types`)。

### **HMR (Hot Module Replacement)**
开发时改代码不刷页面就能看到效果。Vite 默认开启。

---

## 速查表

| 缩写 | 全称 | 中文 |
|------|------|------|
| LLM | Large Language Model | 大语言模型 |
| RAG | Retrieval-Augmented Generation | 检索增强生成 |
| RLHF | RL from Human Feedback | 人类反馈强化学习 |
| MCP | Model Context Protocol | 模型上下文协议 |
| MLOps | ML Operations | 机器学习运维 |
| SSRF | Server-Side Request Forgery | 服务端请求伪造 |
| CSRF | Cross-Site Request Forgery | 跨站请求伪造 |
| XSS | Cross-Site Scripting | 跨站脚本 |
| OIDC | OpenID Connect | - |
| JWT | JSON Web Token | - |
| CSP | Content Security Policy | 内容安全策略 |
| HSTS | HTTP Strict Transport Security | 严格传输安全 |
| SKU | Stock Keeping Unit | 最小商品单元 |
| CSP | (上面) | - |
| HMR | Hot Module Replacement | 热模块替换 |

---

**文档版本**:v1.0 · 2026-07-19
