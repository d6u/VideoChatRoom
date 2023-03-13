terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

provider "archive" {}

data "archive_file" "lambdas-http-CreateRoom" {
  type        = "zip"
  excludes    = []
  source_dir  = "lambdas/http/CreateRoom"
  output_path = "lambdas-http-CreateRoom.zip"
}

data "archive_file" "lambdas-websocket-connect" {
  type        = "zip"
  excludes    = []
  source_dir  = "lambdas/websocket/connect"
  output_path = "lambdas-websocket-connect.zip"
}

data "archive_file" "lambdas-websocket-default" {
  type        = "zip"
  excludes    = []
  source_dir  = "lambdas/websocket/default"
  output_path = "lambdas-websocket-default.zip"
}

data "archive_file" "lambdas-websocket-disconnect" {
  type        = "zip"
  excludes    = []
  source_dir  = "lambdas/websocket/disconnect"
  output_path = "lambdas-websocket-disconnect.zip"
}

data "archive_file" "lambdas-websocket-JoinRoom" {
  type        = "zip"
  excludes    = []
  source_dir  = "lambdas/websocket/JoinRoom"
  output_path = "lambdas-websocket-JoinRoom.zip"
}

data "archive_file" "lambdas-websocket-ConnectClient" {
  type        = "zip"
  excludes    = []
  source_dir  = "lambdas/websocket/ConnectClient"
  output_path = "lambdas-websocket-ConnectClient.zip"
}

provider "aws" {
  region = "us-west-1"
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

resource "aws_s3_object" "lambdas-http-CreateRoom" {
  bucket = aws_s3_bucket.gameroom-deployment.id
  key    = data.archive_file.lambdas-http-CreateRoom.output_path
  source = data.archive_file.lambdas-http-CreateRoom.output_path
}

resource "aws_s3_object" "lambdas-websocket-connect" {
  bucket = aws_s3_bucket.gameroom-deployment.id
  key    = data.archive_file.lambdas-websocket-connect.output_path
  source = data.archive_file.lambdas-websocket-connect.output_path
}

resource "aws_s3_object" "lambdas-websocket-default" {
  bucket = aws_s3_bucket.gameroom-deployment.id
  key    = data.archive_file.lambdas-websocket-default.output_path
  source = data.archive_file.lambdas-websocket-default.output_path
}

resource "aws_s3_object" "lambdas-websocket-disconnect" {
  bucket = aws_s3_bucket.gameroom-deployment.id
  key    = data.archive_file.lambdas-websocket-disconnect.output_path
  source = data.archive_file.lambdas-websocket-disconnect.output_path
}

resource "aws_s3_object" "lambdas-websocket-JoinRoom" {
  bucket = aws_s3_bucket.gameroom-deployment.id
  key    = data.archive_file.lambdas-websocket-JoinRoom.output_path
  source = data.archive_file.lambdas-websocket-JoinRoom.output_path
}

resource "aws_s3_object" "lambdas-websocket-ConnectClient" {
  bucket = aws_s3_bucket.gameroom-deployment.id
  key    = data.archive_file.lambdas-websocket-ConnectClient.output_path
  source = data.archive_file.lambdas-websocket-ConnectClient.output_path
}

