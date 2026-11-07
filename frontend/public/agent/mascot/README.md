# 小铁猫帧（R10）
来源：用户概念图 `docs/agent/mascot-concept.png`（2880×2880）。按状态裁切 → rembg `isnet-general-use` 生成蒙版 → 二值化+填洞+保留最大连通域（去掉背景电路线/气泡）→ 0.8px 羽化。
RGB 像素未做任何重绘/缩放。待机帧左下角残留的背景电路线做了手工擦除。

| 文件 | 概念图位置 |
|---|---|
| idle.png | 1 待机（左） |
| walk.png | 1 待机（右，行走） |
| guiding.png | 2 指引（指向 RUN，RUN 按钮未保留） |
| explaining.png | 3 讲解（书本气泡未保留） |
| thinking.png | 3 讲考（省略号气泡未保留） |
| processing.png | 4 思考（齿轮屏幕） |
| success.png | 5 成功 |
| warning.png | 6 警告（编译失败） |
| listening.png | 7 聆听 |
