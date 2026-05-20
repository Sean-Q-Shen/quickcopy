<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/Sean-Q-Shen/quickcopy/blob/main/images/quickcopy_home.png" />
</div>

# 功能介绍

*视觉与交互架构*：升级至高对比度的干净浅色模式 (Slate Theme)，构建了支持跨组平滑拖拽重排的响应式网格视图，确保快速、直观的片段归类与整理。
*安全加密沙箱*：内置基于本地会话的高级主密码加解密引擎。针对敏感密码片段，启用高强度对称加密存储，页面直接隐藏明文；结合会话锁屏机制，实现安全解锁后自动解密打入本地剪贴板，全程零网络外发。
*三重数据灾备引擎*：搭载强大的存储机制：支持标准 LocalStorage 存储；支持基于原生 File System API 的免刷新本地跨进程热同步；新增多点自动冷备快照（每日首次访问自动备份与留存，内置 10 份历史回卷面板）。
*瞬时检索与管理*：顶栏提供全局搜寻入口，毫秒级跨分类匹配并高亮检索词，配合一键导入/导出 JSON 配置文件的能力，提供极客友好且可靠的运维工具体验。

# 本地运行

**Prerequisites:**  Node.js

1. 安装依赖:
   `npm install`
2. 运行:
   `npm run dev`
