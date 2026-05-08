# 聚合仓库根目录 Dockerfile — 供微信云托管「Dockerfile 构建」使用
#
# 背景：若仅在仓库根执行 Buildpacks，根目录无 pom.xml / package.json，会报
#   No buildpacks participating / failed to detect
# 本文件将构建上下文指向子目录 backend（Git Submodule），与 backend/Dockerfile 行为一致。
#
# 必做：
#   1) 在云托管「版本配置 / Git」中开启子模块检出（或保证构建时 backend/ 内已有 pom.xml）。
#   2) 服务「创建版本」选择 Dockerfile 构建（勿用仅 Buildpack 的默认检测），构建目录为仓库根「.」。
#
# 环境变量与运行说明同 backend/Dockerfile

FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /build
COPY backend/ .
# 子模块未拉取时 backend 为空，尽早失败并给出明确日志
RUN test -f pom.xml || (echo "ERROR: backend/pom.xml 不存在。请在云托管开启 Git Submodule，或先 git submodule update --init。" >&2 && exit 1)
RUN mvn -f pom.xml clean package -pl yshop-server -am -DskipTests -B

FROM eclipse-temurin:17-jre-jammy

RUN mkdir -p /app \
    && apt-get update -qq \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /build/yshop-server/target/yshop-server.jar app.jar

ENV TZ=Asia/Shanghai
ENV JAVA_OPTS="-Xms512m -Xmx1024m -Djava.security.egd=file:/dev/./urandom"
ENV SPRING_PROFILES_ACTIVE=local,cloud
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "exec java ${JAVA_OPTS} -jar /app/app.jar --spring.profiles.active=local,cloud --server.port=${PORT}"]
