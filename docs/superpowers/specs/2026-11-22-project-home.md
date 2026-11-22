software / 玄果开源客户端项目展示站

# 玄果项目主页设计

## 已确认的范围
- 新安装包优先：2.1.3+119 已发布，三 APK 和 Windows 安装/便携包已核对摘要及证书。
- aokorin.xyz 首页改为项目展示站；影视漫画功能保留在 /app，兼容旧的 /#comics 等链接。
- 项目主页显示真实软件图标、项目介绍、2.1.3 下载、网页版、作者 GitHub。
- 后台可修改标题、介绍、背景颜色/图片、背景音乐和照片墙；支持直接上传本地文件。
- 复用现有 Cloudflare Worker、D1 和管理员验证。R2 尚未开通，先做好接口/页面，最后由用户在控制台开通再绑定。

## 结构与数据
- / 为项目展示；/app 为原应用；/admin 保留现有管理页并添加项目主页设置。
- GET /api/project：只返回公开展示配置。
- GET/PUT /api/admin/project：复用 ADMIN_TOKEN，带 revision 避免覆盖其他编辑。
- GET/POST /api/admin/project/media：管理员素材列表与上传；DELETE .../:id 删除未引用素材。
- GET/HEAD /api/project/media/:id：公开展示已上传的图片与音乐，支持单段 Range。
- 新增 D1 project_settings 单例表；只增表，不删除或修改既有片库、账号和书架数据。
- R2 仅绑定项目专用桶，key 为 project/UUID.ext；限制 MIME、大小、条目数和项目总占用。未绑定时配置/链接仍可使用，上传显示未开通。
- 图片由浏览器压缩、去除元数据；音乐保留音频。后台显式保存后才改变主页配置。

## 设计事实与文案
- 品牌为玄果 Xghub，真实图标使用客户端 scripts/brand_icon.svg，淡粉色来自已确认品牌。
- 主标题：玄果，影视与漫画客户端。主操作：下载客户端；次操作：打开网页版。
- 真实事实：Android、Windows、网页；已发布 2.1.3；GPL-3.0 客户端改编自 Xanerix/guoapp 和 Kyosee/VeneraX。
- 不承诺全部第三方源可用。网页不具有客户端完整原生模块运行时。
- Voice: plain-technical Chinese; factual, brief, no invented users/downloads/reviews.
- 参考 https://html3.cc/666 当前仅返回托管站外壳，未能观察实际展示内容；实现独立的玄果设计，不复制对方素材或代码。

## 兼容与验证
- localStorage/cookie 仍在同一域名，移动页面路径不改用户存储 key。
- 旧哈希链接进入 /app；/admin、现有 /api 与漫画仓库地址保持兼容。
- 核验配置校验、未授权写入、冲突写入、真实本地 D1/R2 上传与 Range、缺存储情况。
- 核验手机版/Windows 公共下载、首页/应用导航、键盘、320/390/768/820/1024/1440 布局。
- 上传正式可用的最后一步依赖用户开通 R2；不得代填支付信息或自行接受账单条款。
- 回滚可恢复旧 Worker/前端版本；新表和 R2 文件保留，不破坏原应用数据。


## 最终决策更新（2026-11-22）
用户选择不启用可能要求账单的 R2。最终默认使用现有 D1 分块存储媒体，512KB/块，媒体库最多200文件/100MB；R2仅保留可选兼容，当前线上无R2绑定。上传、跨分块Range、HEAD、删除级联清理及实际后台编辑已在本地验证。
