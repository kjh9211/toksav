'use strict';

const { spawn, spawnSync } = require('child_process');
const platform = require('./platform');

const MAX_CAPTURE_BYTES = 2 * 1024 * 1024; // 2MB safety cap per stream

// Tracks currently-running children so a top-level SIGINT handler can forward
// the interrupt and let them shut down instead of leaving orphans behind.
const activeChildren = new Set();

/**
 * List all processes visible to `ps` as {pid, ppid} pairs. POSIX only.
 * Used to find a child's descendants without relying on process-group
 * signal delivery, which is not reliably supported in every containerized
 * environment this CLI may run in.
 */
function listProcesses() {
  const result = spawnSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) return [];
  return result.stdout
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length === 2)
    .map(([pid, ppid]) => ({ pid: Number(pid), ppid: Number(ppid) }))
    .filter((p) => Number.isInteger(p.pid) && Number.isInteger(p.ppid));
}

function collectDescendants(rootPid, processes) {
  const descendants = [];
  const queue = [rootPid];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const p of processes) {
      if (p.ppid === current) {
        descendants.push(p.pid);
        queue.push(p.pid);
      }
    }
  }
  return descendants;
}

function signalPid(pid, signal) {
  try {
    process.kill(pid, signal);
  } catch {
    // already gone
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitUntilDead(pid, timeoutMs, intervalMs = 25) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      if (!isAlive(pid) || Date.now() >= deadline) {
        resolve(!isAlive(pid));
        return;
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

/**
 * Signal one pid and confirm it actually died, escalating to SIGKILL (which
 * cannot be ignored or lost the way SIGTERM/SIGINT can) if it's still alive
 * after a short wait. Resolves once the pid is confirmed dead or we've
 * exhausted the escalation.
 */
async function killPidReliably(pid, signal) {
  if (!isAlive(pid)) return;
  signalPid(pid, signal);
  const died = await waitUntilDead(pid, 300);
  if (!died) {
    signalPid(pid, 'SIGKILL');
    await waitUntilDead(pid, 200);
  }
}

/**
 * Kill a spawned child's whole process tree, not just the immediate child.
 * Package managers (npm/pnpm/yarn/bun) run scripts through an intermediate
 * shell, so killing only the direct child would leave that shell's own
 * children (the actual lint/test/build process) running as orphans.
 *
 * On Windows, `taskkill /t` kills the tree directly. On POSIX, descendants
 * are found via `ps` (rather than process-group signaling, i.e. `kill(-pgid)`,
 * which some sandboxed/containerized environments don't propagate the way a
 * regular host OS would) and killed leaf-first, each confirmed dead before
 * moving up to its parent: once a parent process exits, some sandboxes
 * reparent its still-alive children (e.g. to PID 1) and then silently stop
 * delivering further signals to them from this process — so the direct
 * child must not be killed until its descendants are already gone.
 */
async function killChildTree(child, signal) {
  if (!child || !child.pid) return;

  if (platform.isWindows()) {
    try {
      spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
    } catch {
      try {
        child.kill(signal);
      } catch {
        // already gone
      }
    }
    return;
  }

  let descendants = [];
  try {
    descendants = collectDescendants(child.pid, listProcesses());
  } catch {
    // `ps` unavailable or failed; we can still kill the direct child below.
  }

  // Deepest descendants first (collectDescendants returns shallow-to-deep).
  for (const pid of [...descendants].reverse()) {
    await killPidReliably(pid, signal);
  }
  await killPidReliably(child.pid, signal);
}

function killAll(signal) {
  for (const child of activeChildren) {
    // Fire and forget: killChildTree's own internal timers (not unref'd)
    // keep the process alive until cleanup genuinely finishes.
    killChildTree(child, signal);
  }
}

/**
 * Spawn a command safely: argv is always passed as an array (never
 * concatenated into a shell string), and `shell: true` is only used for the
 * narrow, explicitly whitelisted set of Windows command shims that require it.
 *
 * Resolves (never rejects) with a normalized result so callers don't need to
 * special-case spawn errors (ENOENT, etc.) with try/catch.
 */
function run(command, args = [], options = {}) {
  const { cwd, env, timeoutMs, input } = options;

  return new Promise((resolve) => {
    const useShell = platform.needsShellOnWindows(command);
    let child;

    try {
      child = spawn(command, args, {
        cwd,
        env: env || process.env,
        shell: useShell,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      resolve({
        command,
        args,
        exitCode: null,
        signal: null,
        stdout: '',
        stderr: '',
        timedOut: false,
        error: err.message,
        spawnFailed: true,
      });
      return;
    }

    activeChildren.add(child);

    let stdout = '';
    let stderr = '';
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let settled = false;
    let timer = null;

    const cleanup = () => {
      activeChildren.delete(child);
      if (timer) clearTimeout(timer);
    };

    child.stdout.on('data', (chunk) => {
      if (stdout.length < MAX_CAPTURE_BYTES) {
        stdout += chunk.toString('utf8');
      } else {
        stdoutTruncated = true;
      }
    });

    child.stderr.on('data', (chunk) => {
      if (stderr.length < MAX_CAPTURE_BYTES) {
        stderr += chunk.toString('utf8');
      } else {
        stderrTruncated = true;
      }
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        command,
        args,
        exitCode: null,
        signal: null,
        stdout,
        stderr,
        timedOut,
        error: err.message,
        spawnFailed: true,
        stdoutTruncated,
        stderrTruncated,
      });
    });

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        command,
        args,
        exitCode: code,
        signal,
        stdout,
        stderr,
        timedOut,
        error: null,
        spawnFailed: false,
        stdoutTruncated,
        stderrTruncated,
      });
    });

    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        // killChildTree confirms each descendant (and finally the direct
        // child) actually died, escalating to SIGKILL as needed; its own
        // internal timers are not unref'd, so the process waits for this
        // to finish instead of exiting while a straggler is still alive.
        killChildTree(child, 'SIGTERM');
      }, timeoutMs);
      timer.unref();
    }

    if (typeof input === 'string' && child.stdin.writable) {
      child.stdin.write(input);
    }
    if (child.stdin.writable) {
      child.stdin.end();
    }
  });
}

module.exports = {
  run,
  killAll,
  MAX_CAPTURE_BYTES,
};
