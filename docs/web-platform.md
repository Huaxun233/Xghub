# 网页版使用与兼容性

线上地址：https://aokorin.xyz 。后台单独位于 /admin，管理接口需要管理员令牌。

影视：共享片库由后端提供，支持分类、搜索、收藏和播放进度。HTTPS MP4/HLS 能否播放取决于源站响应、跨域策略和浏览器编解码支持。爱看机器人详情提供刷新线路，但上游源站当前连接失败；不能保证旧目录链接可播放。

漫画：侧栏进入漫画。可导入 JSON 目录或从 HTTPS 地址导入；JSON 包含 version:1、id、name、comics，每部漫画包含 id、title、chapters，每章包含 id、title、pages（HTTPS 图片 URL）。本机保存书架、导入目录和章节进度。

JavaScript 插件：使用独立插件入口导入基础 VeneraX ComicSource 脚本，支持 search.load、comic.loadInfo 和 comic.loadEp。当前适配基础 Comic/ComicDetails、HTTPS 文本/字节请求、HTML 选择器、UTF-8/Base64/十六进制、MD5/SHA/HMAC、搜索选项及翻页；插件初始化和源数据按插件 key 保存在本机。源站须允许跨域。尚不支持原生图片变换、完整 AES/RSA 等加密接口、验证码及完整源账号设置。插件脚本保存在当前浏览器，刷新后恢复，可移除；已读取的章节可保存到本机目录和书架。不要把基础插件测试通过理解为所有 VeneraX 插件兼容。

数据：网页漫画目录、书架和进度保存在当前浏览器，目录与书架支持登录后手动上传/合并云端数据；章节进度也随手动上传/合并同步，同一漫画使用云端章节进度。清除网站数据会删除本机数据。服务端账号与邀请码继续使用 Cloudflare D1；管理密钥只保存在服务端和用户本地私密文件。

验证：test-web-comics.mjs 验证导入、图片解码、章节进度、书架刷新及手机宽度；test-web-comic-plugins.mjs 使用客户端同协议的合成插件验证执行桥；test-web-production.mjs 检查真实域名导航、健康、账号与管理员隔离。测试夹具不会写入生产数据库。

上线状态：网站与基础漫画阅读已部署；完整原生源兼容、完整插件兼容、旧影视源恢复尚未完成。

## English

Open https://aokorin.xyz and choose Videos or Comics in the sidebar. Comics supports JSON catalog import, image reading, a local bookshelf, chapter progress, and manual account cloud sync. JavaScript ComicSource plugins run in a separate worker with basic search, details, chapter, HTML, network and hash helpers. Plugin settings/data remain local to this browser. Native-only APIs and sources that deny browser access are not fully supported. Existing upstream video links may be unavailable; deployment does not restore those sources.

内置漫画源仓库：在「漫画 → JavaScript 漫画插件」点击「同步内置仓库」，选择源后点击「安装选中漫画源」。默认索引为 https://cdn.jsdelivr.net/gh/venera-app/venera-configs@latest/index.json 。只安装选中的插件，不会自动安装全部源；可用性仍受浏览器接口和跨域限制。

Built-in repository: open Comics → JavaScript plugins, sync the built-in repository, select a source and install it. The default index is the Venera configs jsDelivr URL above. Installation does not guarantee browser compatibility.


网页侧栏提供 Android ARM64、Windows 安装包直链和「作者主页」GitHub 按钮。漫画页更名为玄果漫画，标注基于 VeneraX。仓库支持全选、多选、批量安装与逐项结果；多个已安装插件保存在本机并可切换。

The sidebar provides Android and Windows installer links and the author GitHub profile. Xghub Comics credits VeneraX and supports repository multi-select, batch installation, per-source results and switching between locally saved plugins.
