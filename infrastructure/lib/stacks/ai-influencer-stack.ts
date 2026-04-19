import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { execSync } from 'child_process';
import { Construct } from 'constructs';

interface EnvConfig {
  accountId: string;
  region: string;
  firebase: {
    projectId: string;
    storageBucket: string;
    databaseUrl: string;
  };
  lambdaEnv: {
    NEXT_PUBLIC_BASE_URL: string;
    FAL_MODE: string;
  };
  ffmpegLayerArn: string;
}

export interface AiInfluencerStackProps extends cdk.StackProps {
  environment: string;
  config: EnvConfig;
}

export class AiInfluencerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AiInfluencerStackProps) {
    super(scope, id, props);

    const { environment, config } = props;

    // Secrets are passed via environment variables at deploy time, not hardcoded
    // Run: FIREBASE_SA_KEY=<base64> FAL_API_KEY=<key> npm run deploy:dev
    const firebaseSaKey = process.env.FIREBASE_SA_KEY || '';
    const falApiKey = process.env.FAL_API_KEY || '';

    if (!firebaseSaKey) {
      console.warn(`[CDK] ⚠️  FIREBASE_SA_KEY env var not set — Lambda env vars will be empty`);
    }

    // ── Shared Lambda environment ─────────────────────────────────────────────
    // IMPORTANT: Lambda env vars are capped at 4KB total.
    // Store each secret exactly once. Lambda code reads FIREBASE_SERVICE_ACCOUNT_KEY first.
    const sharedEnv: { [key: string]: string } = {
      FIREBASE_SERVICE_ACCOUNT_KEY: firebaseSaKey,
      FIREBASE_STORAGE_BUCKET: config.firebase.storageBucket,
      FAL_API_KEY: falApiKey,
      FAL_MODE: config.lambdaEnv.FAL_MODE,
    };

    // Webhook URL only needed by ai-prep (submits jobs to Fal with webhook)
    const webhookEnv: { [key: string]: string } = {
      NEXT_PUBLIC_BASE_URL: config.lambdaEnv.NEXT_PUBLIC_BASE_URL,
    };

    // ── FFmpeg Layer ──────────────────────────────────────────────────────────
    const ffmpegLayer = lambda.LayerVersion.fromLayerVersionArn(
      this, 'FfmpegLayer', config.ffmpegLayerArn
    );

    // ── Lambda helper ─────────────────────────────────────────────────────────
    const lambdaRoot = path.join(__dirname, '..', '..', '..', 'AI-Influencer', 'Lambdas');

    const createFn = (
      name: string,
      opts: {
        memorySize?: number;
        timeout?: cdk.Duration;
        layers?: lambda.ILayerVersion[];
        extraEnv?: { [key: string]: string };
      } = {}
    ) =>
      new lambda.Function(this, name, {
        functionName: name,
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(lambdaRoot, name), {
        bundling: {
          local: {
            tryBundle(outputDir: string) {
              const src = path.join(lambdaRoot, name);
              execSync(`cp -rL "${src}/." "${outputDir}"`);
              execSync(`cd "${outputDir}" && npm install --production --prefer-offline 2>&1`);
              return true;
            },
          },
          image: cdk.DockerImage.fromRegistry('node:18'),
        },
      }),
        memorySize: opts.memorySize || 256,
        timeout: opts.timeout || cdk.Duration.seconds(60),
        environment: { ...sharedEnv, ...(opts.extraEnv || {}) },
        layers: opts.layers,
        description: `AI Influencer Pipeline — ${name} (${environment})`,
      });

    // ── Lambda Functions ──────────────────────────────────────────────────────
    const aiPrep = createFn('okvevo-ai-prep', {
      timeout: cdk.Duration.seconds(120),
      extraEnv: webhookEnv,
    });

    const lipsyncSubmit = createFn('okvevo-lipsync-submit', {
      timeout: cdk.Duration.seconds(120),
      extraEnv: webhookEnv,
    });

    const falRecovery = createFn('okvevo-fal-recovery', {
      timeout: cdk.Duration.seconds(60),
    });

    const lipsyncRecovery = createFn('okvevo-lipsync-recovery', {
      timeout: cdk.Duration.seconds(60),
    });

    const renderer = createFn('okvevo-renderer', {
      memorySize: 3008,
      timeout: cdk.Duration.seconds(300),
      layers: [ffmpegLayer],
    });

    const branding = createFn('okvevo-branding', {
      memorySize: 512,
      timeout: cdk.Duration.seconds(120),
    });

    const noop = createFn('okvevo-noop', {
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
    });

    // ── Grant Step Functions permission to invoke all Lambdas ─────────────────
    const allFunctions = [aiPrep, lipsyncSubmit, falRecovery, lipsyncRecovery, renderer, branding, noop];

    allFunctions.forEach(fn => {
      fn.grantInvoke(new iam.ServicePrincipal('states.amazonaws.com'));
    });

    // ── Step Function State Machine ───────────────────────────────────────────
    // Read base definition and replace prod ARNs with live Lambda ARNs
    const baseDefinition = require('../../../AI-Influencer/State-Machine/state-machine.json');

    const definition = JSON.stringify(baseDefinition)
      .replace(/arn:aws:lambda:us-east-1:315974965935:function:okvevo-ai-prep/g, aiPrep.functionArn)
      .replace(/arn:aws:lambda:us-east-1:315974965935:function:okvevo-lipsync-submit/g, lipsyncSubmit.functionArn)
      .replace(/arn:aws:lambda:us-east-1:315974965935:function:okvevo-fal-recovery/g, falRecovery.functionArn)
      .replace(/arn:aws:lambda:us-east-1:315974965935:function:okvevo-lipsync-recovery/g, lipsyncRecovery.functionArn)
      .replace(/arn:aws:lambda:us-east-1:315974965935:function:okvevo-renderer/g, renderer.functionArn);

    // Step Function execution role with Lambda invoke permissions
    const sfnRole = new iam.Role(this, 'StepFunctionRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com'),
      description: 'Step Function execution role for AI Influencer pipeline',
    });

    // Grant invoke permissions for all Lambda functions
    [aiPrep, lipsyncSubmit, falRecovery, lipsyncRecovery, renderer, branding, noop].forEach(fn => {
      fn.grantInvoke(sfnRole);
    });

    const stateMachine = new sfn.StateMachine(this, 'AiInfluencerPipeline', {
      stateMachineName: 'okvevo-ai-influencer-pipeline',
      definitionBody: sfn.DefinitionBody.fromString(definition),
      stateMachineType: sfn.StateMachineType.STANDARD,
      timeout: cdk.Duration.hours(24),
      tracingEnabled: true,
      role: sfnRole,
    });

    // ── IAM Runtime User ──────────────────────────────────────────────────────
    const runtimeUser = new iam.User(this, 'AIInfluencerService', {
      userName: 'AIInfluencerService',
    });

    runtimeUser.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSStepFunctionsFullAccess'));
    runtimeUser.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSLambda_FullAccess'));
    runtimeUser.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess'));

    stateMachine.grantStartExecution(runtimeUser);

    // ── Outputs ───────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: stateMachine.stateMachineArn,
      description: 'SFN_AI_INFLUENCER_ARN — add this to .env or .env.dev',
      exportName: `OkVevo-SfnArn-${environment}`,
    });

    new cdk.CfnOutput(this, 'IAMUserArn', {
      value: runtimeUser.userArn,
      description: 'IAM runtime user ARN',
    });
  }
}
