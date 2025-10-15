# variables.tf
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Nome do projeto"
  type        = string
  default     = "iamigos-dental"
}

variable "environment" {
  description = "Ambiente de deploy"
  type        = string
  default     = "dev"
}

variable "lambda_zip_path" {
  description = "Caminho para o arquivo ZIP da Lambda"
  type        = string
  default     = "lambda_function_payload.zip"
}

variable "bedrock_model_id" {
  description = "ID do modelo Bedrock"
  type        = string
  default     = "amazon.titan-text-express-v1"
}

# outputs.tf
output "static_website_url" {
  description = "URL do site estático"
  value       = "https://${aws_cloudfront_distribution.static_site.domain_name}"
}

output "api_gateway_url" {
  description = "URL da API Gateway"
  value       = aws_api_gateway_rest_api.iamigos_api.api_endpoint
}

output "dynamodb_table_name" {
  description = "Nome da tabela DynamoDB"
  value       = aws_dynamodb_table.dental_claims.name
}

output "lambda_function_name" {
  description = "Nome da função Lambda"
  value       = aws_lambda_function.orchestrator.function_name
}