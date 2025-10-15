1. Implantar Infraestrutura Completa:

# Torne os scripts executáveis

chmod +x deploy-cloudformation.sh frontend-deploy.sh

# Implantar infraestrutura

./deploy-cloudformation.sh

# Implantar frontend

./frontend-deploy.sh

2. Implantar via AWS CLI:

# Criar stack

aws cloudformation create-stack \
 --stack-name iamigos-dental-infra \
 --template-body file://iamigos-dental-cloudformation.yml \
 --parameters \
 ParameterKey=Environment,ParameterValue=prod \
 ParameterKey=ProjectName,ParameterValue=iamigos-dental \
 --capabilities CAPABILITY_NAMED_IAM \
 --region us-east-1 3.

Verificar Status:

aws cloudformation describe-stacks \
 --stack-name iamigos-dental-infra \
 --region us-east-1
