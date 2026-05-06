# `pull-diff` 命令详情

```bash
diffdeck pull-diff <pr_url> [output]
```

| 参数 | 说明 |
|---|---|
| `pr_url` | GitHub / GitLab / Gitea 的 PR/MR 页面 URL |
| `output` | 省略或 `-` → 输出到 stdout；指定文件名 → 写入文件 |

平台由 URL 路径形状自动识别（不依赖 hostname，支持私有化部署）：

| 平台 | URL 路径特征 | API 端点 |
|---|---|---|
| GitHub / GitHub Enterprise | `/pull/{number}` | `https://api.github.com/repos/{owner}/{repo}/pulls/{n}` |
| GitLab | `/.../.../-/merge_requests/{iid}` | `https://{host}/api/v4/projects/{id}/merge_requests/{iid}/diffs?view=raw` |
| Gitea | `/pulls/{number}` | `https://{host}/api/v1/repos/{owner}/{repo}/pulls/{n}` |

认证优先级：命令行 `--profile` > profile host 匹配 > default profile > `DIFFDECK_TOKEN` 环境变量。

**用法示例**

```bash
# 拉取 GitHub PR diff 输出到 stdout（管道给 split）
diffdeck pull-diff https://github.com/owner/repo/pull/42 - | diffdeck index -

# 保存到文件
diffdeck pull-diff https://github.com/owner/repo/pull/42 pr.diff

# 拉取 GitLab MR diff
diffdeck pull-diff https://gitlab.com/ns/repo/-/merge_requests/7 mr.diff

# 指定 profile（忽略 host 匹配）
diffdeck pull-diff https://github.com/owner/repo/pull/42 --profile gh
```
