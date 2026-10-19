> 发布进度更新：用户已确认 SQL 与 Edge Function 部署完成且出现 saved/inserted，现已授权发布前端。下方“未部署”描述记录的是此前本地验收时的状态；本次前端状态以 GitHub Actions 为准，勿因此重复执行 SQL。

# 数据可靠提交修复本地验证

状态：仅本地实现与验证。未执行生产 SQL、未部署 Supabase、未提交或推送 GitHub、未更新 GitHub Pages。基于现有 main 工作树，原部署基线 7ddebbeb74b89a3e33956f2514be850e67f938fc。

## 修改清单

- `src/main.tsx`：完成时同步入队和保存完成进度，后台上传；首次访问恢复队列及旧完整提交。所有返回 JSX 保持逐字一致。
- `src/utils/research.js`：删除旧的 attempted 永久跳过逻辑；保留原 payload/计分，补充安全随机 UUID v4 兼容路径。
- `src/utils/researchQueue.js`（新增）：独立 localStorage 队列、确认凭据、三次累计上限、退避、离线与页面恢复、跨标签锁/租约、结构化状态日志。
- `supabase/functions/submit-research/index.ts`：调用 v2 RPC，分类权限、约束、冲突、数据库和网络/超时错误，仅使用托管服务端变量。
- `supabase/functions/_shared/handler.js`：明确保存确认、分类错误状态、安全日志及 Retry-After/CORS。
- `supabase/dashboard/submit-research.ts`：重新生成与多文件源一致的 Dashboard 完整入口。
- `supabase/sql/06-reliable-submission.sql`（新增）：增量 v2 RPC、读取确认持久内容、同 ID 内容冲突拒绝、保留旧入口兼容；不改表/权限/Cron。
- `supabase/sql/07-verify-reliable-submission.sql`（新增）：管理员只读验证函数配置与权限，不读取参与者答案。
- `scripts/verify-research-rpc.mjs`（新增）：本地 PGlite SQL 行为验证，不连接网络或读取 Supabase 凭据。
- `src/tests/research-queue.test.js`（新增）；`src/tests/research.test.js`、`research-flow.test.js`、`dashboard-function.test.js`：可靠队列、实际生产 React 界面、真实打包函数入口的模拟故障测试。
- `README.md`、`docs/supabase-setup.md`、`docs/supabase-dashboard-next.md`：更新旧说明，明确本轮未上线；新增 `docs/reliable-submission-deployment.md` 说明部署顺序和验证方法。本报告也是新增文件。

原 `storage.ts` 的进度/存档键和 API 不改，待上传队列在独立模块中管理；重测清进度不会清待上传记录。题库、计分文件、人格结果、组件、样式、图片、Vite base、Pages workflow 及原 02/03/04/05 SQL 未修改。

## 验证结果

- `npm run build` 成功，Research 开启，使用原公开函数 URL。构建需要本地 esbuild 的正常目录读取权限；沙箱拒绝后使用已批准的本地构建权限，未部署。
- 设置 `EXPECT_RESEARCH_UPLOAD=true`，完整 83 项自动测试通过，0 失败、0 跳过。后补充了打包函数的数据库错误分类断言并单独通过，再重新执行最终构建与回归。
- 生产包 React/JSDOM 覆盖：正常完成、刷新不重复、重测独立 UUID、网络失败仍可看结果/存档/PNG、离线完成后在加载页关闭并重访欢迎页自动恢复、旧 attempted 完整 payload 恢复、旧 sent 跳过、无 payload 历史不补传。
- 队列覆盖：先入队再请求；只有完整匹配确认清队列；HTTP 200/ok/错误 ID 不误报；断网零消耗；跨页面保留次数；自动退避最多三次；请求提交后响应丢失重试 already_saved；in-flight 关闭后租约恢复；Retry-After；400/401/403/409/422 不重试；跨标签 Web Locks；存储被禁用时警告并保持当前页可用；安全 UUID fallback。
- Dashboard 打包入口模拟实际 PostgREST 请求，覆盖重新计分、RPC 路径、42501 权限错误、23514 约束拒绝、23505 冲突、数据库 5xx、旧 accepted 不当确认、超时和网络错误；未发送真实外部请求。
- `scripts/verify-research-rpc.mjs` 使用已有本地 PGlite：先构建旧 schema/02，再执行 06、07、04；验证 inserted/already_saved、同 ID 改内容拒绝、兼容入口 accepted、重复执行不改历史行、角色不可直接查写表、anon/authenticated 不可执行 RPC、RLS 不变、约束拒绝不入库、触发器阻止插入不误报成功、全局配额不变。
- Git diff 确认保护文件未改，main.tsx 的全部 JSX 与 HEAD 一致；`.env.local`、dist、node_modules 继续忽略。生产资源扫描未发现数据库连接密码 URL、Supabase Secret Key 或 JWT token 格式值；服务端 key 只通过 Deno 环境变量读取，无前端导入。

测试是本地模拟/内存数据库验证，不代表真实 Supabase 部署已成功，也不能证明所有地区网络可达。用户批准后需按部署文档完成 SQL → Edge → 本地真实联调 → Pages → 正式网站验证。请求超出三次预算后为 failed 留存；网站存储被禁用、清除或系统回收时，不能保证跨访问恢复。地区连接质量仍需真实失败样本的 Network 与 Edge Logs 辅助验证。
