# Just My Socks Mirror

一个基于 Vercel / Next.js 的 Just My Socks 镜像项目，用来生成可访问的订阅链接，并查看每月剩余额度。

## 项目背景

Just My Socks 官方订阅地址和部分 mirror 有时会出现无法访问的情况。

这个项目的目的就是提供一个 Vercel HTTP 代理，让你多一条路：

- 将 `/members/*` 请求代理到上游 Just My Socks 地址
- 在首页提供一个简单页面，输入 `service` 和 `id` 后即可：
  - 获取当前镜像订阅链接
  - 实时切换订阅参数
  - 查看本月流量使用进度
  - 查看下次额度重置日期
  - 生成订阅二维码，方便手机等设备扫码使用

## 功能特性

- `/members/*` 透明代理
- 上游地址支持通过环境变量配置
- 默认上游为 `https://justmysocks6.net`
- 首页输入 `service` / `id`
- 展示镜像订阅链接
- 支持以下参数实时切换：
  - 排除 Shadowsocks → `noss=1`
  - 排除 Vmess → `novmess=1`
  - 排除 IP 服务器 → `usedomains=1`
- 默认勾选“排除 IP 服务器”
- 查询并展示：
  - 本月已用流量
  - 剩余流量
  - 使用进度条
  - 下次重置日期（Los Angeles 时区语义）
- 一键复制订阅链接
- 弹窗展示当前订阅链接二维码

## 页面说明

访问首页 `/`：

1. 如果 URL 中没有 `service` 和 `id`，会先弹出输入框
2. 输入后跳转到：

```text
/?service=你的service&id=你的id
```

3. 页面会展示：
   - 当前镜像订阅地址
   - 流量进度和剩余额度
   - 重置日期
   - 订阅过滤选项
   - 复制按钮
   - 二维码按钮

## 代理说明

当前项目会代理所有 `/members/*` 请求，例如：

```text
/members/getsub.php?service=111&id=2222-3333-4444
/members/getbwcounter.php?service=111&id=2222-3333-4444
```

它们会被转发到上游：

```text
{JMS_UPSTREAM_BASE_URL}/members/...
```

默认上游：

```text
https://justmysocks6.net
```

## 环境变量

可配置环境变量：

```env
JMS_UPSTREAM_BASE_URL=https://justmysocks6.net
```

说明：

- 如果不配置，会默认使用 `https://justmysocks6.net`
- 建议只填写基础域名，不要手动带上 `/members`

可参考： [.env.example](file:///d:/Chaos/web/jms-msg/.env.example)

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制示例文件：

```bash
copy .env.example .env.local
```

然后按需修改 `.env.local`。

### 3. 启动开发环境

```bash
npm run dev
```

默认访问：

```text
http://localhost:3000
```

## 常用命令

开发：

```bash
npm run dev
```

类型检查：

```bash
npm run typecheck
```

静态检查：

```bash
npm run lint
```

生产构建：

```bash
npm run build
```

启动生产环境：

```bash
npm run start
```

## 部署到 Vercel

1. 将项目导入 Vercel
2. 配置环境变量：

```env
JMS_UPSTREAM_BASE_URL=https://justmysocks6.net
```

3. 部署完成后即可通过你的域名访问：

- `/` 首页
- `/members/getsub.php?...` 订阅代理
- `/members/getbwcounter.php?...` 流量查询代理

## 技术栈

- Next.js 16
- React 19
- TypeScript
- App Router
- Vercel

## 适用场景

这个项目适合以下场景：

- 官方订阅地址无法连通
- 官方 mirror 失效或不稳定
- 想自建一个固定域名来更新订阅
- 想在网页上直接查看剩余额度，而不是每次手动请求接口

## 免责声明

本项目只是一个自建镜像与查询工具，不提供代理服务本身。
你仍然需要拥有合法有效的 Just My Socks 账户与订阅参数（`service` / `id`）才能使用。
