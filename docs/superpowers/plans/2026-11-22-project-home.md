# 玄果项目主页 Implementation Plan

> **For agentic workers:** Use executing-plans to implement inline, with one whole-branch review at the end.

**Goal:** 在 aokorin.xyz 提供可管理背景、音乐、照片墙的玄果项目主页，并保留 /app 原应用。
**Architecture:** React 新主页与既有管理页共存；D1 保存有 revision 的公开配置；可选 R2 绑定保存和分发媒体。认证复用现有 ADMIN_TOKEN，不扩大公开管理接口。
**Tech Stack:** React 19, Vite, TypeScript, Cloudflare Workers/D1/R2.
**Spec:** docs/superpowers/specs/2026-11-22-project-home.md

## Global Constraints
- 已发布版本 2.1.3+119；先完成安装包交付，再做首页。
- 首页 /，原应用 /app，后台 /admin；旧哈希与漫画仓库接口保持可用。
- 沿用淡粉品牌与真实客户端图标，不虚构下载量/用户。
- 不读取、输出或提交生产管理密钥。
- R2 由用户开通后再连接；未连接时后端配置不受影响。

## Review Focus
- 原应用和旧收藏链接能否继续打开，localStorage 不丢失。
- 配置 URL、文件类型、文件大小、路径和未授权写入有边界。
- 音乐 Range 请求正确，浏览器自动播放被拒仍能手动播放。
- 无 R2 时错误可理解，编辑表单和公开页面仍可用。
- 多照片/长文字/手机宽度不会遮挡下载或后台保存按钮。

### Task 1: 配置与媒体后端
Files: src/projectConfig.ts; worker/project.ts; worker/projectMedia.ts; worker/http.ts; worker/index.ts; worker/migrations/0004_project_settings.sql; scripts/test-project-config.mjs; scripts/test-project-api.mjs.
- [ ] 先写失败的配置校验测试。
- [ ] 实现公开/管理员配置及 revision 冲突保护。
- [ ] 实现可选 R2 上传、列表、删除、公开 GET/HEAD 与 Range。
- [ ] 用本地 D1/R2 验证访问控制、持久化、上传和媒体读取。

### Task 2: 项目主页与管理界面
Files: src/pages/ProjectHome.tsx; src/components/ProjectSettings.tsx; src/project-home.css; src/main.tsx; src/pages/Platform.tsx; public/project-assets; index.html.
- [ ] 完成设计引用、品牌/布局/动效计划及 gate 初始化。
- [ ] 实现主页、下载、音乐、照片墙，真实客户端 UI 预览。
- [ ] 实现后台编辑、图片压缩和批量上传、素材复用/删除。
- [ ] 将旧应用迁至 /app，并处理旧哈希兼容。
- [ ] 运行布局与功能检查，记录实际限制。

### Task 3: 部署与存储连接
- [ ] 本地验证通过后，在远端只应用新增配置表。
- [ ] 发布主页/接口，验证公共下载和旧应用不回归。
- [ ] 给用户可查看的页面和后台后，再指导开通 R2。
- [ ] 连接专用桶并完成合成媒体上传/读取/删除验证。
- [ ] 推送文档与源码，最终复核。


## 最终决策更新（2026-11-22）
用户选择不启用可能要求账单的 R2。最终默认使用现有 D1 分块存储媒体，512KB/块，媒体库最多200文件/100MB；R2仅保留可选兼容，当前线上无R2绑定。上传、跨分块Range、HEAD、删除级联清理及实际后台编辑已在本地验证。
