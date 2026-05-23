# Story Pipeline Workflow

**Goal:** Orchestrate the full story lifecycle — create, validate, implement, PR, review, merge — by spawning subagents for each step.

**Your Role:** Orchestrator. You do NOT implement stories yourself. You spawn subagents for each step, wait for results, and chain the next step. You handle git/PR operations directly (they're fast).

---

## Configuration

- `sprint_status`: `{project-root}/.bmad_output/implementation-artifacts/sprint-status.yaml`
- `implementation_artifacts`: `{project-root}/.bmad_output/implementation-artifacts`
- `project_root`: The git repository root (detect via `git rev-parse --show-toplevel`)

## Subagent Rules

- **Working agents**: Use `sonnet` model, `general-purpose` subagent type
- **Research agents**: Use `haiku` model, `Explore` subagent type
- **Agents apply all fixes directly** — they do NOT report back for approval
- **Pass skill commands** like `/bmad-create-story 2.5` in agent prompts — don't embed full workflow text
- **Instruct agents**: "If you need to gather information from multiple files, spawn Explore subagents with haiku model to save tokens"

---

## Argument Parsing

Parse the user's argument (passed as `{args}`):

| Input | Behavior |
|-------|----------|
| Empty / no argument | Run once for the next backlog story in sprint-status.yaml |
| `2.5` or `2-5` or story ID | Run once for that specific story |
| `next N` or `N stories` | Loop N times, each time picking the next backlog story |

---

## Execution

### Step 0: Determine Stories to Process

1. Read `{sprint_status}` to understand current state
2. Parse `{args}` to determine how many stories to process and which ones
3. If specific story ID given, validate it exists in sprint status
4. If "next N", set loop count = N
5. If empty, set loop count = 1

### For Each Story (loop):

Before each iteration, read `{sprint_status}` fresh to find the next `backlog` story.

---

#### Step 1: Create Story

Spawn a `sonnet` agent:

```
prompt: |
  /bmad-create-story {story_id}

  Project root: {project_root}
  Base directory for this skill: {project_root}/.claude/skills/bmad-create-story
  Follow the instructions in ./workflow.md.

  If you need to gather information from multiple files, spawn Explore subagents with haiku model to save tokens.
```

Wait for completion. Verify the story file was created at `{implementation_artifacts}/story-{epic}.{story}.md`.

---

#### Step 2: Validate + Fix

Spawn a `sonnet` agent:

```
prompt: |
  You are a story quality validator for the Mascotinhos project.

  Read and validate the story file: {story_file_path}

  Cross-reference against the source documents:
  - Epics: {project_root}/.bmad_output/planning-artifacts/epics.md
  - Architecture: {project_root}/.bmad_output/planning-artifacts/architecture.md
  - PRD: {project_root}/.bmad_output/planning-artifacts/prd.md
  - Prisma schema: {project_root}/mascotinhos/packages/db/prisma/schema/schema.prisma
  - Current bot-engine src: {project_root}/mascotinhos/packages/bot-engine/src/

  If you need to gather information from multiple files, spawn Explore subagents with haiku model.

  Check for: missing acceptance criteria, wrong file locations, incorrect field names, missing scope boundaries, mock pattern issues.

  IMPORTANT: Apply ALL fixes directly to the story file. Do not just report issues — fix them.
```

Wait for completion.

---

#### Step 3: Dev Story

Spawn a `sonnet` agent:

```
prompt: |
  /bmad-dev-story {story_file_path}

  Project root: {project_root}
  Base directory for this skill: {project_root}/.claude/skills/bmad-dev-story
  Follow the instructions in ./workflow.md.

  If you need to gather information from multiple files, spawn Explore subagents with haiku model to save tokens.

  CRITICAL: Do NOT stop early. Complete ALL tasks in the story file in one execution.
```

Wait for completion. Verify tests pass by checking the agent's output.

---

#### Step 4: Create PR

Do this yourself (fast git operations):

1. Determine branch name from the story key: `feat/story-{story_id}-{slug}`
2. Create branch: `git checkout -b {branch_name}`
3. Stage all changes: `git add -A`
4. Commit with conventional format: `feat(scope): description (closes #{issue_number})`
   - Get issue number from the epics file or story file GitHub link
5. Push: `git push -u origin {branch_name}`
6. Create PR: `gh pr create --title "..." --body "..."`

---

#### Step 5: Code Review + Fix

Spawn a `sonnet` agent:

```
prompt: |
  You are a code reviewer for the Mascotinhos project. Perform a combined adversarial + edge case + acceptance audit review.

  Review the branch diff: run `git diff main...HEAD` (excluding bun.lock and .bmad_output)

  Read the story spec: {story_file_path}

  Check for: security issues, error handling gaps, race conditions, acceptance criteria coverage, test adequacy.

  Focus on HIGH and MEDIUM severity only. Max 8 findings.

  IMPORTANT: Apply ALL patches directly. Edit the code files, run tests to verify, then commit and push the fixes.
  Update the story file: add Review Findings section, set Status to done.
  Update sprint-status.yaml: set the story to done.
  Append deferred items to {project_root}/.bmad_output/implementation-artifacts/deferred-work.md.

  After fixing, commit with: `fix(scope): apply code review patches for story-{story_id}`
  Then push: `git push`

  If you need to gather information from multiple files, spawn Explore subagents with haiku model.
```

Wait for completion.

---

#### Step 6: Merge PR + Checkout Main

Do this yourself (fast git operations):

1. Merge: `gh pr merge {pr_number} --squash --delete-branch -t "{commit_title}"`
2. Checkout main: `git checkout main && git pull`
3. Verify clean state: `git status`

---

### After Loop

Report summary:

```
## Pipeline Complete

| Story | Title | PR | Status |
|-------|-------|----|--------|
| {story_id} | {title} | #{pr} | Done |
...

Stories completed: {count}
Total tests: {test_count}
```

---

## Error Handling

- If any step fails, log the error and HALT — do not continue to the next step
- If a subagent times out, report to the user and suggest retrying that step
- If tests fail in Step 3, the dev agent should fix them before marking complete
- If git operations fail in Steps 4/6, diagnose and retry once before halting
