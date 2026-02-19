import { buildInfo } from './generated-build-info.js';
import { getRuntimeHealth } from './health.js';

function bindBuildInfo() {
  document.getElementById('commitSha').textContent = buildInfo.commitSha;
  document.getElementById('runNumber').textContent = buildInfo.runNumber;
  document.getElementById('buildTime').textContent = buildInfo.buildTime;
  document.getElementById('environment').textContent = buildInfo.environment;
}

function bindHealth() {
  const { ok, message } = getRuntimeHealth();
  const el = document.getElementById('healthStatus');
  el.textContent = message;
  el.style.color = ok ? '#156b2f' : '#a21a1a';
}

bindBuildInfo();
bindHealth();
