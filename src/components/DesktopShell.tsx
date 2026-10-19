import {LanguageSwitch} from '../i18n/Locale';
import {t} from '../i18n/index.js';
import React, { useEffect, useState } from 'react';
import { DataNotice } from './DataNotice';
import { DesktopItem } from './DesktopItem';
import { PixelIcon } from './PixelIcon';
export function DesktopShell({ researchEnabled = false, appActivation, page, onHome, onResume, hasProgress, children, onSaves, savesState, onSavesState, extraWindows }: {
    researchEnabled?: boolean;
    appActivation: number;
    page: string;
    onHome: () => void;
    onResume: () => void;
    hasProgress: boolean;
    children: React.ReactNode;
    onSaves: () => void;
    savesState: string;
    onSavesState: (s: string) => void;
    extraWindows: React.ReactNode;
}) {
    const [selectedIcon, setSelectedIcon] = useState<string | null>(null);
    const [minimized, setMinimized] = useState(false);
    const [maximized, setMaximized] = useState(false);
    const [menu, setMenu] = useState(false);
    const [help, setHelp] = useState(false);
    useEffect(() => { const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') {
        setHelp(false);
        setMenu(false);
    } }; window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle); }, []);
    useEffect(() => { setMinimized(false); }, [appActivation]);
    const title = page === 'welcome' ? 'Setup Wizard' : page === 'quiz' ? 'Recharge Check' : page === 'loading' ? 'Processing' : 'User Profile';
    function open() { setMinimized(false); setMenu(false); if (savesState === 'open')
        onSavesState('minimized'); }
    return <div className={`desktop ${page === 'quiz' ? 'quiz-desktop' : ''}`}><nav className="desktop-icons" aria-label={t("桌面快捷方式")}><DesktopItem className={selectedIcon === 'app' ? 'selected' : ''} aria-pressed={selectedIcon === 'app'} onSelect={() => setSelectedIcon('app')} onActivate={open}><PixelIcon /><span>{t("精神回血检测")}</span></DesktopItem><DesktopItem className={selectedIcon === 'saves' ? 'selected' : ''} aria-pressed={selectedIcon === 'saves'} onSelect={() => setSelectedIcon('saves')} onActivate={onSaves}><PixelIcon kind="folder"/><span>{t("我的存档")}</span></DesktopItem><DesktopItem className={selectedIcon === 'help' ? 'selected' : ''} aria-pressed={selectedIcon === 'help'} onSelect={() => setSelectedIcon('help')} onActivate={() => setHelp(true)}><PixelIcon kind="info"/><span>{t("使用说明")}</span></DesktopItem></nav><div className="desktop-watermark" aria-hidden="true">Earth Online<br /><span>Personal Recharge Edition</span></div>
 <div className={`xp-window ${maximized ? 'maximized' : ''}`} hidden={minimized}><div className="titlebar"><div className="window-title"><PixelIcon kind={page === 'result' ? 'folder' : 'computer'}/><span>{t("精神回血检测 —")}{title}</span></div><div className="window-controls"><button className="minimize" title={t("最小化")} aria-label={t("最小化窗口")} onClick={() => setMinimized(true)}><span /></button><button className="maximize" title={maximized ? t("还原") : t("最大化")} aria-label={maximized ? t("还原窗口") : t("最大化窗口")} aria-pressed={maximized} onClick={() => setMaximized(!maximized)}><span className={maximized ? 'restore' : ''}/></button><button className="close" title={t("关闭窗口（保留进度）")} aria-label={t("关闭窗口并保留进度")} onClick={() => setMinimized(true)}>×</button></div></div>
 <nav className="menu-bar" aria-label={t("应用菜单")}><button onClick={() => { onHome(); open(); }}>{t("首页")}<span>(F)</span></button><button onClick={onSaves}>{t("存档")}<span>(S)</span></button><button onClick={() => setHelp(true)}>{t("帮助")}<span>(H)</span></button><LanguageSwitch/><span className="menu-app">EARTH ONLINE</span></nav>{children}</div>
 {minimized && <div className="restore-hint"><PixelIcon /><p>{t("精神回血检测已收起。")}<br />{t("你的选择仍然保留。")}</p><button className="primary" onClick={open}>{t("打开检测窗口")}</button></div>}
 {help && <div className="dialog-backdrop" onClick={e => { if (e.target === e.currentTarget)
        setHelp(false); }}><section className="xp-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title"><div className="titlebar"><span id="help-title">{t("精神回血检测 — 使用说明")}</span><button className="dialog-close" autoFocus onClick={() => setHelp(false)} aria-label={t("关闭使用说明")}>×</button></div><div className="help-content"><PixelIcon kind="info"/><div><h2>{t("欢迎来到精神补给站")}</h2><p>{t("点击 Start Setup 开始 13 道题（含多选）。选好答案后点击“下一题”，也可以返回修改。")}</p><p>{t("答题进度保存在当前浏览器。窗口最小化或关闭后，双击桌面快捷方式或点击任务栏即可恢复（触屏轻点打开）；刷新后可选择继续上次测试。")}</p><p>{t("完成后可查看用户属性、保存 PNG 结果卡、分享链接或重新测试。在结果页点击“保存到我的存档”可保存独立历史记录；重新测试不会删除历史。我的存档会打开本地存档文件夹。")}</p><DataNotice enabled={researchEnabled}/></div></div><div className="dialog-actions"><button className="primary" onClick={() => setHelp(false)}>{t("确定")}</button></div></section></div>}
 {menu && <><button className="menu-dismiss" aria-label={t("收起开始菜单")} onClick={() => setMenu(false)}/><nav className="start-menu" aria-label={t("开始菜单")}><div className="start-user"><PixelIcon />{t("地球 Online 玩家")}</div><button onClick={open}><PixelIcon /><span>{t("精神回血检测")}<small>{t("打开当前窗口")}</small></span></button><button onClick={() => { onSaves(); setMenu(false); }}><PixelIcon kind="disk"/><span>{t("我的存档")}<small>{t("打开历史存档文件夹")}</small></span></button><button onClick={() => { if (hasProgress)
        onResume();
    else
        onHome(); open(); }}><PixelIcon /><span>{t("继续当前检测")}<small>{t("恢复答题进度或当前结果")}</small></span></button><button onClick={() => { setHelp(true); setMenu(false); }}><PixelIcon kind="info"/><span>{t("帮助和支持")}</span></button><div className="start-bottom">Personal Recharge Edition</div></nav></>}
 {extraWindows}
 <div className="taskbar"><button className={`start-button ${menu ? 'pressed' : ''}`} onClick={() => setMenu(!menu)} aria-expanded={menu}><span className="start-mark" aria-hidden="true"><i /><i /><i /><i /></span>start</button><button className={`task-button ${!minimized && savesState !== 'open' ? 'active' : ''}`} aria-label={t("恢复或最小化精神回血检测窗口")} aria-pressed={!minimized && savesState !== 'open'} onClick={() => { if (savesState === 'open') {
        onSavesState('minimized');
        setMinimized(false);
    }
    else
        setMinimized(!minimized); }}><PixelIcon /><span>{t("精神回血检测")}</span></button>{savesState !== 'closed' && <button className={`task-button saves-task ${savesState === 'open' ? 'active' : ''}`} aria-label={t("恢复或最小化我的存档窗口")} onClick={() => onSavesState(savesState === 'open' ? 'minimized' : 'open')}><PixelIcon kind="folder"/><span>{t("我的存档")}</span></button>}<div className="tray"><span className="tray-status" title={researchEnabled ? t("完成测试后自动记录选项与结果；存档保存在本地") : t("当前预览未启用统计上传")}>▰</span><span>{t("地球 Online")}</span><time>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</time></div></div></div>;
}
