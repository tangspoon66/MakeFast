# Analysis Research Notes

## Sources inspected

- MakeFast `README.md`, frontend route/pages/components and editor state.
- Existing FastAPI routes, Pydantic models, compilation service, template/course-folder managers, administrator authentication and SQLite services.
- `.kiro/specs/esp-online-dev-platform/*` as historical engineering requirements, not current product scope.
- `.kiro/specs/blockly-code-conversion/PLAN.md` and current parser implementation for conversion constraints.
- `tmp/pdfs/makefast-agent/design.txt` and the user-provided design discussion for Agent goals, modes, event context and boundaries.
- User-provided IP reference image for visual direction; it is a role/state reference, not a production asset contract.

## Findings

1. Existing MakeFast is technically strong as an online ESP/Arduino editor but product navigation is editor-first and does not yet represent a lesson/project lifecycle.
2. Existing admin auth cannot serve learner identity: it is a separate administrator domain and must remain isolated.
3. Existing AI API can generate code with board/project/error context, but it is not yet a persisted, event-driven Agent with semantic UI targets and proposal approval.
4. Existing template/course resources have article/video/code metadata but not a stable executable step schema, prerequisite rules or version-pinned learner progress.
5. Existing Blockly conversion work intentionally describes a constrained syntax subset; this supports a product promise of supported round trips, not arbitrary C++ reversibility.
6. Existing device code can inspect a connected chip/USB device, but USB identity alone does not prove every specific board variant; course/template/project evidence and user confirmation remain necessary.
7. Existing repo uses multiple lightweight stores (JSON and separate SQLite databases). A dedicated learner database is safer than mixing user state with operations or course Q&A data.

## Product decisions from discussion

- Home is learning/project overview, not code editor.
- New users start from a concrete outcome-based project; abstract onboarding questions are removed.
- Guided and autonomous modes share the same workbench and vary Agent intervention.
- Workbench: left course steps, center step panel, right collapsible device debug, floating Agent IP.
- Debug panel is a desktop right-side area and may show serial output next to code; it is not a course step tab.
- Agent uses a fixed avatar and target-side expandable bubble with continued questions; it is not a permanent right chat column.
- Static IP states are sufficient for first release; animated assets are a later visual iteration.
- Username/password is MVP authentication; phone/email recovery is reserved for later.
- Points, badges and progress are first-release requirements.
- PM 已确认课程完成采用两层目标：基础完成以真实硬件运行和用户确认作为闭环；深度完成追加知识检查、改造挑战及修改后的再次验证。前者不被后者阻塞。
- PM 已确认小学生属于 MVP 核心用户，但 MVP 只做个人版。学校/班级、教师后台、学生登录码、课程分配和教师课程管理整体进入后续教育版路线。
- MVP 不制作面向监护人或教师的产品流程；小学生使用个人账号。面向儿童公开服务的告知/同意与数据处理责任仍是上线前法律/隐私审查项，不能因暂不制作管理界面而忽略。
> Security note: obsolete default-login instructions omitted; use locally generated credentials.
- 访客边界已确认：只读课程图文预览和步骤目录；源代码、积木工程、固件、附件下载、工作台、编译、进度、奖励和 Agent 都需要登录。
- 首发奖励已定义基础分值、7 个徽章和同一能力 100%/50%/25%/0% 的合格练习递减规则；重复点击/重试/事件重放不发分。
- 首轮产品验证采用“跟着做出来 → 修改再验证 → 减少提示完成关键闭环”三阶段，核心衡量 Agent 目标准确、操作转化、错误恢复、基础完成和知识掌握。
- Agent 对话模型已确认：完整已发送对话持久化为课程项目学习记录；同一项目支持多个独立会话，可命名、切换、归档和删除。未发送输入只保留为浏览器草稿。
- Agent 不询问家庭信息；代码、串口和完整日志默认不附加到持久会话，需用户明确选择并显示附加范围。

## Unresolved discovery questions

- 用户已确认首发课程硬件组合为 Seeed Studio XIAO ESP32-S3 Sense（不使用摄像头/麦克风/SD）、三针 DHT11 模块、推荐的三针 3.3V 有源蜂鸣器模块、杜邦线和 USB 线；具体蜂鸣器型号、避开 Sense 内部占用资源的 GPIO、pinmap、库版本与实物 BOM 仍待核验。
- 用户确认首发不追求所有板卡/模块变体兼容；课程围绕推荐套件建立一个固定、手动指定、实物验证的 wiring graph。Aily Blockly 的结构化 pinmap/component 数据作为导入和建模参考，提高自动连线图生成概率。
- 接线清单确认保留：新手逐根确认，高手查看完整清单；中文名称优先并保留英文丝印，明确杜邦线颜色不影响功能。
- 当前 MakeFast 没有可用 wiring graph；`HomePage.tsx` 的接线区只是占位 UI。Aily 是首要功能参考：其 AWS 语法、pin resolver、连接类型/数据流规则、JSON 转换和校验应达到首课的质量基线。纯 TypeScript 核心可在 GPL 条件下移植，Angular/Electron 宿主服务需改写为 MakeFast 适配器。
- Aily boards 仓库已有 `xiao_esp32s3_Sense` 的 `board.json`/`pinmap.json`，libraries 仓库已有 `adafruit_DHT/pinmaps/dht11_module.json`；这些文件的 package/repository 许可证需逐项记录，且最终接线仍需真实套件验证。
- Pinmap and electrical validation source for every component variant.
- AI provider context retention, cost budget and user consent language.
- 持久会话的服务端/模型供应商保留期限、删除后的备份清理时间和儿童用户可读的隐私说明仍需上线前确认。
- 后续教育版仍需确定学校开通、教师核验、课程管理权限以及激活码/登录码生命周期；这些不是当前 MVP 的实现阻塞项。

These are recorded as gates in implementation readiness; no placeholder answer is treated as a shipped fact.
