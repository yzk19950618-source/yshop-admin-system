# =============================================================================
# 单容器：Node 构建前端 + Maven 构建后端 + JRE 运行（Spring Boot 托管 /app/static）
# =============================================================================
# 构建上下文：仓库根（需含 backend/、frontend/ 子模块或目录；云托管请开启 Submodule）
#
# 本地构建示例：
#   docker build -t yshop-admin:local .
#
# 说明：
#   - 前端：阶段 node 内执行 npm ci + npm run build，产物目录为 frontend/dist（见下方 npm 脚本）
#   - 后端：mvn 与现有 backend/Dockerfile 一致，打 yshop-server 模块
#   - 子模块检查：保留 backend/pom.xml 存在性校验
#   - 路由 history：见 co.yixiang.yshop.server.config.VueSpaHistoryForwardFilter（@Profile cloud）

# -----------------------------------------------------------------------------
# 阶段 1：Node — 构建 Vue 前端，产物 → frontend/dist
# -----------------------------------------------------------------------------
FROM node:20-bookworm AS frontend-builder

WORKDIR /build/frontend
COPY frontend/ ./

# npm install / npm ci；有 scripts.build 则 npm run build，否则 vite 生产构建（固定 VITE_OUT_DIR=dist）
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi \
    && if node -e "process.exit(require('./package.json').scripts?.build ? 0 : 1)"; then npm run build; else VITE_OUT_DIR=dist npx vite build --mode production; fi

RUN test -f dist/index.html || (echo "ERROR: 前端构建未生成 dist/index.html" >&2; ls -la dist 2>&1 || true; exit 1)

# -----------------------------------------------------------------------------
# 阶段 2：Maven — 构建 Spring Boot，产物 → backend/yshop-server/target/yshop-server.jar
# -----------------------------------------------------------------------------
FROM maven:3.9-eclipse-temurin-17 AS backend-builder

WORKDIR /build
COPY backend/ .

RUN test -f pom.xml || ( \
      echo "ERROR: 构建上下文中缺少 backend/pom.xml（请检查子模块是否检出）。" >&2; \
      ls -la >&2; \
      exit 1 \
    )

RUN mvn -f pom.xml clean package -pl yshop-server -am -DskipTests -B

RUN test -f yshop-server/target/yshop-server.jar || ( \
      echo "ERROR: 未找到 yshop-server/target/yshop-server.jar" >&2; \
      ls -la yshop-server/target >&2 || true; \
      exit 1 \
    )

# -----------------------------------------------------------------------------
# 阶段 3：运行时 — JRE + JAR + 静态资源
# -----------------------------------------------------------------------------
FROM eclipse-temurin:17-jre-jammy

RUN mkdir -p /app/static \
    && apt-get update -qq \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=backend-builder /build/yshop-server/target/yshop-server.jar /app/app.jar
COPY --from=frontend-builder /build/frontend/dist/ /app/static/

RUN test -f /app/static/index.html || (echo "ERROR: /app/static/index.html 缺失" >&2; exit 1)

ENV TZ=Asia/Shanghai
ENV JAVA_OPTS="-Xms512m -Xmx1024m -Djava.security.egd=file:/dev/./urandom"
ENV SPRING_PROFILES_ACTIVE=local,cloud
ENV PORT=8080

EXPOSE 8080

# 云托管会注入 PORT；history 回退由 VueSpaHistoryForwardFilter（cloud profile）处理
ENTRYPOINT ["sh", "-c", "exec java ${JAVA_OPTS} -jar /app/app.jar --spring.profiles.active=local,cloud --server.port=${PORT} --spring.web.resources.static-locations=file:/app/static/"]
