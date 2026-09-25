// One-off local verification (no DB needed) that the hand-authored PBQ seed
// content passes the structural consistency checks. Not part of the seed
// flow itself — scripts/seed-pbq-cards.ts already checks each card before
// insert; this is just for a quick standalone sanity pass during authoring.
import { checkArtifactPbqConsistency, checkRemediationConsistency } from './check-card-consistency';
import { logAnalysisCards, configTableCards, remediationCards } from './seed-pbq-cards';

let anyFailed = false;

for (const card of logAnalysisCards) {
  const issues = checkArtifactPbqConsistency(card.content);
  console.log(`log_analysis "${card.topic}": ${issues.length === 0 ? 'OK' : 'FAILED'}`);
  for (const issue of issues) console.log(`  - ${issue}`);
  if (issues.length > 0) anyFailed = true;
}

for (const card of configTableCards) {
  const issues = checkArtifactPbqConsistency(card.content);
  console.log(`config_table "${card.topic}": ${issues.length === 0 ? 'OK' : 'FAILED'}`);
  for (const issue of issues) console.log(`  - ${issue}`);
  if (issues.length > 0) anyFailed = true;
}

for (const card of remediationCards) {
  const issues = checkRemediationConsistency(card.content);
  console.log(`remediation_select "${card.topic}": ${issues.length === 0 ? 'OK' : 'FAILED'}`);
  for (const issue of issues) console.log(`  - ${issue}`);
  if (issues.length > 0) anyFailed = true;
}

process.exit(anyFailed ? 1 : 0);
