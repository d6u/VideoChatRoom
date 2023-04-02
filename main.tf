terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

provider "archive" {}

provider "aws" {
  region = "us-west-1"
}

locals {
  lambda_sources = {
    connect       = "lambdas/websocket/connect"
    default       = "lambdas/websocket/default"
    disconnect    = "lambdas/websocket/disconnect"
    JoinRoom      = "lambdas/websocket/JoinRoom"
    DirectMessage = "lambdas/websocket/DirectMessage"
    RoomAction    = "lambdas/sqs/RoomAction"
  }

  server_source = "server"
}

data "archive_file" "lambda_source_zip_files" {
  for_each = local.lambda_sources

  type        = "zip"
  excludes    = []
  source_dir  = each.value
  output_path = "build/${replace(each.value, "/", "_")}.zip"
}

resource "null_resource" "typescript_transpile" {
  triggers = {
    random = timestamp()
  }

  provisioner "local-exec" {
    command     = "rm -rf node_modules && npm install && tsc"
    working_dir = local.server_source
  }
}

data "archive_file" "server_source_zip_file" {
  depends_on = [
    resource.null_resource.typescript_transpile
  ]

  type        = "zip"
  excludes    = ["src", "README.md", "tsconfig.json"]
  source_dir  = local.server_source
  output_path = "build/server.zip"
}

resource "aws_s3_bucket" "gameroom-deployment" {
  bucket = "gameroom-deployment"
}

resource "aws_s3_bucket_acl" "gameroom-deployment" {
  bucket = aws_s3_bucket.gameroom-deployment.id
  acl    = "private"
}

resource "aws_s3_bucket_versioning" "gameroom-deployment-versioning" {
  bucket = aws_s3_bucket.gameroom-deployment.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_object" "lambda_source_s3_objects" {
  for_each = data.archive_file.lambda_source_zip_files

  bucket = aws_s3_bucket.gameroom-deployment.id
  key    = "${split(".", each.value.output_path)[0]}_${each.value.output_md5}.zip"
  source = each.value.output_path
  etag   = filemd5(each.value.output_path)
}

resource "aws_s3_object" "server_source_s3_object" {
  bucket = aws_s3_bucket.gameroom-deployment.id
  key    = "${split(".", data.archive_file.server_source_zip_file.output_path)[0]}_${data.archive_file.server_source_zip_file.output_md5}.zip"
  source = data.archive_file.server_source_zip_file.output_path
  etag   = filemd5(data.archive_file.server_source_zip_file.output_path)
}

resource "aws_cloudformation_stack" "gameroom_stack" {
  name         = "GameroomStack"
  capabilities = ["CAPABILITY_NAMED_IAM"]
  parameters = {
    LambdaSourceS3KeyConnect       = aws_s3_object.lambda_source_s3_objects["connect"].key
    LambdaSourceS3KeyDisconnect    = aws_s3_object.lambda_source_s3_objects["disconnect"].key
    LambdaSourceS3KeyDefault       = aws_s3_object.lambda_source_s3_objects["default"].key
    LambdaSourceS3KeyJoinRoom      = aws_s3_object.lambda_source_s3_objects["JoinRoom"].key
    LambdaSourceS3KeyDirectMessage = aws_s3_object.lambda_source_s3_objects["DirectMessage"].key
    LambdaSourceS3KeyRoomAction    = aws_s3_object.lambda_source_s3_objects["RoomAction"].key
    ServerSourceS3Key              = aws_s3_object.server_source_s3_object.key
  }
  template_body = file("cloudformation-template.yaml")
}

locals {
  http_endpoint_url        = aws_cloudformation_stack.gameroom_stack.outputs["HttpEndpointUrl"]
  websocket_endpoint_url   = aws_cloudformation_stack.gameroom_stack.outputs["WebSocketEndpointUrl"]
  s3_bucket_front_end_name = aws_cloudformation_stack.gameroom_stack.outputs["S3BucketFrontEndName"]
}

output "http_endpoint_url" {
  value = local.http_endpoint_url
}

output "websocket_endpoint_url" {
  value = local.websocket_endpoint_url
}

output "s3_bucket_front_end_name" {
  value = local.s3_bucket_front_end_name
}

output "cloud_front_domain_name" {
  value = aws_cloudformation_stack.gameroom_stack.outputs["CloudFrontDomainName"]
}

resource "local_file" "api_endpoints" {
  content = jsonencode({
    http_endpoint_url      = local.http_endpoint_url
    websocket_endpoint_url = local.websocket_endpoint_url
  })
  filename = "frontend/src/api_endpoints.json"
}

resource "null_resource" "gameroom_frontend" {
  depends_on = [
    local_file.api_endpoints,
  ]

  triggers = {
    random = timestamp()
  }

  provisioner "local-exec" {
    working_dir = "${path.module}/frontend"
    # Use `aws s3 sync` command line to upload static files so content-type
    # can be detected automatically
    command = "npm run build && aws s3 sync build s3://${local.s3_bucket_front_end_name}"
  }
}
