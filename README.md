# ArcGIS 面试题目

[Edit on StackBlitz ⚡️](https://stackblitz.com/edit/web-platform-qgtzkp)

### ArcGIS JavaScript API 里面这些 class 的意思及关系：FeatureLayer, Renderer, Graphic, Geometry

- FeatureLayer: 用于展现从 ArcGIS Service Url 获取的数据，例如点，线，多边形等形状。也可以用来查询数据。
- Renderer: 作为 FeatureLayer 的配置项，控制展现样式，比如根据数据的某个属性自定义点大小，颜色等。
- Graphics: 代表地图上的一个标记，如点，线等。包含样式(symbol)，形状以及位置大小(geometry)，以及属性(attributes)，popupTemplate。
- Geometry: 描述形状的位置大小等信息。

### 任务的时间分配，具体实现进度

- 了解 ArcGIS JS SDK 用法，查看示例代码。用时 1 小时。
- 设计页面布局，完成 CSS 以及 HTML 骨架。用时 0.5 小时。
- 完成地图功能编码和调试。用时 0.5 小时。
- 设计并完成滚动组件开发调试。用时 1 小时。
- 调用列表组件，通过事件通知与地图组件功能结合。以及 bugfix。用时 0.5 小时。
