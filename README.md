# 🎴 UNO Online

一个基于 Web 的联机 UNO 卡牌游戏，支持多种游戏预设、用户管理、实时对战与观战。前端使用 React + TypeScript + Material Design 3，后端使用 Node.js + Express + Socket.IO + SQLite。

[![爱发电](https://img.shields.io/badge/赞助-爱发电-946ce6?style=flat&labelColor=444444&logoSize=auto)](https://afdian.com/a/msyark)

## ✨ 功能特性

### 用户系统
- 用户注册 / 登录 / 登出（JWT 认证）
- 昵称、邮箱、密码修改
- **邮箱验证**：可开启注册邮箱验证（验证码 60 秒冷却），支持 SMTP 配置
- **忘记密码**：通过邮箱验证码重置密码
- **称号系统**：管理员可启用称号权限，用户可设置称号（≤10 字符）与展示颜色；支持永久或过期时间（过期自动清除）

### 游戏玩法
- **UNO Standard**：经典玩法
- **UNO Flip**：深浅双面卡牌，翻面牌切换两面，支持预览另一面
- **UNO No Mercy**：168 张牌、+2/+4/+6/+10 叠加、7 换牌、0 交牌、弃牌（同色全出）、颜色轮盘、40 张爆牌规则（阈值可配置）

### 房间与对战
- 创建 / 加入房间，支持最多 10 名玩家
- **观战模式**：可随时进入房间观战
- 管理员可在房间中踢出 / 封禁玩家
- 实时游戏状态同步（手牌、回合、方向、当前颜色）

### 管理后台
- 用户管理：角色、状态（封禁）、邮箱、称号管理、重置密码
- 系统设置：注册开关、最大玩家数、回合超时、UNO 罚牌数、No Mercy 爆牌阈值、公告
- **公告系统**：支持 HTML，版本控制，"不再显示" 记忆
- **邮箱配置**：SMTP 配置与连通性测试

## 🛠️ 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18, TypeScript, Vite, React Router, Socket.IO Client, Material Web 2 |
| 后端 | Node.js, Express, Socket.IO, better-sqlite3, JWT, bcryptjs, nodemailer |

## 📁 目录结构

```
UNOnline/
├── server/                 # 后端
│   ├── src/
│   │   ├── index.js        # Express + Socket.IO 入口
│   │   ├── db.js           # SQLite 数据库与迁移
│   │   ├── mail.js         # 邮件发送（SMTP）
│   │   ├── title.js        # 称号有效性逻辑
│   │   ├── verification.js # 验证码生成 / 校验 / 冷却
│   │   ├── middleware/     # JWT 认证中间件
│   │   ├── routes/         # auth / admin API
│   │   └── game/           # 游戏引擎
│   │       ├── engine.js           # UNO Standard 引擎
│   │       ├── flip-engine.js      # UNO Flip 引擎
│   │       ├── no-mercy-engine.js  # UNO No Mercy 引擎
│   │       └── manager.js          # 房间管理器
│   └── package.json
├── client/                 # 前端
│   ├── src/
│   │   ├── pages/          # 登录/注册/验证/忘记密码/大厅/游戏
│   │   ├── components/     # 卡牌、手牌组件
│   │   ├── context/        # 认证上下文
│   │   ├── api/            # REST API 客户端
│   │   └── types/          # TypeScript 类型
│   └── package.json
└── README.md
```

## 🚀 快速开始

### 环境要求
- Node.js ≥ 18

### 1. 安装依赖

```bash
# 后端
cd server
npm install

# 前端
cd ../client
npm install
```

### 2. 构建前端

```bash
cd client
npx vite build
```

### 3. 启动服务器

```bash
cd server
npm start
```

访问 **http://localhost:3001** 即可。

> **注意**：生产环境服务器直接托管 `client/dist` 静态文件。若修改了前端代码，需重新执行 `npx vite build`。

### 开发模式

```bash
# 后端热重载
cd server && npm run dev

# 前端开发服务器（代理到 3001）
cd client && npm run dev
```

## ⚙️ 环境变量

后端支持通过环境变量或 `server/.env` 配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3001` |
| `JWT_SECRET` | JWT 签名密钥 | `uno-online-secret`（生产环境请修改） |
| `DB_PATH` | SQLite 数据库路径 | `./data/uno.db` |

## 🎮 游戏模式说明

### UNO Standard
经典 108 张牌玩法，包含跳过、反转、+2、万能牌、+4，支持加牌叠加。

### UNO Flip
- 每张牌有深浅两面，随机配对
- 翻面牌（Flip）切换全场深浅面
- 支持按住按钮预览另一面
- 深色面颜色：橙、紫、粉、青

### UNO No Mercy
- 大量功能牌：+2/+4/+6/+10（可叠加）、弃牌、跳过一轮
- **7 换牌**：指定玩家交换手牌
- **0 交牌**：所有玩家把手牌交给下家
- **颜色轮盘**：选色后连续抽牌直到抽到所选颜色
- **爆牌**：手牌达到阈值（默认 40，可配置 20-100）即出局，排名垫底

## 🎨 公告系统

管理员可在「管理面板 → 系统设置」编辑公告（支持 HTML）。每次内容变更版本号 +1，用户打开首页时若版本号更新则弹出公告对话框，可选择「关闭」或「不再显示」。

## 🎉 称号系统

- 管理员在「用户管理 → 称号管理」中启用用户的称号权限
- 有权限的用户在大厅右上角出现「称号管理」按钮，可设置称号、展示颜色，以及永久 / 过期时间
- 拥有称号的用户在游戏内与在线列表中以指定颜色显示 `『称号』昵称`
- 过期时间过后称号自动清除

## 📮 邮箱验证

管理员可在「管理面板 → 邮箱配置」配置 SMTP 并开启邮箱验证：

1. 填写 SMTP 服务器、端口、用户名、密码、发件人邮箱
2. 点击「保存 SMTP 配置」
3. 开启「邮箱验证」前会自动测试 SMTP 连通性
4. 开启后，注册用户需通过邮箱验证码验证；忘记密码也需邮箱验证码

## 🔐 管理员

第一个注册的用户自动成为管理员。管理员可在「管理面板」中：

- 管理用户（角色、封禁、邮箱、称号、重置密码）
- 配置系统设置（注册开关、游戏参数、公告）
- 配置邮箱（SMTP、验证开关）
- 在游戏房间中踢出 / 封禁玩家

## 📝 License

本项目基于 [MIT License](LICENSE)。
