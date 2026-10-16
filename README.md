# 测测你的精神回血机制

Earth Online · Recharge Personality Test v1.1。12 道中文单选题、64 个选项、六种回血机制。题目和 F–K 分数来自《地球Online - 精神回血系统检测 (2).xlsx》。React + TypeScript + Vite；浏览器内运行，不需要数据库或付费 API。

界面保留 Windows XP Luna 风格：原创蓝天草坡桌面、安装向导、绿色分段进度条和用户属性结果面板。窗口可以最小化、最大化/还原，关闭后从桌面或任务栏恢复。v1.1 隐藏首页人格剧透，删除 Q6 的 RESULT LOADING；结果使用六套原创像素图案，新增系统鼓励、现实建议、完整回答记录和每型两本延伸阅读。当前变更见 reports/v1.1-update.md；xp-redesign.md 和 verification.md 为旧版历史记录。

## 本地运行

使用 Node.js 22.12 或更新版本，在项目目录执行 `npm ci`，然后 `npm run dev`。生产构建用 `npm run build`，本地查看构建用 `npm run preview`。先执行 `npm run build`，再执行 `npm test` 检查真实构建页面交互、计分和数据；执行 `npm run simulate` 生成 10,000 次固定种子模拟报告。

## 数据来源与校验

题库 `src/data/questions.json` 按用户提供的 Excel 原题顺序保存 questionId、optionId、text、answerNature、behaviorTag、scoringEnabled、scores、sourceRow。原始 Excel 和文本不修改。转换脚本只读原文件：安装 Python 包 openpyxl 后执行 `python scripts/convert_excel.py "Excel文件绝对路径"`。若后续计分表结构改变，请先检查转换脚本并重新校验。

校验报告在 `reports/data-validation.json`。361 个空白计分单元格保留 null，只累加 23 个明确数字单元格，不将空白解释为已确认的零。独立核对全部 64 个选项与 384 个分数字段：`python scripts/verify_excel.py "Excel文件绝对路径"`，输出 reports/excel-verification.json。Q1-Q3 没有行为标签，保留 null。Q9-D 的 T02 标签与 THINK=2 分数分别原样保存。题干和完整答案原文均保留；界面将答案字母作为单独的选项标识展示。各题选项数为 4/7/4/5/5/5/4/5/7/6/5/7；文本文档与 Excel 仅有空格差异时优先保留 Excel 原文。

## 计分与待校准规则

算法独立于 UI，见 `src/scoring/engine.js`。ACT/RESET/SOCIAL/LUCKY/THINK/SAVE 的理论最高分为 5/6/8/8/6/5。Lucky 列的旧内部代码 LUCK 统一为 LUCKY，不改变数字。每道题只能选一个答案，只有 scoringEnabled=true 的选项中明确数值贡献得分。行为标签不会自动加分。

当前 CONFIG 为 pilot-1.1，calibrated=false，minEvidence=2，nearTieGap=0.1，epsilon=1e-9。按原始分数除以各类型理论最高分排名，仅至少两道独立正分证据的机制进入候选。完全并列时仅展示最高并列项，没有隐藏优先级；唯一最高但有其他候选差距不超过 0.1 时展示混合倾向，不选择唯一主类型；没有候选展示证据不足。完整作答的全零分路径不存在，因为 Q4 所有选项必定贡献 2 分。部分答题或无正分输入的全零状态仍作防御处理，不默认返回任何人格。门槛、归一化和近似差距阈值沿用待校准设计；请在正式研究前确认空白计分含义并校准规则。结果不显示科学准确率，也不作专业心理诊断。

结果保留 totals、evidence、theory、ranking、behavioralProfile、contextProfile、selections。结果页的规则说明可查看原始分。行为文案仅描述本次回答，背景与状态单独显示。

## 交互与隐私

未选答案无法继续；支持返回修改、刷新恢复、继续上次测试、重新测试清除。回答仅存当前浏览器 localStorage，存储损坏会安全回到欢迎页。v1.1 使用独立的 earth-recharge-v1.1 存档键和版本号；旧选项含义已变化，因此不自动迁移旧版答案，旧记录也不会被新题误用。可导出纵向 PNG 结果卡；分享使用浏览器原生分享或复制网站链接。普通链接打开欢迎页，不在 URL 中包含任何答案。没有账号或回答上传，页面采用系统字体。

结果页的“常规、回答线索与记录、推荐阅读、计分说明”是真实页签，支持键盘左右键及 Home/End。“推荐阅读”书名使用已核验的原文标题，附作者、中文匹配理由和官方介绍链接；来源清单见 reports/reading-sources.md。匹配理由是本项目的编辑判断，不代表书籍作者认可本测试，也不是治疗建议。

## GitHub Pages 公开部署

本项目附完整 GitHub Actions 工作流，但没有假设拥有你的 GitHub 权限。创建一个 GitHub 仓库（例如 earth-recharge），在本项目目录执行 `git init`、`git add .`、`git commit -m "Build recharge test"`、`git branch -M main`、`git remote add origin https://github.com/你的用户名/仓库名.git`、`git push -u origin main`。若目录已有 Git，请先核对现有仓库，避免重复初始化或覆盖 remote。

到仓库 Settings → Pages → Build and deployment，将 Source 设为 GitHub Actions。推送 main 后等待 Deploy GitHub Pages 成功。工作流将 VITE_BASE_PATH 设为仓库名路径，常规仓库网址为 `https://用户名.github.io/仓库名/`。若使用 `用户名.github.io` 根站点仓库或自定义域名，将工作流 VITE_BASE_PATH 改成 `/`。本地默认 `./`。

部署后验证：首页可以加载，手机没有横向溢出；12 题可完成，返回修改有效；刷新后可继续；并列和低证据结果合理；下载 PNG 成功；分享链接进入欢迎页；重新测试清空回答。GitHub Pages 是静态托管，不需真实 E-ink 硬件。

## 目录

- src/data：原始结构化题库与六种人格文案。
- src/scoring：计分、理论最高分与候选规则。
- src/utils：浏览器状态和 Canvas 图案／PNG 导出。
- src/main.tsx、src/styles.css：欢迎、答题、过渡、结果页面与响应式视觉。
- src/tests、scripts：数据计分测试、Excel 转换和随机模拟。
- reports：数据校验与模拟结果。

## 模拟说明

固定种子均匀选择 10,000 次，仅检查算法结构，六种人格胜出比例、并列、混合与未判定比例见 simulation.json。此分布不能代表真实用户，也不能据此调整分数以让人格均匀出现。
