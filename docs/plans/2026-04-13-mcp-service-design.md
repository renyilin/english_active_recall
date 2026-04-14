# MCP Service Design

**Date:** 2026-04-13
**Status:** Design approved, ready for planning

## Goal

Expose the English Active Recall card library to Claude via an MCP server so users can search and add cards from chat. Target both **claude.ai** (web) and **Claude Desktop**.

## Scope

### In scope
- Remote MCP server mounted inside the existing FastAPI backend.
- OAuth 2.1 authentication (required by claude.ai; also works for Desktop).
- Two tools: `search_cards`, `add_card`.

### Out of scope (YAGNI)
- Per-tool scopes, rate limiting, token revocation endpoint, admin UI.
- Study-loop tools (`get_due_cards`, `grade_card`).
- AI smart-input tool (Claude fills structured fields itself).
- Dedup on add.
- Update/delete/get tools.

## Architecture

**Location:** New module `app/mcp/` inside the existing FastAPI app, mounted at `/mcp`. Reuses DB, models, and `User` table. No separate service.

**Transport:** Streamable HTTP (current MCP standard). Single `POST /mcp` endpoint handling JSON-RPC.

**Libraries:**
- `mcp` (official Python SDK) for JSON-RPC + tool routing.
- `authlib` for OAuth 2.1 server primitives.

## Authentication

OAuth 2.1 with PKCE and Dynamic Client Registration, layered on the existing email/password login.

### New endpoints
- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-authorization-server`
- `POST /oauth/register` (RFC 7591 Dynamic Client Registration)
- `GET /oauth/authorize` (login + consent UI)
- `POST /oauth/token` (code exchange + refresh)

### Registration
Claude.ai hits `/oauth/register` with its redirect URI. Server creates an `OAuthClient` row (client_id, optional client_secret, allowed redirect_uris) and returns credentials. Fully automatic.

### Authorization flow
1. Client redirects browser to `/oauth/authorize?client_id=...&redirect_uri=...&code_challenge=...&state=...`.
2. If unauthenticated, show login form (email + password — reuses existing auth).
3. Show minimal consent page: *"Claude wants to access your English Active Recall cards. [Approve] [Deny]"* (generic consent, not per-tool).
4. On approve, issue a short-lived (60s) single-use auth code, store `(code → user_id, client_id, code_challenge)`, redirect to `redirect_uri?code=...&state=...`.

### Token exchange
`POST /oauth/token` with code + PKCE `code_verifier`. Verifies, deletes code, issues:
- `access_token`: JWT, 1 hour, claims `{sub: user_id, scope: "mcp", client_id}`.
- `refresh_token`: opaque random string, 30 days, stored hashed in DB.

Standard `grant_type=refresh_token` supported.

### Scope separation
MCP tokens carry `scope: "mcp"` and cannot be used as regular session tokens; regular session JWTs cannot be used against `/mcp`. Enforced in the auth dependency.

### Request auth
FastAPI dependency parses `Authorization: Bearer <jwt>`, validates signature + `scope=mcp`, loads `User`, injects into tool handlers. Failures return 401 with `WWW-Authenticate: Bearer resource_metadata=...` (required by MCP spec).

## Tools

### `search_cards`

```
Input:
  query: string (required, min 1 char)
  limit: integer (optional, default 20, max 100)

SQL:
  SELECT * FROM card
  WHERE user_id = :current_user
    AND (target_text ILIKE %query% OR target_meaning ILIKE %query%)
  ORDER BY next_review ASC
  LIMIT :limit

Output: JSON array of cards with content fields + id + next_review.
        Omits SRS internals (ease_factor, interval).
```

### `add_card`

```
Input (all required):
  type: "phrase" | "sentence"
  target_text: string
  target_meaning: string
  context_sentence: string
  context_translation: string
  cloze_sentence: string

Behavior:
  INSERT with user_id = current_user and SRS defaults
  (interval=0, ease_factor=2.5, next_review=now).
  Return created card id + field echo.

Duplicates: not deduped (matches existing POST /cards).
```

## Database

One new Alembic migration adding:
- `oauth_clients` (client_id, client_secret_hash, redirect_uris, created_at)
- `oauth_auth_codes` (code, user_id, client_id, code_challenge, expires_at)
- `oauth_refresh_tokens` (token_hash, user_id, client_id, expires_at, revoked_at)

## Config

Additions to `.env`:
- `MCP_ISSUER_URL` — public base URL, used in OAuth metadata documents.
- Reuses existing `SECRET_KEY` for JWT signing.

## Testing

- **Unit:** OAuth code/token issuance, PKCE verification, JWT scope enforcement, tool handlers with mocked DB.
- **Integration** (pytest + httpx against test DB): full OAuth dance end-to-end; MCP `initialize` → `tools/list` → `tools/call` with valid bearer; unauthorized calls return 401 with correct `WWW-Authenticate`.
- **Manual:** Claude Desktop first (easier to debug), then claude.ai.

## Rollout phases

1. OAuth scaffolding: DB tables, metadata endpoints, DCR.
2. Authorize/consent UI + token endpoint with PKCE + refresh.
3. MCP transport + `tools/list`.
4. `search_cards`, `add_card` handlers.
5. Verify in Claude Desktop, then claude.ai.
