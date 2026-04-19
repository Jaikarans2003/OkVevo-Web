#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AiInfluencerStack } from '../lib/stacks/ai-influencer-stack';

const app = new cdk.App();

const env = app.node.tryGetContext('env') || 'dev';

if (!['prod', 'dev'].includes(env)) {
  throw new Error(`Invalid --context env=${env}. Must be 'prod' or 'dev'.`);
}

const config = env === 'prod'
  ? require('../config/prod.json')
  : require('../config/dev.json');

// ── AI Influencer Pipeline Stack ──────────────────────────────────────────────
new AiInfluencerStack(app, `OkVevo-AiInfluencer-${env}`, {
  env: {
    account: config.accountId,
    region: config.region,
  },
  environment: env,
  config,
  description: `OkVevo AI Influencer Pipeline — ${env.toUpperCase()}`,
  tags: {
    Project: 'OkVevo',
    Pipeline: 'AIInfluencer',
    Environment: env,
  },
});

// ── Future stacks go here ─────────────────────────────────────────────────────
// new VideoEditingStack(app, `OkVevo-VideoEditing-${env}`, { ... });
// new SharedInfraStack(app, `OkVevo-Shared-${env}`, { ... });

app.synth();
