## Update local npm package

Run this in repo root:

```
echo lambdas/*/* | sed "s/ /\n/g" | xargs -t -I'{}' bash -c 'cd {} && rm -r node_modules/shared-utils && npm i'
```

## Initialize and deploy

```
terraform init
terraform validate
terraform plan
terraform apply -auto-approve
```

## Notes

Upload zip file to S3:

```
aws s3 cp lambdas-http-CreateRoom.zip s3://gameroom-deployment/lambdas-http-CreateRoom.zip
```

Manually deploy CloudFormation:

```
aws cloudformation deploy --template-file cloudformation-template.yaml --capabilities CAPABILITY_NAMED_IAM --stack-name GameroomStack
```

Manually remove CloudFormation stack:

```
aws cloudformation delete-stack --stack-name GameroomStack
```
