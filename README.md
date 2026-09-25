# 行知被试库 · ActMind Pool

> 面向**行为经济学 / 心理学实验**的被试（参与者）管理、信誉分评估与定向分发平台。
> Vue 3 + Element Plus 前端，支持**静态演示**与 **TypeScript / NestJS / PostgreSQL 本机后端**两种模式。

## 本机后端（新增）

本机后端已支持登录会话、角色权限、实验发布与报名、完成后积分入账、研究者评分及兑换申请。Google / Microsoft OIDC 接入代码已准备，需创建登录应用后配置密钥。

完整安装、启动、登录配置与接口说明见 [本机后端文档](docs/backend.md)。已初始化的本机运行 `npm run db:up`，再运行 `npm run dev:full`，打开 `http://localhost:5173/Participant_Recruitment_Platform/`。

设置 `.env.local` 中 `VITE_API_BASE_URL=/api` 启用后端；不设置时是静态演示。`npm run build:demo` 可在保留本机配置的同时构建静态版。兑换目前为人工处理申请，未接入 PayPay 转账。

## 在线演示

- [学生端入口](https://dkshawn.github.io/Participant_Recruitment_Platform/)
- [研究者端入口](https://dkshawn.github.io/Participant_Recruitment_Platform/#/admin-auth-secure)

选择「外部机构及通用入口」，点击 Microsoft 或 Google 按钮即可模拟登录，无需输入真实账号或密码。理科大学专用入口会随机演示认证通过或拒绝两种情况。切换学生端与研究者端前，请先退出当前账号。

演示数据仅在当前浏览器中运行，报名、发布实验和评分等修改不会同步给其他访客，刷新页面会重置这些修改。

网站由 `.github/workflows/deploy.yml` 自动构建并发布到 GitHub Pages；推送到 `main` 后自动更新，也可在 Actions 中手动运行。仓库的 Settings → Pages → Source 需设为 GitHub Actions。

## 隐私与演示数据

- 静态演示及本机种子账户均为虚构数据；真实 OAuth 密钥尚未配置，配置说明见后端文档。
- 请勿把真实被试资料、私人邮箱、访问令牌或私钥写入源码、演示数据或提交说明。
- `.gitignore` 已排除本地环境变量、常见凭据文件、日志、依赖、构建产物和本地工具状态；新增文件仍需在提交前检查。
- 提交作者和提交者邮箱属于 Git 历史，不受 `.gitignore` 保护。请使用 GitHub 账户设置中的 noreply 邮箱作为本地仓库的 `user.email`。

## ✨ 核心机制

- **角色分离**：学生端（被试）与研究者端（管理员）双工作台，互不干扰。
- **信誉分机制（核心）**：每个学生拥有**隐藏**信誉分（默认 100），研究者依据实验认真程度（随机乱点、注意力测试）加减分，并留操作日志。
- **定向分发**：实验设置最低信誉分门槛；API 模式由后端过滤并在报名时重新校验，静态演示由前端模拟。

## 🧰 技术栈

- Vue 3（Composition API / `<script setup>`）
- Vue Router 4（角色路由 + 守卫越权拦截）
- Pinia（全局状态：角色 / 身份 / 信誉分）
- Element Plus（UI 组件库，经 `ElConfigProvider` 随语言切换内置文案）
- **vue-i18n 9**（Composition 模式，三语言实时切换：zh-CN / en-US / ja-JP）
- Vite（构建）

## 🚀 静态演示本地运行

以下模式不设置 `VITE_API_BASE_URL`；真实后端请按上方文档启动。

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npm run dev
# 浏览器访问 http://localhost:5173/Participant_Recruitment_Platform/

# 3. 生产构建
npm run build && npm run preview
```

## 📁 目录结构（步骤 1）

```
src/
├── main.js                     # 入口：挂载 Pinia / Router / Element Plus
├── App.vue                     # 根组件
├── styles/index.css            # 全局样式 + 主题色定制
├── config/menu.js              # 侧边栏菜单配置（按角色区分，i18n key 驱动）
├── i18n/
│   ├── index.js                # createI18n 初始化 + setLocale()（持久化到 localStorage）
│   └── locales/{zh,en,ja}.js   # 三语言字典（zh 为源语言，key 一一对应）
├── stores/user.js              # 用户/角色状态（登录、切换、退出）
├── router/index.js             # 路由表 + 登录/越权守卫（document.title 随语言翻译）
├── layout/
│   ├── MainLayout.vue          # 主外壳：导航栏 + 侧边栏 + 内容区
│   └── components/
│       ├── Navbar.vue          # 顶部导航栏：Logo / 角色切换
│       └── Sidebar.vue         # 侧边栏：动态菜单
├── mocks/                      # 模拟数据（后续步骤填充）
└── views/
    ├── LoginView.vue           # SSO 双入口登录（TUS 专用 / 外部通用，OAuth 2.0 演示）
    ├── PlaceholderView.vue     # 通用占位页
    ├── student/                # 学生端页面（待开发）
    └── researcher/             # 研究者端页面（待开发）
```

## 🗺️ 路由规划

| 角色 | 路径 | 页面 |
| --- | --- | --- |
| — | `/login` | 登录 / 角色选择 |
| 学生端 | `/student/hall` | 实验大厅 |
| 学生端 | `/student/records` | 我的参与记录 |
| 学生端 | `/student/profile` | 个人中心 |
| 研究者端 | `/researcher/publish` | 发布新实验 |
| 研究者端 | `/researcher/manage` | 实验管理 |
| 研究者端 | `/researcher/pool` | 被试池管理 |
| 研究者端 | `/researcher/review` | 评分与审核 |

## 📌 开发进度

- [x] **步骤 1**：基础外壳、导航栏、侧边栏、路由与角色守卫、登录/角色切换
- [x] **步骤 2**：学生端实验大厅（信息卡 + 信誉分过滤的定向分发 + 报名）
- [x] **步骤 3**：研究者端发布实验（表单校验 + 数据质量要求控制：滑条/档位/达标人数实时预览）
- [x] **步骤 4**：被试池管理（统计卡、检索/筛选、数据表格）+ 信誉评分弹窗（加分/扣分 + 必填理由 + 前后分预览）
- [x] **步骤 5**：国际化（vue-i18n）——中 / 英 / 日三语言实时切换
- [x] 本机后端：实验管理、我的参与记录、会话权限、积分流水与评分审计
- [ ] 个人中心、独立审核页、支付渠道、真实 OAuth 应用配置与联调

## 🌐 国际化（步骤 5）

- 支持语言：**简体中文（zh-CN）/ English（en-US）/ 日本語（ja-JP）**，导航栏右上角「🧭 语言切换器」点击即切，**全页实时响应，无需刷新**。
- 语言偏好写入 `localStorage`（`actmind.locale`），刷新后保持；首次访问按浏览器语言自动匹配。
- 字典位于 `src/i18n/locales/`，zh 为源语言，en / ja 的 key 与之一一对应；Element Plus 组件内置文案（确定/取消等）由 `App.vue` 中的 `ElConfigProvider` 同步切换。
- 术语对齐（学术语境）：行知被试库 → ActMind Pool → ActMind被験者プール；实验大厅 → Experiment Hall → 実験ホール；被试池管理 → Subject Pool Management → 被験者プール管理；信誉分 → Reputation Score → 信用スコア；报酬 → Compensation → 謝礼；发布实验 → Publish Experiment → 実験の公開。
- 内容数据（实验名称/描述/标签、被试姓名/专业、评分理由日志）属于「实验内容」，保留原始语言，不做界面翻译。

> 静态演示说明：可在顶部导航栏右上角的「角色切换」下拉菜单中，在
> **学生端 / 研究者端** 之间切换；API 模式的角色由后端控制，本机测试请退出后使用开发账户登录。旁边的语言菜单支持中 / 英 / 日切换。
