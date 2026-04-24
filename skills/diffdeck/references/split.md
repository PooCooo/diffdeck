# 拆分指南

仅当 `SKILL.md` 中的基础规则不够用时，才使用这份参考文档。

## 目标

将一个大型 PR diff 拆分成一系列更小、逻辑上连贯、并且更易于 review 的 sub-patches。

## 原则

- 感知模式的排序：选择与用户偏好或 diff 形态匹配的 review flow
- 内聚分组：将紧密相关的 changes 放在一起；当分离无关关注点能提升 reviewability 时，将它们拆开
- 稳定的 review flow：对 groups 排序，让 reviewer 可以逐步建立上下文，而不必不必要地来回跳转
- 面向 reviewer 的描述：描述这个 group 为什么存在于当前 review flow 中，而不只是说明触及了哪个区域
- 必要时提供 co-review drafts：如果你在拆分时发现具体的 review concern，将其作为 draft comment 附加，而不是切换成完整的 review report

## 输出格式

输出单个 JSON object，不要包含 markdown fences，也不要包含额外说明：

```json
{
  "groups": [
    {
      "description": "Add version selector plumbing so later upgrade flows have a stable input",
      "changes": ["0-2", 5, 6],
      "draftComments": [
        {
          "change": 6,
          "body": "Check whether the new selector can drift out of sync when no compatible versions exist."
        }
      ]
    },
    {
      "description": "Cover the upgrade path with e2e checks after the UI flow is in place",
      "changes": ["3-4", "7-9"]
    }
  ]
}
```

## 规则

1. 每个 change index 必须且只能出现在一个 group 中。
2. 任何 index 都不能出现在多个 groups 中。
3. 任何 index 都不能被遗漏。
4. Groups 是有顺序的。Group 1 最先 review，Group N 最后 review。
5. 根据 PR 形态选择 groups 的数量。使用足够多的 groups 来保持 review 易于理解，但不要只是为了创建更多 groups 而拆分紧密耦合的 changes。
6. 对连续 indices 使用 range syntax：`"0-2"` 表示 `[0, 1, 2]`。
7. `draftComments` 是可选的。
8. 每条 draft comment 都必须 anchor 到同一 group 中的某个 `change`。

## Description guidance

好的 descriptions 可以帮助 reviewer 理解为什么这个 group 应该作为一个单元被 review，以及它如何融入整个序列。

优先使用满足以下条件的 descriptions：

- 解释该 group 的意图或 review value
- 在有用时提及 dependency 或 sequencing reason
- 告诉 reviewer 在这一步可以了解或验证什么

避免只包含以下内容的 descriptions：

- 像 `form version selector` 这样的原始区域标签
- 对 filenames、component names 或 ticket labels 的原样复述
- 过于模糊，无法将这个 group 与相邻 groups 区分开

通常效果较好的示例：

- `Add version selection plumbing so the upgrade flow has a stable entry point`
- `Show current version and status before wiring upgrade actions`
- `Isolate the upgrade dialog and action handling as the main behavior change`
- `Add e2e coverage once the upgrade flow is in place`

通常过于模糊的示例：

- `version selector`
- `status display`
- `upgrade dialog`
- `e2e`

## Draft comment guidance

有选择地使用 `draftComments`。它们是候选 review comments，human reviewer 可以在 `render` 阶段接受或拒绝。

优先使用满足以下条件的 draft comments：

- 指向具体的 risk、regression 或有疑问的 assumption
- anchor 到一个具体的 indexed change
- 读起来像是如果被接受，就值得发送到 source review 的内容

避免只包含以下内容的 draft comments：

- 对代码功能的摘要
- 泛泛的赞扬或噪音
- 没有具体 concern 的模糊警告

通常效果较好的示例：

- `Potential regression: this update path bypasses the sanitizing transform used by the normal edit flow.`
- `This selector keeps the old version when no compatible options exist, so the form may submit an unavailable version.`

通常过弱的示例：

- `Adds selector logic`
- `Looks risky`
- `Need review`

## 语言

- 默认使用中文输出 description 和 draftComment
- 如果用户明确指定语言（如英文 / 日文等），则严格遵循用户指定语言
- 不要自行切换语言或混用多种语言，除非属于“术语保留规则”

术语保留规则:
- 编程核心概念: `callback`, `closure`, `promise`等翻译后会丢失技术语境或产生歧义
- 标准 / 协议 / 数据格式: `HTTP`, `TCP/IP`, `DNS`等
- 工具 / 框架 / 平台名称: `Git`, `Docker`, `Kubernetes`

翻译风格:
- 以准确性优先于字面翻译
- 采用自然、工程化表达，避免生硬直译
- 优先使用开发者日常用语（工程语境）

推荐采用中文 + 英文术语的翻译方式, 例如: `通过 promise 处理异步逻辑`, `使用 closure（闭包）解决作用域问题`.
