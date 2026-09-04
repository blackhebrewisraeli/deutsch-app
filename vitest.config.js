// Vitest config — pure-logic + data-invariant tests plus React component tests.
// jsdom is required for storage.js tests and component rendering.
// See docs/MAINTENANCE_CHECKLIST.md for how tests fit into the release flow.

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.js'],
    // Generous timeouts on purpose. These budgets bound how long we wait for
    // something that is going to happen anyway, so on a loaded machine the
    // default 5s turns passing tests red: with the box at load 16, component
    // tests here took 7.4s, 10.0s and 12.6s and failed, in files the change
    // under test had never touched. A real hang still fails, just later.
    testTimeout: 30000,
    hookTimeout: 30000,
    // Bound the worker pool. Vitest defaults maxForks to the CPU count — 8
    // here — and each fork carries its own jsdom environment, so peak memory
    // scales with core count rather than with available RAM. On a 16 GB box
    // that is also running Docker (which reserves ~7.7 GB before a single
    // test starts), eight forks push the machine into swap, and a worker that
    // gets paged out stalls for tens of seconds.
    //
    // That is what the flakiness was. Measured: the three tests that failed
    // reported 34.3s, 32.8s and 33.4s — all just past the 30s deadline —
    // while the same tests run in 492-673ms. A 70x blowup is a stall, not
    // slowness: 2x CPU oversubscription (load 8 on 8 cores) reproduced
    // nothing, all 46 passing at 1.4x. The differentiator was memory —
    // swap sat at 6.4 GB of 7.2 GB used, with 693k pageouts.
    //
    // Which tests fail is therefore random (whichever worker is paged out),
    // and CI never sees it: `ubuntu-latest` is 4 vCPU with no Docker, so this
    // cap is a no-op there and bounds only the developer machine. Raising
    // testTimeout 5s -> 30s (above) treated this same cause at the deadline;
    // this treats it at the source. Both stay: a real hang still fails, and
    // now it fails for a legible reason.
    // minForks must be set alongside maxForks: it defaults to the CPU count,
    // so `maxForks: 4` alone throws "minThreads and maxThreads must not
    // conflict" and vitest then runs ZERO tests. It does exit 1, so CI and the
    // pre-commit hook catch it — but the summary reads "Test Files no tests",
    // which looks far more benign than it is.
    poolOptions: { forks: { minForks: 1, maxForks: 4 } },
    include: ['src/**/*.test.{js,jsx}', 'api/**/*.test.js', 'scripts/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      // lcov is what SonarCloud reads (sonar.javascript.lcov.reportPaths).
      // Without it the dashboard reported 0.0% Coverage on New Code for a repo
      // with ~1760 tests — not a low number, a MISSING one.
      reporter: ['text', 'html', 'lcov'],
      // src/App.jsx is listed explicitly. It was absent for the app's whole
      // life, so the 939-line orchestrator that owns the sync effects, the
      // trial-wall gate and the entry gate never appeared in a coverage
      // report — a sweep for uncovered flag branches found 58 of them and
      // silently missed App's four. An audit that cannot see a file reports
      // zero findings there and zero files inspected identically.
      //
      // src/data/** is gone, not omitted: the directory was deleted in Phase
      // 1.5 (PR #101) and the stale glob had been matching nothing since.
      // src/packs/** added: 14 source files with 14 test files beside them,
      // measured by nothing. Same defect as App.jsx below — a tested directory
      // absent from the report is indistinguishable from an untested one, and
      // once Sonar reads this lcov it would have called all 14 uncovered.
      include: ['src/lib/**', 'src/components/**', 'src/packs/**', 'src/App.jsx', 'api/**'],
      exclude: ['src/**/*.test.{js,jsx}', 'api/**/*.test.js'],
    },
  },
});
