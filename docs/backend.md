# 本机后端与登录接入

本机使用 TypeScript + NestJS + PostgreSQL。Vue 页面通过 `/api` 访问后端，未设置 `VITE_API_BASE_URL` 时继续使用原有静态演示。GitHub Pages 上的版本仍是独立演示，不连接你的本机数据库。

## 首次启动

需要 Node.js 22.12 或更高版本，以及已启动的 Docker Desktop。以下命令均在项目根目录的 PowerShell 中运行：

```powershell
npm ci
npm run api:install
# 仅第一次复制，已有配置时不要覆盖
Copy-Item .env.example .env.local
Copy-Item server/.env.example server/.env
npm run db:up
npm run api:build
npm run db:migrate
npm run db:seed
npm run dev:full
```

打开 <http://localhost:5173/Participant_Recruitment_Platform/>。使用 **localhost**，不要换成 `127.0.0.1`，两者对浏览器 Cookie 和 Origin 校验是不同的地址。前端监听 localhost:5173；API 监听 127.0.0.1:3001；数据库监听 127.0.0.1:55432。

这台电脑已复制本机配置、安装依赖并初始化数据库。以后启动 Docker Desktop，再运行 `npm run db:up` 和 `npm run dev:full` 即可。修改后端后重启 `dev:full`；修改 Vue 页面由 Vite 自动刷新。

登录页的“本机开发账户”提供学生与研究者测试身份。它们是虚构数据，邮箱使用 `example.invalid`。该入口只有 `ALLOW_DEV_AUTH=true` 且运行在开发/测试环境、监听与公开 URL 均为本机地址时可用；生产模式拒绝开启。

`Ctrl+C` 停止前后端。`docker compose stop db` 停止数据库但保留数据。数据位于 Docker 的命名卷，不在 Git 仓库中；不要用 `docker compose down -v` 作为日常停止命令。

## 体验完整流程

1. 以本机学生登录，报名“本地后端演示实验”。刷新后报名仍保留。
2. 退出，再以本机研究者登录，打开“实验管理”→“参与者”→“确认完成并发放积分”。
3. “被试池管理”可以对报名过本人实验的参与者评分；操作必须提供理由，并写入审计记录。
4. 退出并用学生身份登录，查看“我的参与记录”和“积分钱包”。完成演示实验入账 2,000 积分。
5. 提交至少 1,000、且为 100 整数倍的兑换申请。可用余额减少，申请状态为“待处理”，流水记录对应预留。

已完成联调的本机数据库可能已有上述记录，可发布新的实验重复体验；种子命令不会重置现有余额或报名。

兑换申请**没有调用 PayPay，也没有实际转账**。当前不包含出款、审核通过、拒绝退款的后台工作流；这些需要以后接入支付渠道与人工审核。个人中心和独立“评分与审核”页仍是占位页，已有评分功能位于被试池页面。当前列表有上限（实验 200、参与者/个人记录 500、钱包记录 200），正式扩大使用前需补分页。

## Google 登录配置

这是服务器接收授权码并交换令牌的 **Web 应用**，不是只依赖前端的 SPA 登录。

1. 在 Google Cloud / Google Auth Platform 中创建项目，填写应用品牌与同意屏幕；测试阶段按控制台要求添加测试用户。
2. 创建类型为 **Web application** 的 OAuth 客户端。
3. 添加授权重定向 URI：`http://localhost:5173/api/auth/callback/google`。
4. 将 Client ID 和 Client Secret 填入 **server/.env** 的 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`，重启后端。

配置后登录按钮自动启用。仅请求 `openid profile email`，验证签名、发行者、受众、过期时间、state、nonce、PKCE 和 Google 的已验证邮箱声明。注册要求和重定向 URI 精确匹配规则见 [Google 官方 OIDC 文档](https://developers.google.com/identity/openid-connect/openid-connect)。

## Microsoft 登录配置

第一版支持**一个明确指定的 Entra 机构租户**，不接受 `common`、`organizations` 或任意个人 Outlook 账户。

1. 在 Microsoft Entra 的“应用注册”创建应用，选择本组织目录中的账户。
2. 身份验证平台选择 **Web**，回调 URI 填 `http://localhost:5173/api/auth/callback/microsoft`。
3. 配置客户端机密，把 Application (client) ID、Directory (tenant) ID、机密的 **Value** 分别写入 `server/.env` 的 `MICROSOFT_CLIENT_ID`、`MICROSOFT_TENANT_ID`、`MICROSOFT_CLIENT_SECRET`。
4. 若机构禁止用户自行注册应用或同意授权，需要由学校/组织管理员创建或批准；重启后端后按钮自动启用。

“理科大学专用入口”额外要求 `SCHOOL_TENANT_ID` 等于上面的真实学校租户 ID，并设置允许的 `SCHOOL_EMAIL_DOMAINS`（默认两个示例学校域）。服务端同时校验租户和邮箱域。没有学校租户配置时，这个入口保持禁用，不能仅靠邮箱后缀认定学校身份。

应用注册和 OIDC 说明见 [Microsoft 应用注册文档](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)与 [Microsoft OIDC 文档](https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc)。后续如需跨机构 Microsoft 登录，需要另外设计租户准入和身份校验，不能只把租户 ID 换成 `common`。

## 研究者权限

所有通过 Google / Microsoft 首次登录的用户默认是学生。权限不从邮箱、前端角色按钮或研究者入口 URL 推断。同邮箱的 Google 和 Microsoft 身份也不会自动合并。

用户登录后，可在同一浏览器访问 `http://localhost:5173/api/auth/me` 查看自己的用户 ID。本机维护者确认身份后，在项目根目录执行：

```powershell
npm run user:role --prefix server -- 用户UUID researcher
```

该操作记录审计事件并撤销该用户的旧会话，用户需要重新登录。改回学生则把 `researcher` 换成 `student`。这条命令需要数据库访问权限，不通过公开 HTTP 接口提供。API 总是按数据库角色和实验归属授权。

## 数据、隐私与配置

- `server/.env` 存数据库连接及 OAuth 密钥；`.env.local` 只存前端 API 地址。两者都被 `.gitignore` 排除。
- **不要把 Client Secret 写入 `VITE_*` 变量**，Vite 变量会打包给浏览器。可提交的 `.env.example` 只有空 OAuth 字段和明确的本机数据库示例口令。
- Cookie 是随机不透明会话标识，设置 HttpOnly / SameSite=Lax；数据库仅保存它的 SHA-256 哈希，8 小时有效，退出即时撤销。OAuth 令牌不存进 localStorage，OAuth 事务单次使用、10 分钟过期。
- 真实登录会把提供方身份 ID、显示名与邮箱存入本机数据库，用于账号识别；只在本人信息中返回邮箱，研究者参与者列表不包含邮箱。学生接口不返回隐藏信誉分或实验信誉门槛。
- 报名对实验行加锁，容量与重复报名在数据库事务中校验；完成操作只记一次报酬；评分和兑换使用 `Idempotency-Key`（UUID v4）；兑换锁定余额，避免并发透支。
- 所有写接口校验 Origin。前端和 `/api` 必须使用同一公开域名；未来可以由反向代理把 `/api` 转给 NestJS。
- 目前限流为单进程内存计数。公开部署前应替换本机数据库口令、配置 HTTPS、关闭开发登录、准备数据库备份与多实例限流，并完成真实 OAuth 联调。
- 默认不打印请求体、Cookie、授权码或提供方错误，避免个人信息进入日志。`.gitignore` 不会清除已经提交过的历史；提交作者邮箱仍需使用 GitHub noreply 地址。

## 接口速查

全部以 `/api` 为前缀，除健康检查和登录启动/回调外，业务接口需会话 Cookie。

| 方法与路径 | 用途 |
| --- | --- |
| `GET /health` | 检查服务与数据库连接 |
| `GET /auth/providers` | 可用登录入口，不返回密钥 |
| `GET /auth/login/google`、`GET /auth/login/microsoft` | 发起 OIDC；`audience=school` 仅学校 Microsoft |
| `GET /auth/callback/:provider` | 服务端授权码回调 |
| `GET /auth/me`、`POST /auth/logout` | 本人会话、退出 |
| `POST /auth/dev` | 仅本机开发账户登录 |
| `GET /experiments` | 学生可报名列表／研究者本人实验 |
| `POST /experiments`、`POST /experiments/:id/close` | 发布／结束招募，研究者本人 |
| `POST /experiments/:id/sessions` | 本人实验追加场次，`{ sessions: [...] }` |
| `POST /experiments/:id/enroll` | 学生报名；有场次的实验必须传 `{ session_id: "场次UUID" }` |
| `GET /experiments/:id/enrollments` | 本人实验的参与者 |
| `POST /enrollments/:id/complete` | 确认完成并发放一次报酬 |
| `GET /me/profile` | 学生本人参与记录 |
| `GET /subjects`、`POST /subjects/:id/reputation` | 本人被试池／评分（评分需要幂等键） |
| `GET /wallet`、`POST /wallet/redemptions` | 本人余额与流水／兑换申请（需要幂等键） |

## 验证与静态演示

### Docker Desktop 启动时报套接字无法访问

如果错误指向 `%LOCALAPPDATA%\Docker\run\sailor-ingest.sock` 或 `%LOCALAPPDATA%\docker-secrets-engine\engine.sock`，这是 Docker Desktop 自身启动阶段的通信文件故障，尚未运行项目容器。Docker 官方仓库有[相同的 Windows 遗留套接字问题报告](https://github.com/docker/for-win/issues/15064)。

恢复时先完全退出 Docker，检查上述两个目录仅包含临时套接字，再将故障目录改名备份，启动 Docker 让它自动重建。应同时检查两个位置，避免修复一个后卡在另一个。保留数据卷、WSL 磁盘及凭据配置，不使用恢复出厂设置或 `docker compose down -v`。最后用 `docker info` 和 `npm run db:up` 验证引擎与数据库健康状态。日常退出优先使用 Docker 自带的退出操作，避免强制结束进程留下失效文件。

### 多场次与旧数据升级

先启动数据库，运行 `npm run api:build` 和 `npm run db:migrate`，再启动应用。迁移 `002_experiment_sessions.sql` 增加场次表及报名的可空场次关联，不删除旧实验或旧报名。

发布接口的 `sessions` 为 `{ starts_at, ends_at, capacity }` 数组，时间必须是带时区的 ISO 8601 字符串。最多 50 场，新增场次必须在未来、不能重叠或重复，场次长度不能短于实验时长，每场名额不能超过实验总人数。前端按 JST 输入及展示、按 UTC 发送；支持多选日期，也支持同一天分批增加不同开始时间。

已有场次仅支持追加，暂不修改或删除。无场次的旧实验仍兼容报名；旧报名保留空场次。报名会同时校验每场容量及实验总容量，使用同一实验行锁串行处理并发请求；同一学生同一实验只能有一条报名。重复提交同一场返回原报名，尝试另选一场返回冲突。参与记录及研究者报名名单均包含所选场次，关闭实验后仍在研究者管理列表中保留。

```powershell
npm run test:ui
npm run api:test
npm run build
npm run build:demo
```

`test:ui` 覆盖旧演示数据兼容、刷新恢复、JST 跨日转换及场次校验。`api:test` 启动真实 NestJS HTTP 服务，在 PostgreSQL 中创建随机独立测试 schema；结束时仅删除该 schema，不清空开发数据。涵盖匿名请求、Cookie、CSRF、数据校验、越权、并发名额、每人一场、追加场次、旧报名兼容、重复发放、评分审计、余额预留和退出失效。OIDC 使用进程内虚构提供方与 RSA 签名令牌验证授权码流程、PKCE、nonce、签名、受众、过期时间、学校限制和回调重放，不发送真实提供方请求。

`npm run build` 按当前环境构建，`npm run build:demo` 强制关闭 API 模式，不修改 `.env.local`。GitHub Pages 工作流执行静态回归测试后构建演示版，后端只在本机运行。静态发布、场次和报名会保存在当前浏览器，刷新后仍可查看，不向其他访客同步。

OAuth 的成功回调必须在你创建真实应用、填好本机密钥之后再联调。当前测试不冒充 Google 或 Microsoft 登录成功。
