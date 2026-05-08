/**
 * 微信云托管 CLI 项目配置（@wxcloud/cli / @wxcloud/core）
 *
 * =============================================================================
 * 一、仓库与 Git Submodule
 * =============================================================================
 * 本仓库采用前后端 Git Submodule：聚合仓库根目录下应有子目录 `frontend/`、`backend/`。
 *
 * 首次克隆后务必拉取子模块，否则目录为空、构建与部署会失败：
 *   git submodule update --init --recursive
 *
 * 部署前请确认两个子模块已检出到预期提交。
 *
 * =============================================================================
 * 一.1、云托管「Dockerfile 构建」与 Buildpack 失败说明
 * =============================================================================
 * 判断方式：构建日志若出现「===> DETECTING」「buildpacksio/lifecycle」，说明当前走的是
 * Buildpack 源码构建，并未执行根目录 Dockerfile 的「FROM ...」步骤。
 *
 * 推荐：在「创建版本」中显式选择 Dockerfile 构建，构建目录为仓库根「.」，Dockerfile 填 ./Dockerfile，
 * 并将含该文件的提交推送到远端后再发版。
 *
 * 子模块：若构建日志提示 backend 无 pom.xml 或「transferring context」极小，请在云托管 Git 中开启「检出子模块」。
 * Dockerfile 只使用上下文中的 backend/，不在镜像内 clone，与 .gitmodules 锁定提交一致。
 *
 * 兼容：若控制台只能使用 Buildpack / 自动检测，本仓库已在根目录增加 pom.xml，将子模块 backend
 * 作为 Maven 模块接入，以便 Java Maven buildpack 能在根目录发现 pom.xml（仍需开启 Git Submodule，
 * 否则 backend 目录为空，Maven 仍会失败）。
 *
 * 原错误「No buildpacks participating」多因根目录无 pom.xml、无 package.json；勿仅依赖子目录内文件。
 *
 * =============================================================================
 * 二、部署模式说明（为何使用 type: "custom"）
 * =============================================================================
 * - 官方「混合部署」type: "universal" 开箱仅支持 Next.js / Nuxt，不适用 Vue 3 + Vite。
 * - 使用 @wxcloud/cli 执行「wxcloud deploy」且 type 为 custom 时：
 *   - custom.staticTarget：本地已构建的前端目录 → 静态托管路径（键目录须已存在，例如 frontend/dist-prod）。
 *   - custom.runTarget：指向仓库根下**已存在的**后端 zip 路径；CLI **不会**根据 Dockerfile 自动生成该 zip。
 *     若从未执行打 zip 步骤就 deploy，会出现「找不到包 / 上传失败」等与「打包不到」等效的问题。
 * - 若你**仅在微信云托管控制台**用「Git + Dockerfile」发版后端镜像：一般由平台按 Dockerfile 构建镜像，
 *   此流程**不依赖**本文件中的 runTarget zip；此时 runTarget 主要在你改用「wxcloud deploy 自定义模式」时才必须准备。
 * - 根目录 Dockerfile 与 backend/Dockerfile 用于容器镜像构建；与 custom.runTarget 的 zip 是两条不同产物链路，勿混为一谈。
 *
 * =============================================================================
 * 三、推荐执行顺序（生产 / prod）
 * =============================================================================
 * 1) git submodule update --init --recursive
 * 2) 前端：进入 frontend，安装依赖（本仓库常用 pnpm，与 package.json 脚本一致）：
 *      cd frontend && pnpm install
 *    在设置好后端 API 相关环境变量后执行生产构建（本仓库为）：
 *      pnpm run build:prod
 *    若你使用 npm 且自行配置了 npm run build，请保证产物目录与下方 staticTarget 的「键」一致。
 * 3) 在聚合仓库根目录生成 backend-deploy.zip（内容需符合微信云托管控制台对代码包的要求）。
 * 4) 在聚合仓库根目录执行：wxcloud deploy（需已安装 @wxcloud/cli 并完成登录、选择环境与服务）
 *
 * =============================================================================
 * 四、前端产物目录（staticTarget）与 VITE_OUT_DIR
 * =============================================================================
 * Vite 的 build.outDir 来自 frontend 下的环境变量 VITE_OUT_DIR（见 frontend/vite.config.ts）。
 * 本仓库 frontend/.env.prod 中 VITE_OUT_DIR=dist-prod，故默认 staticTarget 键为 frontend/dist-prod。
 *
 * 若你改为「npm run build」且未指定 mode、且 .env.production 中 VITE_OUT_DIR=dist，则应把 staticTarget
 * 的键改为 frontend/dist，否则会上传空目录或错误目录。
 *
 * =============================================================================
 * 五、后端 API 地址与 VITE_API_BASE_URL（构建期注入）
 * =============================================================================
 * wxcloud.config.js **不会**自动向 Vite 注入任意 VITE_* 变量；必须在执行前端构建**之前**写入环境：
 *   - Linux/macOS: export VITE_API_BASE_URL=https://你的云托管后端域名
 *   - Windows PowerShell: $env:VITE_API_BASE_URL="https://..."
 *
 * 与本仓库代码对齐说明：
 * - 业务代码大量读取 import.meta.env.VITE_BASE_URL、VITE_API_URL、VITE_UPLOAD_URL 等（见 frontend/.env.prod），
 *   仓库内默认**没有**使用 VITE_API_BASE_URL 变量名。
 * - 推荐（改动小）：构建前设置 VITE_BASE_URL 为后端 HTTPS 根地址，并按需设置 VITE_UPLOAD_URL 等。
 * - 若必须使用名称 VITE_API_BASE_URL：可在 frontend/vite.config.ts 中通过 define 将其映射到现有逻辑，
 *   或逐步把请求基址改为读取 import.meta.env.VITE_API_BASE_URL（改动面较大）。
 *
 * =============================================================================
 * 六、可选：自定义 CDN 域名（client）
 * =============================================================================
 * 若已配置静态资源自定义域名，可取消注释并填写 customDomain（参见微信云托管「项目配置」文档）。
 * 无需时可保持注释状态。
 */

/** @type {import("@wxcloud/core").CloudConfig} */
const cloudConfig = {
  // custom：自定义静态目录 + zip 代码包（非 universal 开箱框架）
  type: 'custom',

  // 云托管服务元信息：端口需与 Spring Boot / 代码包内进程监听一致；versionRemark 用于版本备注（生产 prod）
  server: {
    port: 8080,
    buildDir: '.',
    versionRemark: 'prod'
  },

  // 有静态自定义域名需求时再启用（参见官方文档 client.customDomain）
  // client: {
  //   customDomain: 'cdn.example.com'
  // },

  custom: {
    // 键：相对【聚合仓库根】的本地目录；值：静态托管上的远端路径（'' 表示根路径）
    // 默认对齐本仓库 pnpm run build:prod + .env.prod → dist-prod；若你的产物在 frontend/dist，请改键名
    staticTarget: {
      'frontend/dist-prod': ''
    },
    // 相对聚合仓库根的 zip 路径；wxcloud deploy 前须已存在且符合云托管代码包规范
    runTarget: 'backend-deploy.zip'
  }
}

module.exports = cloudConfig
