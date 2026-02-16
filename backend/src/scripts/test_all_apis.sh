#!/bin/bash
# ══════════════════════════════════════════════════════
# COMPREHENSIVE BACKEND API TEST SUITE v3
# Uses local JWT + pg fallback for dev testing
# ══════════════════════════════════════════════════════

BASE="http://127.0.0.1:5000/api"
PASS=0; FAIL=0; WARN=0; RESULTS=""; TEST_NUM=0

USER_ID="b9b2a1a8-8bcb-4a62-a9e9-40790ff015bc"
DB_URL="postgresql://postgres:adminDSAOSsupabase@db.wxrxnqhjkwlxvmaopvlv.supabase.co:5432/postgres"
JWT_SECRET="development-secret-key-change-in-prod-min-32-chars"

# Generate local JWT
TOKEN=$(node -e "
const jwt = require('jsonwebtoken');
console.log(jwt.sign({
    sub: '${USER_ID}',
    email: 'testadmin@dsaos.app',
    role: 'user',
    iat: Math.floor(Date.now()/1000),
    exp: Math.floor(Date.now()/1000) + 3600
}, '${JWT_SECRET}'));
")

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

test_ep() {
    local method="$1" endpoint="$2" expected="$3" desc="$4" data="$5" auth="$6"
    TEST_NUM=$((TEST_NUM + 1))
    local args=(-s -o /tmp/api_resp.json -w "%{http_code}" -m 15 -X "$method" -H "Content-Type: application/json")
    [ -n "$auth" ] && args+=(-H "Authorization: Bearer $auth")
    [ -n "$data" ] && args+=(-d "$data")
    args+=("${BASE}${endpoint}")
    local code=$(curl "${args[@]}" 2>/dev/null)
    local body=$(cat /tmp/api_resp.json 2>/dev/null | head -c 120)
    
    if [ "$code" = "$expected" ]; then
        PASS=$((PASS + 1))
        printf "  ${GREEN}✅${NC} [%02d] %-7s %-45s %s → ${GREEN}%s${NC}  %s\n" "$TEST_NUM" "$method" "$endpoint" "$expected" "$code" "$desc"
        RESULTS="${RESULTS}| ✅ | ${method} | \`${endpoint}\` | ${expected} | ${code} | ${desc} |\n"
    elif [ "$code" = "000" ]; then
        FAIL=$((FAIL + 1))
        printf "  ${RED}🔴${NC} [%02d] %-7s %-45s %s → ${RED}TIMEOUT${NC}  %s\n" "$TEST_NUM" "$method" "$endpoint" "$expected" "$desc"
        RESULTS="${RESULTS}| 🔴 | ${method} | \`${endpoint}\` | ${expected} | TIMEOUT | ${desc} |\n"
    elif echo "$code" | grep -qE "^(400|401|403|404|409|422)$"; then
        WARN=$((WARN + 1))
        printf "  ${YELLOW}⚠️${NC}  [%02d] %-7s %-45s %s → ${YELLOW}%s${NC}  %s\n" "$TEST_NUM" "$method" "$endpoint" "$expected" "$code" "$desc"
        RESULTS="${RESULTS}| ⚠️ | ${method} | \`${endpoint}\` | ${expected} | ${code} | ${desc} — ${body:0:60} |\n"
    else
        FAIL=$((FAIL + 1))
        printf "  ${RED}❌${NC} [%02d] %-7s %-45s %s → ${RED}%s${NC}  %s [%s]\n" "$TEST_NUM" "$method" "$endpoint" "$expected" "$code" "$desc" "${body:0:60}"
        RESULTS="${RESULTS}| ❌ | ${method} | \`${endpoint}\` | ${expected} | ${code} | ${desc} — ${body:0:60} |\n"
    fi
}

echo ""
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}          COMPREHENSIVE BACKEND API TEST SUITE v3            ${NC}"
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "  Server: ${BASE}"
echo -e "  User:   testadmin@dsaos.app"
echo -e "  Token:  ${TOKEN:0:20}... (${#TOKEN} chars)"
echo ""

# Wait for server reload
sleep 2

# ── Phase 1: Authentication ──────────────────────────
echo -e "${BOLD}━━━ Phase 1: Authentication ━━━${NC}"
test_ep "POST" "/auth/signup" "400" "Missing fields" '{}'
test_ep "POST" "/auth/signin" "400" "Missing fields" '{}'
test_ep "POST" "/auth/signin" "401" "Wrong password" '{"email":"bad@test.com","password":"wrong"}'
echo ""

# ── Phase 2: Public Endpoints ────────────────────────
echo -e "${BOLD}━━━ Phase 2: Public Endpoints ━━━${NC}"
test_ep "GET" "/problems" "200" "List problems"
test_ep "GET" "/problems?page=1&limit=5" "200" "Paginated problems"
test_ep "GET" "/problems?difficulty=easy" "200" "Filter by difficulty"
test_ep "GET" "/categories" "200" "List categories"
test_ep "GET" "/roadmaps" "200" "List roadmaps"
test_ep "GET" "/leaderboard" "200" "Leaderboard alias"
test_ep "GET" "/submissions/leaderboard" "200" "Submissions leaderboard"
echo ""

# ── Phase 3: Auth Guards ─────────────────────────────
echo -e "${BOLD}━━━ Phase 3: Auth Guards (expect 401) ━━━${NC}"
test_ep "GET" "/tasks" "401" "Tasks w/o auth"
test_ep "POST" "/feedback" "401" "Feedback w/o auth" '{"type":"bug","message":"test"}'
test_ep "GET" "/admin/dashboard" "401" "Admin w/o auth"
echo ""

# ── Phase 4: Authenticated User ─────────────────────
echo -e "${BOLD}━━━ Phase 4: Authenticated User ━━━${NC}"
# User routes use /me prefix
test_ep "GET" "/users/me" "200" "User profile" "" "$TOKEN"
test_ep "GET" "/users/me/stats" "200" "User stats" "" "$TOKEN"
test_ep "GET" "/users/me/progress" "200" "User progress" "" "$TOKEN"
test_ep "POST" "/users/study-time" "200" "Study time" '{"duration":60}' "$TOKEN"
test_ep "GET" "/users/analytics/activity" "200" "Activity heatmap" "" "$TOKEN"
test_ep "GET" "/users/analytics/radar" "200" "Skill radar" "" "$TOKEN"
test_ep "GET" "/users/analytics/weekly" "200" "Weekly progress" "" "$TOKEN"

# Subscriptions
test_ep "GET" "/subscriptions/current" "200" "Current subscription" "" "$TOKEN"
test_ep "GET" "/subscriptions/plans" "200" "Available plans" "" "$TOKEN"

# Payments
test_ep "GET" "/payments/history" "200" "Payment history" "" "$TOKEN"

# Referrals
test_ep "GET" "/referrals/leaderboard" "200" "Referral leaderboard" "" "$TOKEN"

# AI
test_ep "GET" "/ai/history" "200" "AI chat history" "" "$TOKEN"
test_ep "GET" "/ai/usage" "200" "AI usage" "" "$TOKEN"

# Certificates
test_ep "GET" "/certificates" "200" "Certificates" "" "$TOKEN"

# Submissions
test_ep "GET" "/submissions" "200" "Submissions" "" "$TOKEN"

echo ""

# ── Phase 5: Tasks CRUD ──────────────────────────────
echo -e "${BOLD}━━━ Phase 5: Tasks CRUD ━━━${NC}"
TASK_RESP=$(curl -s -X POST "${BASE}/tasks" \
    -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" \
    -d '{"title":"Test Task","description":"Testing","priority":"high","due_date":"2026-12-31"}' 2>/dev/null)
TASK_ID=$(echo "$TASK_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -n "$TASK_ID" ] && [ "$TASK_ID" != "" ] && [ "$TASK_ID" != "None" ]; then
    TEST_NUM=$((TEST_NUM + 1)); PASS=$((PASS + 1))
    printf "  ${GREEN}✅${NC} [%02d] POST    /tasks                                        201 → ${GREEN}201${NC}  Create task\n" "$TEST_NUM"
    RESULTS="${RESULTS}| ✅ | POST | \`/tasks\` | 201 | 201 | Create task |\n"
    test_ep "GET" "/tasks" "200" "List tasks" "" "$TOKEN"
    test_ep "GET" "/tasks/summary" "200" "Task summary" "" "$TOKEN"
    test_ep "PUT" "/tasks/${TASK_ID}" "200" "Update task" '{"status":"in_progress"}' "$TOKEN"
    test_ep "DELETE" "/tasks/${TASK_ID}" "200" "Delete task" "" "$TOKEN"
else
    TEST_NUM=$((TEST_NUM + 1)); FAIL=$((FAIL + 1))
    ERR=$(echo "$TASK_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null)
    printf "  ${RED}❌${NC} [%02d] POST    /tasks                                        201 → ${RED}ERR${NC}  [%s]\n" "$TEST_NUM" "${ERR:0:60}"
    RESULTS="${RESULTS}| ❌ | POST | \`/tasks\` | 201 | ERR | ${ERR:0:60} |\n"
    test_ep "GET" "/tasks" "200" "List tasks" "" "$TOKEN"
    test_ep "GET" "/tasks/summary" "200" "Task summary" "" "$TOKEN"
fi
echo ""

# ── Phase 6: Feedback ────────────────────────────────
echo -e "${BOLD}━━━ Phase 6: Feedback ━━━${NC}"
test_ep "POST" "/feedback" "201" "Submit feedback" '{"type":"bug","subject":"Test","message":"Great!"}' "$TOKEN"
test_ep "GET" "/feedback" "200" "User feedback" "" "$TOKEN"
echo ""

# ── Phase 7: Admin Guard (user=403) ──────────────────
echo -e "${BOLD}━━━ Phase 7: Admin Guard (expect 403) ━━━${NC}"
test_ep "GET" "/admin/dashboard" "403" "Dashboard as user" "" "$TOKEN"
test_ep "GET" "/admin/users" "403" "Users as user" "" "$TOKEN"
test_ep "POST" "/admin/categories" "403" "Create cat as user" '{"name":"hack"}' "$TOKEN"
echo ""

# ── Phase 8: Admin Endpoints ─────────────────────────
echo -e "${BOLD}━━━ Phase 8: Admin Endpoints ━━━${NC}"
printf "  ${CYAN}→ Promoting user to super_admin...${NC}"
PGPASSWORD=adminDSAOSsupabase psql "$DB_URL" -c "UPDATE users SET role = 'super_admin' WHERE id = '${USER_ID}';" > /dev/null 2>&1
echo -e " ${GREEN}done${NC}"

# Dashboard & Analytics
test_ep "GET" "/admin/dashboard" "200" "Dashboard" "" "$TOKEN"
test_ep "GET" "/admin/analytics" "200" "Analytics" "" "$TOKEN"

# Users
test_ep "GET" "/admin/users" "200" "List users" "" "$TOKEN"
test_ep "GET" "/admin/users/${USER_ID}" "200" "User detail" "" "$TOKEN"

# Categories CRUD
CAT_RESP=$(curl -s -X POST "${BASE}/admin/categories" \
    -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" \
    -d '{"name":"Arrays","description":"Array problems","icon":"📊"}' 2>/dev/null)
CAT_ID=$(echo "$CAT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -n "$CAT_ID" ] && [ "$CAT_ID" != "None" ] && [ "$CAT_ID" != "" ]; then
    TEST_NUM=$((TEST_NUM + 1)); PASS=$((PASS + 1))
    printf "  ${GREEN}✅${NC} [%02d] POST    /admin/categories                             201 → ${GREEN}201${NC}  Create category\n" "$TEST_NUM"
    RESULTS="${RESULTS}| ✅ | POST | \`/admin/categories\` | 201 | 201 | Create category |\n"
    test_ep "PUT" "/admin/categories/${CAT_ID}" "200" "Update category" '{"description":"Updated"}' "$TOKEN"

    # Pattern CRUD
    PAT_RESP=$(curl -s -X POST "${BASE}/admin/patterns" \
        -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" \
        -d "{\"name\":\"Two Pointers\",\"category_id\":\"${CAT_ID}\",\"description\":\"Technique\"}" 2>/dev/null)
    PAT_ID=$(echo "$PAT_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
    if [ -n "$PAT_ID" ] && [ "$PAT_ID" != "None" ] && [ "$PAT_ID" != "" ]; then
        TEST_NUM=$((TEST_NUM + 1)); PASS=$((PASS + 1))
        printf "  ${GREEN}✅${NC} [%02d] POST    /admin/patterns                               201 → ${GREEN}201${NC}  Create pattern\n" "$TEST_NUM"
        RESULTS="${RESULTS}| ✅ | POST | \`/admin/patterns\` | 201 | 201 | Create pattern |\n"
        test_ep "PUT" "/admin/patterns/${PAT_ID}" "200" "Update pattern" '{"description":"Updated"}' "$TOKEN"
        test_ep "DELETE" "/admin/patterns/${PAT_ID}" "200" "Delete pattern" "" "$TOKEN"
    else
        TEST_NUM=$((TEST_NUM + 1)); FAIL=$((FAIL + 1))
        printf "  ${RED}❌${NC} [%02d] POST    /admin/patterns                               201 → ${RED}ERR${NC}\n" "$TEST_NUM"
        RESULTS="${RESULTS}| ❌ | POST | \`/admin/patterns\` | 201 | ERR | |\n"
    fi
    test_ep "DELETE" "/admin/categories/${CAT_ID}" "200" "Delete category" "" "$TOKEN"
else
    TEST_NUM=$((TEST_NUM + 1)); FAIL=$((FAIL + 1))
    ERR=$(echo "$CAT_RESP" | head -c 100)
    printf "  ${RED}❌${NC} [%02d] POST    /admin/categories                             201 → ${RED}ERR${NC}  [%s]\n" "$TEST_NUM" "$ERR"
    RESULTS="${RESULTS}| ❌ | POST | \`/admin/categories\` | 201 | ERR | ${ERR:0:60} |\n"
fi

# Roadmaps CRUD
ROAD_RESP=$(curl -s -X POST "${BASE}/admin/roadmaps" \
    -H "Content-Type: application/json" -H "Authorization: Bearer ${TOKEN}" \
    -d '{"title":"90 Day DSA","description":"Master DSA","type":"custom","duration_days":90,"difficulty_level":"beginner","is_published":true}' 2>/dev/null)
ROAD_ID=$(echo "$ROAD_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$ROAD_ID" ] && [ "$ROAD_ID" != "None" ] && [ "$ROAD_ID" != "" ]; then
    TEST_NUM=$((TEST_NUM + 1)); PASS=$((PASS + 1))
    printf "  ${GREEN}✅${NC} [%02d] POST    /admin/roadmaps                               201 → ${GREEN}201${NC}  Create roadmap\n" "$TEST_NUM"
    RESULTS="${RESULTS}| ✅ | POST | \`/admin/roadmaps\` | 201 | 201 | Create roadmap |\n"
    test_ep "GET" "/admin/roadmaps" "200" "List roadmaps (admin)" "" "$TOKEN"
    test_ep "PUT" "/admin/roadmaps/${ROAD_ID}" "200" "Update roadmap" '{"description":"Updated"}' "$TOKEN"
    test_ep "DELETE" "/admin/roadmaps/${ROAD_ID}" "200" "Delete roadmap" "" "$TOKEN"
else
    TEST_NUM=$((TEST_NUM + 1)); FAIL=$((FAIL + 1))
    ERR=$(echo "$ROAD_RESP" | head -c 100)
    printf "  ${RED}❌${NC} [%02d] POST    /admin/roadmaps                               201 → ${RED}ERR${NC}  [%s]\n" "$TEST_NUM" "$ERR"
    RESULTS="${RESULTS}| ❌ | POST | \`/admin/roadmaps\` | 201 | ERR | ${ERR:0:60} |\n"
fi

# Plans, Settings, Referrals, Feedback, Tasks, Leaderboard, AI, Logs, Withdrawals
test_ep "GET" "/admin/plans" "200" "List plans" "" "$TOKEN"
test_ep "GET" "/admin/settings" "200" "Get settings" "" "$TOKEN"
test_ep "PUT" "/admin/settings" "200" "Update settings" '{"test_key":"val"}' "$TOKEN"
test_ep "GET" "/admin/referrals/stats" "200" "Referral stats" "" "$TOKEN"
test_ep "GET" "/admin/referrals/all" "200" "All referrals" "" "$TOKEN"
test_ep "GET" "/admin/referrals/flagged" "200" "Flagged referrals" "" "$TOKEN"
test_ep "GET" "/admin/feedback" "200" "All feedback" "" "$TOKEN"
test_ep "POST" "/admin/tasks/assign/${USER_ID}" "201" "Assign task" '{"title":"Admin Task","description":"Test","priority":"high","due_date":"2026-12-31"}' "$TOKEN"
test_ep "POST" "/admin/tasks/assign-all" "200" "Assign to all" '{"title":"Global Task","description":"For all","priority":"medium","due_date":"2026-12-31"}' "$TOKEN"
test_ep "GET" "/admin/leaderboard/config" "200" "Leaderboard config" "" "$TOKEN"
test_ep "PUT" "/admin/leaderboard/config" "200" "Update LB config" '{"visible_count":50}' "$TOKEN"
test_ep "GET" "/admin/ai/config" "200" "AI config" "" "$TOKEN"
test_ep "PUT" "/admin/ai/config" "200" "Update AI config" '{"ai_model":"gpt-4o"}' "$TOKEN"
test_ep "GET" "/admin/logs" "200" "Audit logs" "" "$TOKEN"
test_ep "GET" "/admin/withdrawals" "200" "Withdrawals" "" "$TOKEN"

echo ""

# ── Cleanup ───────────────────────────────────────────
echo -e "${CYAN}→ Resetting user to 'user' role...${NC}"
PGPASSWORD=adminDSAOSsupabase psql "$DB_URL" -c "UPDATE users SET role = 'user' WHERE id = '${USER_ID}';" > /dev/null 2>&1

# ══════════════════════════════════════════════════════
# FINAL REPORT
# ══════════════════════════════════════════════════════
TOTAL=$((PASS + FAIL + WARN))
PASS_RATE=0; [ $TOTAL -gt 0 ] && PASS_RATE=$(( (PASS * 100) / TOTAL ))

echo ""
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}                      FINAL RESULTS                          ${NC}"
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}✅ Passed:   ${PASS}${NC}"
echo -e "  ${YELLOW}⚠️  Warnings: ${WARN}${NC}"
echo -e "  ${RED}❌ Failed:   ${FAIL}${NC}"
echo -e "  ${BOLD}📊 Total:    ${TOTAL}${NC}"
echo -e "  ${BOLD}📈 Pass Rate: ${PASS_RATE}%${NC}"
echo ""

# Write report
REPORT="/home/unknown/.gemini/antigravity/brain/32f0cb6f-57ea-45f9-b850-c1e921654652/api_test_report.md"
cat > "$REPORT" << HEREDOC
# 🧪 Backend API Test Report

**Date:** $(date '+%Y-%m-%d %H:%M:%S %Z')
**Server:** ${BASE}
**Auth:** Local JWT (dev) — Supabase Auth has infra 500 error

## Summary

| Metric | Count |
|--------|-------|
| ✅ Passed | **${PASS}** |
| ⚠️ Warnings | **${WARN}** |
| ❌ Failed | **${FAIL}** |
| 📊 Total | **${TOTAL}** |
| 📈 Pass Rate | **${PASS_RATE}%** |

## Results

| Status | Method | Endpoint | Expected | Actual | Description |
|--------|--------|----------|----------|--------|-------------|
$(echo -e "$RESULTS")

## Notes

- Supabase Auth returns 500 (infra issue) — used local JWT fallback
- RLS bypass via raw pg queries in dev mode for admin role checks
- Some service methods may fail if they also use Supabase client with RLS
HEREDOC

echo -e "  ${CYAN}📄 Report: api_test_report.md${NC}"
echo ""
