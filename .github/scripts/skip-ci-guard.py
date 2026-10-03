#!/usr/bin/env python3
"""Fail when a commit that GitHub would not run CI for ("[skip ci]" and friends) changed code.

GitHub drops push/pull_request workflow runs entirely for such commits, so the guard cannot run
in the skipped push. It runs on a schedule and on later pushes instead, and inspects every
commit since the last green run of the repo's CI workflow (a green run validates the whole tree
at its SHA, including skipped commits before it). With no usable green run it falls back to a
lookback window.

    skip-ci-guard.py [--repo OWNER/NAME --branch B --ci-workflow FILE] [--since-days N] [--paths ...]

Uses git and, only when --ci-workflow is given, `gh api` (read-only, GH_TOKEN). No secrets are
printed. Exit 0 clean, 1 offenders found, 2 usage/git error.
"""
import argparse
import json
import re
import subprocess
import sys

DEFAULT_PATHS = ("tests/", "cli/", "stack/", "src/", "config/")
# Markers GitHub documents as suppressing push/pull_request workflow runs.
SKIP_RE = re.compile(
    r"\[(?:skip ci|ci skip|no ci|skip actions|actions skip)\]|^skip-checks:\s*true\s*$",
    re.IGNORECASE | re.MULTILINE,
)
SEP = "\x1e"  # record separator between commits in git log output
FIELD = "\x1f"


def has_skip_marker(message):
    return bool(SKIP_RE.search(message or ""))


def touches(files, paths):
    return [f for f in files if any(f == p.rstrip("/") or f.startswith(p) for p in paths)]


def find_offenders(commits, paths=DEFAULT_PATHS):
    """commits: iterable of {sha, subject, message, files}. Returns offenders with touched files."""
    out = []
    for c in commits:
        hit = touches(c.get("files", []), paths)
        if hit and has_skip_marker(c.get("message", "")):
            out.append({"sha": c["sha"], "subject": c.get("subject", ""), "files": hit})
    return out


def parse_log(text):
    commits = []
    for record in text.split(SEP):
        record = record.strip("\n")
        if not record:
            continue
        head, _, files = record.partition(FIELD + "\n")
        sha, subject, message = head.split(FIELD, 2)
        commits.append({"sha": sha, "subject": subject, "message": message,
                        "files": [f for f in files.split("\n") if f]})
    return commits


def git(*args, cwd="."):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout


def read_commits(cwd, base=None, head="HEAD", since_days=None):
    """Commits in base..head (or the lookback window), merges included via --first-parent=off."""
    fmt = f"--format={SEP}%H{FIELD}%s{FIELD}%B{FIELD}"
    args = ["log", "--name-only", "--no-renames", "-m", fmt]
    args.append(f"{base}..{head}" if base else head)
    if not base:
        args.append(f"--since={int(since_days)} days ago")
    return parse_log(git(*args, cwd=cwd))


def pick_base(runs, is_ancestor):
    """First successful push/dispatch run whose head SHA is an ancestor of the branch head."""
    for run in runs:
        if run.get("conclusion") != "success" or run.get("event") not in ("push", "workflow_dispatch"):
            continue
        sha = run.get("head_sha")
        if sha and is_ancestor(sha):
            return sha
    return None


def fetch_runs(repo, workflow, branch):
    url = f"repos/{repo}/actions/workflows/{workflow}/runs?branch={branch}&status=success&per_page=30"
    out = subprocess.run(["gh", "api", url, "--jq", ".workflow_runs"], check=True,
                         capture_output=True, text=True).stdout
    return json.loads(out or "[]")


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--repo-dir", default=".")
    p.add_argument("--head", default="HEAD")
    p.add_argument("--repo")
    p.add_argument("--branch")
    p.add_argument("--ci-workflow", default="", help="push-triggered CI workflow file; blank = lookback only")
    p.add_argument("--since-days", type=int, default=7)
    p.add_argument("--paths", nargs="*", default=list(DEFAULT_PATHS))
    a = p.parse_args(argv)
    base = None
    try:
        if a.ci_workflow:
            if not (a.repo and a.branch):
                p.error("--ci-workflow needs --repo and --branch")
            def is_ancestor(sha):
                return subprocess.run(["git", "merge-base", "--is-ancestor", sha, a.head],
                                      cwd=a.repo_dir, capture_output=True).returncode == 0
            base = pick_base(fetch_runs(a.repo, a.ci_workflow, a.branch), is_ancestor)
        commits = read_commits(a.repo_dir, base, a.head, a.since_days)
    except (subprocess.CalledProcessError, OSError) as exc:
        print(f"skip-ci-guard: cannot read history: {exc}", file=sys.stderr)
        return 2
    scope = f"since green {a.ci_workflow} run {base[:12]}" if base else f"last {a.since_days} days"
    offenders = find_offenders(commits, tuple(a.paths))
    print(f"skip-ci-guard: {len(commits)} commit(s) scanned ({scope})")
    for o in offenders:
        print(f"::error title=skip-ci commit changed code::{o['sha'][:12]} {o['subject']} ({', '.join(o['files'][:5])})")
    if offenders:
        print("A later non-skipped CI run that passes on a descendant commit clears this.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
