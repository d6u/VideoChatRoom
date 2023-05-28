# Deploy

_All commands should run at repo root, unless otherwise specified._

## Prerequisites

### AWS ClI

1. In AWS Console, go to IAM.
2. Go to User section, click on "Add users". Give it a name, recommend "<you_name>\_cli". Ciick "Next".
3. Add the user to a User Group that has AdministratorAccess policy.
4. After user is created, open the user page in IAM, go to "Security credentials" tab, in "Access keys" section, click "Create access key".
5. Select "Command Line Interface (CLI)", and ignore the warning. Click "Next".
6. **Don't navigate away from the web page that shows key ID and secret**, because this is the last time you will have access to the key's secret. After key is created, configure AWS CLI.

   ```sh
   aws configure
   ```

   Then enter Access Key ID and Secret Access Key.

   You can also configure a new profile:

   ```sh
   aws configure --profile <profile_name>
   ```

   When running other aws commands, just add `--profile <profile_name>` to each command.

## Deploy

### Shared Resources

This section describes development of shared resources across stacks.

1. (**Not required for every deployment**) Create ACM Certificates:

   This CloudFormation stack is created specifically for creating ACM certificates in us-east-1. Because according to AWS documentation, CloudFront can only use certificates in us-east-1.

   ```sh
   aws --region us-east-1 \
     cloudformation deploy \
     --template-file deploy/cloudformation-acm-certificates.yaml \
     --stack-name DaiweiLuCerts
   ```

   (Optional) You can use this command to conveniently query for the outputs of the stack.

   ```sh
   aws --region us-east-1 \
      cloudformation describe-stacks \
      --stack-name DaiweiLuCerts | jq ".Stacks[0].Outputs"
   ```

   - `--region`: Specify AWS region for resources to be created in.
   - `--profile`: (Optional) Specifies the profile used for authentication. (See [Prerequisites](#prerequisites) section above for details on profile creation.)
   - `--template-file`: The CloudFormation template that AWS resources will be created from.
   - `--stack-name`: The name of the CloudFormation Stack.
   - `--capabilities`: Allow the template to create IAM resources.

### Gameroom

```sh
./deploy.sh
```

## Undeploy

```
aws cloudformation delete-stack --stack-name DaiweiLuCerts
```
