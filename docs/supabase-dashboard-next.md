# 数据库验证通过后的 Dashboard 操作

当前状态：用户已完成以下云端配置并确认首次真实答卷入库。本文件保留作操作参考，不需重新建函数或重复迁移；前端本轮已获授权发布到原 GitHub Pages 地址。

依据用户返回的 verification JSON，五字段及 NOT NULL、时间默认值、主键、valid_answers/valid_scores、新数组 CHECK、RLS enabled=true/forced=false、policy_count=0、空 search_path 的 SECURITY DEFINER RPC 均正确。anon/authenticated 的表、列及 RPC 权限全 false；service_role 仅 RPC=true。无需重跑迁移，也无需新增公开策略。以下操作由用户在 Dashboard 完成，助手没有连接或部署真实项目。

## 第一步：启用每日清理

进入项目 qwkwtcbkxjlyelvbvwpv → Integrations → Cron，启用 pg_cron。然后在 SQL Editor 新建查询，以 postgres 角色完整执行 `supabase/sql/03-retention.sql`。

返回 Integrations → Cron → Jobs，应出现 `earth-online-retention`，Active 开启，计划 `15 3 * * *`，命令 `select research_private.purge_expired();`。这是按 Cron 配置时区每日 03:15 执行，默认 GMT/UTC；03 文件也会查询时区。命令将删除超过 180 天的原始记录并清理旧分钟计数。下一次成功调度前可能有正常延迟；CSV/备份/服务商日志需独立管理。

初次没有 History 是正常情况。第一次执行后检查 History 的 succeeded；失败时查看错误，不能仅以 Active 判定清理已成功。03 的最后一条运行历史查询首次可能没有行，应到 Jobs 确认任务确已建立。

## 第二步：配置允许来源

进入 Edge Functions → Secrets，添加且保存这一项：

```text
RESEARCH_ALLOWED_ORIGINS=https://73ya73.github.io,http://127.0.0.1:5173
```

不要加路径、不使用星号，来源之间用英文逗号。后面的本地地址用于本次不发布网站的联调；本地页面必须从这一完全一致的地址打开，localhost 与 127.0.0.1 不相同。若本地实际端口不同，更新列表为对应 origin。生产发布前移除无需保留的本地来源。

当前函数直接读取托管环境中的 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`，不用新增或复制它们，也不要尝试添加 SUPABASE_ 前缀的自定义 Secret。如果运行日志提示配置缺失，仅返回错误文本和“哪项存在/缺失”的信息，不返回密钥值。Supabase 新版还提供 `SUPABASE_SECRET_KEYS`，当前这份部署文件使用已支持的托管 service_role 变量；不以浏览器 anon key 替代。

## 第三步：Dashboard 部署单文件函数

进入 Edge Functions → Deploy a new function → Via Editor，函数名精确填写 `submit-research`。打开本地 `supabase/dashboard/submit-research.ts`，复制**完整文件**，替换 Dashboard 默认 index.ts 的全部内容，然后 Deploy function。

这是从现有多文件源码生成的独立版本，已包含 13 题题库、原计分代码、字段校验、限额和 CORS；不需要手动在 Dashboard 创建 _shared 文件夹。不要只复制 `supabase/functions/submit-research/index.ts`，那个入口需要其他模块。

在该函数详情的 Configuration/Settings 中，关闭本函数的 Verify JWT（有些界面标为 Verify JWT with legacy secret），保存配置，确保等价于 verify_jwt=false。Dashboard 不会因为你粘贴代码而自动读取本地 config.toml。只改这一个公开匿名入口的 JWT 配置，保留数据库 RLS 及现有公开角色禁用权限。

最终函数地址应为：

```text
https://qwkwtcbkxjlyelvbvwpv.supabase.co/functions/v1/submit-research
```

看到部署成功后再进行下一步；浏览器直接打开地址会是 GET 且可能无允许 Origin，收到 403/405 不等于部署失败。Dashboard 测试器的默认 Hello World 请求也不是完整答卷，本次真实验收走本地网站的 13 题流程。

## 第四步：本地真实自动提交

在 earth-recharge 根目录复制 `.env.example` 为 `.env.local`，仅在这份忽略文件中设置：

```dotenv
VITE_RESEARCH_ENABLED=true
VITE_RESEARCH_FUNCTION_URL=https://qwkwtcbkxjlyelvbvwpv.supabase.co/functions/v1/submit-research
```

根目录前端 .env.local 不放任何 Supabase key。运行 `npm run dev -- --port 5173 --strictPort`，重启服务后，从终端显示的 `http://127.0.0.1:5173/` 打开页面。如果已经有预览服务，不要仅刷新旧生产 dist；要使用这次新启动的开发服务。若 npm 不在 PATH，请先确认 Node.js 安装位置，将对应目录加入当前终端 PATH，再调用 npm.cmd。

首页应看到“完成测试后，系统会自动记录…”说明。打开浏览器开发者工具 → Network，过滤 submit-research；点击 Start Setup 新开一轮，实际完成 13 题并点击“查看我的回血人格”。不要恢复旧完成结果或打开旧存档，它们按设计不会补传。

预期正常显示结果；网络 OPTIONS 预检为 204，POST 为 200、响应 `{"ok":true}`。某些浏览器已缓存预检，此时只看到 POST 也正常。记录 POST 中本次随机 submission_id（不要记录任何密钥），再进入 Supabase Table Editor → public.research_submissions，按该 ID 筛选，应只有一行，包含 13 个 Q1–Q13 数组选项、结果数组、六维原始分与服务端时间。

刷新本地网站并继续同一次结果，再查该 submission_id 仍只有一行；重新开始并完整完成一次则产生新编号和新行。保存到我的存档或导出图片不是上传触发器。测试记录没有额外标记字段，统计时可按记下的 submission_id 排除验收记录。

先不更改公开网站或 GitHub 构建环境。完成测试后，可把本地上传开关恢复 false 并重启开发服务，避免后续无意继续写入。

## 故障定位与返回信息

401 常见于本函数 JWT verification 仍开启；403 检查实际页面 origin 与允许列表；400 检查是否用了真正的新完整答卷、前后端题库是否一致；404 检查函数名与部署项目；503 查看 Edge Logs 中 RPC/配置故障，不要开放 anon INSERT 来解决。页面正常出结果本身不能证明数据写入成功，必须同时看到 POST 成功与 Table Editor 对应行。

请返回：Cron 任务 Active/计划（首次运行后再看 History）、函数部署成功及 JWT 关闭、POST 状态与响应、Table Editor 是否有且只有一条对应编号。可以只提供编号，不提供密钥或真实答案。未观察到这些之前，不将真实联调标记为完成。

参考：[Cron 安装](https://supabase.com/docs/guides/cron/install)、[Cron 调度与历史](https://supabase.com/docs/guides/cron/quickstart)、[Dashboard 部署](https://supabase.com/docs/guides/functions/quickstart-dashboard)、[托管环境变量](https://supabase.com/docs/guides/functions/secrets)、[函数 JWT 配置](https://supabase.com/docs/guides/functions/function-configuration)。
