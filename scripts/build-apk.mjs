import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toolchainDir = 'D:\\.android-toolchain';

const env = { ...process.env };

if (!env.JAVA_HOME && existsSync(toolchainDir)) {
  const jdkFolder = readdirSync(toolchainDir).find((name) => name.startsWith('jdk-21'));
  if (jdkFolder) {
    env.JAVA_HOME = path.join(toolchainDir, jdkFolder);
    env.PATH = `${path.join(env.JAVA_HOME, 'bin')};${env.PATH || env.Path || ''}`;
  }
}

const sdkPath = path.join(toolchainDir, 'Sdk');
if (!env.ANDROID_HOME && existsSync(sdkPath)) {
  env.ANDROID_HOME = sdkPath;
  env.ANDROID_SDK_ROOT = sdkPath;
}

function run(cmd, cwd = rootDir) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, env, stdio: 'inherit' });
}

run('npm run build');
run('npx cap sync android');
run('gradlew.bat assembleDebug', path.join(rootDir, 'android'));

const apkSrc = path.join(
  rootDir,
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  'debug',
  'app-debug.apk',
);
const apkDest = path.join(rootDir, 'QOC.apk');
const legacyApk = path.join(rootDir, 'quotation-invoice-cepat.apk');

if (existsSync(legacyApk)) {
  try {
    unlinkSync(legacyApk);
  } catch {
    // ignore if open in another process
  }
}

if (existsSync(apkSrc)) {
  copyFileSync(apkSrc, apkDest);
  const mb = (statSync(apkDest).size / (1024 * 1024)).toFixed(2);
  console.log(`\nSelesai! APK terbaru siap di: ${apkDest} (${mb} MB)`);
}
