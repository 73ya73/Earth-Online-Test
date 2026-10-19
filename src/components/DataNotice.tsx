import {t} from '../i18n/index.js';
import React from 'react';
export function DataNotice({ enabled = false }: {
    enabled?: boolean;
}) {
    return <section className="data-notice" aria-label={t("测试与数据使用说明")}><b>{t("测试与数据使用说明")}</b><p>{enabled ? t("本测试为趣味探索，非心理诊断。完成测试后，系统会自动记录本次答题选项及测试结果，用于统计和优化体验。无需提供姓名或联系方式。") : t("本测试为趣味探索，非心理诊断。当前预览尚未启用统计上传；答题进度与我的存档保存在当前浏览器。")}</p>{enabled && <p>{t("只记录本次随机编号、提交时间、13 题选项、人格结果和六维原始分数；不收集姓名、邮箱、账号，也不主动读取或保存 IP。原始记录保留 180 天，按日清理到期数据；导出的原始 CSV 同样适用。Supabase 等服务商可能处理必要的网络请求信息，服务日志与备份受其保留策略约束，因此不承诺完全匿名。我的存档与图片保存仍独立可用。")}</p>}</section>;
}
