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
