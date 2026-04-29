import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parsePrUrl, fetchDiff } from '../../src/utils/platform.ts'

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

type MockResponseInit = {
  status?: number
  statusText?: string
  headers?: Record<string, string>
  body?: string | object
}

/** Build a Response-like object for the mocked fetch. */
function buildResponse(init: MockResponseInit = {}): Response {
  const {
    status = 200,
    statusText = 'OK',
    headers = {},
    body = '',
  } = init

  const bodyText = typeof body === 'string' ? body : JSON.stringify(body)
  const h = new Map(Object.entries(headers))

  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {
      get(name: string) {
        return h.get(name) ?? null
      },
    },
    async text() {
      return bodyText
    },
    async json() {
      if (typeof body === 'object' && body !== null) return body
      throw new Error('Not JSON')
    },
  } as unknown as Response
}

// ─────────────────────────────────────────────────────────────────────────────

describe('parsePrUrl', () => {
  // ── GitHub ──────────────────────────────────────────────────────────────

  describe('GitHub', () => {
    it('parses a standard github.com PR URL', () => {
      const result = parsePrUrl('https://github.com/owner/repo/pull/42')

      expect(result.platform).toBe('github')
      expect(result.diffEndpoint).toBe(
        'https://api.github.com/repos/owner/repo/pulls/42'
      )
      expect(result.acceptHeader).toBe('application/vnd.github.v3.diff')
    })

    it('handles trailing slash in URL', () => {
      const result = parsePrUrl('https://github.com/owner/repo/pull/42/')

      expect(result.platform).toBe('github')
      expect(result.diffEndpoint).toContain('/pulls/42')
    })

    it('uses /api/v3 prefix for GitHub Enterprise (non-github.com host)', () => {
      const result = parsePrUrl('https://git.company.com/owner/repo/pull/99')

      expect(result.platform).toBe('github')
      expect(result.diffEndpoint).toBe(
        'https://git.company.com/api/v3/repos/owner/repo/pulls/99'
      )
    })

    it('throws for an invalid PR path', () => {
      expect(() =>
        parsePrUrl('https://github.com/owner/repo/commits/42')
      ).toThrow('Unrecognized PR/MR URL format')
    })
  })

  // ── GitLab ───────────────────────────────────────────────────────────────

  describe('GitLab', () => {
    it('parses a gitlab.com MR URL', () => {
      const result = parsePrUrl(
        'https://gitlab.com/owner/repo/-/merge_requests/7'
      )

      expect(result.platform).toBe('gitlab')
      expect(result.diffEndpoint).toBe(
        'https://gitlab.com/api/v4/projects/owner%2Frepo/merge_requests/7/diffs'
      )
      expect(result.diffParams).toEqual({ view: 'raw' })
    })

    it('parses a subgroup MR URL (multi-level namespace)', () => {
      const result = parsePrUrl(
        'https://gitlab.com/group/subgroup/repo/-/merge_requests/3'
      )

      expect(result.platform).toBe('gitlab')
      expect(result.diffEndpoint).toContain(
        'group%2Fsubgroup%2Frepo/merge_requests/3/diffs'
      )
    })

    it('uses self-hosted GitLab base URL', () => {
      const result = parsePrUrl(
        "https://w.src.corp.qihoo.net/sord/www_so_com/-/merge_requests/1027",
      );

      expect(result.platform).toBe('gitlab')
      expect(result.diffParams).toEqual({ view: 'raw' })
      expect(result.diffEndpoint).toBe(
        "https://w.src.corp.qihoo.net/api/v4/projects/sord%2Fwww_so_com/merge_requests/1027/diffs"
      )
    })

    it('throws for an invalid MR path', () => {
      expect(() =>
        parsePrUrl('https://gitlab.com/owner/repo/-/issues/7')
      ).toThrow('Unrecognized PR/MR URL format')
    })
  })

  // ── Errors ──────────────────────────────────────────────────────────────

  describe('invalid input', () => {
    it('throws for a completely invalid URL', () => {
      expect(() => parsePrUrl('not-a-url')).toThrow('Invalid URL')
    })

    it('throws with a helpful message listing expected formats', () => {
      try {
        parsePrUrl('https://example.com/weird/path')
      } catch (err) {
        expect((err as Error).message).toContain('GitHub')
        expect((err as Error).message).toContain('GitLab')
      }
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
