#!/bin/bash

# Script de Deploy com CloudFormation - IAmigos Dental
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
STACK_NAME="iamigos-dental-infra"
TEMPLATE_FILE="iamigos-dental-cloudformation.yml"
ENVIRONMENT="prod"
REGION="us-east-1"

echo -e "${GREEN}🚀 Iniciando deploy da infraestrutura IAmigos Dental com CloudFormation${NC}"

# Check if stack exists
echo -e "${YELLOW}📋 Verificando stack existente...${NC}"
if aws cloudformation describe-stacks --stack-name $STACK_NAME --region $REGION &>/dev/null; then
    echo -e "${YELLOW}🔄 Stack existente encontrada. Atualizando...${NC}"
    ACTION="update-stack"
    WAIT_ACTION="stack-update-complete"
else
    echo -e "${YELLOW}🆕 Criando nova stack...${NC}"
    ACTION="create-stack"
    WAIT_ACTION="stack-create-complete"
fi

# Deploy CloudFormation stack
echo -e "${YELLOW}🏗️  Implantando infraestrutura...${NC}"
aws cloudformation $ACTION \
    --stack-name $STACK_NAME \
    --template-body file://$TEMPLATE_FILE \
    --parameters \
        ParameterKey=Environment,ParameterValue=$ENVIRONMENT \
        ParameterKey=ProjectName,ParameterValue="iamigos-dental" \
        ParameterKey=LexBotName,ParameterValue="IAmigosDentalBot" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region $REGION

echo -e "${YELLOW}⏳ Aguardando conclusão do deploy...${NC}"
aws cloudformation wait $WAIT_ACTION \
    --stack-name $STACK_NAME \
    --region $REGION

# Get outputs
echo -e "${YELLOW}📊 Obtendo outputs da stack...${NC}"
OUTPUTS=$(aws cloudformation describe-stacks \
    --stack-name $STACK_NAME \
    --region $REGION \
    --query 'Stacks[0].Outputs')

# Display outputs
echo -e "\n${GREEN}🎉 Infraestrutura implantada com sucesso!${NC}"
echo -e "${YELLOW}📋 Outputs da Stack:${NC}"

echo $OUTPUTS | jq -r '.[] | "\(.Description): \(.Value)"' | while read line; do
    echo -e "   ${GREEN}✅${NC} $line"
done

# Extract specific outputs
WEBSITE_URL=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="FrontendWebsiteURL") | .Value')
BUCKET_NAME=$(echo $OUTPUTS | jq -r '.[] | select(.OutputKey=="FrontendBucketName") | .Value')

echo -e "\n${YELLOW}🔧 Próximos passos:${NC}"
echo -e "   1. 🌐 Website URL: ${GREEN}$WEBSITE_URL${NC}"
echo -e "   2. 📦 S3 Bucket: ${GREEN}$BUCKET_NAME${NC}"
echo -e "   3. 📁 Faça upload dos arquivos do frontend:"
echo -e "      ${YELLOW}aws s3 sync ./frontend/ s3://$BUCKET_NAME --delete${NC}"
echo -e "   4. 🤖 Teste o bot Lex no console AWS"
echo -e "   5. ⚡ Faça upload do código Lambda"

echo -e "\n${GREEN}✅ Infraestrutura IAmigos Dental pronta!${NC}"