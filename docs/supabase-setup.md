# 自动统计接入与后台操作

最新进度：用户已执行 02 并返回完整 04 verification JSON，字段、约束、RLS、RPC 及表/列权限全部符合预期；随后用户确认每日清理、允许来源、Edge 部署及 JWT 关闭均已完成，并在 Table Editor 看到了第一份真实记录。以下为配置与维护说明，不需因拉取代码再次运行迁移。Dashboard 操作参考见 [supabase-dashboard-next.md](supabase-dashboard-next.md)。`supabase/dashboard/submit-research.ts` 是可全文粘贴的单文件部署版本；CLI 源码仍保持多文件结构。

前端本轮已获用户授权通过现有 main 分支与 GitHub Pages 工作流发布；云端数据库和函数由用户在 Dashboard 配置，助手不获取管理密钥。公开项目地址为 `https://qwkwtcbkxjlyelvbvwpv.supabase.co`；`/rest/v1/` 是 Data API 路径，不是提交入口。正确的接收入口为 `https://qwkwtcbkxjlyelvbvwpv.supabase.co/functions/v1/submit-research`。实际表权限检查依据用户返回的 SQL 结果。

迁移后的实际结构：submission_id uuid 主键，submitted_at timestamptz 默认 now()，answers/scores/result_type 均为 jsonb；五字段均 NOT NULL，存在结果数组 CHECK 与 valid_answers/valid_scores 对象 CHECK。RLS enabled=true、forced=false，无策略；anon/authenticated 表、列及 RPC 权限全 false，service_role 仅 RPC=true。不开放 anon 权限，不增加 test_version。下方 text→jsonb 操作为已完成的迁移步骤。

## 先在 Supabase 手动完成

- 只读检查已完成。需要再检查时可运行 `supabase/sql/01-inspect.sql`。不要提供 service_role key、数据库密码或完整环境文件。
- **需要迁移**：目前 result_type 为 text，现有接入代码按用户确认采用 JSON 数组。已更新的 `02-prepare.sql` 会把 `ACT` 转为 `["ACT"]`，EXPLORING 同理；新并列／混合为 `["ACT","SAVE"]`。它只替换引用 result_type 单列的 CHECK，保留原有主键、NOT NULL、时间默认值和 valid_answers/valid_scores；遇到未知旧值、跨字段结果约束、未预期默认值或其他依赖会整笔回滚，不使用 CASCADE。
- 在对应 Supabase 项目打开 SQL Editor → New query，选择 postgres 角色，复制**当前更新后的完整** `supabase/sql/02-prepare.sql`，从 BEGIN 到 COMMIT 一次运行，勿只运行选中的一小段。已有记录可先在 Table Editor 导出备份。成功通常显示 `Success. No rows returned`；报错时停止并保留原始错误，不继续部署。脚本在同一事务内对比所有旧记录，确认除结果类型转换外，原编号、时间、答案及分数均未变化。
- 这份脚本同时增加时间索引，沿用已有主键去重，撤销 public/anon/authenticated/service_role 对此表的直接权限，仅允许 service_role 调用写入 RPC。RLS 保持开启、无新增策略、forced=false 不变。RPC 使用固定空 search_path 的 SECURITY DEFINER，在单事务内限额并插入，重复 UUID 不更新旧记录。私有计数表只包含分钟和请求数量，不存 IP 或设备信息。其他表不受影响，Table Editor 由项目管理员使用。
- 在 Integrations / Cron 中启用 Supabase Cron，然后执行 `03-retention.sql`。默认原始记录保留 180 天，UTC 每日 03:15 清理，最多可能有一个调度周期延迟。需要接受这一保留安排再启用前端；如改天数，同步修改说明组件与 SQL。监控 Cron 执行失败。CSV、个人下载副本由管理员按同样期限清理；备份及服务日志遵循服务商实际设置，不能承诺同时立即删除。
- Edge Functions Secrets 设置 `RESEARCH_ALLOWED_ORIGINS=https://73ya73.github.io`。Origin 不包含 `/Earth-Online-Test/`，不要写 `*`；同一 github.io origin 下其他仓库共享此来源，CORS 无法按路径鉴权。本地联调额外加入实际本地 origin，如 `http://127.0.0.1:5173`，验收后从生产允许列表去掉。平台提供 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`，只在函数环境读取；若项目禁用旧密钥，先确认可用的服务端密钥方式再适配。不要把它们放进 VITE_*、GitHub 公开变量、聊天或源码。
- 发布函数时使用仓库内多文件结构（推荐 Supabase CLI）：`supabase login`、`supabase link --project-ref qwkwtcbkxjlyelvbvwpv`、`supabase functions deploy submit-research --no-verify-jwt`。不要只复制 index.ts 丢掉 `_shared`。`supabase/config.toml` 已仅对这个公开入口设 `verify_jwt=false`，它不要求参与者登录；这是公开写入接口，关闭 JWT 不等于可开放数据库权限。
- 在新查询复制执行完整 `04-verify-access.sql`，得到一行 verification JSON。应看到 result_type 类型 jsonb，五字段 nullable=NO，submitted_at 默认 now()，原主键及 valid_answers/valid_scores 保留、新 research_result_type_array_check validated=true；rls enabled=true、forced=false、policy_count=0；rpc_exists/rpc_security_definer=true、rpc_settings 含空 search_path。权限中 anon/authenticated 的 select/insert/update/delete/rpc 全 false；service_role 四项直接表权限 false，仅 rpc=true。将这行结果提供后再进入函数部署。
- 后续实际联调时，用项目公开 key 对 REST select/insert/update/delete 和 RPC 分别验证拒绝；再通过函数完成一份完整答卷，确认 Table Editor 只有一条对应记录；相同 UUID 再次 POST 不增加记录。不要通过给 anon INSERT 来排查写入失败。

执行前复核（2026-10-18）：02 还会撤销五字段上可能独立存在的列授权，并在提交前检查 anon/authenticated 的有效表／列权限；角色继承导致仍可访问时整笔回滚。04 的 column_select/column_insert/column_update 也应全部 false。02 会短暂独占锁表，5 秒锁等待和 60 秒语句超时；在没有并发写入时执行。其他程序若依赖旧 text 比较或 service_role 直接读写本表，需要先适配；项目内不存在这类读取，不能据此保证未知外部工具不受影响。数据库登记的视图等阻塞类型转换时，迁移会失败回滚，不使用 CASCADE 删除依赖。

仅执行 02 不会启动清理，也不会删除旧行；purge_expired() 必须由 03 建立的 Cron 任务实际调用。每日清理意味着到期后可能延迟至下一次成功运行；应检查 Cron active=true 及成功执行历史，不能只确认函数存在。后台备份、日志、导出 CSV 的保留需分别管理。

## 本地前端与上线顺序

复制 `.env.example` 为被忽略的 `.env.local`，默认 `VITE_RESEARCH_ENABLED=false`。只有完成上述设置后才改为 true；配置公开函数地址不需要浏览器 API key。Vite 环境变量在构建时固定，不是在浏览器运行时读取。缺失或无效地址会关闭上传，首页显示预览未启用；启动命令先用 `npm run dev`，不要推送 main。

现有生产工作流 build 步骤已明确设置 `VITE_RESEARCH_ENABLED='true'` 和当前公开函数 URL，并保留原 `VITE_BASE_PATH`。这两项不是密钥，无需另设仓库 Secrets；CI 运行实际生产包测试时通过 `EXPECT_RESEARCH_UPLOAD=true` 防止遗漏配置。本地示例文件默认 false，由使用者选择是否启用；不要将 service_role key 放入任何 VITE_* 变量。

上线顺序：核对真实 schema → SQL 与 RLS → Cron → 部署函数 → 本地启用并实际联调 → 允许公开 REST 拒绝验证 → 用户授权后映射前端 build 变量并发布 → 核查真实 Table Editor 数据。不要先发布显示“已记录”的界面后补后端。

## 数据与失败处理

仅在本次启用统计的测试真正点击最后一步并进入结果页时提交。恢复以前的完成结果、打开历史存档、未答完、只保存 PNG 均不会补传旧记录。随机 UUID 仅标识这一次完成的测试，不建立长期参与者身份；重新测试会生成新编号。answers 使用 Q1–Q13 到选项编号数组的对象，单选也为数组，多选按题库顺序保存，适合 CSV 中 JSON 字段解析及组合频率统计。

前端在发送前记录 attempt 标记并在内存防并发，7 秒超时，不显示上传弹窗、不阻塞结果、不自动重试。刷新与重复进入结果跳过同编号；若本地存储不可用则只能保证当前页面内去重，数据库唯一约束仍防止重复行。失败可能丢失这一份统计，优先保障测试体验；这不是保证送达的队列。关闭页面、网络中断均可能未送达，控制台只写失败类别，不写答案、编号或响应内容。打开另一份测试会独立尝试一次。服务端收到完整内容后校验并重新计算，以数据库接收时间写 submitted_at，不采用浏览器时钟；已验证的浏览器 scores/result_type 必须与服务端一致。

Edge 使用生成的同源题库和原计分代码副本，运行 `node scripts/sync-research.mjs` 同步，测试校验副本与原始代码完全相同。原计分文件不改动；未来题库升级必须同步前后端，旧页面不匹配会被拒绝而不影响本地出结果。服务端字段严格白名单，只接受完整 13 题、合法选项数量与互斥规则、六维整数分和合法结果数组，不接受姓名、版本号等附加字段。

请求只接受允许来源的 JSON POST/OPTIONS，流式请求体最多 8 KiB、读入 3 秒、数据库调用 5 秒，Edge isolate 每分钟最多 120 个 POST（含无效输入），数据库原子计数对所有 isolate 合计限制每分钟 120 份有效输入。限制不使用 IP 或设备指纹。公开入口的来源头可被脚本伪造，isolate 限额也会随实例重启，全球配额不能识别人、更不能阻止攻击流量耗尽配额或产生调用成本；它是轻量限额，不是完整反机器人方案。流量明显增加时可另加 Turnstile 或网关规则，需同步更新数据说明。本次不引入额外第三方验证服务。

## 后台和 CSV

管理员在 Table Editor 查看 research_submissions 并导出 CSV，无需管理员网页。answers、result_type、scores 是 JSON 字段，CSV 会包含 JSON 文本，多选并不会丢失。`05-statistics.sql` 提供管理员只读分布、六维原始分占比、逐题频率和多选组合统计。混合结果的“整组分布”每份只算一次；拆为七种标签时同一份可能计入多类，应清楚区分分母。六维“总分占比”与“每人占比的平均”含义不同，所附 SQL 默认总分占比。

## 参考

- [Supabase 公开函数与 JWT 配置](https://supabase.com/docs/guides/functions/auth)
- [函数环境变量与密钥](https://supabase.com/docs/guides/functions/secrets)
- [RLS 与 service role](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [数据库函数权限](https://supabase.com/docs/guides/database/functions)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
