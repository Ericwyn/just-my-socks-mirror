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
- 默认勾选"排除 IP 服务器"
- 查询并展示：
  - 本月已用流量
  - 剩余流量
  - 使用进度条
  - 下次重置日期（Los Angeles 时区语义）
- 一键复制订阅链接
- 弹窗展示当前订阅链接二维码
- **安全短链模式**：配置 `SEC_KEY` / `SEC_SERVICE` / `SEC_ID` 后，可通过 `/?key=...` 访问，订阅链接和额度接口均不暴露真实 `service` / `id`

## 页面说明

### 普通模式

访问 `/?service=xxx&id=yyy`，或直接访问 `/` 后在弹出框中输入参数。

### 安全短链模式

配置好 `SEC_KEY` / `SEC_SERVICE` / `SEC_ID` 后，访问：

```text
/?key={SEC_KEY}
```

页面会自动进入安全模式：

- 订阅链接指向 `/api/sublink?key=...`，不暴露真实 `service` / `id`
- 额度请求走 `/api/counter?key=...`
- 顶部显示"安全短链"标识，不展示真实参数

这个链接可以安全分享，不会泄露账户信息。

## 代理说明

### 通用代理

所有 `/members/*` 请求会被透明转发到上游：

```text
/members/getsub.php?service=111&id=2222-3333-4444
/members/getbwcounter.php?service=111&id=2222-3333-4444
```

转发目标：

```text
{JMS_UPSTREAM_BASE_URL}/members/...
```

### 安全短链接口

配置 `SEC_KEY` / `SEC_SERVICE` / `SEC_ID` 后，可使用以下接口，无需在 URL 中暴露真实参数：

**`/api/sublink?key={SEC_KEY}`**

代理到上游 `getsub.php`，自动注入 `SEC_SERVICE` / `SEC_ID`。支持透传 `usedomains`、`noss`、`novmess` 等参数：

```text
/api/sublink?key=xxx&usedomains=1&noss=1
```

**`/api/counter?key={SEC_KEY}`**

代理到上游 `getbwcounter.php`，自动注入 `SEC_SERVICE` / `SEC_ID`：

```text
/api/counter?key=xxx
```

key 不匹配时返回 `403`，未配置时返回 `500`。

## 环境变量

```env
JMS_UPSTREAM_BASE_URL=https://justmysocks6.net

SEC_KEY=
SEC_SERVICE=
SEC_ID=
```

| 变量 | 必填 | 说明 |
|------|------|------|
| `JMS_UPSTREAM_BASE_URL` | 否 | 上游基础地址，默认 `https://justmysocks6.net` |
| `SEC_KEY` | 否 | 短链接访问凭证，配置后才能使用 `/api/sublink`、`/api/counter` 及首页 key 模式 |
| `SEC_SERVICE` | 否（与 SEC_KEY 配套） | 真实 service 参数，由服务端注入，不对外暴露 |
| `SEC_ID` | 否（与 SEC_KEY 配套） | 真实 id 参数，由服务端注入，不对外暴露 |

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
