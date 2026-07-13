# Family Meal Log MVP — Milestone M1 — Identity & Family Profiles（最终交付报告）

> 日期：2026-07-13 ｜ 状态：✅ 完成（83/83 校验通过）


## 目录

1. M1 完成总结
2. 变更区域仓库目录树
3. 创建与修改文件完整清单
4. 身份与数据模型
5. 云函数契约
6. 共享运行时打包
7. 客户端架构
8. 活动档案解析与引导流程
9. 安全模型
10. 状态与错误处理矩阵
11. 自动化校验结果
12. 手动测试清单
13. 文档更新与决策记录
14. Git 与范围控制
15. M2 建议（不实现）

## 1. M1 完成总结

M1 在已验收的 M0 基础之上实现，目标是为「家庭用餐记录」小程序建立单一所有者（single-owner）身份模型与家庭成员档案（family profiles）。本里程碑不涉及多人共享、邀请或角色权限，且档案删除（归档/软删除）明确延后至后续里程碑。

M1 交付的核心成果：

- 新增独立云函数 profileApi（list / get / create / update / setDefault），不复用 mealApi；login 与 profileApi 均通过共享运行时（shared runtime）派生身份与档案逻辑。
- 服务端可信身份：openid 仅由 cloud.getWXContext().OPENID 在服务端取得，客户端永不发送、接收或存储 openid；所有对外 DTO 不含 openid / ownerOpenid。
- 共享运行时确定性打包：shared/*.ts 编译为 CommonJS 后复制进各云函数 lib/shared/，无符号链接、Windows 兼容、生成物不入库。
- 客户端身份/档案 UI：首次引导（onboarding）、档案列表/创建/编辑/选择/设默认，首页展示当前活动档案。
- 自动化验收：npm run validate 共 83 项检查全部通过（M0 基线 67 + M1 新增 16）。其中「跨用户隔离（9–11）」「共享运行时打包（15a–d）」「默认档案持久化（13）」三项关键验收均通过。
结论：依据验收门槛（owner-isolation、shared-runtime packaging、default-profile persistence 必须全部通过），M1 可判定为【完成】。

附带一项仓库卫生修正：.gitignore 现忽略 .workbuddy/（项目记忆目录，不应提交）。

## 2. 变更区域仓库目录树

以下为 M1 实际变更/新增的目录与文件（省略未变动项）：

```
Family Meal Log MVP/
├─ .gitignore                      # 修正：仅忽略生成物 lib/shared/，提交云函数源码 .js
├─ package.json                    # 新增 build:shared / clean 脚本
├─ README.md                       # M0/M1 里程碑表、仓库结构、校验说明
├─ shared/                         # ★ 共享运行时（单一事实来源）
│  ├─ index.ts
│  ├─ repository.ts                # Repository 接口 + ServiceError
│  ├─ repository-memory.ts         # InMemoryRepository（测试用）
│  ├─ tsconfig.json
│  ├─ dist/                        # 编译产出（git 忽略）
│  └─ services/
│     ├─ user-service.ts           # upsertUser（幂等登录）
│     ├─ profile-service.ts        # 档案校验/创建/更新/设默认/列表
│     └─ session.ts                # resolveActiveProfile 纯函数
├─ cloudfunctions/
│  ├─ login/                       # 改用共享运行时；去除响应中的 openid
│  │  ├─ index.js  cloudbase-repository.js  package.json  config.json
│  ├─ profileApi/                  # ★ 新增云函数
│  │  ├─ index.js  cloudbase-repository.js  package.json  config.json
│  ├─ mealApi/                     # 修订：响应去除 openid
│  └─ aiAnalyze/                   # 随 gitignore 修正一并纳入版本控制（M0 遗留）
├─ miniprogram/
│  ├─ app.ts  app.json             # onLaunch 初始化云 + 可选 loadSession
│  ├─ typings/index.d.ts           # 移除 openid；新增 ClientFamilyProfile / FamilyRelation
│  ├─ config/labels.ts             # ★ RELATION_LABELS / RELATION_OPTIONS（中文）
│  ├─ services/
│  │  ├─ auth.ts                   # ★ login() 封装
│  │  ├─ profile.ts                # ★ 档案接口封装
│  │  └─ session.ts                # ★ 活动档案解析与本地存储
│  └─ pages/
│     ├─ home/                     # 展示活动档案 / 引导 / 离线；保留记餐占位
│     ├─ profiles/                 # ★ 档案列表/选择/设默认（防重复点击）
│     └─ profile-edit/             # ★ 创建/编辑表单（姓名 + 关系）
├─ scripts/
│  ├─ build-shared.mjs             # ★ 共享运行时编译+复制
│  └─ validate.mjs                 # 扩展 16 项 M1 验收
└─ docs/
   ├─ SECURITY.md                  # ★ 新增：信任模型/集合/索引/安全规则
   ├─ MANUAL_TEST_CHECKLIST.md     # ★ 新增：DevTools + 真机清单
   ├─ ARCHITECTURE.md              # 更新 M1 状态/页面/服务/打包/安全/决策
   ├─ DATA_MODEL.md                # 更新索引/校验规则/删除延后/本地日
   ├─ USER_FLOWS.md                # 修正 openid 表述，补充 M1 流程
   ├─ DEVELOPMENT_PLAN.md          # M1 标记 ✅
   └─ PRODUCT_REQUIREMENTS.md      # 补充排除项（删除延后/营养目标延后）

```

## 3. 创建与修改文件完整清单

M1 共涉及 44 个文件（新增 29、修改 15）。按类别列示如下（★ 为 M1 新增）：

### 3.1 共享运行时（新增）

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| shared/repository.ts | 新增 | Repository 接口、ServiceError、错误码 |
| shared/repository-memory.ts | 新增 | 内存实现，供自动化测试使用 |
| shared/index.ts | 修改 | 导出 repository / service 模块 |
| shared/services/user-service.ts | 新增 | upsertUser 幂等登录 |
| shared/services/profile-service.ts | 新增 | 档案校验、CRUD、设默认、列表面向客户端转换 |
| shared/services/session.ts | 新增 | resolveActiveProfile 纯函数（优先级逻辑） |

### 3.2 云函数

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| cloudfunctions/login/index.js | 修改 | 改用共享运行时；响应去除 openid |
| cloudfunctions/login/cloudbase-repository.js | 新增 | 基于 wx-server-sdk 的 Repository 实现 |
| cloudfunctions/profileApi/index.js | 新增 | profileApi 分发 list/get/create/update/setDefault |
| cloudfunctions/profileApi/cloudbase-repository.js | 新增 | 同 login 的仓储实现 |
| cloudfunctions/profileApi/package.json | 新增 | 依赖 wx-server-sdk |
| cloudfunctions/profileApi/config.json | 新增 | 云函数配置 |
| cloudfunctions/mealApi/index.js | 修改 | 响应去除 openid |
| cloudfunctions/aiAnalyze/index.js | 新增(纳入) | M0 遗留源码随 gitignore 修正入库 |

### 3.3 客户端

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| miniprogram/app.ts | 修改 | onLaunch 初始化云 + 可选 loadSession |
| miniprogram/app.json | 修改 | 注册 profiles / profile-edit 页面 |
| miniprogram/typings/index.d.ts | 修改 | 移除 openid；新增 ClientFamilyProfile/FamilyRelation |
| miniprogram/config/labels.ts | 新增 | 关系中文标签与选择器选项 |
| miniprogram/services/auth.ts | 新增 | login() 封装 |
| miniprogram/services/profile.ts | 新增 | 档案接口封装 + ApiResult |
| miniprogram/services/session.ts | 新增 | 活动档案解析/本地存储/loadSession |
| miniprogram/pages/home/home.ts/.wxml/.wxss | 修改 | 活动档案/引导/离线；记餐占位 |
| miniprogram/pages/profiles/* | 新增 | 档案列表/选择/设默认 |
| miniprogram/pages/profile-edit/* | 新增 | 创建/编辑表单 |

### 3.4 构建 / 校验 / 文档 / 配置

| 文件 | 状态 | 用途 |
| --- | --- | --- |
| scripts/build-shared.mjs | 新增 | 共享运行时编译+复制打包 |
| scripts/validate.mjs | 修改 | 扩展 16 项 M1 验收 |
| package.json | 修改 | 新增 build:shared / clean |
| .gitignore | 修改 | 仅忽略生成物；忽略 .workbuddy/ |
| README.md | 修改 | 里程碑表/结构/校验说明 |
| docs/SECURITY.md | 新增 | 信任模型/集合/索引/安全规则 |
| docs/MANUAL_TEST_CHECKLIST.md | 新增 | DevTools + 真机清单 |
| docs/ARCHITECTURE.md | 修改 | M1 状态/页面/服务/打包/安全/决策 |
| docs/DATA_MODEL.md | 修改 | 索引/校验规则/删除延后/本地日 |
| docs/USER_FLOWS.md | 修改 | 修正 openid 表述，补充 M1 流程 |
| docs/DEVELOPMENT_PLAN.md | 修改 | M1 标记 ✅ |
| docs/PRODUCT_REQUIREMENTS.md | 修改 | 补充排除项 |

## 4. 身份与数据模型

### 4.1 users 集合

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| _id | string | 云数据库文档 ID（对外仅返回此内部 ID） |
| openid | string | 微信身份；唯一索引；仅服务端写入，客户端不可见 |
| unionid | string? | 跨应用 UnionID（可选） |
| defaultFamilyProfileId | string? | 当前默认档案 ID；登录/设默认时维护 |
| createdAt / updatedAt | number | 服务端时间戳（毫秒） |

登录幂等：以 openid 为键 upsert，首次 isNew=true 并写入时间戳；并发竞态下由唯一索引保障单文档（重复写入以相同 openid 命中既有文档）。

### 4.2 family_profiles 集合

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| _id | string | 档案文档 ID |
| ownerOpenid | string | 所有者 openid；仅服务端设置，客户端不可伪造 |
| name | string | 姓名；trim 后非空、≤30 字符 |
| relation | enum | self / spouse / child / parent / other |
| isDefault | boolean? | 是否默认（与 users.defaultFamilyProfileId 协同维护） |
| createdAt / updatedAt | number | 服务端时间戳 |

校验规则（normalizeProfileInput）：姓名去除首尾空格、限长 30、非空；relation 必须为白名单枚举；除 name/relation 外的字段一律丢弃，ownerOpenid 由服务端写入。更新时仅 name/relation 可改，其余（尤其 ownerOpenid）不可变。档案删除不在 M1 范围，留待后续以归档/软删除实现。

本地自然日约定：用餐记录（M2）按 YYYY-MM-DD 00:00–23:59（所有者所在时区）分区存储，该约定已在 DATA_MODEL 登记，M1 仅记录规则不落地数据。

### 4.3 索引

| 集合 | 字段 | 类型 | 用途 |
| --- | --- | --- | --- |
| users | openid | 唯一 | 幂等登录、按身份查用户 |
| family_profiles | ownerOpenid | 普通 | 按所有者列出/隔离档案 |

## 5. 云函数契约

### 5.1 login

- 从 cloud.getWXContext().OPENID 取身份（绝不信任客户端传入）。
- 调用 upsertUser(repo, openid, unionid?) → { user, isNew }。
- 响应：{ ok:true, user:{ id, defaultFamilyProfileId }, isNewUser }。不包含 openid。
### 5.2 profileApi 动作

| 动作 | 说明 | 对外字段（toClientProfile） |
| --- | --- | --- |
| list | 按 OPENID 列出本人档案，按 createdAt 升序 | id, name, relation, isDefault, createdAt |
| get | 取单条，校验归属 | 同上 |
| create | 规范化输入；服务端写 ownerOpenid；首个档案自动默认；按姓名去重 | 返回新建档案 |
| update | 校验归属；仅可改 name/relation | 返回更新后档案 |
| setDefault | 校验归属；维护 user.defaultFamilyProfileId 与 profile.isDefault | 返回更新后档案 |

错误映射：ServiceError（not_found / forbidden / validation / invalid_input）→ { ok:false, error:{ code, message } }。mealApi 同步去除响应中的 openid（M0 遗留修正）。

## 6. 共享运行时打包

目标：shared/*.ts 为单一事实来源，编译后确定性地复制进各云函数，避免符号链接、兼容 Windows、生成物不入库。

- 编译：tsc -p shared/tsconfig.json → shared/dist（CommonJS）。
- 复制：scripts/build-shared.mjs 将 shared/dist 递归复制到 cloudfunctions/<fn>/lib/shared/，并为该函数写入 { type:'commonjs' } package.json；覆盖 login 与 profileApi（亦可供其它函数复用）。
- git 忽略：cloudfunctions/*/lib/shared/ 与 shared/dist/ 均忽略；仅提交云函数源码 .js（修正 M0 的 cloudfunctions/**/*.js 误忽略）。
- 校验：validate 的 15a–d 检查 login/profileApi 是否打包共享运行时且确实引用；另含 gitignore 与生成物忽略检查。
## 7. 客户端架构

### 7.1 服务层

- services/auth.ts：login() 封装 login 云函数，返回 { userId, defaultFamilyProfileId, isNewUser }。
- services/profile.ts：listProfiles / createProfile / updateProfile / setDefaultProfile / getProfile 封装 profileApi；ApiResult 非泛型；映射 invalid_input。
- services/session.ts：getActiveProfileId / setActiveProfileId（wx.storage）；客户端 resolveActiveProfile；loadSession(app)；selectActiveProfile。
- config/labels.ts：RELATION_LABELS（中文展示）与 RELATION_OPTIONS（选择器）。
### 7.2 页面

- pages/home：展示当前活动档案 / 引导 / 离线横幅；保留「记餐」占位入口。
- pages/profiles：档案列表、选择、设默认（防重复点击）。
- pages/profile-edit：创建/编辑表单（姓名输入 + 关系选择器），提交防重。
app.ts 在 onLaunch 初始化云环境，并可选地 loadSession 预填全局活动档案。typings/index.d.ts 已移除 openid，新增 ClientFamilyProfile 与 FamilyRelation 全局类型。

## 8. 活动档案解析与引导流程

解析优先级（共享纯函数 resolveActiveProfile，客户端镜像同一逻辑）：

- 1) 本地记住的档案 ID —— 若仍在列表内则采用；
- 2) 服务端 defaultFamilyProfileId；
- 3) 列表首个档案；
- 4) 无档案 → 进入引导（onboarding）。
本地仅存储档案 ID（wx.storage），不缓存 openid 或敏感字段。首次运行（无档案）进入引导创建首个档案，该档案自动设为默认。session.loadSession 在启动后将活动档案写入 app.globalData。

## 9. 安全模型

- 服务端可信身份：openid 仅来自 cloud.getWXContext().OPENID；客户端永不发送/接收/存储 openid。
- 客户端安全 DTO：对外结构排除 openid 与 ownerOpenid，仅返回内部文档 ID 与档案摘要。
- 跨用户隔离：list / get / update / setDefault 全部按 OPENID 校验归属，越权返回 forbidden / not_found（ServiceError）。
- CloudBase 安全规则：相关集合 read:false、write:false，所有访问经云函数；users.openid 与 family_profiles.ownerOpenid 建索引以支持隔离查询。
- 无密钥入库：校验含 no-secrets 检查；SECURITY.md 提供开发/生产一致性与卫生清单。
## 10. 状态与错误处理矩阵

| 场景 | 行为 |
| --- | --- |
| 云环境未配置 | 首页显示离线横幅；服务失败优雅降级，不崩溃 |
| 登录失败 | 提示错误，不加载档案 |
| 列表失败 | 显示重试/空态 |
| 创建/更新失败 | Toast 报错，保留表单内容 |
| 重复点击提交 | 客户端按钮防重（in-flight 标记）；服务端按姓名去重，保证幂等 |
| 姓名为空/纯空格 | 客户端校验 + 服务端 rejection（validation） |
| 关系非法 | 选择器限定枚举；服务端拒绝 |
| 本地 ID 失效（档案已删） | resolveActiveProfile 回退至服务端默认 → 首个 → 引导 |
| 操作他人档案 | 服务端按 OPENID 校验返回 forbidden（客户端无法伪造归属） |
| 无任何档案 | 进入引导创建首个档案 |

## 11. 自动化校验结果

npm run validate 串联 typecheck 与 83 项检查：M0 基线 67 + M1 新增 16，0 失败。M1 十六项分组如下：

| 编号 | 检查 | 分组 |
| --- | --- | --- |
| 1 | login upsert 幂等（同身份仅首次 isNew） | 身份 |
| 2 | 首个档案自动设为默认 | 身份 |
| 3 | 用户可创建 ≥2 个档案 | 身份 |
| 4 | 档案姓名被 trim | 校验 |
| 5 | 空/纯空格姓名被拒 | 校验 |
| 6 | 非法 relation 被拒 | 校验 |
| 7 | 未知字段不持久化（ownerOpenid 服务端写，额外字段丢弃） | 校验 |
| 8 | 客户端传入 ownerOpenid 被忽略 | 校验 |
| 9 | 用户不能列出他人档案 | 隔离 |
| 10 | 用户不能更新他人档案 | 隔离 |
| 11 | 用户不能将他人档案设为默认 | 隔离 |
| 12a | 失效本地 ID → 服务端默认 | 活动档案回退 |
| 12b | 失效本地 ID → 首个档案 | 活动档案回退 |
| 12c | 无档案 → 引导（undefined） | 活动档案回退 |
| 13 | 默认在重新登录后持久化 | 持久化 |
| 14 | 重复提交返回同一档案（不重复） | 幂等 |
| 15a–d | 共享运行时已打包进 login/profileApi 且被引用 | 打包 |
| — | gitignore 忽略生成运行时；生成物确被忽略 | 打包 |
| — | 客户端 globalData / app.ts / login 响应均不含 openid | 卫生 |

结论：跨用户隔离（9–11）、共享运行时打包（15a–d）、默认档案持久化（13）三项关键验收全部通过，故 M1 可判定完成。

## 12. 手动测试清单

详见 docs/MANUAL_TEST_CHECKLIST.md。要点：

- A. DevTools：首次运行进入引导；创建一个档案后自动默认；再建第二个；切换默认；编辑；选择活动档案；重新编译后默认仍生效；提交空姓名/非法关系被拒；连续点击提交不重复创建。
- B. 真机：上述流程在手机端复现；离线时首页横幅正确；本地 ID 失效回退正确。
注：单设备上难以实测「跨账户隔离」，该路径由自动化测试（9–11）覆盖，真机仅做冒烟。

## 13. 文档更新与决策记录

### 13.1 新增文档

- docs/SECURITY.md：信任模型、集合、索引、安全规则、dev/prod、卫生清单。
- docs/MANUAL_TEST_CHECKLIST.md：DevTools + 真机 11 步清单。
### 13.2 更新文档

- ARCHITECTURE：M1 状态、新增页面/服务、profileApi 分发、§6 打包、§9 安全、§11 决策。
- DATA_MODEL：索引表与竞态说明、User 客户端契约、FamilyProfile M1 校验规则与删除延后、本地日规则。
- USER_FLOWS：修正「客户端在 globalData 存储 openid」的旧表述（§1.5 不再存储），补充 M1 流程。
- DEVELOPMENT_PLAN：M1 标记 ✅ 并注明测试通过。
- PRODUCT_REQUIREMENTS：排除项补充「档案删除延后」「营养目标延后」。
- README：里程碑表 M0/M1 ✅、仓库结构、校验说明。
### 13.3 已记录决策

- 单一所有者模型（无多人共享/邀请/角色）。
- 档案删除延后（后续以归档/软删除实现）。
- 本地自然日 YYYY-MM-DD 约定（为 M2 用餐记录分区）。
- 共享运行时打包：编译+复制、无符号链接、生成物不入库，纳入 npm run validate。
- 客户端绝不存储 openid；移除旧文档中相关错误表述。
## 14. Git 与范围控制

分支：feature/m1-identity-family-profiles，自干净的 M0 基线（cc698c2）切出。

聚焦提交（5 个）：

- M1: shared runtime (repository, user/profile services, session) + build packaging
- M1: profileApi cloud function + login uses shared runtime; drop openid from client responses
- M1: client identity/profile UI + auth/profile/session services
- M1: documentation (...) + ignore .workbuddy
- M1: extend validation with 16 M1 acceptance tests
范围控制：未包含任何 M2+ 代码。附带修正：M0 的 cloudfunctions/**/*.js 误忽略导致云函数源码从未入库；M1 修正 .gitignore 改为仅忽略 lib/shared/，使 login/mealApi/aiAnalyze 源码得以纳入版本控制。

## 15. M2 建议（不实现）

建议 M2 聚焦「用餐记录与营养」：

- 扩展 mealApi：meal 的 create/list/get/update，使用活动档案 ID（activeFamilyProfileId）+ 本地日分区（YYYY-MM-DD）。
- 复用 M0 已有的营养工具（validateMeal / sumNutrition / caloriesFromMacros 已在共享运行时与校验中验证），定义 food item 模型与营养汇总。
- 客户端新增记餐列表与「记餐」表单（首页占位已预留），按活动档案归属与本地日筛选。
- 所有权范围沿用 profileApi 的服务端 OPENID 校验，meal 查询以 ownerOpenid + activeFamilyProfileId 隔离。
- 照片/AI 分析延后：provider-neutral 适配层桩已就位，M2 不接真实 AI。
注意：M2 仍保持单一所有者模型，不引入多人共享；openid 继续仅服务端可见。
