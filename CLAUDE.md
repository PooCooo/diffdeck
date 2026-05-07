# DiffDeck

DiffDeck 是一个将大型 PR/MR diff 拆分为可审查的子补丁、并在本地浏览器中进行交互式代码审查的 CLI 工具。

## 项目结构

Monorepo，使用 pnpm workspaces + Turborepo 管理：

```
packages/
├── core/       # 纯算法库：diff 解析、patch 应用、拆分
├── shared/     # 跨包共享的 TypeScript 类型定义
├── cli/        # CLI 入口，所有命令实现
└── cli-ui/     # 审查用 Web UI（React + Vite + Tailwind）
```

### 包依赖关系

```
cli → core, shared
cli-ui → shared (仅类型)
core → shared
```

## 命令总览

| 命令 | 说明 | 实现文件 |
|------|------|----------|
| `index` | 为 diff 中的变更行建立索引 | `cli/src/commands/index.ts` |
| `split` | 按元数据将 diff 拆分为子补丁 | `cli/src/commands/split.ts` |
| `render` | 启动本地 Web 服务器进行交互式审查 | `cli/src/commands/render.ts` |
| `config` | 管理平台认证配置 | `cli/src/commands/config.ts` |
| `pull-diff` | 从 GitHub/GitLab/Gitea 拉取 PR/MR diff | `cli/src/commands/pull-diff.ts` |
| `submit` | 将审查评论提交回 PR/MR | `cli/src/commands/submit.ts` |

---

## 命令详解

### `diffdeck index <diff_file>`

为统一 diff 中的所有变更行（`+` / `-`）分配全局递增索引，输出带编号的变更列表。

- **输入**：统一 diff 文件路径或 `-`（stdin）
- **输出**：带索引的变更行列表，格式如 `[0] - L2:   return a + b;`
- **选项**：`-o, --output <file>` 输出到文件

**核心流程**：`parsePatch(text)` → `indexChanges(patches)` → `formatIndexedChanges(changes)`

`indexChanges` 从原始 hunk 头 (`@@ -x,y +a,b @@`) 计算 `lineNo`，它是**源文件的绝对行号**（addition 用 `dstLine`，deletion 用 `srcLine`），不是 sub-patch 内的相对行号。

### `diffdeck split <diff_file> <split_meta_file>`

按 LLM 生成的拆分元数据，将一个大 diff 拆分为多个子补丁，并验证子补丁重新组合后等于原始 diff。

- **输入**：
  - `diff_file`：统一 diff 文件
  - `split_meta_file`：JSON 元数据或 `-`（stdin），格式：
    ```json
    {
      "groups": [
        { "description": "新增用户注册功能", "changes": ["0-10", 14, 15], "draftComments": [{ "change": 1, "body": "注意安全" }] }
      ]
    }
    ```
- **输出**：`-o <dir>` 输出目录（含 `sub1.diff`, `sub2.diff`, ... + `meta.json`）；省略则输出 `===SUB_PATCH===` 分隔的 stdout 流
- **验证**：`reconstructBase` + 逐个 `applyPatch`，确保重组结果与原始 diff 一致

**元数据规则**：
- 每个 change 索引必须且只能出现一次
- `changes` 支持范围语法：`"0-10"` 等价于 `[0,1,2,...,10]`
- `draftComments` 是可选字段，必须锚定到同组内的一个 `change` 索引
- `resolveSplitGroupMeta` 会将 `change` 索引解析为具体的 `file`、`line`（绝对行号）、`side`

### `diffdeck render <source>`

启动本地 HTTP 服务器，在浏览器中展示子补丁供人工审查，等待提交后输出 `SubmitRequest` JSON。

- **参数**：`source` 为子补丁目录路径或 `-`（stdin，接收 `split` 的输出）
- **选项**：
  - `-p, --port <port>`：监听端口，默认 3847
  - `-o, --output <file>`：输出到文件而非 stdout
- **API 端点**：
  - `GET /api/patches`：返回 `SubPatch[]`
  - `POST /api/submit`：接收 `ReviewSubmission`，返回 `{ ok: true }`
- **输出**：`SubmitRequest` JSON，包含 `body` 和 `comments`（已将 `ReviewSubmission.comments` + 被采纳的 `draftComments` 合并映射为平台格式的 `ReviewComment[]`）

**`convertDraftCommentsToSubmitRequest`** 将共享类型映射为平台提交类型：
- `comment.side "additions" | "deletions"` → `"RIGHT" | "LEFT"`
- `comment.file` → `path`
- `comment.line`（绝对文件行号）→ `line`
- 仅采纳 `status === "accepted"` 的 agent draftComments

### `diffdeck config`

管理平台认证配置，存储于 `~/.diffdeck/config.json`。

```json
{
  "default": "gh",
  "profiles": {
    "gh": { "url": "https://github.com", "authToken": "ghp_xxx" }
  }
}
```

| 子命令 | 用法 | 说明 |
|--------|------|------|
| `set` | `config set --url <url> --auth-token <token> [--profile <name>] [--make-default]` | 添加/更新 profile |
| `get` | `config get [--profile <name>]` | 输出 profile JSON（token 脱敏） |
| `list` | `config list` | 列出所有 profile 名称 |
| `delete` | `config delete --profile <name>` | 删除 profile |

### `diffdeck pull-diff <pr_url> [output]`

从 GitHub / GitLab / Gitea 拉取 PR/MR 的 diff。

- **参数**：`pr_url` 为 PR/MR 页面 URL；`output` 省略或 `-` 输出 stdout，指定文件名写入文件
- **选项**：`--profile <name>` 显式指定认证 profile

**平台识别**（基于 URL 路径形状，不依赖 hostname）：

| 平台 | 路径特征 | API |
|------|----------|-----|
| GitHub | `/{owner}/{repo}/pull/{n}` | `api.github.com/repos/{owner}/{repo}/pulls/{n}` (Accept: diff) |
| GitHub Enterprise | 同上（host 非 github.com） | `{host}/api/v3/...` |
| GitLab | `/{ns}/-/merge_requests/{iid}` | `{host}/api/v4/projects/{id}/merge_requests/{iid}/diffs?view=raw` |
| Gitea | `/{owner}/{repo}/pulls/{n}` | `{host}/api/v1/repos/{owner}/{repo}/pulls/{n}` |

**认证优先级**：`--profile` 显式指定 → host 匹配 → well-known 名称 → default profile → `DIFFDECK_TOKEN` 环境变量 → 无 token

### `diffdeck submit <pr_url> <comments_file>`

将审查评论提交回 PR/MR。

- **参数**：`pr_url` 为 PR/MR URL；`comments_file` 为 `SubmitRequest` JSON 文件路径或 `-`（stdin）
- **选项**：`--profile <name>` 显式指定认证 profile
- **当前支持**：GitHub / GitHub Enterprise 已完整实现；GitLab 提交尚未实现（会报错）

**`SubmitRequest` 格式**：
```json
{
  "commit_id": "abc123",
  "event": "COMMENT",
  "body": "Overall review comment",
  "comments": [
    { "path": "src/main.ts", "body": "Nit: rename", "line": 10, "side": "RIGHT" }
  ]
}
```

---

## 核心库 (`packages/core`)

纯算法库，无 I/O 依赖。

### `diff.ts` — Diff 算法

| 函数 | 说明 |
|------|------|
| `myersDiff(a, b)` | Myers diff 算法（LCS），返回 `DiffLine[]` |
| `simpleDiff(a, b)` | 简单逐行比较，大文件（>10M 行）fallback |

### `patch.ts` — Unified Diff 解析与应用

| 函数 | 说明 |
|------|------|
| `parsePatch(text)` | 解析 unified diff 为 `FilePatch[]` |
| `applyPatch(contents, patches)` | 将 patch 应用到文件内容，失败抛 `PatchError` |
| `reconstructBase(patches)` | 仅从 patch 重建基础文件内容（用于验证） |
| `filesTouchedByPatches(patches)` | 返回 patch 涉及的文件列表 |

### `split.ts` — 拆分逻辑

| 函数 | 说明 |
|------|------|
| `indexChanges(patches)` | 为所有变更行分配全局索引，返回 `IndexedChange[]` |
| `formatIndexedChanges(changes)` | 格式化索引输出 |
| `validateMeta(meta, total)` | 验证拆分元数据有效性 |
| `resolveSplitGroupMeta(meta, changes)` | 将 `change` 索引解析为 `file`/`line`/`side` |
| `generateSubPatches(text, meta)` | 生成子补丁字符串列表 |
| `expandChanges(items)` | 展开 `ChangeItem`（支持范围语法 `"3-7"`） |

---

## 共享类型 (`packages/shared`)

关键类型（定义于 `src/types.ts`）：

| 类型 | 说明 |
|------|------|
| `Hunk` / `FilePatch` | Patch 解析结构 |
| `IndexedChange` | 带索引的变更行：`{ index, file, type, content, lineNo }` |
| `SubPatch` | 子补丁：`{ index, description, diff, draftComments[] }` |
| `SplitMeta` | LLM 输出的拆分元数据格式 |
| `ReviewComment` | 审查评论：`{ sub, file, line, side, body, source }` |
| `AgentDraftComment` | Agent 草稿评论：含 `id`、`change` 索引 |
| `AgentDraftCommentDecision` | 含决定状态：`pending` / `accepted` / `rejected` |
| `ReviewSubmission` | 审查提交载荷：`{ comments[], draftComments[] }` |
| `ReviewResponse` | 提交响应：`{ ok: boolean }` |

---

## CLI UI (`packages/cli-ui`)

基于 React 19 + Vite + Tailwind CSS v4 的审查界面。

- `GET /api/patches` 获取子补丁数据
- `POST /api/submit` 提交审查结果
- 支持 i18n（中/英），通过 URL 参数 `?lang=` 切换
- 组件：diff 查看器、评论输入、agent draft decision 按钮（接受/拒绝/待定）

---

## 开发命令

```bash
pnpm build          # 构建所有包
pnpm dev            # 开发模式
pnpm test           # 运行 vitest 测试
pnpm lint           # ESLint
pnpm format         # Prettier 格式化
pnpm check-types    # TypeScript 类型检查
```

CLI 单独构建：

```bash
pnpm --filter @diffdeck/cli build    # 构建 CLI
pnpm --filter @diffdeck/cli test     # 运行 CLI 测试
```

---

## 典型工作流

```bash
# 1. 拉取 diff
diffdeck pull-diff https://github.com/owner/repo/pull/42 pr.diff

# 2. 建立索引（LLM 读取输出进行分组）
diffdeck index pr.diff

# 3. 拆分（LLM 生成 meta JSON 后执行）
echo '<meta JSON>' | diffdeck split pr.diff - -o /tmp/output/

# 4. 交互式审查
diffdeck render /tmp/output/

# 5. 提交评论
diffdeck submit https://github.com/owner/repo/pull/42 submit.json
```

管道式一键流程：

```bash
diffdeck pull-diff <pr_url> - | diffdeck index -  # 查看索引
echo '<meta>' | diffdeck split pr.diff - | diffdeck render -  # 拆分+审查
```
