# 根据实际表结构准备的迁移（2026-10-18）

用户报告现有表的五字段全部 NOT NULL：submission_id uuid 主键、submitted_at timestamptz 默认 now()、answers jsonb、result_type text、scores jsonb；结果有 CHECK，answers/scores 有对象 CHECK。RLS 开启、未 FORCE、没有策略，anon 四项表权限均 false。以上为用户在 Supabase SQL Editor 的只读检查结果。

决定：需要迁移结果类型以满足已确认的 JSON 数组数据格式，并建立 Edge 专用 RPC。运行文件为**本次更新后的** `supabase/sql/02-prepare.sql`，随后只读运行 `supabase/sql/04-verify-access.sql`。不需要另外新增表记录列，也不需要重新建表、改变现有主键、开放匿名 SELECT/INSERT 或加入 test_version。

02 的变更为：text 单结果转为 JSONB 单元素数组；只替换 result_type 单列 CHECK，新数组 CHECK 限定六种机制及独立 EXPLORING；保留原来的 answers/scores CHECK、五项 NOT NULL、时间默认值和主键；新增时间索引、私有分钟计数表、受限写入 RPC 和尚未调度的清理函数。表直接权限继续对 anon/authenticated 关闭，service_role 也仅通过 SECURITY DEFINER RPC 写入。没有新增任何 RLS 策略。整笔事务包含旧记录逐行对比；未知旧结果、未知默认值、跨列结果约束、依赖冲突、锁等待或执行超时都会报错回滚。没有 CASCADE、旧行删除或真实测试写入。

本地验证使用工作区外于应用仓库的 `.research-sql-check/verify.mjs` 与 PGlite（嵌入式 PostgreSQL）。在按用户报告结构构建的合成数据库中实际执行 02 与 04，验证通过：

- 旧单结果 text 转数组，编号、时间、答案、分数均保留，NOT NULL/主键/对象 CHECK/时间默认值及 RLS 保持。
- 04 生成一行完整 JSON，列类型、约束、RLS、RPC 属性和三角色有效权限符合预期。
- 重复执行迁移不嵌套数组、不改旧行；空表可以迁移。
- anon 真实 SELECT 与 RPC 调用均被拒绝；service_role 可执行 RPC，但不能直接 SELECT 表。
- RPC 两次提交同一编号只有一条新增记录；计数达到阈值时返回 rate_limited，不新增行。
- 未知旧结果与跨列结果 CHECK 均使迁移回滚，原 text 字段与旧行保持。

这些测试不连接 Supabase，不能代替实际项目的权限/依赖验证。Supabase 托管扩展、真实角色继承、其他对象依赖仍以用户运行结果为准。既有前端统计代码、题库及评分无新增变更；本次无需重新构建前端。GitHub、线上网站和远程数据库均未由助手改动。

操作：Supabase 正确项目 → SQL Editor → New query → postgres 角色 → 全文粘贴 02（BEGIN 到 COMMIT）→ Run；成功通常为 Success. No rows returned。然后新建查询全文执行 04，把 verification JSON 返回。预期 result_type=jsonb、五项 nullable=NO、原主键/valid_answers/valid_scores 保留、新数组 CHECK validated=true、RLS enabled=true/forced=false、policy_count=0、rpc_exists/rpc_security_definer=true，anon/authenticated 五项权限全 false，service_role 仅 rpc=true。出现错误时停止，提供错误而不继续部署。

数据库结果确认后，下一步才是部署多文件 submit-research Edge Function，使用托管 SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY、RESEARCH_ALLOWED_ORIGINS，最后进行受控真实答卷写入。本次未执行 03-retention.sql，没有启动数据清理。生产统计默认仍关闭。

依据：[PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)、[Supabase 数据库函数权限](https://supabase.com/docs/guides/database/functions)。

## 执行前再次复核

Edge validateSubmission 使用生成的实际 13 题题库，逐题验证编号、数量与互斥，调用与前端一致的 calculate 后比较浏览器分数和候选数组，写入对象取自服务端重算。针对这一流程及本地历史记录的 17 项测试再次通过。数据库云端行不会被前端当成本地历史记录读取；本地冻结存档独立于云端 result_type 类型。旧 text 查询的外部报表不保证自动兼容，需改用 JSONB 数组操作。

本地 PGlite 增补验证全部通过：七种旧结果逐一迁移；五组管理员统计 SQL 实际执行；依赖视图导致 ALTER TYPE 失败并完整回滚、视图仍可读取。迁移脚本本轮补强五字段独立列授权的撤销，04 增加 column_* 有效权限检查；独立列授权被清除、未处理的继承权限导致整笔回滚，这两个场景均实际通过。

权限收紧有明确边界：service_role 直接操作此表的权限被撤销，仅 RPC 可写；若项目外另有程序依赖直接读写，必须先适配。未知动态 SQL 和外部消费者无法靠 PostgreSQL 静态依赖检查穷尽。正常迁移需要短暂独占表；已有锁等待超过 5 秒或单句超过 60 秒会报错回滚。

02 仅定义清理函数，不运行清理。还需管理员启用 pg_cron 并执行 03-retention.sql，确认任务 active=true、实际运行成功，才算启动 180 天到期清理；每日调度存在不超过一个成功调度周期的正常延迟，失败须及时处理。本次未连接云端、未部署、未推送。
