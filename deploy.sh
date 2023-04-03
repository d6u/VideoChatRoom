#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

printf "\n>>> Cleaning up staging area for CloudFormation...\n"
rm -rf build
mkdir build

# Enter /shared
pushd shared/shared-models
rm -rfv dist node_modules | sed 's/\([^/]*\)\/.*$/\1/' | sort | uniq
npm i
tsc
popd

pushd shared/shared-utils
rm -rfv dist node_modules | sed 's/\([^/]*\)\/.*$/\1/' | sort | uniq
npm i
tsc
popd

# Enter /server
pushd server

printf "\n>>> Cleaning up staging area for server...\n"
rm -rfv dist node_modules | sed 's/\([^/]*\)\/.*$/\1/' | sort | uniq

printf "\n>>> Building...\n"
npm i
tsc

printf "\n>>> Bundling...\n"
HASH=$(find . -type f \( -ipath "./dist/*" -o -ipath "./node_modules/*" -o -ipath "./package.json" -o -ipath "./package-lock.json" \) | sort | xargs sha1sum | sha1sum | awk '{print $1}')
SOURCE_ZIP="build/server_$HASH.zip"
zip -q -r "../$SOURCE_ZIP" ./ -i "dist/*" "node_modules/*" "package.json" "package-lock.json"

# Leave /server
popd

printf "\n>>> Final source zip name is:\n"
printf $SOURCE_ZIP

printf "\n>>> Contents of final source zip:\n"
zipinfo -1 $SOURCE_ZIP | sed 's/\([^/]*\/\).*$/\1/' | sort | uniq

# Deploy server
printf "\n>>> Uploading the source zip to S3...\n"
aws s3 sync build s3://gameroom-deployment/build

printf "\n>>> Deploying using CloudFormation...\n"
aws cloudformation deploy \
  --template-file cloudformation-template.yaml \
  --stack-name GameroomStack \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides ServerSourceS3Key=$SOURCE_ZIP

printf "\n>>> Saving the CloudFormation output to a JSON file...\n"
aws cloudformation describe-stacks --stack-name GameroomStack | jq ".Stacks[0].Outputs | map({(.OutputKey): .OutputValue}) | add" > frontend/src/api_endpoints.json

printf "\n>>> The output of CloudFormation is:\n"
cat frontend/src/api_endpoints.json

# Enter /frontend
pushd frontend

printf "\n>>> Bundling and deploying the frontend...\n"
npm run build
aws s3 sync build s3://gameroom-frontend

# Leave /frontend
popd
