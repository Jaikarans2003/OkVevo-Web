import * as path from 'path';
import { execSync } from 'child_process';
import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface HyperframesCompletionStackProps extends cdk.StackProps {
  environment: string;
  stateMachineArn: string;
  renderBucketName: string;
  firebaseAdminSecretArn: string;
  firebaseStorageBucket: string;
}

export class HyperframesCompletionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: HyperframesCompletionStackProps) {
    super(scope, id, props);

    const renderBucket = s3.Bucket.fromBucketName(
      this,
      'RenderBucket',
      props.renderBucketName
    );
    const firebaseSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'FirebaseAdminSecret',
      props.firebaseAdminSecretArn
    );
    const stateMachineName = cdk.Arn.split(
      props.stateMachineArn,
      cdk.ArnFormat.COLON_RESOURCE_NAME
    ).resourceName;
    const executionArn = this.formatArn({
      service: 'states',
      resource: 'execution',
      resourceName: `${stateMachineName}:*`,
      arnFormat: cdk.ArnFormat.COLON_RESOURCE_NAME,
    });

    const role = new iam.Role(this, 'CompletionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Finalizes HyperFrames renders in Firebase',
    });
    role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole'
      )
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${renderBucket.bucketArn}/*`],
      })
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ['states:DescribeExecution'],
        resources: [executionArn],
      })
    );
    firebaseSecret.grantRead(role);

    const lambdaRoot = path.join(
      __dirname,
      '..',
      '..',
      'lambdas',
      'hyperframes-render-completion'
    );
    const completion = new lambda.Function(this, 'CompletionFunction', {
      functionName: `okvevo-hyperframes-render-completion-${props.environment}`,
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'index.handler',
      role,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      code: lambda.Code.fromAsset(lambdaRoot, {
        exclude: ['node_modules'],
        bundling: {
          local: {
            tryBundle(outputDir: string) {
              execSync(`cp "${path.join(lambdaRoot, 'index.js')}" "${outputDir}/index.js"`);
              execSync(`cp "${path.join(lambdaRoot, 'package.json')}" "${outputDir}/package.json"`);
              execSync(
                `cp "${path.join(lambdaRoot, 'package-lock.json')}" "${outputDir}/package-lock.json"`
              );
              execSync('npm ci --omit=dev', { cwd: outputDir, stdio: 'inherit' });
              return true;
            },
          },
          image: lambda.Runtime.NODEJS_22_X.bundlingImage,
          command: [
            'bash',
            '-c',
            'cp -r /asset-input/. /asset-output && cd /asset-output && npm ci --omit=dev',
          ],
        },
      }),
      environment: {
        HYPERFRAMES_BUCKET: props.renderBucketName,
        FIREBASE_ADMIN_SECRET_ARN: firebaseSecret.secretArn,
        FIREBASE_STORAGE_BUCKET: props.firebaseStorageBucket,
      },
    });

    new events.Rule(this, 'RenderTerminalEvents', {
      eventPattern: {
        source: ['aws.states'],
        detailType: ['Step Functions Execution Status Change'],
        detail: {
          stateMachineArn: [props.stateMachineArn],
          status: ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED'],
        },
      },
      targets: [new targets.LambdaFunction(completion)],
    });
  }
}
