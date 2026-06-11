#!/bin/bash
# Grid Games (格子熵) — Docker build, tag & push to private registry
# Pattern aligned with chigua/Poetica-6 deploy scripts

set -e

IMAGE_NAME="grid-games"
REGISTRY="zzxun.cn:5000"
TAG="latest"

echo "🎮 格子熵 · Grid Games — 部署开始..."

# Build Docker image
echo "📦 构建 Docker 镜像..."
docker build -t ${IMAGE_NAME}:${TAG} .

# Tag for private registry
echo "🏷️ 打标签..."
docker tag ${IMAGE_NAME}:${TAG} ${REGISTRY}/${IMAGE_NAME}:${TAG}

# Push to private registry
echo "📤 推送到私有仓库..."
docker push ${REGISTRY}/${IMAGE_NAME}:${TAG}

echo "✅ 部署完成！"
echo "镜像地址: ${REGISTRY}/${IMAGE_NAME}:${TAG}"
echo ""
echo "远程服务器拉取并运行："
echo "  docker pull ${REGISTRY}/${IMAGE_NAME}:${TAG}"
echo "  docker-compose up -d"
