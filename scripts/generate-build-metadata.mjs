import fs from 'node:fs';
import path from 'node:path';

const templatePath = path.join(process.cwd(), 'src', 'build-info.template.js');
const outputPath = path.join(process.cwd(), 'src', 'generated-build-info.js');
const template = fs.readFileSync(templatePath, 'utf8');

const commitSha = process.env.COMMIT_SHA || 'local-dev';
const runNumber = process.env.RUN_NUMBER || 'local';
const environment = process.env.DEPLOY_ENV || 'development';
const buildTime = new Date().toISOString();

const content = template
  .replace('__COMMIT_SHA__', commitSha)
  .replace('__RUN_NUMBER__', runNumber)
  .replace('__BUILD_TIME__', buildTime)
  .replace('__ENVIRONMENT__', environment);

fs.writeFileSync(outputPath, content);
console.log('Build metadata injected into src/generated-build-info.js');
