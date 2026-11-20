# 部署 HGhub 视频平台到 Cloudflare

Worker 同时提供网页与 API。D1 保存公开站源、本站账号和登录会话。管理后台在 `/#admin`，可以发布、编辑、下架站源和查看本站注册的用户名及注册时间。

网页首页展示后台发布的内容。视频库可按名称、分类或站源查找视频，支持选集、追剧和续播。追剧与观看进度保存在当前浏览器。视频由原视频地址提供，数据库存储目录和播放链接。发布前确认视频允许公开播放，HLS 源须允许网页跨域读取清单及分片。

## 本地预览

使用 Node.js 22 或 24 和 pnpm 10。运行以下命令安装依赖、生成网页和初始化本地数据库。

```powershell
pnpm install --frozen-lockfile
pnpm build:worker
pnpm exec wrangler d1 migrations apply DB --local
```

在项目根目录创建 `.dev.vars`，添加 `ADMIN_TOKEN` 和 `PASSWORD_PEPPER`，每行一个 `名称=随机值`。每个值分别用以下生成命令运行一次。Git 会忽略该文件，本地和线上应分别生成密钥。

```powershell
node -p "require('node:crypto').randomBytes(32).toString('hex')"
pnpm worker:dev
```

打开终端显示的本地网址。在后台输入 `ADMIN_TOKEN`，点 **载入站源示例**，再点 **保存并发布**。回首页可以验证播放。

## 先部署到 workers.dev

1. 验证 Cloudflare 账号邮箱，再在本机运行 `pnpm exec wrangler login` 并按提示授权。遇到账号选择时使用准备托管站点的账号。
2. 在 Cloudflare 后台开通 **Workers & Pages**，按提示设置 `workers.dev` 子域名。
3. 创建 D1 数据库。

   ```powershell
   pnpm exec wrangler d1 create hghub-video-db
   ```

4. 把命令返回的 `database_id` 填到 `wrangler.jsonc` 的 `d1_databases` 条目中。对线上数据库应用迁移并部署。

   ```powershell
   pnpm exec wrangler d1 migrations apply DB --remote
   pnpm worker:deploy
   ```

5. 分别生成两个新的随机值，按提示填入 Worker 的 Secrets。`ADMIN_TOKEN` 用来解锁管理后台，`PASSWORD_PEPPER` 是用于验证密码的服务端密钥，需要在后续发布时保留原值。

   ```powershell
   pnpm exec wrangler secret put ADMIN_TOKEN
   pnpm exec wrangler secret put PASSWORD_PEPPER
   ```

6. 打开部署命令返回的 HTTPS 地址，查看 `/api/health` 是否返回 `{"ok":true}`。在网页中注册一个测试账号，进入后台确认名单能看到该账号，再发布站源并用另一个浏览器会话验证访客端。

以后更新按顺序执行数据库迁移和 `pnpm worker:deploy`。只想更新视频时，直接在后台按站源 ID 编辑发布。

如果本工作区已有 `.wrangler/production.jsonc`，可直接沿用其中的线上绑定。

```powershell
pnpm build:worker
pnpm exec wrangler d1 migrations apply DB --remote --config .wrangler/production.jsonc
pnpm exec wrangler deploy --config .wrangler/production.jsonc
```

[邮箱验证](https://developers.cloudflare.com/fundamentals/setup/account/verify-email-address/) · [Worker 部署](https://developers.cloudflare.com/workers/get-started/guide/) · [D1 迁移](https://developers.cloudflare.com/d1/reference/migrations/) · [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)

## 买域名后绑定

1. 把域名添加到同一个 Cloudflare 账号。在注册商后台把域名的 Nameservers 改为 Cloudflare 分配的值，等待 Cloudflare 显示域名已激活。已有邮箱或网站时，先核对 Cloudflare 上的 DNS 记录。
2. 打开 **Workers & Pages → hghub-video → Settings → Domains & Routes**，选择 **Add → Custom domain**，输入要使用的域名，例如 `video.example.com`。Cloudflare 会创建对应 DNS 记录并签发 HTTPS 证书。
3. 在新网址检查 `/api/health` 和网页。只要绑定同一个 Worker，账号与站源仍使用同一套 D1 数据。域名变更后，访客需要在新域名重新登录。

域名首年和续费价格以注册商报价为准。Cloudflare 的免费额度和限制按实际套餐执行。中国大陆访问表现需要实测，Cloudflare 中国网络有单独的服务和备案要求。

[自定义域名](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/) · [Workers 限制](https://developers.cloudflare.com/workers/platform/limits/) · [D1 价格](https://developers.cloudflare.com/d1/platform/pricing/) · [Cloudflare 中国网络](https://developers.cloudflare.com/china-network/get-started/)
