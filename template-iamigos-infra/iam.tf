# iam.tf
resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-lambda-exec-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-lambda-exec"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_policy" "lambda_dynamodb" {
  name        = "${var.project_name}-lambda-dynamodb-${var.environment}"
  description = "Permissões DynamoDB para Lambda Orchestrator"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.dental_claims.arn,
          "${aws_dynamodb_table.dental_claims.arn}/index/*"
        ]
      }
    ]
  })
}

resource "aws_iam_policy" "lambda_sns" {
  name        = "${var.project_name}-lambda-sns-${var.environment}"
  description = "Permissões SNS para Lambda Orchestrator"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          aws_sns_topic.client_notifications.arn,
          aws_sns_topic.dentist_notifications.arn
        ]
      }
    ]
  })
}

resource "aws_iam_policy" "lambda_s3" {
  name        = "${var.project_name}-lambda-s3-${var.environment}"
  description = "Permissões S3 para Lambda Orchestrator"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.documents.arn}/*",
          "${aws_s3_bucket.static_website.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_policy" "lambda_sqs" {
  name        = "${var.project_name}-lambda-sqs-${var.environment}"
  description = "Permissões SQS para Lambda Orchestrator"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.processing_queue.arn,
          aws_sqs_queue.processing_dlq.arn
        ]
      }
    ]
  })
}

resource "aws_iam_policy" "lambda_ai_services" {
  name        = "${var.project_name}-lambda-ai-${var.environment}"
  description = "Permissões AI/ML para Lambda Orchestrator"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "textract:AnalyzeExpense",
          "lex:PostText",
          "lex:PutSession"
        ]
        Resource = "*"
      }
    ]
  })
}

# Anexar todas as políticas ao role Lambda
resource "aws_iam_role_policy_attachment" "lambda_dynamodb" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_dynamodb.arn
}

resource "aws_iam_role_policy_attachment" "lambda_sns" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_sns.arn
}

resource "aws_iam_role_policy_attachment" "lambda_s3" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_s3.arn
}

resource "aws_iam_role_policy_attachment" "lambda_sqs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_sqs.arn
}

resource "aws_iam_role_policy_attachment" "lambda_ai_services" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_ai_services.arn
}