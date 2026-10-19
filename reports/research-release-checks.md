# 自动统计发布检查（2026-10-18）

用户已在 Supabase 完成迁移和权限验证，确认 Cron、允许来源 Secret、submit-research 部署及 Verify JWT 关闭，并在 Table Editor 看到第一份完整真实记录。助手没有数据库管理密钥，未读取参与者表；该真实入库结果依据用户确认。

## 本地发布验证

- 按生产 base `/Earth-Online-Test/`、上传开关 true、现有公开 Edge Function 地址构建成功。70 项自动测试全部通过，10,000 次合法答案模拟通过。题库、原评分文件和 Vite base 配置相对已发布 v1.5 基线未改动。
- 使用真实生产包执行 React 交互测试，记录网络请求次数：完成一次后提交一次、返回结果及刷新恢复后不再请求；重新完整答题生成第二个独立 UUID、第二次请求。测试以模拟成功响应验证客户端逻辑，未为此额外写入云端研究数据。数据库 UUID 主键与受限 RPC 的重复写入防护另经本地 PostgreSQL 实测。
- 模拟网络失败后结果正常显示，可成功保存本地存档并实际触发 1080×1350 PNG 下载；没有无限重试。后续完整新一轮仍独立尝试。
- 首页 Start Setup 之前显示完整自动记录说明、用途及数据保留信息；帮助窗口、页脚和任务栏与统计模式一致。真实浏览器 DOM 亦已确认首页包含说明。
- GitHub Actions 原 build 步骤新增两项非敏感 env：VITE_RESEARCH_ENABLED=true、VITE_RESEARCH_FUNCTION_URL 指向已部署函数。原 base、Pages 构建/发布结构及公开地址不变。测试步骤设置 EXPECT_RESEARCH_UPLOAD=true，验证实际构建启用且 URL 正确，避免本地 .env.local 掩盖 CI 配置缺失。
- .env.local 未跟踪并被 .env.* 忽略；node_modules、dist、凭据文件和 Supabase CLI 本地状态均不入库。待提交文件、全部六个既有 Git 提交与生产产物扫描未发现常见私钥、Service Role JWT、Supabase Secret Key、数据库密码 URI、GitHub/AWS 密钥特征；前端构建不含服务端密钥环境变量引用。明细见 research-security-audit.json。模式扫描不能证明不存在一切形式的秘密，但此次只使用托管环境读取、公开地址和明确测试占位值，未将真实密钥交给助手。
- 已对真实 Edge Function 发出不含答案的生产来源 OPTIONS 请求：返回 204，允许 Origin 为 https://73ya73.github.io，方法 POST/OPTIONS，头 content-type。未为预检写入任何记录。
- 推送前 fetch 确认远程 main 与本地基线一致，无他人新提交；使用正常追加提交和推送，不强推。最终推送及部署结果以对应 GitHub Actions 运行和最终回复为准。

## 已知边界

上传失败不重试可能造成统计缺失，换取测试流程连续性；本地存储不可用时无法保证跨刷新客户端跳过请求，但同一 UUID 的数据库唯一约束仍有效。CORS 不认证用户，公开写入口的限额是轻量保护。Cron 的实际调度和运行健康由 Supabase 管理员监控，服务日志、备份及 CSV 保留单独管理。旧完成结果和历史存档不补传。
