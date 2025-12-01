# copilot instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/components/loading-button）中安全、高效地协作开发。

<!-- 以下的说明不是 GPT 生成的而是 Tab 补全的，发现几是乱说没什么有用的东西 -->

## 全局架构与职责划分

- 本子包是一个「支持加载状态展示」的按钮组件库，对外主要通过 [src/index.ts](src/index.ts) 暴露：
  - 组件：`LoadingButton`，用于展示加载状态的按钮。
  - 类型：`LoadingButtonProps`，定义在 [src/components/loading-button/types.ts](src/components/loading-button/types.ts)。
- 组件主体逻辑集中在 [src/components/loading-button/index.tsx](src/components/loading-button/index.tsx)：
  - 负责根据传入的 `loading` 状态展示不同的按钮样式和行为。
  - 支持自定义按钮文本、样式和点击事件处理。
- Storybook 配置位于 [.storybook/main.js](.storybook/main.js) 和 [.storybook/preview.js](.storybook/preview.js)，用于本组件的可视化调试与文档演示。
