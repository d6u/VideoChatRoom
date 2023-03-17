## Initialize

```
terraform init
terraform validate
terraform plan
terraform apply
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
