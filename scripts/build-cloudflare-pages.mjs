import { spawnSync } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const deployKey = process.env.GAME_PLATFORM_SDK_DEPLOY_KEY;

if (!deployKey?.startsWith("-----BEGIN OPENSSH PRIVATE KEY-----")) {
  throw new Error("GAME_PLATFORM_SDK_DEPLOY_KEY is required for the Pages build.");
}

const githubHostKey =
  "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl\n";
const tempDirectory = await mkdtemp(join(tmpdir(), "games-site-sdk-ssh-"));
const keyPath = join(tempDirectory, "sdk-deploy-key");
const knownHostsPath = join(tempDirectory, "known_hosts");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function runNpm(args, description, environment) {
  const result = spawnSync(npmCommand, args, {
    env: environment,
    shell: process.platform === "win32",
    stdio: "inherit"
  });

  if (result.error) {
    throw new Error(`${description} could not start: ${result.error.message}`);
  }

  return result.status ?? 1;
}

async function verifySdkLockResolution() {
  const packagePath = "node_modules/@setnessconsulting/game-platform-sdk";
  const packageLock = JSON.parse(await readFile(join(process.cwd(), "package-lock.json"), "utf8"));
  const installedLock = JSON.parse(
    await readFile(join(process.cwd(), "node_modules/.package-lock.json"), "utf8")
  );
  const expected = packageLock.packages?.[packagePath]?.resolved;
  const installed = installedLock.packages?.[packagePath]?.resolved;

  if (!expected || installed !== expected) {
    throw new Error(
      `Installed SDK resolution does not match package-lock.json (expected ${expected ?? "missing"}, received ${installed ?? "missing"}).`
    );
  }

  process.stdout.write(`Verified SDK package-lock resolution: ${installed}\n`);
}

let installStatus;

try {
  await chmod(tempDirectory, 0o700);
  await writeFile(keyPath, deployKey.endsWith("\n") ? deployKey : `${deployKey}\n`, {
    mode: 0o600
  });
  await writeFile(knownHostsPath, githubHostKey, { mode: 0o600 });

  const installEnvironment = {
    ...process.env,
    GIT_SSH_COMMAND: `ssh -i "${keyPath}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="${knownHostsPath}"`
  };
  delete installEnvironment.GAME_PLATFORM_SDK_DEPLOY_KEY;
  installStatus = runNpm(["ci"], "Dependency installation", installEnvironment);
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}

if (installStatus !== 0) {
  process.exitCode = installStatus;
} else {
  await verifySdkLockResolution();
  const buildEnvironment = { ...process.env };
  delete buildEnvironment.GAME_PLATFORM_SDK_DEPLOY_KEY;
  delete buildEnvironment.GIT_SSH_COMMAND;
  process.exitCode = runNpm(["run", "build"], "Site build", buildEnvironment);
}
