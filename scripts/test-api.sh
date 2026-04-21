#!/usr/bin/env bash
# DITCH API — happy-path smoke test
#
# Prerequisites:
#   - API server running:  pnpm --filter @ditch/api dev
#   - jq installed:        brew install jq  /  apt install jq
#
# Usage:
#   chmod +x scripts/test-api.sh
#   ./scripts/test-api.sh

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

API="http://localhost:3001"

EMAIL="testuser_$(date +%s)@example.com"
PASSWORD="testpassword123"
CHANNEL_SLUG="test-channel-$(date +%s)"

# ── Helpers ───────────────────────────────────────────────────────────────────

step() { echo; echo "━━━ $1 ━━━"; }
ok()   { echo "✓  $1"; }
fail() { echo "✗  $1"; exit 1; }

check_status() {
  local label="$1" expected="$2" actual="$3" body="$4"
  if [[ "$actual" != "$expected" ]]; then
    echo "✗  $label — expected HTTP $expected, got $actual"
    echo "   Response: $body"
    exit 1
  fi
  ok "$label (HTTP $actual)"
}

# ── 1. Signup ─────────────────────────────────────────────────────────────────

step "1. POST /auth/signup"

SIGNUP=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"display_name\":\"Test User\"}")

SIGNUP_BODY=$(echo "$SIGNUP" | head -n -1)
SIGNUP_STATUS=$(echo "$SIGNUP" | tail -n 1)
check_status "signup" "201" "$SIGNUP_STATUS" "$SIGNUP_BODY"

USER_ID=$(echo "$SIGNUP_BODY" | jq -r '.user.id')
ok "user_id: $USER_ID"

# ── 2. Signin ─────────────────────────────────────────────────────────────────

step "2. POST /auth/signin"

SIGNIN=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

SIGNIN_BODY=$(echo "$SIGNIN" | head -n -1)
SIGNIN_STATUS=$(echo "$SIGNIN" | tail -n 1)
check_status "signin" "200" "$SIGNIN_STATUS" "$SIGNIN_BODY"

JWT=$(echo "$SIGNIN_BODY" | jq -r '.access_token')
ok "access_token: ${JWT:0:40}…"

AUTH="Authorization: Bearer $JWT"

# ── 3. POST /channels ─────────────────────────────────────────────────────────

step "3. POST /channels"

CHANNEL=$(curl -s -w "\n%{http_code}" -X POST "$API/channels" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "{\"slug\":\"$CHANNEL_SLUG\",\"display_name\":\"Test Channel\",\"description\":\"Created by test script\"}")

CHANNEL_BODY=$(echo "$CHANNEL" | head -n -1)
CHANNEL_STATUS=$(echo "$CHANNEL" | tail -n 1)
check_status "create channel" "201" "$CHANNEL_STATUS" "$CHANNEL_BODY"

CHANNEL_ID=$(echo "$CHANNEL_BODY" | jq -r '.channel.id')
ok "channel_id: $CHANNEL_ID"
ok "channel_slug: $(echo "$CHANNEL_BODY" | jq -r '.channel.slug')"
ok "channel.owner_id matches user: $([ "$(echo "$CHANNEL_BODY" | jq -r '.channel.owner_id')" = "$USER_ID" ] && echo "yes" || echo "FAIL")"

# ── 4. GET /channels/:slug ────────────────────────────────────────────────────

step "4. GET /channels/:slug"

GET_CHANNEL=$(curl -s -w "\n%{http_code}" "$API/channels/$CHANNEL_SLUG")
GET_CHANNEL_BODY=$(echo "$GET_CHANNEL" | head -n -1)
GET_CHANNEL_STATUS=$(echo "$GET_CHANNEL" | tail -n 1)
check_status "get channel" "200" "$GET_CHANNEL_STATUS" "$GET_CHANNEL_BODY"
ok "channel.display_name: $(echo "$GET_CHANNEL_BODY" | jq -r '.channel.display_name')"

# ── 5. POST /sessions ─────────────────────────────────────────────────────────

step "5. POST /sessions"

SESSION=$(curl -s -w "\n%{http_code}" -X POST "$API/sessions" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "{\"channel_id\":\"$CHANNEL_ID\"}")

SESSION_BODY=$(echo "$SESSION" | head -n -1)
SESSION_STATUS=$(echo "$SESSION" | tail -n 1)
check_status "create session" "201" "$SESSION_STATUS" "$SESSION_BODY"

SESSION_ID=$(echo "$SESSION_BODY" | jq -r '.session.id')
ok "session_id: $SESSION_ID"
ok "session.status: $(echo "$SESSION_BODY" | jq -r '.session.status')"

# ── 6. POST /destinations ─────────────────────────────────────────────────────

step "6. POST /destinations"

DEST=$(curl -s -w "\n%{http_code}" -X POST "$API/destinations" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "{\"session_id\":\"$SESSION_ID\",\"platform\":\"twitch\",\"rtmp_url\":\"rtmp://live.twitch.tv/app\",\"stream_key\":\"live_test_key_abc123\"}")

DEST_BODY=$(echo "$DEST" | head -n -1)
DEST_STATUS=$(echo "$DEST" | tail -n 1)
check_status "create destination" "201" "$DEST_STATUS" "$DEST_BODY"

DEST_ID=$(echo "$DEST_BODY" | jq -r '.destination.id')
ok "destination_id: $DEST_ID"
ok "destination.platform: $(echo "$DEST_BODY" | jq -r '.destination.platform')"
ok "rtmp_url absent: $(echo "$DEST_BODY" | jq -r 'if (.destination | has("rtmp_url")) then "FAIL - creds leaked!" else "ok" end')"

# ── 7. GET /destinations?channel_id= ─────────────────────────────────────────

step "7. GET /destinations?channel_id="

GET_DESTS=$(curl -s -w "\n%{http_code}" "$API/destinations?channel_id=$CHANNEL_ID" \
  -H "$AUTH")

GET_DESTS_BODY=$(echo "$GET_DESTS" | head -n -1)
GET_DESTS_STATUS=$(echo "$GET_DESTS" | tail -n 1)
check_status "list destinations" "200" "$GET_DESTS_STATUS" "$GET_DESTS_BODY"
ok "destinations count: $(echo "$GET_DESTS_BODY" | jq '.destinations | length')"

# ── 8. POST /participants (anonymous join) ────────────────────────────────────

step "8. POST /participants (anonymous)"

PARTICIPANT=$(curl -s -w "\n%{http_code}" -X POST "$API/participants" \
  -H "Content-Type: application/json" \
  -d "{\"session_id\":\"$SESSION_ID\",\"display_name\":\"ViewerJane\",\"platform_origin\":\"twitch\"}")

PARTICIPANT_BODY=$(echo "$PARTICIPANT" | head -n -1)
PARTICIPANT_STATUS=$(echo "$PARTICIPANT" | tail -n 1)
check_status "join as participant" "201" "$PARTICIPANT_STATUS" "$PARTICIPANT_BODY"

PARTICIPANT_ID=$(echo "$PARTICIPANT_BODY" | jq -r '.participant.id')
ok "participant_id: $PARTICIPANT_ID"
ok "participant.status: $(echo "$PARTICIPANT_BODY" | jq -r '.participant.status')"
ok "participant.user_id: $(echo "$PARTICIPANT_BODY" | jq -r '.participant.user_id')"

# ── 9. GET /participants?session_id= ─────────────────────────────────────────

step "9. GET /participants?session_id="

GET_PARTS=$(curl -s -w "\n%{http_code}" "$API/participants?session_id=$SESSION_ID")
GET_PARTS_BODY=$(echo "$GET_PARTS" | head -n -1)
GET_PARTS_STATUS=$(echo "$GET_PARTS" | tail -n 1)
check_status "list participants" "200" "$GET_PARTS_STATUS" "$GET_PARTS_BODY"
ok "participants count: $(echo "$GET_PARTS_BODY" | jq '.participants | length')"

# ── 10. PATCH /participants/:id — waiting → approved ─────────────────────────

step "10. PATCH /participants/:id (waiting → approved)"

PATCH_APPROVED=$(curl -s -w "\n%{http_code}" -X PATCH "$API/participants/$PARTICIPANT_ID" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"status":"approved"}')

PATCH_APPROVED_BODY=$(echo "$PATCH_APPROVED" | head -n -1)
PATCH_APPROVED_STATUS=$(echo "$PATCH_APPROVED" | tail -n 1)
check_status "approve participant" "200" "$PATCH_APPROVED_STATUS" "$PATCH_APPROVED_BODY"
ok "participant.status: $(echo "$PATCH_APPROVED_BODY" | jq -r '.participant.status')"

# ── 11. PATCH /participants/:id — approved → live ─────────────────────────────

step "11. PATCH /participants/:id (approved → live)"

PATCH_LIVE=$(curl -s -w "\n%{http_code}" -X PATCH "$API/participants/$PARTICIPANT_ID" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"status":"live","slot_index":0}')

PATCH_LIVE_BODY=$(echo "$PATCH_LIVE" | head -n -1)
PATCH_LIVE_STATUS=$(echo "$PATCH_LIVE" | tail -n 1)
check_status "set participant live" "200" "$PATCH_LIVE_STATUS" "$PATCH_LIVE_BODY"
ok "participant.status: $(echo "$PATCH_LIVE_BODY" | jq -r '.participant.status')"
ok "participant.slot_index: $(echo "$PATCH_LIVE_BODY" | jq -r '.participant.slot_index')"

# ── 12. PATCH /destinations/:id — update status ──────────────────────────────

step "12. PATCH /destinations/:id (connecting → live)"

PATCH_DEST=$(curl -s -w "\n%{http_code}" -X PATCH "$API/destinations/$DEST_ID" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"status":"live"}')

PATCH_DEST_BODY=$(echo "$PATCH_DEST" | head -n -1)
PATCH_DEST_STATUS=$(echo "$PATCH_DEST" | tail -n 1)
check_status "update destination status" "200" "$PATCH_DEST_STATUS" "$PATCH_DEST_BODY"
ok "destination.status: $(echo "$PATCH_DEST_BODY" | jq -r '.destination.status')"

# ── 13. DELETE /participants/:id ──────────────────────────────────────────────

step "13. DELETE /participants/:id"

DELETE_PART=$(curl -s -w "\n%{http_code}" -X DELETE "$API/participants/$PARTICIPANT_ID" \
  -H "$AUTH")

DELETE_PART_BODY=$(echo "$DELETE_PART" | head -n -1)
DELETE_PART_STATUS=$(echo "$DELETE_PART" | tail -n 1)
check_status "delete participant" "200" "$DELETE_PART_STATUS" "$DELETE_PART_BODY"
ok "participant.status: $(echo "$DELETE_PART_BODY" | jq -r '.participant.status')"

# ── 14. DELETE /destinations/:id ─────────────────────────────────────────────

step "14. DELETE /destinations/:id"

DELETE_DEST=$(curl -s -w "\n%{http_code}" -X DELETE "$API/destinations/$DEST_ID" \
  -H "$AUTH")

DELETE_DEST_STATUS=$(echo "$DELETE_DEST" | tail -n 1)
check_status "delete destination" "204" "$DELETE_DEST_STATUS" ""

# ── 15. PATCH /sessions/:id — idle → live ────────────────────────────────────

step "15. PATCH /sessions/:id (idle → live)"

PATCH_SESSION=$(curl -s -w "\n%{http_code}" -X PATCH "$API/sessions/$SESSION_ID" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d '{"status":"live"}')

PATCH_SESSION_BODY=$(echo "$PATCH_SESSION" | head -n -1)
PATCH_SESSION_STATUS=$(echo "$PATCH_SESSION" | tail -n 1)
check_status "go live" "200" "$PATCH_SESSION_STATUS" "$PATCH_SESSION_BODY"
ok "session.status: $(echo "$PATCH_SESSION_BODY" | jq -r '.session.status')"
ok "session.started_at: $(echo "$PATCH_SESSION_BODY" | jq -r '.session.started_at')"

# ── 16. DELETE /sessions/:id — force end ─────────────────────────────────────

step "16. DELETE /sessions/:id (force end)"

DELETE_SESSION=$(curl -s -w "\n%{http_code}" -X DELETE "$API/sessions/$SESSION_ID" \
  -H "$AUTH")

DELETE_SESSION_BODY=$(echo "$DELETE_SESSION" | head -n -1)
DELETE_SESSION_STATUS=$(echo "$DELETE_SESSION" | tail -n 1)
check_status "end session" "200" "$DELETE_SESSION_STATUS" "$DELETE_SESSION_BODY"
ok "session.status: $(echo "$DELETE_SESSION_BODY" | jq -r '.session.status')"
ok "session.ended_at: $(echo "$DELETE_SESSION_BODY" | jq -r '.session.ended_at')"

# ── Done ──────────────────────────────────────────────────────────────────────

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  All 16 steps passed. Happy path clean."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
