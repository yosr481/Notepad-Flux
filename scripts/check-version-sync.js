/* global process */
// CI guard: package.json version must match package-lock.json and, when run on a
// tag push, the tag (v1.2.3 -> 1.2.3). The 6785fd7 commit was a manual fix for
// exactly this drift; this makes it fail the build instead.
import fs from 'fs';
import path from 'path';

const read = (p) => JSON.parse(fs.readFileSync(path.resolve(p), 'utf8'));

const pkgVersion = read('package.json').version;
const lock = read('package-lock.json');
const lockVersion = lock.version;
const lockRootPkgVersion = lock.packages && lock.packages[''] && lock.packages[''].version;

const problems = [];
if (lockVersion !== pkgVersion) {
    problems.push(`package-lock.json .version (${lockVersion}) != package.json (${pkgVersion})`);
}
if (lockRootPkgVersion && lockRootPkgVersion !== pkgVersion) {
    problems.push(`package-lock.json packages[""].version (${lockRootPkgVersion}) != package.json (${pkgVersion})`);
}

const ref = process.env.GITHUB_REF_NAME || '';
if (/^v\d+\.\d+\.\d+/.test(ref)) {
    const tagVersion = ref.replace(/^v/, '');
    if (tagVersion !== pkgVersion) {
        problems.push(`git tag (${tagVersion}) != package.json version (${pkgVersion})`);
    }
}

if (problems.length) {
    console.error('Version sync check failed:\n  - ' + problems.join('\n  - '));
    process.exit(1);
}
console.log(`Version sync OK (${pkgVersion})`);
