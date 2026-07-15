import { existsSync } from 'fs';
import { join } from 'path';
import {
  BuildOptions,
  createLambda,
  download,
  FileBlob,
  FileFsRef,
  getWriteableDirectory,
  glob,
  PrepareCacheOptions,
  StartDevServerOptions,
  StartDevServerResult,
} from '@vercel/build-utils';
import {
  buildProjectNative,
  detectBuildSystem,
  detectJavaVersion,
  downloadAndExtract,
  ensureExecutable,
  readLauncherSource,
  getGraalVmDownloadUrl,
} from './utils';

export const version = 3;

const GRAALVM_CACHE_KEY = '.vercel-graalvm';

export async function build(options: BuildOptions) {
  const { files, workPath, entrypoint, repoRootPath } = options;

  console.log('=== vercel-spring build ===');
  console.log(`Entrypoint: ${entrypoint}`);
  console.log(`Work path: ${workPath}`);

  await download(files, workPath);

  if (!entrypoint.endsWith('.java')) {
    throw new Error(
      `vercel-spring requires .java entrypoint, got: "${entrypoint}"`
    );
  }

  const buildSystem = await detectBuildSystem(workPath);
  if (!buildSystem) {
    throw new Error(
      'No build system detected. Need pom.xml (Maven) or build.gradle/build.gradle.kts (Gradle).'
    );
  }
  console.log(`Detected build system: ${buildSystem}`);

  const javaVersion = await detectJavaVersion(workPath);
  console.log(`Detected Java version: ${javaVersion}`);

  ensureExecutable(workPath);

  const writableDir = await getWriteableDirectory();
  const graalUrl = getGraalVmDownloadUrl(javaVersion);
  console.log(`Downloading GraalVM from: ${graalUrl}`);
  const graalHome = await downloadAndExtract(graalUrl, writableDir);
  console.log(`GraalVM installed at: ${graalHome}`);

  console.log('Building native image...');
  const nativeBinaryPath = await buildProjectNative(workPath, graalHome, buildSystem);
  console.log(`Native binary: ${nativeBinaryPath}`);

  const nativeBinaryName = 'spring-app.bin';
  const launcherCode = readLauncherSource();

  const lambda = createLambda({
    runtime: 'nodejs22.x',
    handler: 'launcher.mjs',
    files: {
      'launcher.mjs': new FileBlob({ data: launcherCode }),
      [nativeBinaryName]: await FileFsRef.fromStream({
        mode: 0o755,
        stream: require('fs').createReadStream(nativeBinaryPath),
        fsPath: nativeBinaryPath,
      }),
    },
  });

  console.log('=== build complete ===');

  return {
    output: lambda,
    routes: [
      { src: '/(.*)', dest: `/${entrypoint}` },
    ],
  };
}

export async function prepareCache(options: PrepareCacheOptions) {
  const { workPath, repoRootPath } = options;
  console.log('Caching GraalVM installation...');

  const cache = await glob('**/.vercel-graalvm/**', workPath);

  let mavenCache;
  try {
    mavenCache = await glob('**/.m2/repository/**', join(workPath, '..'));
  } catch {
    mavenCache = {};
  }

  let gradleCache;
  try {
    gradleCache = await glob('**/.gradle/caches/**', join(workPath, '..'));
  } catch {
    gradleCache = {};
  }

  return {
    ...cache,
    ...mavenCache,
    ...gradleCache,
  } as any;
}

export async function startDevServer(options: StartDevServerOptions): Promise<StartDevServerResult> {
  const { workPath, entrypoint } = options;
  const { spawn } = await import('child_process');

  const buildSystem = await detectBuildSystem(workPath);
  if (!buildSystem) {
    throw new Error('No build system detected (pom.xml or build.gradle)');
  }

  const useMvnw = existsSync(join(workPath, 'mvnw'));
  const useGradlew = existsSync(join(workPath, 'gradlew'));

  let cmd: string;
  let args: string[];
  let childProcess: ReturnType<typeof spawn>;

  if (buildSystem === 'maven') {
    cmd = useMvnw ? './mvnw' : 'mvn';
    args = ['spring-boot:run'];
  } else {
    cmd = useGradlew ? './gradlew' : 'gradle';
    args = ['bootRun'];
  }

  childProcess = spawn(cmd, args, {
    cwd: workPath,
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  const port = await new Promise<number>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Dev server startup timed out'));
    }, 120000);

    childProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      const match = text.match(/port\(s\):\s*(\d+)/i);
      if (match) {
        clearTimeout(timeout);
        resolve(parseInt(match[1], 10));
      }
    });

    childProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    childProcess.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Dev server exited with code ${code}`));
      }
    });
  });

  return { pid: childProcess.pid!, port };
}
