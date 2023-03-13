## Initialize

```
terraform init
terraform validate
terraform apply
```

## Deploy

```
aws s3 cp lambdas-http-CreateRoom.zip s3://gameroom-deployment/lambdas-http-CreateRoom.zip
aws cloudformation deploy --template-file cloudformation-template.yaml --capabilities CAPABILITY_NAMED_IAM --stack-name GameroomStack
```

## Remove

```
aws cloudformation delete-stack --stack-name GameroomStack
```
