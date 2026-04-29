# diffdeck CLI 新增命令文档

> 分支：`feature/command` | 创建时间：2026-04-29

---

## 新增文件

| 文件 | 说明 |
|---|---|
| `src/utils/config.ts` | 配置文件读写、Profile 解析与 token 解析 |
| `src/utils/platform.ts` | PR URL 解析、平台自动识别、HTTP diff 获取 |
| `src/commands/config.ts` | `config` 命令实现 |
| `src/commands/pull-diff.ts` | `pull-diff` 命令实现 |

## 修改文件

| 文件 | 说明 |
|---|---|
| `src/index.ts` | 新增两个 register 调用 |

---

## 1. config 命令

### 存储位置
`~/.diffdeck/config.json`

### 文件结构
```json
{
  "default": "gh",
  "profiles": {
    "gh": { "url": "https://github.com", "authToken": "ghp_xxx" },
    "gl": { "url": "https://gitlab.com", "authToken": "glpat_xxx" }
  }
}
```

### 子命令

#### `diffdeck config set`
```bash
diffdeck config set --url <url> --auth-token <token> [--profile <name>] [--make-default]
```
- `--profile`：profile 名称，默认为 `default`
- `--make-default`：将此 profile 设为默认
- 将配置写入 `~/.diffdeck/config.json`（目录不存在时自动创建）

#### `diffdeck config get`
```bash
diffdeck config get [--profile <name>]
```
- 输出 JSON 到 stdout，token 被脱敏（首 4 + `*****` + 末 4）

#### `diffdeck config list`
```bash
diffdeck config list
```
- 每个 profile 名称一行输出到 stdout，默认 profile 标注 `(default)`

---

## 2. pull-diff 命令

### 用法
```bash
diffdeck pull-diff <pr_url> [output]
```

### 参数说明
| 参数 | 说明 |
|---|---|
| `pr_url` | GitHub / GitLab / Gitea 的 PR/MR 页面 URL |
| `output` | 省略或 `-` → 输出到 stdout；指定文件名 → 写入文件 |

### 平台自动识别
| 平台 | URL 路径特征 | API 端点 |
|---|---|---|
| GitHub | `/pull/{number}` | `https://api.github.com/repos/{owner}/{repo}/pulls/{n}` |
| GitHub Enterprise | 同上（host != github.com） | `https://{host}/api/v3/...` |
| GitLab | `/.../.../-/merge_requests/{iid}` | `https://{host}/api/v4/projects/{id}/merge_requests/{iid}/diffs?view=raw` |
| Gitea | `/pulls/{number}` | `https://{host}/api/v1/repos/{owner}/{repo}/pulls/{n}` |

> 平台由 URL **路径形状**决定，不依赖 hostname，适用于私有化部署。

### 认证优先级
1. 命令行 `--profile <name>` 显式指定
2. 与 PR host 匹配的 profile（根据配置中 `url` 的 hostname 对应）
3. Well-known 名称：`github` → github.com，`gitlab` → gitlab.com
4. Default profile
5. 环境变量 `DIFFDECK_TOKEN`
6. 无 token（允许尝试访问公开仓库）

### HTTP 错误提示
| 状态码 | 提示 |
|---|---|
| 401 | 运行 `diffdeck config set` 重新设置 token |
| 403 | Token 权限不足，缺少 repo 读权限 |
| 404 | URL 错误或 token 无权访问私有仓库 |
| 422 | PR/MR 为空，没有 diff |
| 429 | 平台限速，等待后重试 |

---

## 3. 工具模块设计

### `utils/config.ts`

```typescript
readConfig(): Promise<DiffdeckConfig | null>   // null 表示首次使用
writeConfig(config): Promise<void>             // 原子写入（tmp+rename）
upsertProfile(name, profile, makeDefault?): Promise<void>
resolveProfile(prUrl: URL, explicit?): Promise<ResolvedProfile | null>
resolveToken(profile): string | null           // profile.token ?? DIFFDECK_TOKEN
```

Profile 解析优先级见上方「认证优先级」。

### `utils/platform.ts`

```typescript
parsePrUrl(raw: string, profileUrl?: string): ParsedPrUrl
fetchDiff(parsed: ParsedPrUrl, token: string | null): Promise<string>
```

`fetchDiff` 支持三个平台的响应格式：
- **GitHub**：`Accept: application/vnd.github.v3.diff` → 直接返回 raw diff 文本
- **GitLab**：JSON 数组 `[{ diff: "..." }]` → 取所有 `.diff` 字段拼接
- **Gitea**：JSON 对象 `{ patch: "..." }` → 取 `.patch` 或 `.diff` 字段

---

## 4. 已知限制 / 后续改进项

- [ ] cac 框架的 `"config set"` 空格子命令在部分环境下 `--help` 不显示子命令详情（`config set --help` 输出根 help），但功能正常
- [ ] GitLab 老版本（<15）不支持 `?view=raw`，可考虑 fallback `?unidiff=true`
- [ ] GitHub API 限速（429）时自动等待 `Retry-After` 秒后重试
- [ ] 大型 diff（>10MB）可考虑流式写入文件而非全部 buffer 到内存

---

## 5. 使用示例

```bash
# 配置 GitHub token
diffdeck config set --url https://github.com --auth-token ghp_xxx --profile gh --make-default

# 配置 GitLab token
diffdeck config set --url https://gitlab.com --auth-token glpat_xxx --profile gl

# 查看配置（token 已脱敏）
diffdeck config get --profile gh

# 列出所有 profile
diffdeck config list

# 拉取 diff 输出到 stdout（管道给其他命令）
diffdeck pull-diff https://github.com/owner/repo/pull/42 - | diffdeck index -

# 拉取 diff 保存到文件
diffdeck pull-diff https://gitlab.com/ns/repo/-/merge_requests/7 out.diff

# 用指定 profile 拉取（忽略 host 匹配）
diffdeck pull-diff https://github.com/owner/repo/pull/42 out.diff --profile gh
```