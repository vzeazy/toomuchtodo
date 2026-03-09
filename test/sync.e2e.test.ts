import test from 'node:test';
import assert from 'node:assert/strict';
import { createPagesApiHarness } from './support/pagesApiHarness';
import { mergeFirstLinkState } from '../src/lib/sync/engine';

const strongPassword = 'Strongpass123';

const readUserId = (payload: unknown) => {
  const user = payload as { user?: { id?: string } };
  assert.ok(user.user?.id);
  return user.user.id;
};

const baseTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-shared-id',
  title: 'First synced task',
  description: '',
  status: 'open',
  isStarred: false,
  projectId: null,
  area: 'Personal',
  dueDate: null,
  dayPart: null,
  parentId: null,
  collapsed: false,
  createdAt: 1_700_000_000_000,
  tags: [],
  updatedAt: 1_700_000_000_100,
  deletedAt: null,
  ...overrides,
});

test('turnstile-enabled sign-up creates a session in the same request', async () => {
  const harness = createPagesApiHarness({ TURNSTILE_ENABLED: 'true' });
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input, init) => {
    if (typeof input === 'string' && input.includes('challenges.cloudflare.com/turnstile')) {
      const body = init?.body instanceof URLSearchParams ? init.body : null;
      assert.equal(body?.get('response'), 'turnstile-pass');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch during test: ${String(input)}`);
  };

  try {
    const client = harness.createClient();
    const signUp = await client.requestJson<{ user: { email: string } }>('/api/auth/sign-up', {
      body: {
        email: 'turnstile@example.com',
        password: strongPassword,
        turnstileToken: 'turnstile-pass',
      },
    });

    assert.equal(signUp.response.status, 200);
    assert.equal(signUp.data.user.email, 'turnstile@example.com');

    const session = await client.requestJson<{ user: { email: string } }>('/api/auth/session');
    assert.equal(session.response.status, 200);
    assert.equal(session.data.user.email, 'turnstile@example.com');
  } finally {
    globalThis.fetch = originalFetch;
    harness.close();
  }
});

test('sign-up rejects weak passwords that do not meet the new policy', async () => {
  const harness = createPagesApiHarness();

  try {
    const client = harness.createClient();
    const response = await client.requestJson<{ error: string; message: string }>('/api/auth/sign-up', {
      body: {
        email: 'weak@example.com',
        password: 'weakpass',
      },
    });

    assert.equal(response.response.status, 400);
    assert.equal(response.data.error, 'weak_password');
    assert.match(response.data.message, /12 characters/i);
  } finally {
    harness.close();
  }
});

test('user-scoped settings and record ids stay isolated across accounts', async () => {
  const harness = createPagesApiHarness();

  try {
    const alice = harness.createClient();
    const bob = harness.createClient();

    const aliceAuth = await alice.requestJson('/api/auth/sign-up', {
      body: { email: 'alice@example.com', password: strongPassword },
    });
    const bobAuth = await bob.requestJson('/api/auth/sign-up', {
      body: { email: 'bob@example.com', password: strongPassword },
    });

    assert.equal(aliceAuth.response.status, 200);
    assert.equal(bobAuth.response.status, 200);

    const aliceBootstrap = await alice.requestJson<{ cursor: string }>('/api/sync/bootstrap');
    const bobBootstrap = await bob.requestJson<{ cursor: string }>('/api/sync/bootstrap');

    await alice.requestJson('/api/sync/push', {
      body: {
        deviceId: 'device-alice',
        cursor: aliceBootstrap.data.cursor,
        ops: [
          {
            id: 'alice-settings-op',
            entity: 'settings',
            action: 'upsert',
            recordId: 'settings',
            payload: { activeThemeId: 'theme-alice', taskListMode: 'list' },
            deviceId: 'device-alice',
            timestamp: 1_700_000_000_000,
          },
          {
            id: 'alice-task-op',
            entity: 'task',
            action: 'upsert',
            recordId: 'task-shared-id',
            payload: baseTask({ title: 'Alice task' }),
            deviceId: 'device-alice',
            timestamp: 1_700_000_000_100,
          },
        ],
      },
    });

    await bob.requestJson('/api/sync/push', {
      body: {
        deviceId: 'device-bob',
        cursor: bobBootstrap.data.cursor,
        ops: [
          {
            id: 'bob-settings-op',
            entity: 'settings',
            action: 'upsert',
            recordId: 'settings',
            payload: { activeThemeId: 'theme-bob', taskListMode: 'outline' },
            deviceId: 'device-bob',
            timestamp: 1_700_000_000_200,
          },
          {
            id: 'bob-task-op',
            entity: 'task',
            action: 'upsert',
            recordId: 'task-shared-id',
            payload: baseTask({ title: 'Bob task', updatedAt: 1_700_000_000_300 }),
            deviceId: 'device-bob',
            timestamp: 1_700_000_000_300,
          },
        ],
      },
    });

    const aliceSnapshot = await alice.requestJson<{ snapshot: { settings: { activeThemeId: string }; tasks: Array<{ title: string }> } }>('/api/sync/bootstrap');
    const bobSnapshot = await bob.requestJson<{ snapshot: { settings: { activeThemeId: string }; tasks: Array<{ title: string }> } }>('/api/sync/bootstrap');

    assert.equal(aliceSnapshot.data.snapshot.settings.activeThemeId, 'theme-alice');
    assert.equal(bobSnapshot.data.snapshot.settings.activeThemeId, 'theme-bob');
    assert.deepEqual(aliceSnapshot.data.snapshot.tasks.map((task) => task.title), ['Alice task']);
    assert.deepEqual(bobSnapshot.data.snapshot.tasks.map((task) => task.title), ['Bob task']);
  } finally {
    harness.close();
  }
});

test('sign-in, session refresh, sign-out, bootstrap, push, pull, and first-link upload work across two clients', async () => {
  const harness = createPagesApiHarness();

  try {
    const deviceA = harness.createClient();
    const deviceB = harness.createClient();
    const email = 'shared@example.com';
    const password = strongPassword;

    const signUp = await deviceA.requestJson('/api/auth/sign-up', {
      body: { email, password },
    });
    assert.equal(signUp.response.status, 200);
    const userId = readUserId(signUp.data);

    const bootstrapA = await deviceA.requestJson<{ cursor: string; snapshot: { tasks: unknown[] } }>('/api/sync/bootstrap');
    assert.equal(bootstrapA.response.status, 200);
    assert.equal(bootstrapA.data.snapshot.tasks.length, 0);

    const firstLinkPush = await deviceA.requestJson<{ accepted: number }>('/api/sync/push', {
      body: {
        deviceId: 'device-a',
        cursor: bootstrapA.data.cursor,
        ops: [
          {
            id: 'device-a-project-op',
            entity: 'project',
            action: 'upsert',
            recordId: 'project-1',
            payload: {
              id: 'project-1',
              name: 'Home',
              color: '#123456',
              parentId: null,
              updatedAt: 1_700_000_000_010,
              deletedAt: null,
            },
            deviceId: 'device-a',
            timestamp: 1_700_000_000_010,
          },
          {
            id: 'device-a-task-op',
            entity: 'task',
            action: 'upsert',
            recordId: 'task-1',
            payload: baseTask({ id: 'task-1', title: 'Synced from device A', projectId: 'project-1' }),
            deviceId: 'device-a',
            timestamp: 1_700_000_000_100,
          },
          {
            id: 'device-a-settings-op',
            entity: 'settings',
            action: 'upsert',
            recordId: 'settings',
            payload: { activeThemeId: 'aurora', taskListMode: 'list' },
            deviceId: 'device-a',
            timestamp: 1_700_000_000_120,
          },
        ],
      },
    });
    assert.equal(firstLinkPush.response.status, 200);
    assert.equal(firstLinkPush.data.accepted, 3);

    const signOut = await deviceA.requestJson('/api/auth/sign-out', { method: 'POST' });
    assert.equal(signOut.response.status, 200);
    const signedOutSession = await deviceA.requestJson('/api/auth/session');
    assert.equal(signedOutSession.response.status, 401);

    const signIn = await deviceB.requestJson('/api/auth/sign-in', {
      body: { email, password },
    });
    assert.equal(signIn.response.status, 200);
    assert.equal(readUserId(signIn.data), userId);

    const refreshedSession = await deviceB.requestJson<{ user: { email: string } }>('/api/auth/session');
    assert.equal(refreshedSession.response.status, 200);
    assert.equal(refreshedSession.data.user.email, email);

    const bootstrapB = await deviceB.requestJson<{ cursor: string; snapshot: { projects: Array<{ name: string }>; tasks: Array<{ title: string }>; settings: { activeThemeId: string } } }>('/api/sync/bootstrap');
    assert.equal(bootstrapB.response.status, 200);
    assert.deepEqual(bootstrapB.data.snapshot.projects.map((project) => project.name), ['Home']);
    assert.deepEqual(bootstrapB.data.snapshot.tasks.map((task) => task.title), ['Synced from device A']);
    assert.equal(bootstrapB.data.snapshot.settings.activeThemeId, 'aurora');

    const deviceAAgain = harness.createClient();
    await deviceAAgain.requestJson('/api/auth/sign-in', {
      body: { email, password },
    });
    const deviceABootstrap = await deviceAAgain.requestJson<{ cursor: string }>('/api/sync/bootstrap');
    const secondPush = await deviceAAgain.requestJson('/api/sync/push', {
      body: {
        deviceId: 'device-a',
        cursor: deviceABootstrap.data.cursor,
        ops: [
          {
            id: 'device-a-task-op-2',
            entity: 'task',
            action: 'upsert',
            recordId: 'task-2',
            payload: baseTask({ id: 'task-2', title: 'Second device A task', updatedAt: 1_700_000_000_500 }),
            deviceId: 'device-a',
            timestamp: 1_700_000_000_500,
          },
        ],
      },
    });
    assert.equal(secondPush.response.status, 200);

    const pullOnB = await deviceB.requestJson<{ changes: Array<{ recordId: string; payload: { title?: string } }> }>(`/api/sync/pull?cursor=${encodeURIComponent(bootstrapB.data.cursor)}`);
    assert.equal(pullOnB.response.status, 200);
    assert.equal(pullOnB.data.changes.length, 1);
    assert.equal(pullOnB.data.changes[0]?.recordId, 'task-2');
    assert.equal(pullOnB.data.changes[0]?.payload.title, 'Second device A task');
  } finally {
    harness.close();
  }
});

test('same-record concurrent edits return a structured version conflict with the server record', async () => {
  const harness = createPagesApiHarness();

  try {
    const deviceA = harness.createClient();
    const deviceB = harness.createClient();
    const email = 'conflict@example.com';
    const password = strongPassword;

    await deviceA.requestJson('/api/auth/sign-up', { body: { email, password } });
    await deviceB.requestJson('/api/auth/sign-in', { body: { email, password } });

    const bootstrapA = await deviceA.requestJson<{ cursor: string }>('/api/sync/bootstrap');
    await deviceA.requestJson('/api/sync/push', {
      body: {
        deviceId: 'device-a',
        cursor: bootstrapA.data.cursor,
        ops: [{
          id: 'seed-task',
          entity: 'task',
          action: 'upsert',
          recordId: 'task-1',
          payload: baseTask({ id: 'task-1', title: 'Seed task' }),
          deviceId: 'device-a',
          timestamp: 1_700_000_001_000,
          baseVersion: null,
        }],
      },
    });

    const currentA = await deviceA.requestJson<{ snapshot: { tasks: Array<{ syncVersion: number }> } }>('/api/sync/bootstrap');
    const currentB = await deviceB.requestJson<{ snapshot: { tasks: Array<{ syncVersion: number }> } }>('/api/sync/bootstrap');
    const baseVersion = currentA.data.snapshot.tasks[0]?.syncVersion;
    assert.equal(baseVersion, currentB.data.snapshot.tasks[0]?.syncVersion);

    const accepted = await deviceA.requestJson('/api/sync/push', {
      body: {
        deviceId: 'device-a',
        cursor: currentA.data.cursor,
        ops: [{
          id: 'device-a-update',
          entity: 'task',
          action: 'upsert',
          recordId: 'task-1',
          payload: baseTask({ id: 'task-1', title: 'Device A wins', updatedAt: 1_700_000_001_100 }),
          deviceId: 'device-a',
          timestamp: 1_700_000_001_100,
          baseVersion,
        }],
      },
    });
    assert.equal(accepted.response.status, 200);

    const conflicted = await deviceB.requestJson<{ accepted: number; conflicts: Array<{ recordId: string; serverVersion: number; serverRecord: { title: string } }> }>('/api/sync/push', {
      body: {
        deviceId: 'device-b',
        cursor: currentB.data.cursor,
        ops: [{
          id: 'device-b-update',
          entity: 'task',
          action: 'upsert',
          recordId: 'task-1',
          payload: baseTask({ id: 'task-1', title: 'Device B loses', updatedAt: 1_700_000_001_200 }),
          deviceId: 'device-b',
          timestamp: 1_700_000_001_200,
          baseVersion,
        }],
      },
    });

    assert.equal(conflicted.response.status, 200);
    assert.equal(conflicted.data.accepted, 0);
    assert.equal(conflicted.data.conflicts.length, 1);
    assert.equal(conflicted.data.conflicts[0]?.recordId, 'task-1');
    assert.equal(conflicted.data.conflicts[0]?.serverVersion, baseVersion + 1);
    assert.equal(conflicted.data.conflicts[0]?.serverRecord.title, 'Device A wins');
  } finally {
    harness.close();
  }
});

test('replaying the same push op id is idempotent and does not duplicate change log entries', async () => {
  const harness = createPagesApiHarness();

  try {
    const client = harness.createClient();
    await client.requestJson('/api/auth/sign-up', { body: { email: 'retry@example.com', password: strongPassword } });

    const bootstrap = await client.requestJson<{ cursor: string }>('/api/sync/bootstrap');
    const pushPayload = {
      deviceId: 'device-retry',
      cursor: bootstrap.data.cursor,
      ops: [{
        id: 'idempotent-op',
        entity: 'task',
        action: 'upsert',
        recordId: 'task-idempotent',
        payload: baseTask({ id: 'task-idempotent', title: 'Retry-safe task' }),
        deviceId: 'device-retry',
        timestamp: 1_700_000_002_000,
        baseVersion: null,
      }],
    };

    const firstPush = await client.requestJson<{ accepted: number; acceptedOpIds: string[] }>('/api/sync/push', { body: pushPayload });
    const secondPush = await client.requestJson<{ accepted: number; acceptedOpIds: string[] }>('/api/sync/push', { body: pushPayload });
    const pull = await client.requestJson<{ changes: Array<{ recordId: string }> }>(`/api/sync/pull?cursor=${encodeURIComponent(bootstrap.data.cursor)}`);

    assert.equal(firstPush.data.accepted, 1);
    assert.equal(secondPush.data.accepted, 1);
    assert.deepEqual(secondPush.data.acceptedOpIds, ['idempotent-op']);
    assert.deepEqual(pull.data.changes.map((change) => change.recordId), ['task-idempotent']);
  } finally {
    harness.close();
  }
});

test('first-link merge keeps local tasks while hydrating remote tasks and projects', () => {
  const localState = {
    version: 2,
    tasks: [baseTask({ id: 'local-task', title: 'Local task', syncVersion: null })],
    projects: [],
    settings: {
      activeThemeId: 'local-theme',
      plannerWidthMode: 'container',
      taskListMode: 'outline',
      showCompletedTasks: true,
      hideEmptyProjectsInPlanner: false,
      compactEmptyDaysInPlanner: false,
      startPlannerOnToday: false,
      groupDayViewByPart: false,
    },
    themes: [],
    timer: {
      active: false,
      paused: false,
      duration: 1800,
      remaining: 1800,
      linkedTaskId: null,
      sessionTitle: null,
      lastTick: null,
      finished: false,
      minimized: false,
    },
  };

  const merged = mergeFirstLinkState(localState, {
    tasks: [baseTask({ id: 'remote-task', title: 'Remote task', syncVersion: 2 })],
    projects: [{ id: 'remote-project', name: 'Remote project', parentId: null, updatedAt: 1_700_000_003_000, deletedAt: null, syncVersion: 1 }],
    settings: { ...localState.settings, activeThemeId: 'remote-theme', taskListMode: 'list' },
  });

  assert.deepEqual(merged.tasks.map((task) => task.id).sort(), ['local-task', 'remote-task']);
  assert.deepEqual(merged.projects.map((project) => project.id), ['remote-project']);
  assert.equal(merged.settings.activeThemeId, 'local-theme');
  assert.equal(merged.settings.taskListMode, 'outline');
});
