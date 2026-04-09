# 短链接代理功能实施计划

## 目标

在当前项目基础上新增一套基于 `key` 的短链接代理能力，避免在前端和订阅链接中暴露原始 `service` / `id`。

需要支持：

1. 新环境变量：`SEC_KEY`、`SEC_SERVICE`、`SEC_ID`
2. 新接口：`/api/sublink`
3. 新接口：`/api/counter`
4. 当访问首页 `/?key={SEC_KEY}` 且 key 正确时：

   * 页面订阅链接改为指向 `/api/sublink`

   * 页面额度请求改为走 `/api/counter`

   * 不再暴露原始 `service` / `id`
5. 其他现有基于 `service` / `id` 的模式保持兼容

***

## 现状分析

当前项目已有：

* 通用 `/members/*` 上游代理：[`route.ts`](file:///d:/Chaos/web/jms-msg/app/members/\[...path]/route.ts)

* 首页参数解析：[`page.tsx`](file:///d:/Chaos/web/jms-msg/app/page.tsx)

* 首页订阅链接与额度请求逻辑：[`home-client.tsx`](file:///d:/Chaos/web/jms-msg/app/ui/home-client.tsx)

当前行为：

* 首页依赖 `service` 和 `id`

* 订阅链接直接拼接 `/members/getsub.php?service=...&id=...`

* 额度请求直接访问 `/members/getbwcounter.php?service=...&id=...`

这意味着一旦把页面 URL 或订阅链接分享出去，原始 `service` / `id` 会暴露。

***

## 设计方案

### 一、环境变量设计

保留现有：

* `JMS_UPSTREAM_BASE_URL`

新增：

* `SEC_KEY`

* `SEC_SERVICE`

* `SEC_ID`

用途：

* `SEC_KEY`：用于校验用户访问 `/api/sublink`、`/api/counter`、以及首页 `/?key=...` 的短链接凭证

* `SEC_SERVICE` / `SEC_ID`：服务端代理上游时实际使用的真实参数

实现要求：

1. 服务端统一读取并 `trim()`
2. 对空字符串按未配置处理
3. 需要有一个统一的“安全配置读取函数”，避免在多个接口里重复校验
4. 若缺少必要配置，接口返回明确错误，避免静默失败

***

### 二、`/api/sublink` 接口设计

#### 入口规则

请求路径：

```text
/api/sublink?key=xxx&usedomains=1&noss=1...
```

该接口：

* 不再接收 `service` / `id` 作为对外入口参数

* 必须接收 `key`

* 允许透传其他 query 参数到上游，例如：

  * `usedomains`

  * `noss`

  * `novmess`

  * 未来其他兼容参数

#### 校验规则

1. 读取请求中的 `key`
2. 与环境变量 `SEC_KEY` 做严格一致比较
3. 不一致时直接返回 `401` 或 `403` 风格错误响应
4. 一致时继续代理

#### 上游映射规则

代理目标固定为：

```text
{JMS_UPSTREAM_BASE_URL}/members/getsub.php?service={SEC_SERVICE}&id={SEC_ID}
```

同时：

* 除 `key` 外，其余 query 参数全部继续透传到上游

* 若外部请求里带了 `service` / `id`，执行时应忽略或覆盖为服务端环境变量，避免用户篡改

#### 响应规则

* 状态码、响应头、响应体尽量原样返回

* 延续现有代理的 header 过滤策略

* 异常时返回清晰错误 JSON

***

### 三、`/api/counter` 接口设计

#### 入口规则

请求路径：

```text
/api/counter?key=xxx
```

#### 校验规则

* 与 `/api/sublink` 使用相同的 `SEC_KEY` 校验方式

#### 上游映射规则

代理目标固定为：

```text
{JMS_UPSTREAM_BASE_URL}/members/getbwcounter.php?service={SEC_SERVICE}&id={SEC_ID}
```

处理要求：

* 可以透传其他非敏感 query 参数，但最终 `service` / `id` 必须由服务端强制注入

* 不允许依赖外部传入的 `service` / `id`

#### 响应规则

* 返回上游 JSON

* 保持现有前端对 `monthly_bw_limit_b`、`bw_counter_b`、`bw_reset_day_of_month` 的兼容

* 异常返回明确错误

***

### 四、首页模式切换设计

首页需要同时支持两种模式。

#### 模式 A：原有显式参数模式

访问：

```text
/?service=xxx&id=yyy
```

行为保持不变：

* 订阅链接仍指向 `/members/getsub.php`

* 流量请求仍走 `/members/getbwcounter.php`

* 页面显示 `service` / `id`

#### 模式 B：新的短链接 key 模式

访问：

```text
/?key={SEC_KEY}
```

当 key 正确时：

* 页面进入“安全模式”

* 订阅链接改为：

```text
/api/sublink?key={SEC_KEY}
```

* 勾选项如 `usedomains` / `noss` / `novmess` 继续拼接到 `/api/sublink`

* 流量请求改为：

```text
/api/counter?key={SEC_KEY}
```

* 页面不再依赖 URL 中出现 `service` / `id`

* 页面展示上也不应泄露 `SEC_SERVICE` / `SEC_ID`

#### 非法 key 行为

若访问 `/?key=...` 但 key 不正确：

* 页面不能进入短链接模式

* 视实现方式可显示为未授权/无效 key 状态

* 不能回退暴露真实 `service` / `id`

***

### 五、前端改造点

重点改造文件：[`home-client.tsx`](file:///d:/Chaos/web/jms-msg/app/ui/home-client.tsx)

需要调整的逻辑：

1. 扩展首页参数来源

   * 现有读取 `service` / `id`

   * 新增读取 `key`
2. 增加模式判断

   * `service/id` 模式

   * `key` 模式
3. 重写订阅链接生成函数

   * 普通模式：输出 `/members/getsub.php?...`

   * key 模式：输出 `/api/sublink?key=...`
4. 重写额度请求地址生成逻辑

   * 普通模式：请求 `/members/getbwcounter.php?...`

   * key 模式：请求 `/api/counter?key=...`
5. 调整缺省表单展示逻辑

   * 当前缺少 `service/id` 时会弹输入框

   * 新逻辑应改为：只要既没有合法的 `key` 模式，也没有 `service/id` 模式，才弹输入框
6. 调整顶部展示信息

   * key 模式下不展示真实 `service` / `id`

   * 可以显示“安全短链模式”之类的标识
7. 二维码、复制按钮继续基于当前生成的订阅链接工作

***

### 六、服务端复用设计

为了避免重复代码，实施时建议：

1. 抽出通用的上游 URL 构建逻辑
2. 抽出通用的请求头透传与响应头过滤逻辑
3. 抽出通用的“代理到固定 members 接口”的方法
4. 抽出安全配置读取与 key 校验逻辑

这样可以让：

* `/members/*` 继续走通用透明代理

* `/api/sublink` 和 `/api/counter` 走受控代理

* 代码风格与当前项目保持一致

***

## 具体实施步骤

### 第 1 步：梳理并抽取代理公共能力

目标：减少后续两个新接口的重复逻辑。

执行内容：

1. 审视 [`route.ts`](file:///d:/Chaos/web/jms-msg/app/members/\[...path]/route.ts) 中已有的：

   * 上游地址解析

   * 请求头复制

   * 响应头过滤

   * 代理请求发送
2. 视当前项目结构，将这些能力保留原地或抽到可复用模块
3. 保证现有 `/members/*` 行为不变

### 第 2 步：新增安全配置读取逻辑

执行内容：

1. 增加对 `SEC_KEY`、`SEC_SERVICE`、`SEC_ID` 的统一读取
2. 统一处理空值与末尾空格
3. 提供明确错误分支：

   * 配置缺失

   * key 缺失

   * key 不匹配

### 第 3 步：实现 `/api/sublink`

执行内容：

1. 新增对应 App Router route 文件
2. 校验 `key`
3. 构造上游 `/members/getsub.php`
4. 强制写入 `service={SEC_SERVICE}`、`id={SEC_ID}`
5. 删除或覆盖来自用户的 `service` / `id`
6. 透传其余 query 参数
7. 返回上游结果

### 第 4 步：实现 `/api/counter`

执行内容：

1. 新增对应 App Router route 文件
2. 校验 `key`
3. 构造上游 `/members/getbwcounter.php`
4. 强制写入 `service={SEC_SERVICE}`、`id={SEC_ID}`
5. 返回上游 JSON

### 第 5 步：改造首页参数解析

重点文件：[`page.tsx`](file:///d:/Chaos/web/jms-msg/app/page.tsx)

执行内容：

1. 除 `service` / `id` 外，新增读取 `key`
2. 将 `key` 作为初始参数传给客户端组件
3. 维持现有兼容性

### 第 6 步：改造首页客户端逻辑

重点文件：[`home-client.tsx`](file:///d:/Chaos/web/jms-msg/app/ui/home-client.tsx)

执行内容：

1. 增加 `key` 相关状态与模式判断
2. 让订阅链接支持在两种模式间切换生成
3. 让额度接口请求地址支持在两种模式间切换
4. 调整“缺少凭证”的判断条件
5. key 模式下隐藏 `service` / `id` 展示
6. 确保复制、二维码、选项切换都兼容 key 模式

### 第 7 步：补充环境变量示例

重点文件：[`.env.example`](file:///d:/Chaos/web/jms-msg/.env.example)

执行内容：

1. 追加 `SEC_KEY`
2. 追加 `SEC_SERVICE`
3. 追加 `SEC_ID`
4. 保留 `JMS_UPSTREAM_BASE_URL`

### 第 8 步：补充文档说明

重点文件：[`README.md`](file:///d:/Chaos/web/jms-msg/README.md)

执行内容：

1. 增加新的环境变量说明
2. 增加 `/api/sublink`、`/api/counter` 用法说明
3. 增加 `/?key=...` 首页安全模式说明
4. 明确该模式用于缩短链接与隐藏真实参数

### 第 9 步：验证

实施完成后需要执行：

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`

并重点验证：

* `/?service=...&id=...` 旧模式仍可用

* `/?key=正确值` 新模式可用

* `/?key=错误值` 不会泄露真实参数

* `/api/sublink` 会透传 `usedomains`、`noss`、`novmess` 等参数

* `/api/counter` 返回结构与现有页面兼容

***

## 验收标准

满足以下条件即视为完成：

1. 项目支持配置：

   * `SEC_KEY`

   * `SEC_SERVICE`

   * `SEC_ID`
2. `/api/sublink?key=正确值` 能代理返回上游 `getsub.php` 结果
3. `/api/sublink` 会自动注入 `SEC_SERVICE` / `SEC_ID`
4. `/api/sublink` 会透传除 `key` 外的其他订阅参数
5. `/api/counter?key=正确值` 能代理返回上游 `getbwcounter.php` 结果
6. 首页访问 `/?key=正确值` 时：

   * 订阅链接使用 `/api/sublink`

   * 额度请求使用 `/api/counter`

   * 不显示真实 `service` / `id`
7. 旧的 `/?service=...&id=...` 模式仍然可用
8. lint、typecheck、build 全部通过

***

## 风险点与处理

1. **key 模式前端无法真正知道 key 是否正确**

   * 处理方式：以前端请求 `/api/counter` 的结果作为有效性反馈来源

   * 若返回 401/403，则页面展示“key 无效或未授权”错误

2. **用户手动在** **`/api/sublink`** **追加** **`service`** **/** **`id`** **试图覆盖**

   * 处理方式：服务端统一覆盖为 `SEC_SERVICE` / `SEC_ID`

3. **现有 UI 仍默认暴露 service/id**

   * 处理方式：在 key 模式下显式切换展示文案和顶部信息

4. **代理逻辑重复导致维护困难**

   * 处理方式：优先复用现有代理实现中的公共逻辑

***

## 执行假设

1. 新增接口使用 Next.js App Router Route Handler 实现
2. `/api/sublink` 与 `/api/counter` 只需要支持当前页面所需的 HTTP 方法，优先支持 `GET`
3. key 模式下首页只需支持展示和使用，不要求用户再输入 `service` / `id`
4. 旧模式保留，作为兼容和调试入口

