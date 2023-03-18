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
    CreateRoom      = "lambdas/http/CreateRoom"
    GetRoomDeltas   = "lambdas/http/GetRoomDeltas"
    GetRoomSnapshot = "lambdas/http/GetRoomSnapshot"
    connect         = "lambdas/websocket/connect"
    default         = "lambdas/websocket/default"
    disconnect      = "lambdas/websocket/disconnect"
    JoinRoom        = "lambdas/websocket/JoinRoom"
    ConnectClient   = "lambdas/websocket/ConnectClient"
    RoomAction      = "lambdas/sqs/RoomAction"
  }
}

data "archive_file" "lambda_source_zip_files" {
  for_each = local.lambda_sources

  type        = "zip"
  excludes    = []
  source_dir  = each.value
  output_path = "build/${replace(each.value, "/", "_")}.zip"
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

resource "aws_cloudformation_stack" "gameroom_stack" {
  name         = "GameroomStack"
  capabilities = ["CAPABILITY_NAMED_IAM"]
  parameters = {
    LambdaSourceS3KeyCreateRoom      = aws_s3_object.lambda_source_s3_objects["CreateRoom"].key
    LambdaSourceS3KeyGetRoomDeltas   = aws_s3_object.lambda_source_s3_objects["GetRoomDeltas"].key
    LambdaSourceS3KeyGetRoomSnapshot = aws_s3_object.lambda_source_s3_objects["GetRoomSnapshot"].key
    LambdaSourceS3KeyConnect         = aws_s3_object.lambda_source_s3_objects["connect"].key
    LambdaSourceS3KeyDisconnect      = aws_s3_object.lambda_source_s3_objects["disconnect"].key
    LambdaSourceS3KeyDefault         = aws_s3_object.lambda_source_s3_objects["default"].key
    LambdaSourceS3KeyJoinRoom        = aws_s3_object.lambda_source_s3_objects["JoinRoom"].key
    LambdaSourceS3KeyConnectClient   = aws_s3_object.lambda_source_s3_objects["ConnectClient"].key
    LambdaSourceS3KeyRoomAction      = aws_s3_object.lambda_source_s3_objects["RoomAction"].key
  }
  template_body = file("cloudformation-template.yaml")
}

locals {
  http_endpoint_url      = aws_cloudformation_stack.gameroom_stack.outputs["HttpEndpointUrl"]
  websocket_endpoint_url = aws_cloudformation_stack.gameroom_stack.outputs["WebSocketEndpointUrl"]
}

output "http_endpoint_url" {
  value = local.http_endpoint_url
}

output "websocket_endpoint_url" {
  value = local.websocket_endpoint_url
}

resource "local_file" "api_endpoints" {
  content = jsonencode({
    http_endpoint_url      = local.http_endpoint_url
    websocket_endpoint_url = local.websocket_endpoint_url
  })
  filename = "react-webrtc/src/api_endpoints.json"
}
