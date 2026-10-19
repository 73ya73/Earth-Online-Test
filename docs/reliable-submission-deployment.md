> 发布进度更新：用户已确认 SQL 与 Edge Function 部署完成且出现 saved/inserted，现已授权发布前端。下方“未部署”描述记录的是此前本地验收时的状态；本次前端状态以 GitHub Actions 为准，勿因此重复执行 SQL。

# 可靠提交修复：本地准备与分阶段部署

本轮只做本地代码、SQL 材料和验证，未连接生产数据库、部署 Edge、提交或推送 GitHub。旧线上版本不因本地修改而生效。以下步骤须经用户确认后操作，保留原项目、函数名、网站地址和 Vite base。

## 当前行为与限制

- 完成全部 13 题时生成唯一 UUID，把完整五字段记录同步写入 `earth-recharge-outbox-v2:<uuid>`，再异步发送，不等待上传才显示结果。重测不会删除之前的队列。
- 状态为 pending、saved、failed。每次尝试前持久化次数和短期 in-flight 租约；浏览器关闭后，其他页面等待租约到期再恢复，避免重访立即并发发送。支持 Web Locks 的浏览器另加跨标签锁；不支持时以租约减少竞争，由数据库主键最终保证不重复写入。
- 总计最多三次请求，指数退避约 1 秒、2 秒，加随机抖动，429 尊重 Retry-After。前端超时 15 秒、RPC 超时 10 秒。offline 不消耗尝试次数；online、pageshow、可见性恢复和重新访问触发恢复，刷新不重置预算。400/401/403/409/422 等确定性错误不重试，408/429/500/502/503/504 及网络/超时有限重试。
- HTTP 200 或只有 ok 不等于保存。必须同时返回 ok=true、匹配 submission_id、status=inserted 或 already_saved，才能保存成功凭据并移除 payload。响应丢失后用原 ID 重试，数据库确认同内容已有记录后返回 already_saved。
- 失败条目不会自动丢弃或无限重试，留在本地供排查；不补传任意存档或推断旧答案。旧 sent 凭据仍去重；旧 attempted 只有保留完整 researchSubmission 时才恢复原 ID。
- 已保存的成功凭据保留在本地用于去重。待上传/失败条目与用户存档均为浏览器本地数据，用户清除网站数据会删除；服务器仍沿用 180 天 Cron。浏览器禁用、清除或回收 localStorage 时无法保证恢复，存储失败写警告，当前页仍尽力提交且不阻塞测试。不同设备、无痕窗口和不同 origin 不共享队列。
- 开发日志显示 submission_id、状态、次数、HTTP 状态、耗时、错误类别及保存确认。生产客户端仅警告失败/存储异常；Edge 记录结构化保存/失败日志。日志不输出完整答案、请求头、身份信息或服务端密钥。浏览器存储完整答题 payload 是恢复所必需，不能把该 payload 整体复制到公共日志。

## 部署顺序（本轮尚未执行）

1. **Supabase SQL Editor**：在现有项目 `qwkwtcbkxjlyelvbvwpv`，选择 postgres，复制 `supabase/sql/06-reliable-submission.sql` 完整运行。不要重跑 02，不修改 03 Cron。06 是事务迁移，不改表、列、题目、记录、RLS 或公开权限；新增仅 service_role 可执行的 v2 RPC，旧 RPC 作为兼容入口仍返回 accepted，因此此时旧 Edge 可以继续工作。已有数据和权限异常会使迁移回滚。
2. **验证 SQL**：完整运行只读 `07-verify-reliable-submission.sql`。应有两行函数，returns=text、security_definer=true、settings 包含空 search_path、owner=postgres（或原可信数据库管理者）；anon_execute/authenticated_execute=false，service_role_execute=true；RLS enabled=true、forced=false；三角色 any_table_access/any_column_access 均 false；v2_contract/compatibility_wrapper 均 true。再运行已有 04 核对其他约束及权限。失败则停止，不继续发布。
3. **更新现有 Edge Function**：Dashboard → Edge Functions → 已有 `submit-research` → Code/Editor，用 `supabase/dashboard/submit-research.ts` 的**完整内容**替换入口并部署。它已包含所有共享模块；不要只复制多文件入口。CLI 使用者可部署 `supabase/functions/submit-research/index.ts` 和 `_shared` 源码。Dashboard 和 CLI 是同一函数的两种部署方法，只选一种，无须部署两次。Verify JWT 继续关闭，托管 SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 保持不变，不复制任何密钥到聊天、前端或 GitHub。
4. **跨域与环境**：保留 `RESEARCH_ALLOWED_ORIGINS` 的正式来源 `https://73ya73.github.io`，本地联调时仅添加实际使用的完整 origin，例如 `http://127.0.0.1:5173`。不含路径，不用星号。现有公开 endpoint 不变。新函数调用 `store_research_submission_v2`；CORS 暴露 Retry-After 供浏览器读取。先确认 SQL 已完成，再部署函数，避免缺失 RPC。
5. **本地端到端联调**：用现有 `.env.local` 开启 Research 和原 endpoint；`npm run dev`，在允许的本地 origin 完成一份测试。Network 应收到匹配编号和 inserted；Table Editor 按该 ID 过滤应只有一行。重发同一完整 payload（开发 Network 的 replay/resend；不得改 ID）应 already_saved，行数仍为一；故意改同 ID 内容的测试请只在测试项目执行，应 409 且不覆盖原记录。无需开放匿名 SELECT，验证由管理员在 Table Editor 完成。
6. **GitHub Pages 最后发布**：只有联调通过且用户确认，才提交并推送现有 main，由原 Actions 构建部署。保留 workflow 中 enabled=true、原函数 URL、原 Vite base；不创建新仓库或改变网址。GitHub Actions 不部署 Supabase SQL/Edge。发布完成后再在正式网站完成一份全新测试验证，不把旧结果刷新当新增记录。

旧前端可接受新 Edge 的成功响应；新前端会拒绝旧 Edge 仅有 ok 的响应，因此严格按 SQL → Edge → 本地联调 → Pages 顺序。迁移后不要重跑旧 02，否则会把兼容入口改回旧实现。若需回滚，旧前端与新版 Edge/v2 RPC可共存，无须删除数据。

## 验证场景

- 正常完成：结果立即可见；队列先存在，收到确认后移除，Table Editor 一行。
- 断网完成：无请求、pending 且 attempts=0；关闭再进入仍保留；联网后自动发送。
- 请求中刷新/关闭：同 ID 与已消耗次数保留；租约到期后恢复，响应丢失也不会新增重复行。
- 网络/超时/429/临时服务异常：指数退避；最多三次，耗尽后 failed 留存；刷新不重新计数。
- 数据库权限/约束拒绝、编号冲突：无成功确认，队列保留 failed，结果、存档和 PNG 正常。
- 重测：新增 ID，上一份未保存记录不清除。旧 attempted 仅完整 payload 恢复，旧 sent 不重传，没有 payload 的历史不补传。

本地自动验证：`node scripts/bundle-research.mjs`、`npm run build`、`EXPECT_RESEARCH_UPLOAD=true npm test`（PowerShell 用 `$env:EXPECT_RESEARCH_UPLOAD='true'`）。SQL 行为验证脚本是 `scripts/verify-research-rpc.mjs`，需可用的本地 `@electric-sql/pglite`，或用 PGLITE_MODULE 指向已有运行时模块的 file URL；它创建内存数据库，不读取 Supabase 凭据或连接线上。验证结果见 `reports/reliable-submission-validation.md`。
