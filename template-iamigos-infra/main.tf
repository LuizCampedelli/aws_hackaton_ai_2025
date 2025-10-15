# main.tf
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# S3 Buckets
resource "aws_s3_bucket" "static_website" {
  bucket = "${var.project_name}-static-${var.environment}"

  tags = {
    Name        = "${var.project_name}-static"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_s3_bucket" "documents" {
  bucket = "${var.project_name}-documents-${var.environment}"

  tags = {
    Name        = "${var.project_name}-documents"
    Environment = var.environment
    Project     = var.project_name
  }
}

# DynamoDB Table
resource "aws_dynamodb_table" "dental_claims" {
  name           = "${var.project_name}-claims-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "sessionId"
  range_key      = "createdAt"

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "createdAt"
    type = "S"
  }

  attribute {
    name = "claimType"
    type = "S"
  }

  # GSI para consultas por tipo de claim
  global_secondary_index {
    name            = "ClaimTypeIndex"
    hash_key        = "claimType"
    range_key       = "createdAt"
    projection_type = "ALL"
    read_capacity   = 5
    write_capacity  = 5
  }

  tags = {
    Name        = "${var.project_name}-claims"
    Environment = var.environment
    Project     = var.project_name
  }
}

# SNS Topics
resource "aws_sns_topic" "client_notifications" {
  name = "${var.project_name}-client-notifications-${var.environment}"

  tags = {
    Name        = "${var.project_name}-client-notifications"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_sns_topic" "dentist_notifications" {
  name = "${var.project_name}-dentist-notifications-${var.environment}"

  tags = {
    Name        = "${var.project_name}-dentist-notifications"
    Environment = var.environment
    Project     = var.project_name
  }
}

# SQS Queue + DLQ
resource "aws_sqs_queue" "processing_queue" {
  name                      = "${var.project_name}-processing-${var.environment}"
  delay_seconds             = 0
  max_message_size          = 262144
  message_retention_seconds = 86400  # 1 dia
  receive_wait_time_seconds = 10

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.processing_dlq.arn
    maxReceiveCount     = 3
  })

  tags = {
    Name        = "${var.project_name}-processing"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_sqs_queue" "processing_dlq" {
  name = "${var.project_name}-processing-dlq-${var.environment}"

  tags = {
    Name        = "${var.project_name}-processing-dlq"
    Environment = var.environment
    Project     = var.project_name
  }
}

# Lambda Function
resource "aws_lambda_function" "orchestrator" {
  filename         = var.lambda_zip_path
  function_name    = "${var.project_name}-orchestrator-${var.environment}"
  role            = aws_iam_role.lambda_exec.arn
  handler         = "lambda_function.lambda_handler"
  runtime         = "python3.9"
  timeout         = 30
  memory_size     = 256

  environment {
    variables = {
      DYNAMO_TABLE        = aws_dynamodb_table.dental_claims.name
      DOCUMENTS_BUCKET    = aws_s3_bucket.documents.bucket
      SQS_QUEUE_URL       = aws_sqs_queue.processing_queue.url
      SNS_TOPIC_CLIENTES  = aws_sns_topic.client_notifications.arn
      SNS_TOPIC_DENTISTAS = aws_sns_topic.dentist_notifications.arn
      BEDROCK_MODEL_ID    = var.bedrock_model_id
      ENVIRONMENT         = var.environment
    }
  }

  tags = {
    Name        = "${var.project_name}-orchestrator"
    Environment = var.environment
    Project     = var.project_name
  }
}

# API Gateway
resource "aws_api_gateway_rest_api" "iamigos_api" {
  name        = "${var.project_name}-api-${var.environment}"
  description = "API Gateway para IAmigos Dental"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = {
    Name        = "${var.project_name}-api"
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "static_site" {
  origin {
    domain_name = aws_s3_bucket.static_website.bucket_regional_domain_name
    origin_id   = "S3StaticSite"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.static_site.cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3StaticSite"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  price_class = "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = {
    Name        = "${var.project_name}-cdn"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_cloudfront_origin_access_identity" "static_site" {
  comment = "OAI for ${var.project_name} static site"
}