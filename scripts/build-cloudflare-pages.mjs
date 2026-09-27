import { spawnSync } from "node:child_process";
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import process from "node:process";

const deployKey = process.env.GAME_PLATFORM_SDK_DEPLOY_KEY;

if (!deployKey?.includes("PRIVATE KEY")) {
  throw new Error("GAME_PLATFORM_SDK_DEPLOY_KEY is required for the Pages build.");
}

const sshDirectory = join(homedir(), ".ssh");
const keyPath = join(sshDirectory, "game-platform-sdk");
const knownHostsPath = join(sshDirectory, "game-platform-sdk-known-hosts");
const githubHostKey =
  "github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl\n";

function runNpm(args, description, environment) {
  const result = spawnSync("npm", args, { env: environment, stdio: "inherit" });

  if (result.error) {
    throw new Error(`${description} could not start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    return false;
  }

  return true;
}

let dependenciesInstalled;

try {
  await mkdir(sshDirectory, { recursive: true, mode: 0o700 });
  await chmod(sshDirectory, 0o700);
  await writeFile(keyPath, deployKey.endsWith("\n") ? deployKey : `${deployKey}\n`, {
    mode: 0o600
  });
  await writeFile(knownHostsPath, githubHostKey, { mode: 0o600 });

  const installEnvironment = {
    ...process.env,
    GIT_SSH_COMMAND: `ssh -i "${keyPath}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="${knownHostsPath}"`
  };
  delete installEnvironment.GAME_PLATFORM_SDK_DEPLOY_KEY;
  dependenciesInstalled = runNpm(["ci"], "Dependency installation", installEnvironment);
} finally {
  await rm(keyPath, { force: true });
  await rm(knownHostsPath, { force: true });
}

if (dependenciesInstalled) {
  const buildEnvironment = { ...process.env };
  delete buildEnvironment.GAME_PLATFORM_SDK_DEPLOY_KEY;
  delete buildEnvironment.GIT_SSH_COMMAND;
  runNpm(["run", "build"], "Site build", buildEnvironment);
} else if (!process.exitCode) {
  process.exitCode = 1;
}
