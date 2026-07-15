#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { HyperframesCompletionStack } from '../lib/stacks/hyperframes-completion-stack';

const app = new cdk.App();

const env = app.node.tryGetContext('env') || 'dev';

if (!['prod', 'dev'].includes(env)) {
  throw new Error(`Invalid --context env=${env}. Must be 'prod' or 'dev'.`);
}

const config = env === 'prod'
  ? require('../config/prod.json')
  : require('../config/dev.json');

const hyperframesStateMachineArn =
  app.node.tryGetContext('hyperframesStateMachineArn') || process.env.HYPERFRAMES_SFN_ARN;
const hyperframesBucket =
  app.node.tryGetContext('hyperframesBucket') || process.env.HYPERFRAMES_BUCKET;
const firebaseAdminSecretArn =
  app.node.tryGetContext('firebaseAdminSecretArn') || process.env.FIREBASE_ADMIN_SECRET_ARN;

if (!hyperframesStateMachineArn || !hyperframesBucket || !firebaseAdminSecretArn) {
  throw new Error(
    'HyperFrames completion stack requires HYPERFRAMES_SFN_ARN, HYPERFRAMES_BUCKET, ' +
      'and FIREBASE_ADMIN_SECRET_ARN (environment variables or CDK context)'
  );
}

new HyperframesCompletionStack(app, `OkVevo-HyperframesCompletion-${env}`, {
  env: {
    account: config.accountId,
    region: config.region,
  },
  environment: env,
  stateMachineArn: hyperframesStateMachineArn,
  renderBucketName: hyperframesBucket,
  firebaseAdminSecretArn,
  firebaseStorageBucket: config.firebase.storageBucket,
  description: `OkVevo HyperFrames render completion — ${env.toUpperCase()}`,
  tags: {
    Project: 'OkVevo',
    Pipeline: 'HyperFrames',
    Environment: env,
  },
});

app.synth();
