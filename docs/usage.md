# 玄果 / Xghub

## 中文

玄果改编自 AIRzZ90 的 study-materials-fork，其上游为 Minireel 及 HGhub 贡献者开发的 HGhub。视频库的模块与追剧交互参考 Xanerix 的 GuoApp，使用独立实现。原项目和本版本按随附的 PolyForm Noncommercial 1.0.0 许可证分发。

1. 在 GitHub Releases 下载 Windows 安装包、Android APK 或网页 ZIP。Windows 选择 x64 安装程序，常见 Android 手机选择 ARM64。测试签名的 APK 须与已安装版本签名一致才可覆盖升级。
2. 原生客户端首页、分类和搜索使用原项目线路。打开 **视频库** 可导入 JSON 站源，或添加可直接播放的 HTTPS MP4 / M3U8 地址。
3. 网页 ZIP 解压后放到静态 HTTP 服务。可用 **视频库** 导入 JSON 并播放。站源格式见公开示例。
4. 追剧和观看进度保存在当前客户端或浏览器。仅添加你有权使用和分享的媒体地址。

## English

Xghub is adapted from AIRzZ90's study-materials-fork, based on HGhub by Minireel and the HGhub contributors. Xanerix's GuoApp inspired the source and watchlist workflows, which this project implements independently. This distribution retains the included PolyForm Noncommercial 1.0.0 license.

1. Download a Windows installer, Android APK, or web ZIP from GitHub Releases. Use the x64 installer on Windows and the ARM64 APK on most Android phones. Android requires a matching signing certificate to install an update over an existing copy.
2. The native home, categories, and search use the upstream service. Open **Video Library** to import a JSON source or add a directly playable HTTPS MP4 or M3U8 URL.
3. Extract the web ZIP and serve it over HTTP. Use **Video Library** to import and play your sources. The included example documents the JSON format.
4. Watchlists and playback progress are stored in the current client or browser. Add only media URLs you have permission to use and share.

[Xghub releases](https://github.com/Huaxun233/Xghub/releases) · [AIRzZ90 fork](https://github.com/AIRzZ90/study-materials-fork) · [HGhub](https://github.com/Minireel/HGhub) · [GuoApp](https://github.com/Xanerix/guoapp) · [JSON example](../public/video-source.example.json) · [License](../LICENSE)

### 通过地址导入 / Import from a URL

在客户端的「视频库」或网站管理后台填写玄果格式的 HTTPS JSON 地址，再点「从地址导入」。在后台确认预览后点「保存并发布」。配置链接应允许浏览器跨域访问。TVBox 仓库索引、Spider JAR 和 GuoApp JS 模块需另行适配。

Open Video Library or the site admin panel, paste an HTTPS URL for an Xghub JSON source, and select Import from URL. In the admin panel, review the draft and publish it explicitly. The server hosting the JSON must allow browser cross-origin requests. TVBox indexes, Spider JARs, and GuoApp JS modules require separate adapters.

### 同步仓库源 / Sync repository sources

打开「仓库站源」，选择配置文件并同步 [Huaxun233/tvbox](https://github.com/Huaxun233/tvbox) 的站点列表。可尝试逐页导入允许跨域访问的 HTTPS JSON 或 XML 站点中直接可播的 MP4 / M3U8。网站后台会先载入草稿，发布前请确认你有公开播放权限。需要 TVBox 插件的站点会显示兼容性提示。更新 fork 后，重新同步即可读取新的配置。

Open Repository Sources, choose a configuration file, and sync the site list from the fork. Import a page from a compatible HTTPS JSON or XML API with CORS and direct MP4 or M3U8 links. The website admin panel loads a draft for review. Confirm publication rights before posting. Sync again after updating the fork.
