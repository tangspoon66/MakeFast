# MakeFast 部署文档

本文档面向 `makefast.cn` 的小型单机长期运行部署。推荐先用 Docker Compose 部署到一台 Linux 服务器，后续课程资源变多时再把大文件迁移到对象存储。

## 1. 部署前检查

### 服务器建议

- 入门可用：2 核 4 GB，系统盘 60 GB 起。
- 更稳妥：2 核 8 GB，系统盘 80 GB 起。
- 编译 ESP 项目会瞬时吃 CPU 和内存，低配机器必须保持 `COMPILE_CONCURRENCY=1`。
- 课程资料、模型、固件文件会持续增长，长期运营建议准备对象存储或定期备份。

### 必备条件

- Linux 服务器，建议 Ubuntu 22.04 / 24.04 LTS。
- 域名 `makefast.cn` 已解析到服务器公网 IP。
- 安装 Docker 和 Docker Compose v2。
- 80、443 端口已在云厂商安全组和系统防火墙放行。
- 准备让域名先解析到服务器。生产配置使用 Caddy 自动申请免费 HTTPS 证书，公网 Web Serial 烧录必须使用 HTTPS，HTTP 下只有 `localhost` 可用。

## 2. 获取代码

```bash
git clone <your-repo-url> makefast
cd makefast
```

生产部署使用：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

不要用根目录的 `docker-compose.yml` 作为生产配置，它是开发环境入口。

## 3. 配置环境变量

在项目根目录创建 `.env`，可以从后端示例复制：

```bash
cp backend/.env.example .env
```

最低生产配置：

```bash
ENV=production
ALLOWED_ORIGINS=https://makefast.cn
COOKIE_SECURE=true

ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$12$replace_with_bcrypt_hash
JWT_SECRET_KEY=replace_with_random_secret
JWT_EXPIRE_HOURS=2

REDIS_URL=redis://redis:6379/0
COMPILE_CONCURRENCY=1
COMPILE_QUEUE_TIMEOUT_SECONDS=2

APP_DATA_PATH=/app/data
OPS_DB_PATH=/app/data/ops.sqlite3
FIRMWARE_STORAGE_PATH=/opt/firmware
TEMPLATE_STORAGE_PATH=/opt/templates

OBJECT_STORAGE_ENABLED=false
```

生成 JWT 密钥：

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

生成管理员密码哈希：

```bash
cd backend
python3 -m pip install passlib bcrypt
python3 scripts/init_admin.py
```

把脚本输出的 bcrypt 哈希填入 `ADMIN_PASSWORD_HASH`。

## 4. 免费 HTTPS 证书

本项目生产配置已内置 Caddy。Caddy 会在容器启动后为 `makefast.cn` 自动申请免费证书，并自动续期。默认会使用 Let's Encrypt；必要时也可使用 ZeroSSL 作为自动证书来源。

你不需要购买 SSL 证书，也不需要手动把证书文件放进项目。只要满足：

- `makefast.cn` 已解析到这台服务器公网 IP。
- 服务器安全组和防火墙已放行 80、443。
- 没有其他程序占用服务器的 80、443 端口。
- Docker Compose 使用 `docker-compose.prod.yml` 启动。

生产流量路径：

```text
浏览器 https://makefast.cn
  -> Caddy 自动 HTTPS
  -> Docker 内部 Nginx
  -> frontend / backend / redis
```

如果你还没完成域名解析，Caddy 无法申请证书。可以先在服务器上完成 Docker 构建，但正式访问和烧录要等 DNS 生效后再验证。

## 5. 启动服务

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

查看日志：

```bash
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f caddy
docker compose -f docker-compose.prod.yml logs -f nginx
```

访问：

- 用户端：`https://makefast.cn`
- 管理后台：`https://makefast.cn/admin`

生产环境默认关闭 `/api/docs`。临时排查接口时可以设置 `ENABLE_API_DOCS=true` 后重启后端，排查完再关闭。

## 6. 数据和存储

Docker 卷：

- `app_data`：SQLite 运行统计、反馈、备份。
- `template_data`：课程代码、课程资源包、缩略图。
- `firmware_data`：发布固件和编译缓存。
- `libraries`：Arduino CLI、ESP core、预装库缓存。
- `redis_data`：Redis AOF 数据。

SQLite 当前用于运行统计、反馈、备份状态等轻量数据。课程元数据和固件元数据仍主要以文件目录和 JSON 保存，适合小型单机；后续如果多管理员、高并发或数据量明显增长，再整体迁移到数据库会更合适。

## 7. 对象存储建议

小型单机可以先关闭对象存储：

```bash
OBJECT_STORAGE_ENABLED=false
```

当课程包、模型、缩略图、固件文件增多后，建议迁移到腾讯 COS、阿里 OSS 或 Cloudflare R2。对象存储适合放大文件，服务器本地保留 SQLite、配置和必要缓存。

S3 兼容配置示例：

```bash
OBJECT_STORAGE_ENABLED=true
OBJECT_STORAGE_BUCKET=makefast-assets
OBJECT_STORAGE_ENDPOINT=https://cos.ap-guangzhou.myqcloud.com
OBJECT_STORAGE_REGION=ap-guangzhou
OBJECT_STORAGE_ACCESS_KEY_ID=replace_me
OBJECT_STORAGE_SECRET_ACCESS_KEY=replace_me
OBJECT_STORAGE_PUBLIC_BASE_URL=https://assets.makefast.cn
OBJECT_STORAGE_PREFIX=makefast
```

注意：不要把对象存储密钥提交到 Git。建议使用只允许指定 bucket 和 prefix 的最小权限密钥。

## 8. 备份和恢复

### 手动备份 Docker 卷

```bash
mkdir -p backups
docker run --rm -v makefast_app_data:/data -v "$PWD/backups:/backup" alpine tar czf /backup/app_data.tgz -C /data .
docker run --rm -v makefast_template_data:/data -v "$PWD/backups:/backup" alpine tar czf /backup/template_data.tgz -C /data .
docker run --rm -v makefast_firmware_data:/data -v "$PWD/backups:/backup" alpine tar czf /backup/firmware_data.tgz -C /data .
```

### 管理后台备份

管理后台的系统配置页支持创建和下载 SQLite 备份。它只备份运行统计数据库，不包含课程资源包和固件文件，所以仍然需要定期备份 Docker 卷或对象存储。

### 恢复原则

1. 先停止服务：

```bash
docker compose -f docker-compose.prod.yml down
```

2. 恢复卷数据。
3. 确认 `.env`、域名解析、对象存储配置仍然正确。
4. 启动服务并检查后台统计、课程列表、烧录流程。

## 9. 安全检查清单

- `JWT_SECRET_KEY` 已使用强随机值。
> Security note: obsolete default-login instructions omitted; use locally generated credentials.
- `COOKIE_SECURE=true` 且网站使用 HTTPS。
- `ALLOWED_ORIGINS` 只包含生产域名，不使用 `*`。
- 云安全组只放行 80、443、必要 SSH 端口。
- Redis 不暴露公网，只在 Docker 网络内访问。
- `/api/docs` 在生产环境关闭。
- 管理后台只给可信管理员使用，管理员密码足够长。
- 定期更新系统、Docker 镜像和依赖。
- 定期备份 `.env`、Docker 卷、对象存储数据。
- 课程锁定资源已在后端校验，不能只依赖前端隐藏。
- AI 导入自定义积木时不要导入包含 `fetch`、`eval`、`Function`、`localStorage`、`window` 等危险 API 的代码。

## 10. 性能建议

- 小型服务器保持 `COMPILE_CONCURRENCY=1` 和后端 `--workers 1`。
- Redis 已用于运行态限流和状态，保持启用。
- Nginx 已对登录、编译、AI 接口做限流。
- 课程资源和固件下载可由 Nginx 缓存，体积增长后转对象存储/CDN。
- `client_max_body_size` 当前为 500 MB，与后端上传上限一致；如果服务器磁盘较小，可以改成 200 MB 并同步调整业务限制。
- 定期清理不再使用的固件、课程包和旧备份。
- 监控后台“存储占用、编译失败率、烧录失败率、用户反馈”。

## 11. 常见故障

### 管理员登录失败

- 检查 `.env` 是否被 `docker-compose.prod.yml` 读取。
- 重新生成 `ADMIN_PASSWORD_HASH`。
- 确认浏览器访问的是 HTTPS，且 `COOKIE_SECURE=true`。
- 查看后端日志：

```bash
docker compose -f docker-compose.prod.yml logs -f backend
```

### 页面能打开但无法连接开发板

- 确认使用 Chrome / Edge。
- 确认访问地址是 `https://makefast.cn`，不是 HTTP。
- 确认浏览器弹出了串口授权窗口。

### 编译卡住或服务器变慢

- 确认 `COMPILE_CONCURRENCY=1`。
- 查看服务器内存和 CPU。
- 查看后端日志里是否有 Arduino CLI 下载库或工具链失败。

### 上传课程资源失败

- 检查 Nginx `client_max_body_size`。
- 检查 Docker 卷磁盘空间。
- 如果文件很多或很大，优先考虑对象存储。

## 12. 更新发布

### 服务器上拉取更新

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f backend
```

更新前建议先做一次卷备份。若更新涉及环境变量、域名或反向代理，重启后务必验证管理后台登录、课程列表、编译、烧录、反馈提交。

### 本地代码直传到服务器

如果服务器不是直接从 Git 仓库拉代码，而是从本机同步，使用 `rsync` 时必须排除线上配置和数据目录，避免覆盖 `.env`、课程资源和 Docker 卷数据：

```bash
rsync -az --delete \
  --exclude '.git' \
  --exclude '.env' \
  --exclude 'backend/.env' \
  --exclude 'node_modules' \
  --exclude 'frontend/node_modules' \
  --exclude 'frontend/dist' \
  --exclude 'backend/venv' \
  --exclude 'data' \
  --exclude 'firmware_storage' \
  --exclude 'template_storage' \
  ./ root@your-server:/opt/makefast/
```

同步后必须重建服务，而不是只刷新浏览器：

```bash
ssh root@your-server
cd /opt/makefast
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

如果只更新前端，后端接口不会变化；如果只更新后端，浏览器仍可能拿到旧页面。涉及 API、服务配置、课程库、语音识别时，建议前端和后端一起重建。

### 上线后快速验收

```bash
curl -I https://makefast.cn/
curl -sS https://makefast.cn/api/health
curl -sS 'https://makefast.cn/api/templates?page_size=5'
curl -I https://makefast.cn/api/admin/service-config
```

预期结果：

- 首页返回 `200`。
- `/api/health` 返回健康状态。
- `/api/templates` 返回课程列表 JSON。
- `/api/admin/service-config` 未登录时应返回 `401` 或 `403`，不能是 `404`。如果是 `404`，说明后端容器仍是旧版本。

### 浏览器缓存导致的旧页面

如果无痕窗口正常、普通窗口异常，通常是普通窗口仍在使用旧前端资源。优先处理：

1. Chrome/Edge 打开开发者工具。
2. 进入 Application / Storage。
3. 点击 Clear site data。
4. 重新打开 `https://makefast.cn`。

生产前端已经对 `index.html` 设置 `no-cache`，后续版本更新时浏览器会更容易拿到新的入口文件；带 hash 的 JS/CSS 静态资源仍可长期缓存。
