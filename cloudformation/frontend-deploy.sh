#!/bin/bash

# Script para deploy do frontend no S3
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
STACK_NAME="iamigos-dental-infra"
REGION="us-east-1"
FRONTEND_DIR="./frontend"  # Ajuste para o caminho dos seus arquivos

echo -e "${GREEN}🚀 Iniciando deploy do frontend IAmigos Dental${NC}"

# Get S3 bucket from CloudFormation outputs
echo -e "${YELLOW}📋 Obtendo bucket S3 da stack CloudFormation...${NC}"
BUCKET_NAME=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
    --output text)

if [ -z "$BUCKET_NAME" ]; then
    echo -e "${RED}❌ Não foi possível encontrar o bucket S3 na stack${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Bucket encontrado: $BUCKET_NAME${NC}"

# Check if frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${YELLOW}📁 Diretório frontend não encontrado. Criando estrutura básica...${NC}"
    mkdir -p $FRONTEND_DIR
    # Aqui você copiaria seus arquivos frontend para o diretório
    echo -e "${YELLOW}⚠️  Adicione seus arquivos frontend em $FRONTEND_DIR${NC}"
    exit 1
fi

# Upload files to S3
echo -e "${YELLOW}📤 Fazendo upload dos arquivos para S3...${NC}"

# Upload HTML files with no cache
echo -e "${YELLOW}📄 Enviando arquivos HTML...${NC}"
aws s3 sync $FRONTEND_DIR/ "s3://$BUCKET_NAME" \
    --delete \
    --exclude "*" \
    --include "*.html" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --region $REGION

# Upload CSS files
echo -e "${YELLOW}🎨 Enviando arquivos CSS...${NC}"
aws s3 sync $FRONTEND_DIR/ "s3://$BUCKET_NAME" \
    --delete \
    --exclude "*" \
    --include "*.css" \
    --cache-control "max-age=86400" \
    --region $REGION

# Upload JS files
echo -e "${YELLOW}⚡ Enviando arquivos JavaScript...${NC}"
aws s3 sync $FRONTEND_DIR/ "s3://$BUCKET_NAME" \
    --delete \
    --exclude "*" \
    --include "*.js" \
    --cache-control "max-age=86400" \
    --region $REGION

# Upload images and other assets
echo -e "${YELLOW}🖼️  Enviando imagens e assets...${NC}"
aws s3 sync $FRONTEND_DIR/ "s3://$BUCKET_NAME" \
    --delete \
    --exclude "*.html" \
    --exclude "*.css" \
    --exclude "*.js" \
    --cache-control "max-age=86400" \
    --region $REGION

# Get website URL
WEBSITE_URL=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs[?OutputKey==`FrontendWebsiteURL`].OutputValue' \
    --output text)

echo -e "\n${GREEN}🎉 Frontend implantado com sucesso!${NC}"
echo -e "${YELLOW}📋 Informações:${NC}"
echo -e "   🌐 Website URL: ${GREEN}$WEBSITE_URL${NC}"
echo -e "   📦 S3 Bucket: ${GREEN}$BUCKET_NAME${NC}"
echo -e "   📍 Região: ${GREEN}$REGION${NC}"

echo -e "\n${YELLOW}🔧 Teste o deploy:${NC}"
echo -e "   1. Acesse: ${GREEN}$WEBSITE_URL${NC}"
echo -e "   2. Verifique todas as páginas"
echo -e "   3. Teste a integração com Lex"

echo -e "\n${GREEN}✅ IAmigos Dental está no ar! 🚀${NC}"