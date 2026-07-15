import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';

export type BuildSystem = 'maven' | 'gradle';

const GRAALVM_VERSIONS: Record<string, string> = {
  '17': '17.0.9',
  '21': '21.0.2',
  '22': '22.0.2',
  '23': '23.0.2',
  '24': '24.0.2',
  '25': '25.0.2',
};

export async function detectJavaVersion(workPath: string): Promise<number> {
  const pomPath = join(workPath, 'pom.xml');
  if (existsSync(pomPath)) {
    const content = await readFile(pomPath, 'utf-8');
    const match = content.match(/<java\.version>\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);
    const sourceMatch = content.match(/<maven\.compiler\.source>\s*(\d+)/i);
    if (sourceMatch) return parseInt(sourceMatch[1], 10);
  }

  const gradlePath = join(workPath, 'build.gradle');
  const gradleKtsPath = join(workPath, 'build.gradle.kts');
  for (const gp of [gradlePath, gradleKtsPath]) {
    if (existsSync(gp)) {
      const content = await readFile(gp, 'utf-8');
      const match = content.match(/sourceCompatibility\s*=\s*['"]?(\d+)/i)
        || content.match(/java\.toolchain\.languageVersion\s*=\s*JavaLanguageVersion\.of\((\d+)\)/i);
      if (match) return parseInt(match[1], 10);
    }
  }

  return 21;
}

export function getGraalVmDownloadUrl(javaVersion: number): string {
  const jdkVer = GRAALVM_VERSIONS[String(javaVersion)];
  if (!jdkVer) {
    throw new Error(`Unsupported Java version: ${javaVersion}. Supported: ${Object.keys(GRAALVM_VERSIONS).join(', ')}`);
  }
  const platform = 'linux';
  const arch = process.arch === 'x64' ? 'x64' : 'aarch64';
  return `https://github.com/graalvm/graalvm-ce-builds/releases/download/jdk-${jdkVer}/graalvm-community-jdk-${jdkVer}_${platform}-${arch}_bin.tar.gz`;
}

export async function downloadAndExtract(url: string, destDir: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download GraalVM: ${response.status} ${response.statusText}`);
  }
  if (!response.body) {
    throw new Error('No response body');
  }

  const extractDir = join(destDir, 'graalvm');
  mkdirSync(extractDir, { recursive: true });
  const tarballPath = join(destDir, 'graalvm.tar.gz');

  const fileStream = createWriteStream(tarballPath);
  const reader = response.body.getReader();
  const pump = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(value);
    }
    fileStream.end();
  };
  await pump();

  await new Promise<void>((resolve, reject) => {
    fileStream.on('finish', resolve);
    fileStream.on('error', reject);
  });

  const tar = require('tar');
  await tar.extract({
    file: tarballPath,
    cwd: extractDir,
    strip: 1,
  });
  return extractDir;
}

export async function detectBuildSystem(workPath: string): Promise<BuildSystem | null> {
  const files = await readdir(workPath);
  if (files.includes('pom.xml')) return 'maven';
  if (files.includes('build.gradle') || files.includes('build.gradle.kts')) return 'gradle';
  return null;
}

export function ensureExecutable(workPath: string): void {
  const mvnw = join(workPath, 'mvnw');
  const gradlew = join(workPath, 'gradlew');
  if (existsSync(mvnw)) {
    execSync(`chmod +x "${mvnw}"`, { stdio: 'inherit' });
  }
  if (existsSync(gradlew)) {
    execSync(`chmod +x "${gradlew}"`, { stdio: 'inherit' });
  }
}

export async function downloadMaven(destDir: string): Promise<string> {
  const url = 'https://dlcdn.apache.org/maven/maven-3/3.9.16/binaries/apache-maven-3.9.16-bin.tar.gz';
  console.log(`Downloading Maven from ${url}`);
  const mavenDir = join(destDir, 'maven');
  mkdirSync(mavenDir, { recursive: true });
  const tarballPath = join(destDir, 'maven.tar.gz');

  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Failed to download Maven: ${response.status}`);

  const fileStream = createWriteStream(tarballPath);
  const reader = response.body.getReader();
  while (true) { const { done, value } = await reader.read(); if (done) break; fileStream.write(value); }
  fileStream.end();
  await new Promise<void>((resolve, reject) => { fileStream.on('finish', resolve); fileStream.on('error', reject); });

  const tar = require('tar');
  await tar.extract({ file: tarballPath, cwd: mavenDir, strip: 1 });
  return mavenDir;
}

export async function downloadGradle(destDir: string): Promise<string> {
  const url = 'https://services.gradle.org/distributions/gradle-8.10-bin.zip';
  console.log(`Downloading Gradle from ${url}`);
  const gradleDir = join(destDir, 'gradle');
  mkdirSync(gradleDir, { recursive: true });
  const zipPath = join(destDir, 'gradle.zip');

  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Failed to download Gradle: ${response.status}`);

  const fileStream = createWriteStream(zipPath);
  const reader = response.body.getReader();
  while (true) { const { done, value } = await reader.read(); if (done) break; fileStream.write(value); }
  fileStream.end();
  await new Promise<void>((resolve, reject) => { fileStream.on('finish', resolve); fileStream.on('error', reject); });

  execSync(`unzip -o "${zipPath}" -d "${gradleDir}"`, { stdio: 'inherit' });
  return join(gradleDir, 'gradle-8.10');
}

function writeNativeImageProps(targetClassesDir: string, hasH2: boolean): void {
  if (!existsSync(targetClassesDir)) {
    mkdirSync(targetClassesDir, { recursive: true });
  }
  const dir = join(targetClassesDir, 'META-INF', 'native-image', 'vercel-spring');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'native-image.properties');

  let args = '--gc=G1 -J-Xmx2g --parallelism=2 --enable-url-protocols=http -H:+ReportExceptionStackTraces';
  if (hasH2) {
    args += ' --exclude-config=.*h2.*,META-INF/native-image/.*';
  }
  writeFileSync(file, `Args = ${args}\n`);
  console.log('Native-image config written to', file);
}

export async function buildNativeImageMaven(workPath: string, graalHome: string, hasH2: boolean, buildDir?: string): Promise<string> {
  const env = {
    ...process.env,
    JAVA_HOME: graalHome,
    GRAALVM_HOME: graalHome,
    PATH: `${join(graalHome, 'bin')}${require('path').delimiter}${process.env.PATH}`,
  } as Record<string, string>;

  const mvnw = join(workPath, 'mvnw');
  let mvnCmd: string;
  if (existsSync(mvnw)) {
    mvnCmd = `"${mvnw}"`;
  } else {
    const mavenHome = await downloadMaven(buildDir || require('os').tmpdir());
    mvnCmd = join(mavenHome, 'bin', 'mvn');
  }

  const targetClasses = join(workPath, 'target', 'classes');
  writeNativeImageProps(targetClasses, hasH2);

  console.log('Building Spring Boot native image with Maven...');
  console.log('This may take 5-15 minutes depending on project size and Vercel build resources.');
  try {
    execSync(`"${mvnCmd}" -Pnative native:compile -DskipTests`, {
      cwd: workPath,
      env,
      stdio: 'inherit',
      timeout: 1800000,
    });
  } catch (err: any) {
    console.error('Maven native build failed. Common causes:');
    console.error('  - Out of memory');
    console.error('  - Build timeout (try simplifying your project or increasing timeout)');
    console.error('  - Check your pom.xml native profile configuration');
    throw new Error(`Maven native build failed: ${err.message || err}`);
  }

  const targetDir = join(workPath, 'target');
  const entries = await readdir(targetDir);
  for (const entry of entries) {
    const fullPath = join(targetDir, entry);
    if (!entry.includes('.') && !entry.endsWith('.jar')) {
      return fullPath;
    }
  }
  throw new Error('Native binary not found in target/ directory');
}

export async function buildNativeImageGradle(workPath: string, graalHome: string, hasH2: boolean, buildDir?: string): Promise<string> {
  const env = {
    ...process.env,
    JAVA_HOME: graalHome,
    GRAALVM_HOME: graalHome,
    PATH: `${join(graalHome, 'bin')}${require('path').delimiter}${process.env.PATH}`,
  } as Record<string, string>;

  const gradlew = join(workPath, 'gradlew');
  let gradleCmd: string;
  if (existsSync(gradlew)) {
    gradleCmd = `"${gradlew}"`;
  } else {
    const gradleHome = await downloadGradle(buildDir || require('os').tmpdir());
    gradleCmd = join(gradleHome, 'bin', 'gradle');
  }

  const classesDir = join(workPath, 'build', 'classes', 'java', 'main');
  writeNativeImageProps(classesDir, hasH2);

  console.log('Building Spring Boot native image with Gradle...');
  console.log('This may take 5-15 minutes depending on project size and Vercel build resources.');
  try {
    execSync(`"${gradleCmd}" nativeCompile -x test`, {
      cwd: workPath,
      env,
      stdio: 'inherit',
      timeout: 1800000,
    });
  } catch (err: any) {
    console.error('Gradle native build failed. Common causes:');
    console.error('  - Out of memory');
    console.error('  - Build timeout (try simplifying your project or increasing timeout)');
    throw new Error(`Gradle native build failed: ${err.message || err}`);
  }

  const nativeDir = join(workPath, 'build', 'native', 'nativeCompile');
  const entries = await readdir(nativeDir);
  if (entries.length === 0) {
    throw new Error('Native binary not found in build/native/nativeCompile/');
  }
  return join(nativeDir, entries[0]);
}

export function readLauncherSource(): string {
  const fs = require('fs');
  const path = require('path');
  const launcherPath = path.resolve(__dirname, '..', 'src', 'launcher.mjs');
  return fs.readFileSync(launcherPath, 'utf-8');
}

function detectH2Dependency(workPath: string): boolean {
  const pomXml = join(workPath, 'pom.xml');
  if (existsSync(pomXml)) {
    const content = readFileSync(pomXml, 'utf-8');
    if (/<artifactId>h2<\/artifactId>/.test(content)) return true;
  }
  for (const name of ['build.gradle', 'build.gradle.kts']) {
    const gp = join(workPath, name);
    if (existsSync(gp)) {
      const content = readFileSync(gp, 'utf-8');
      if (/['"]h2['"]/.test(content)) return true;
    }
  }
  return false;
}

export async function buildProjectNative(workPath: string, graalHome: string, buildSystem: BuildSystem, buildDir?: string): Promise<string> {
  const hasH2 = detectH2Dependency(workPath);
  if (buildSystem === 'maven') {
    return buildNativeImageMaven(workPath, graalHome, hasH2, buildDir);
  }
  return buildNativeImageGradle(workPath, graalHome, hasH2, buildDir);
}
