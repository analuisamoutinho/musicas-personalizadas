---
name: implement-story
description: "End-to-end story implementation pipeline — from GitHub issue to PR-ready code. Use when the user says 'implement story', 'dev story', 'build story', 'work on story', 'implement issue', or references a story number like '1.1' or '#41'. Orchestrates: context enrichment → code implementation → code review → commit → PR creation."
argument-hint: "[story_id: e.g. 1.1, 2.3, #41]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - Skill
  - WebSearch
  - WebFetch
  - AskUserQuestion
---

# Implement Story Pipeline

End-to-end orchestration from GitHub issue to PR-ready code. One command, minimal human intervention.

## Why This Exists

Implementing a story involves 6+ tools/skills in sequence with specific handoff points. Running them manually is error-prone and slow. This pipeline automates the boring parts (context gathering, commit, PR) and focuses human attention where it matters most (implementation decisions).

## Input Parsing

The user provides a story identifier. Parse it:

- `1.1` or `1-1` → Epic 1, Story 1 → find matching GH issue
- `#41` or `41` → GitHub issue number directly
- `Story 1.1` → extract `1.1`

**Resolution logic:**
1. If GH issue number: fetch issue directly via `gh issue view <number>`
2. If story number (N.M): search issues with `gh issue list --label "story" --search "Story N.M"` to find the matching issue
3. Extract: issue number, title, body (user story + acceptance criteria + FRs)

## Pipeline Phases

### Phase 1: Context Enrichment (Autonomous)

**Goal:** Create a comprehensive implementation guide so the dev phase has everything it needs.

**Steps:**
1. Fetch the GitHub issue details:
   ```bash
   gh issue view <number> --json title,body,labels,milestone
   ```

2. Run `/bmad-create-story` pointing to the story number. This reads the PRD, architecture, and epics to produce a detailed implementation file at `.bmad_output/implementation-artifacts/<story-key>.md` with:
   - Architecture compliance requirements
   - Exact file paths to create/modify
   - Library versions and patterns to follow
   - Testing requirements
   - Dev guardrails

   Invoke via: `Skill("bmad-create-story", args: "<epic_num>.<story_num>")`

   If bmad-create-story requires interaction, provide the story number and let it auto-discover from epics.md.

3. Update the GitHub issue with a comment containing the enriched context summary:
   ```bash
   gh issue comment <number> --body "## Implementation Context\n\n[summary of create-story output: key files, patterns, dependencies]"
   ```

4. Assign the issue to yourself and add "in-progress" label:
   ```bash
   gh issue edit <number> --add-label "in-progress"
   ```

**Transition:** Print "Phase 1 complete. Starting implementation..." and proceed.

### Phase 2: Implementation (Human Checkpoint)

**Goal:** Write the actual code. This is where the user reviews and gives feedback.

**Steps:**
1. Read the implementation guide created in Phase 1 (`.bmad_output/implementation-artifacts/<story-key>.md`)

2. Invoke the implementation pipeline inspired by cc-arsenal implement-feature:
   - Analyze the story requirements and acceptance criteria
   - Plan the implementation approach (show to user for approval)
   - Implement in focused iterations:
     a. Create/modify files according to architecture doc
     b. Follow patterns from architecture (error handling, state machine, etc.)
     c. Write tests alongside code
   - After each significant change, show the user what was done

3. **Human checkpoint:** Ask the user:
   "Implementation complete for Story <N.M>. Here's what was built:
   - [list of files created/modified]
   - [key decisions made]

   Would you like to:
   [1] Approve and continue to review
   [2] Request changes (describe what to adjust)
   [3] See a diff of all changes"

4. If user requests changes, iterate until approved.

**Transition:** Once user approves, proceed to Phase 3.

### Phase 3: Code Review (Autonomous)

**Goal:** Catch issues before the PR is created.

**Steps:**
1. Get the list of changed files:
   ```bash
   git diff --name-only HEAD
   ```

2. Invoke code review: `Skill("cc-arsenal:review-code")`

   This spawns 5 parallel specialist agents (correctness, performance, style, tests, error handling) and produces a review report.

3. Triage the findings:
   - **Critical/Major:** Auto-fix if straightforward (typos, missing null checks, obvious bugs). For complex issues, show to user and ask.
   - **Minor/Nit:** Auto-fix non-controversial ones (formatting, naming consistency). Skip purely stylistic nits.

4. If any fixes were applied, briefly summarize what was fixed.

**Transition:** Print "Review complete. Preparing commit..." and proceed.

### Phase 4: Deliver (Autonomous)

**Goal:** Commit, push, and create a PR linked to the story issue.

**Steps:**
1. Stage and commit using conventional commit format:
   `Skill("cc-arsenal:git:commit")`

   The commit message should reference the story: `feat: implement story N.M - [title] (closes #XX)`

2. Create a PR linked to the issue:
   `Skill("cc-arsenal:git:create-pr")`

   PR should:
   - Title: `feat: Story N.M - [title]`
   - Body: summary of changes + link to issue + acceptance criteria checklist
   - Link: `closes #<issue_number>` in the body

3. Update the GitHub issue with completion status:
   ```bash
   gh issue comment <number> --body "## Implementation Complete\n\nPR: #<pr_number>\n\nReady for human review."
   ```

4. Remove "in-progress" label, add "review-ready":
   ```bash
   gh issue edit <number> --remove-label "in-progress" --add-label "review-ready"
   ```

5. Report completion:
   "Story <N.M> implementation complete!
   - PR: <pr_url>
   - Issue: <issue_url>
   - Files changed: <count>
   - Review findings fixed: <count>

   Ready for your review on GitHub."

## Error Handling

- If any phase fails, stop and report clearly which phase failed and why
- Don't proceed to Phase 4 (commit/PR) if Phase 2 wasn't approved by user
- If bmad-create-story can't find the story, ask user to confirm the story number
- If gh commands fail (auth, permissions), report and suggest fixes

## What This Skill Does NOT Do

- Does not merge PRs (that's human review)
- Does not deploy to production
- Does not skip the human checkpoint in Phase 2
- Does not create stories (use /bmad-create-epics-and-stories for that)
