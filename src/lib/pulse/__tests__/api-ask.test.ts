import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// API-level tests for the Ask Pulse route (src/app/api/pulse/websites/[websiteId]/ask).
// The route handler runs for real, including the deterministic built-in question
// parser in src/lib/pulse/assistant.ts. Only the request/auth layer, the
// permission checks and the Prisma client behind pulseDb() are mocked, the
// same pattern as the existing route tests (e.g. src/app/api/auth/login).
// No database, no network and no LLM key: OPENAI_API_KEY is removed for the
// whole file so Ask Pulse stays on its built-in parser path.

const mocks = vi.hoisted(() => ({
  parseRequest: vi.fn(),
  canViewWebsite: vi.fn(),
  db: {
    websiteEvent: { findMany: vi.fn(), groupBy: vi.fn() },
    session: { groupBy: vi.fn() },
  },
}));

vi.mock('@/lib/request', () => ({
  parseRequest: mocks.parseRequest,
}));

vi.mock('@/permissions', () => ({
  canViewWebsite: mocks.canViewWebsite,
  canUpdateWebsite: vi.fn(async () => false),
}));

vi.mock('@/lib/prisma', () => ({
  default: { client: mocks.db },
}));

import { GET, POST } from '@/app/api/pulse/websites/[websiteId]/ask/route';

const params = Promise.resolve({ websiteId: 'site-1' });

let savedKey: string | undefined;

beforeAll(() => {
  savedKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

afterAll(() => {
  if (savedKey !== undefined) process.env.OPENAI_API_KEY = savedKey;
});

beforeEach(() => {
  mocks.parseRequest.mockReset();
  mocks.canViewWebsite.mockReset();
  mocks.db.websiteEvent.findMany.mockReset();
  mocks.db.websiteEvent.groupBy.mockReset();
  mocks.db.session.groupBy.mockReset();

  mocks.canViewWebsite.mockResolvedValue(true);
  // Three pageview events from two sessions and two visits.
  mocks.db.websiteEvent.findMany.mockResolvedValue([
    { sessionId: 's1', visitId: 'v1' },
    { sessionId: 's1', visitId: 'v1' },
    { sessionId: 's2', visitId: 'v2' },
  ]);
  mocks.db.websiteEvent.groupBy.mockResolvedValue([]);
  mocks.db.session.groupBy.mockResolvedValue([]);
});

function mockBody(body: any) {
  mocks.parseRequest.mockResolvedValue({
    auth: { user: { id: 'user-1', username: 'alice' } },
    body,
    error: undefined,
  });
}

describe('Ask Pulse API: GET capabilities', () => {
  it('reports the built-in mode when no LLM key is configured', async () => {
    mockBody(undefined);

    const response = await GET(new Request('http://localhost/api/pulse/websites/site-1/ask'), {
      params,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.llmConfigured).toBe(false);
    expect(body.mode).toBe('builtin');
    expect(Array.isArray(body.examples)).toBe(true);
    expect(body.examples.length).toBeGreaterThan(0);
    expect(Array.isArray(body.capabilities)).toBe(true);
  });

  it('rejects a user who cannot view the website', async () => {
    mockBody(undefined);
    mocks.canViewWebsite.mockResolvedValue(false);

    const response = await GET(new Request('http://localhost/api/pulse/websites/site-1/ask'), {
      params,
    });

    expect(response.status).toBe(401);
  });
});

describe('Ask Pulse API: POST question', () => {
  it('answers a pageviews question through the built-in parser and the data layer', async () => {
    mockBody({ question: 'How many pageviews did I get yesterday?' });

    const response = await POST(
      new Request('http://localhost/api/pulse/websites/site-1/ask', { method: 'POST' }),
      { params },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.mode).toBe('builtin');
    expect(body.plan).toMatchObject({ intent: 'summary', metric: 'pageviews' });
    // The explanation is built from the executed result: 3 mocked pageviews.
    expect(body.explanation).toContain('3');
    expect(mocks.db.websiteEvent.findMany).toHaveBeenCalled();
  });

  it('refuses a question it cannot map to a supported plan', async () => {
    mockBody({ question: 'How much revenue did I make this week?' });

    const response = await POST(
      new Request('http://localhost/api/pulse/websites/site-1/ask', { method: 'POST' }),
      { params },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('refused');
    expect(body.plan).toBeUndefined();
    expect(Array.isArray(body.capabilities)).toBe(true);
  });

  it('rejects a user who cannot view the website before answering', async () => {
    mockBody({ question: 'How many pageviews did I get yesterday?' });
    mocks.canViewWebsite.mockResolvedValue(false);

    const response = await POST(
      new Request('http://localhost/api/pulse/websites/site-1/ask', { method: 'POST' }),
      { params },
    );

    expect(response.status).toBe(401);
    expect(mocks.db.websiteEvent.findMany).not.toHaveBeenCalled();
  });

  it('passes through a request validation error without touching the data layer', async () => {
    mocks.parseRequest.mockResolvedValue({
      auth: { user: { id: 'user-1' } },
      body: undefined,
      error: () =>
        Response.json({ error: { message: 'Bad request', code: 'bad-request' } }, { status: 400 }),
    });

    const response = await POST(
      new Request('http://localhost/api/pulse/websites/site-1/ask', { method: 'POST' }),
      { params },
    );

    expect(response.status).toBe(400);
    expect(mocks.canViewWebsite).not.toHaveBeenCalled();
    expect(mocks.db.websiteEvent.findMany).not.toHaveBeenCalled();
  });
});
