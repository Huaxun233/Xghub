<div align="center">
  <img src="public/logo.svg" width="112" height="112" alt="玄果 Xghub 软件图标" />
  <h1>玄果 · Xghub</h1>
  <p>面向 Windows、Android 和浏览器的视频播放器与片库。</p>
  <p><a href="https://aokorin.xyz">在线体验</a> · <a href="https://github.com/Huaxun233/Xghub/releases/latest">下载安装包</a> · <a href="docs/usage.md">中英文完整说明</a></p>
</div>

网页版已提供影视、漫画、书架和账号入口，详见 [网页版使用与兼容性 / Web guide](docs/web-platform.md)。

## 关于玄果

玄果基于 Tauri 2、Rust 和 React，提供视频浏览、分类搜索和个人片单。Windows 与 Android 客户端支持原项目线路，也可以导入自己的 JSON 站源或添加 HTTPS 视频直链。在线版提供独立的邀请制账号和管理后台，服务器部署源码见 Cloudflare 分支。

- **浏览与播放**　从侧边栏打开首页、分类、搜索和「我的」，支持 MP4、HLS（M3U8）和选集。
- **个人片单**　收藏追剧与续播进度保存在当前设备或浏览器，可以切换淡粉浅色主题和深色主题。
- **发布与账号**　在线版后台可维护站源、生成和停用邀请码，并查看账号使用的邀请码。[Cloudflare 部署指南](https://github.com/Huaxun233/Xghub/blob/codex/cloudflare-video-platform/docs/cloudflare.md)

## 安装和使用

| 平台 | 操作 |
| --- | --- |
| Windows | 从 [Releases](https://github.com/Huaxun233/Xghub/releases) 下载 x64 安装程序，也可以使用便携 ZIP。 |
| Android | 大多数手机选 ARM64 APK。覆盖安装要求新旧包的签名一致。 |
| 静态网页 | 解压网页 ZIP，用静态 HTTP 服务打开。在首页导入 [JSON 站源](public/video-source.example.json) 或添加 HTTPS 视频直链。 |
| 在线网页 | 打开 [玄果](https://aokorin.xyz)，从侧边栏浏览内容。新账号注册需管理员提供邀请码。 |

原生客户端可在侧栏打开 **视频库** 导入站源。同一站源更新时，保留站源 ID 可延续追剧与观看记录。仅添加你有权使用和分享的媒体，HLS 服务器需允许播放器读取播放清单及分片。

## English

Xghub is a video player and library for Windows, Android, and the browser. Use the sidebar to browse categories, search, open your watchlist, and switch between light and dark mode.

1. Download the x64 installer or portable ZIP for Windows, or the ARM64 APK for most Android phones. Android updates require the same signing certificate. [Downloads](https://github.com/Huaxun233/Xghub/releases)
2. Open **Video Library** in the native app to import a [JSON source](public/video-source.example.json) or add an HTTPS MP4 or M3U8 link. For the static web ZIP, extract it, serve it over HTTP, and import a source from the home page.
3. Use the hosted site to browse published sources. New accounts require an invitation code. Watchlists and playback progress are stored on the current device or browser. [Hosted site](https://aokorin.xyz)

## 本地开发 / Development

使用 Node.js 22、pnpm 10、Rust 1.90+ 和目标平台所需的 Tauri 工具链。Use Node.js 22, pnpm 10, Rust 1.90+, and the Tauri toolchain for your target platform.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm app:dev
pnpm build:web
```

当前版本依据 [PolyForm Noncommercial 1.0.0](LICENSE) 分发。第三方媒体的使用权限由相应权利人授予。

<sub>转载与改编出处 / Credits: adapted from <a href="https://github.com/AIRzZ90/study-materials-fork">AIRzZ90/study-materials-fork</a>, based on <a href="https://github.com/Minireel/HGhub">Minireel/HGhub</a>. Video library workflows were inspired by <a href="https://github.com/Xanerix/guoapp">Xanerix/GuoApp</a> and implemented independently.</sub>
