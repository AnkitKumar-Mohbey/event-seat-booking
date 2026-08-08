

set -u

API="${API:-http://127.0.0.1:8000}"
EVENT_ID="${EVENT_ID:-1}"
SEAT_ID="${SEAT_ID:-15}"

payload() {
  cat <<JSON
{"event_id": $EVENT_ID, "seat_ids": [$SEAT_ID], "booker_name": "$1", "booker_email": "$2"}
JSON
}

fire() {
  local name="$1"
  local email="$2"
  local label="$3"
  local status
  local body
  local resp
  resp=$(curl -sS -o /tmp/body_${label}.json -w "%{http_code}" \
    -X POST "$API/bookings" \
    -H "Content-Type: application/json" \
    -d "$(payload "$name" "$email")")
  status=$resp
  body=$(cat /tmp/body_${label}.json)
  echo "[$label] HTTP $status  $body"
}

echo "Firing two concurrent bookings for seat_id=$SEAT_ID ..."
fire "Alice" "alice@test.com" "A" &
fire "Bob"   "bob@test.com"   "B" &
wait

echo ""
echo "--- Final state (should show exactly one booking) ---"
curl -sS "$API/admin/events/$EVENT_ID/summary" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'booked_seats={d[\"booked_seats\"]}, bookings={d[\"bookings\"]}')"