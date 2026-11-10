import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const raiz=process.argv[2]||process.cwd();
function git(...args){
  const r=spawnSync('git',['-c','safe.directory=*','-C',raiz,...args],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr||args.join(' '));
  return r.stdout.trim();
}
for(const [tag,commit] of [['v0.2.30','4907468'],['v0.2.31','e5844bf'],['v0.2.32','7a80c61']]){
  assert.equal(git('cat-file','-t',tag),'tag');
  assert.ok(git('rev-parse',tag+'^{commit}').startsWith(commit));
  git('cat-file','-e',tag+':src/js/backend/core/dashboard.js');
  git('cat-file','-e',tag+':tests/dashboard.mjs');
  git('merge-base','--is-ancestor',tag,'HEAD');
}
console.log('REL-01: tags anotadas e código das três versões presentes no histórico.');
