# 测测你的精神回血机制

Earth Online · Recharge Personality Test v1.2。沿用 React、TypeScript、Vite 静态项目和 Windows XP Luna / 原创像素设计。题库唯一来源为《分数 (7).xlsx》：13 题、70 个选项、六种回血机制；不需要数据库或付费 API。

## 本地运行与校验

使用 Node.js 22.12 或更新版本，运行 `npm ci`，然后 `npm run dev`。执行 `npm run build` 后再运行 `npm test`（自动化交互测试读取真实构建产物）。`npm run simulate` 运行 10,000 次固定种子的合法答题模拟，仅检查算法结构，不代表人群分布。

Python 需 openpyxl。运行 `python scripts/convert_excel.py "Excel绝对路径"` 导入题库，运行 `python scripts/verify_excel.py "Excel绝对路径"` 独立逐格核对。源文件只读。当前 420 个评分单元格包含 23 个数字和 397 个 null，均与 Excel 一致；报告见 reports/data-validation.json 和 excel-verification.json。

## 题库和多选

各题选项数为 4/7/4/5/5/5/4/5/7/6/6/5/7。Q9、Q10 最多选两项；Q13 的 A–F 可多选，G 与其他选项互斥；其余单选。下一题要求至少选择一项，返回可修改。选项保留原题文案、顺序、behaviorTag、answerNature、scoringEnabled、scores 和 sourceRow；额外的选择约束来自 v1.2 说明。

Q9-D 保留 THINK=2，Q9-F 保留 ACT=2，不按行为标签改分。Q10、Q13 不计分。Q10-E/F 的原始标签保留在 behaviorTag，添加准确 feedbackTag 与 needs-review 标记；补充线索使用效果反馈，不误解释为反复确认或寻求方向。其余未评分选项也完整记录标签和答案性质。

## 计分与状态占比

内部沿用 Excel 的 ACT/RESET/SOCIAL/LUCKY/THINK/SAVE；文档 REST/LUCK 是 RESET/LUCKY 的别名，不添加新机制。只累加参与评分选项的明确数字，空白不推断赋分；多选各项累加，同一题对同机制只增加一道正分证据。合法多选组合参与理论最高分计算，目前仍为 5/6/8/8/6/5。

主人格判定沿用试行配置 pilot-1.2：原始分 / 各型理论最高分比较；至少两道不同题目的正分证据才能进入候选。最高完全并列时展示全部最高候选；唯一最高且其他候选差距不超过 0.1 时展示混合倾向，否则明确单一候选。容差 1e-9。不随机、不默认返回 ACT；无候选时明确显示证据不足。规则尚待校准，非科学心理测评。

新增 System Status 与主人格算法分离：每项原始分 / 六维原始总分 × 100，保留一位小数，六项合计约 100%。异常输入安全显示 0%；低证据仍可展示已有得分占比，但不强行判定人格。Top 3 按原始分排列，只列正分属性，第三名并列全部保留。不是人格判断值、心理准确率或能力评价。

## 界面与隐私

欢迎页为安装向导；答题使用绿色进度条；结果常规页优先展示名称、原图案、代表文案、六维属性、Top 3 和操作按钮。系统鼓励、回血建议、原有长文放入详细分析折叠区；回答线索与记录、推荐阅读、计分说明仍是真实标签页，支持方向键和 Home/End。保留六套人格图案、文案及每型两本书籍，来源见 reports/reading-sources.md。

PNG 导出使用独立 Canvas 状态卡，1080×1350（4:5），包含结果、原图案、文案、六维条、Top 3、非诊断说明和版本号。分享采用原生分享或复制普通网站链接，不包含答案。XP 窗口的最小化、最大化、关闭保留进度、桌面恢复均保留。

所有答案仅保存在当前浏览器。v1.2 使用独立 earth-recharge-v1.2 键和答案数组，拒绝无效、超限或互斥冲突的存档。旧版存档不自动迁移，避免新旧题号错配；重新测试会清除本版进度。无账号、无回答上传，使用系统字体和原创背景，不依赖外部版权图片。

## GitHub Pages

远程仓库为 https://github.com/73ya73/Earth-Online-Test ，分支 main。已有 .github/workflows/deploy.yml 在推送 main 时安装依赖、构建、测试、模拟并部署。工作流根据仓库名设置 `VITE_BASE_PATH=/Earth-Online-Test/`，Vite 本地默认 `./`。

仓库 Settings → Pages → Source 使用 GitHub Actions。部署地址 https://73ya73.github.io/Earth-Online-Test/ 。若 Actions 失败，请查看对应运行记录；先修复构建或配置，再重新运行。无需重新初始化 Git，也不要强推覆盖现有历史。

## 目录

- src/data：Excel 原始结构化题库、人格文案和原创像素图案。
- src/scoring：答案约束、计分、候选规则和独立的状态占比。
- src/components：XP 桌面窗口、结果页与属性组件。
- src/utils：版本化存档和独立 Canvas 分享卡。
- src/tests、scripts：数据核对、交互回归和合法答题模拟。
- reports：本版验收记录与历次历史报告；当前说明见 v1.2-update.md。
