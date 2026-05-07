
# `submit` 命令详情

```bash
diffdeck submit <pr_url> <comments_file>
```

| 参数 | 说明 |
|---|---|
| `pr_url` | 目标 PR/MR 的页面 URL（GitHub / GitLab / Gitea） |
| `comments_file` | JSON 文件路径，或 `-` 从 stdin 读取 |

**`comments_file` 格式（SubmitRequest）**

`render` 返回的 `comments` 数组即为合法的提交载荷，但需外层包装一个包含 `body` 和 `event` 的对象：

```json
{
  "body": "整体评语（可选，平台会显示在总评中）",
  "event": "COMMENT",
  "comments": [
    {
      "path": "src/main.ts",
      "body": "这里建议加个判空",
      "position": 12
    },
    {
      "path": "src/utils.ts",
      "body": "这个函数是否有线程安全问题？",
      "line": 45,
      "side": "RIGHT"
    }
  ]
}
```

`event` 可选值：`COMMENT`（仅评论）、`APPROVE`（批准）、`REQUEST_CHANGES`（请求修改）。

`comments[].position` 是 GitHub 行号（相对于 diff 的位置），`line` + `side`（或 `start_line` + `start_side`）也可用于多行评论。

**用法示例**

```bash
# 从 stdin 提交（render 返回的 JSON 直接 pipe 过来）
echo '{"body":"整体评语","event":"COMMENT","comments":[...]}' \
  | diffdeck submit https://github.com/owner/repo/pull/42 -

# 从文件提交
diffdeck submit https://github.com/owner/repo/pull/42 comments.json

# 提交批准（同时留下评论）
echo '{"body":"LGTM","event":"APPROVE","comments":[...]}' \
  | diffdeck submit https://github.com/owner/repo/pull/42 -

# 提交 GitLab MR
echo '{"body":"整体评语","event":"COMMENT","comments":[...]}' \
  | diffdeck submit https://gitlab.com/ns/repo/-/merge_requests/7 -

# 指定 profile（忽略 host 匹配）
diffdeck submit https://github.com/owner/repo/pull/42 comments.json --profile gh
```
