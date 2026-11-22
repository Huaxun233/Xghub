# 项目首页管理 / Project homepage administration

- 项目首页：`https://aokorin.xyz/`
- 原影视、漫画网页：`https://aokorin.xyz/app`
- 独立后台：`https://aokorin.xyz/admin`，使用原管理密钥。

在「项目首页管理」修改名称、介绍、浅色/深色主题、背景颜色和图片、音乐、照片墙，点击「保存并发布首页」。图片会在浏览器缩小至最长边 2400 像素并转成 WebP；每次最多上传 4 个文件，照片墙最多 24 张。音乐最大 15MB，访客点击后播放。删除照片配置不会立即删除文件；保存后可在媒体库清理未使用文件。正在使用的文件不能删除。

## 文件存储 / File storage

默认直接使用现有 Cloudflare D1 数据库分块保存媒体，不需要启用 R2 或填写付款信息。媒体库限制 200 个文件、总计 100MB。图片最大 5MB、音乐最大 15MB；这是小型站长展示页的媒体库，不适合大量视频上传。服务仍受 Cloudflare 免费额度限制，达到额度时服务可能暂不可用。

部署前应用 D1 迁移 `worker/migrations/0004_project_settings.sql`。已有账号和片库不变。可选 R2 绑定继续兼容，但当前部署不使用它。

接口：公开 `GET /api/project`；管理 `GET/PUT /api/admin/project`；媒体库 `GET/POST /api/admin/project/media`、`DELETE /api/admin/project/media/:id`；文件读取 `GET/HEAD /api/project/media/:id`。管理接口沿用 Bearer 管理密钥、来源检查和频率限制。保存携带 revision，冲突返回 409。

## English

The root URL is the project showcase; the video/comics web app remains at `/app`, and administration remains at `/admin` with the existing admin key. Edit the title, introduction, theme, background, music and gallery in **Project homepage administration**, then save to publish.

Local image uploads are resized to a maximum 2400px edge and encoded as WebP. Upload up to four files per request; the gallery supports 24 photos. Music supports files up to 15MB and starts after a visitor clicks Play. Removing a photo from the gallery does not delete its uploaded file. Save first, then remove unused files from the media library. Files referenced by the saved configuration cannot be deleted.

Uploads use the existing Cloudflare D1 database with chunked media storage by default; no R2 activation or payment details are needed. The library is capped at 200 files / 100MB total and remains subject to Cloudflare free-tier quotas. This is a small project gallery, not video hosting. An optional `PROJECT_MEDIA` R2 binding remains compatible but is not used by this deployment. Apply D1 migration `0004_project_settings.sql` before deployment. Keep admin credentials and private production configuration out of Git.

Rollback: deploy the previous Worker/frontend version. The additive settings table and private bucket may remain; existing account, catalog and reading data are unaffected.
