#!/bin/bash
set -u

FIX=0
FINCH_HOME="${FINCH_HOME:-$HOME/.finch}"
AGENT_HOME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fix)
      FIX=1
      shift
      ;;
    --home)
      if [[ $# -lt 2 ]]; then echo "ERROR: --home requires a path" >&2; exit 2; fi
      FINCH_HOME="$2"
      shift 2
      ;;
    --agent-home)
      if [[ $# -lt 2 ]]; then echo "ERROR: --agent-home requires a path" >&2; exit 2; fi
      AGENT_HOME="$2"
      shift 2
      ;;
    --dev)
      FINCH_HOME="$HOME/.finch-dev"
      [[ -z "$AGENT_HOME" ]] && AGENT_HOME="$HOME/finchnest-dev"
      shift
      ;;
    --prod)
      FINCH_HOME="$HOME/.finch"
      [[ -z "$AGENT_HOME" ]] && AGENT_HOME="$HOME/finchnest"
      shift
      ;;
    *)
      echo "WARN: unknown arg ignored: $1"
      shift
      ;;
  esac
done

expand_path() {
  local p="$1"
  if [[ "$p" == "~" ]]; then echo "$HOME"; return; fi
  if [[ "$p" == "~/"* ]]; then echo "$HOME/${p#~/}"; return; fi
  echo "$p"
}

FINCH_HOME="$(expand_path "$FINCH_HOME")"
[[ -z "$AGENT_HOME" ]] && AGENT_HOME="$HOME/finchnest"
AGENT_HOME="$(expand_path "$AGENT_HOME")"
REPORT_DIR="$FINCH_HOME/diagnostics"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_FILE="$REPORT_DIR/startup-doctor-$STAMP.txt"
ERRORS=0
WARNINGS=0
FIXES=0
TMP_REPORT="/tmp/finch-startup-doctor-$STAMP.txt"

json_valid() {
  local file="$1"
  /usr/bin/ruby -rjson -e 'JSON.parse(File.read(ARGV[0]))' "$file" >/dev/null 2>&1
}

emit() {
  local level="$1"
  local msg="$2"
  echo "$level: $msg"
  case "$level" in
    ERROR) ERRORS=$((ERRORS + 1));;
    WARN) WARNINGS=$((WARNINGS + 1));;
    FIX) FIXES=$((FIXES + 1));;
  esac
}

ensure_dir() {
  local dir="$1"
  local label="$2"
  if [[ -d "$dir" ]]; then
    emit INFO "$label exists: $dir"
    return
  fi
  if [[ "$FIX" == "1" ]]; then
    mkdir -p "$dir" && emit FIX "created $label: $dir" || emit ERROR "failed to create $label: $dir"
  else
    emit WARN "$label missing: $dir"
  fi
}

backup_file() {
  local file="$1"
  local backup="$file.bak-$STAMP"
  cp "$file" "$backup"
  echo "$backup"
}

write_json_default() {
  local file="$1"
  local content="$2"
  mkdir -p "$(dirname "$file")"
  printf '%s\n' "$content" > "$file"
}

check_json() {
  local file="$1"
  local label="$(basename "$file")"
  local default_content="$2"
  local optional="${3:-0}"

  if [[ ! -e "$file" ]]; then
    if [[ "$optional" == "1" ]]; then
      emit INFO "$label missing; Finch will use defaults"
      return
    fi
    if [[ "$FIX" == "1" ]]; then
      write_json_default "$file" "$default_content"
      emit FIX "created missing $label"
    else
      emit WARN "$label missing; run with --fix to create a safe default"
    fi
    return
  fi

  if ! json_valid "$file"; then
    if [[ "$FIX" == "1" ]]; then
      local backup="$(backup_file "$file")"
      write_json_default "$file" "$default_content"
      emit FIX "$label was invalid JSON; backed up to $backup and rebuilt"
    else
      emit ERROR "$label is invalid JSON"
    fi
  else
    emit INFO "$label JSON ok"
  fi
}

json_get_string() {
  local file="$1"
  local key="$2"
  [[ -f "$file" ]] || return 0
  /usr/bin/osascript -l JavaScript <<EOF 2>/dev/null
const fs = $.NSFileManager.defaultManager;
const path = '$file';
const data = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
if (!data) '';
else {
  try { const v = JSON.parse(ObjC.unwrap(data)).$key; if (typeof v === 'string') v; else ''; }
  catch (e) { ''; }
}
EOF
}

remove_project_path_if_missing() {
  local workspace="$FINCH_HOME/workspace.json"
  [[ -f "$workspace" ]] || return
  local project_path="$(json_get_string "$workspace" "projectPath" | tail -n 1)"
  [[ -z "$project_path" ]] && return
  project_path="$(expand_path "$project_path")"
  if [[ -d "$project_path" ]]; then
    emit INFO "projectPath accessible: $project_path"
    return
  fi
  if [[ "$FIX" != "1" ]]; then
    emit WARN "workspace.projectPath does not exist: $project_path"
    return
  fi
  local backup="$(backup_file "$workspace")"
  /usr/bin/osascript -l JavaScript <<EOF >/dev/null
const path = '$workspace';
const NSString = $.NSString;
const data = NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
const obj = JSON.parse(ObjC.unwrap(data));
delete obj.projectPath;
if (Array.isArray(obj.recentProjects)) obj.recentProjects = obj.recentProjects.filter((x) => x && x.path !== '$project_path');
const out = NSString.alloc.initWithUTF8String(JSON.stringify(obj, null, 2) + '\n');
out.writeToFileAtomicallyEncodingError(path, true, $.NSUTF8StringEncoding, null);
EOF
  emit FIX "removed missing projectPath from workspace.json; backup: $backup"
}

check_logs() {
  local logs="$FINCH_HOME/logs"
  if [[ ! -d "$logs" ]]; then
    emit INFO "logs directory missing; enable diagnostics logs in Finch if the issue reproduces"
    return
  fi
  emit INFO "recent startup log lines (max 20):"
  local log_tmp="/tmp/finch-startup-log-$STAMP.txt"
  : > "$log_tmp"
  find "$logs" -name '*.jsonl' -type f -print 2>/dev/null | sort | tail -3 | while read -r file; do
    tail -300 "$file" | grep -E 'bootstrap\.get|workspace\.get|app\.ready|plugins|mcp' >> "$log_tmp" || true
  done
  tail -20 "$log_tmp" || true
  rm -f "$log_tmp"
}

exec > >(tee "$TMP_REPORT")
exec 2>&1

{
  echo "Finch startup doctor (macOS, no Node required)"
  echo "=============================================="
  echo "finchHome: $FINCH_HOME"
  echo "agentHome: $AGENT_HOME"
  echo "fix: $([[ "$FIX" == "1" ]] && echo enabled || echo disabled)"
  echo ""

  ensure_dir "$FINCH_HOME" "Finch data directory"
  ensure_dir "$FINCH_HOME/pi" "Agent core directory"
  ensure_dir "$FINCH_HOME/pi/sessions" "session directory"
  ensure_dir "$FINCH_HOME/pi/tmp" "tmp directory"

  check_json "$FINCH_HOME/workspace.json" '{"recentProjects":[]}'
  check_json "$FINCH_HOME/models.json" '{"providers":[]}'
  check_json "$FINCH_HOME/spaces.json" '{"version":2,"spaces":[],"threads":[]}'
  check_json "$FINCH_HOME/skills.json" '{"disabled":[]}'
  check_json "$FINCH_HOME/plugins.json" '{"enabled":[],"plugins":{}}'
  check_json "$FINCH_HOME/log-settings.json" '{"enabled":false,"level":"basic"}' 1

  remove_project_path_if_missing

  ensure_dir "$AGENT_HOME" "Agent Home"
  ensure_dir "$AGENT_HOME/memory" "Agent Home memory directory"
  ensure_dir "$AGENT_HOME/.finch/skills" "Agent Home skills directory"
  for f in FINCH.md SOUL.md USER.md; do
    [[ -f "$AGENT_HOME/$f" ]] || emit WARN "Agent Home identity file missing: $AGENT_HOME/$f"
  done

  check_logs

  echo ""
  echo "Summary: errors=$ERRORS warnings=$WARNINGS fixes=$FIXES"
  if [[ "$FIX" != "1" && $((ERRORS + WARNINGS)) -gt 0 ]]; then
    echo "Try: /bin/bash finch-doctor-macos.sh --fix"
  fi
}

mkdir -p "$REPORT_DIR" 2>/dev/null && cp "$TMP_REPORT" "$REPORT_FILE" 2>/dev/null && echo "Report saved: $REPORT_FILE"

[[ "$ERRORS" -gt 0 ]] && exit 2 || exit 0
