# Git Commands

A practical Git cheat sheet for day-to-day work while learning.

## Check where you are

Show the current branch:

```bash
git branch --show-current
```

Show the current status of the repo:

```bash
git status
```

Show short status:

```bash
git status --short
```

## Create branches

Create a new branch without switching to it:

```bash
git branch new-branch-name
```

Create a new branch and switch to it:

```bash
git switch -c new-branch-name
```

Older equivalent:

```bash
git checkout -b new-branch-name
```

## Switch branches

Switch to an existing branch:

```bash
git switch branch-name
```

Older equivalent:

```bash
git checkout branch-name
```

Switch back to the previous branch:

```bash
git switch -
```

## See branches

List local branches:

```bash
git branch
```

List local and remote branches:

```bash
git branch -a
```

## Stage changes

Stage one file:

```bash
git add path/to/file
```

Stage everything:

```bash
git add .
```

## Commit changes

Commit staged changes:

```bash
git commit -m "Describe the change"
```

Stage tracked files and commit in one command:

```bash
git commit -am "Describe the change"
```

Note: `git commit -am` does not include brand new untracked files.

## Push branches

Push the current branch for the first time and set upstream:

```bash
git push -u origin branch-name
```

Push after upstream is already set:

```bash
git push
```

Push the current branch name automatically:

```bash
git push -u origin HEAD
```

## Pull changes

Pull the latest changes for the current branch:

```bash
git pull
```

Fetch remote changes without merging:

```bash
git fetch
```

Fetch all branches:

```bash
git fetch --all
```

## Start from main

Move to main:

```bash
git switch main
```

Update main from remote:

```bash
git pull origin main
```

Create a feature branch from updated main:

```bash
git switch -c feature/my-new-work
```

## Typical feature branch workflow

Update main first:

```bash
git switch main
git pull origin main
```

Create and switch to a new branch:

```bash
git switch -c feature/my-change
```

Work, then stage and commit:

```bash
git add .
git commit -m "Add my change"
```

Push the branch:

```bash
git push -u origin feature/my-change
```

## Stash changes

Temporarily save uncommitted work:

```bash
git stash
```

Save uncommitted work including untracked files:

```bash
git stash -u
```

See stashes:

```bash
git stash list
```

Restore the latest stash:

```bash
git stash pop
```

## View history

Show commit history:

```bash
git log
```

Show compact one-line history:

```bash
git log --oneline --graph --decorate --all
```

Show what changed:

```bash
git diff
```

Show staged changes:

```bash
git diff --staged
```

## Safe undo commands

Unstage a file:

```bash
git restore --staged path/to/file
```

Discard changes in one file:

```bash
git restore path/to/file
```

Restore all unstaged tracked files:

```bash
git restore .
```

## Delete branches

Delete a local branch that has been merged:

```bash
git branch -d branch-name
```

Force delete a local branch:

```bash
git branch -D branch-name
```

Delete a remote branch:

```bash
git push origin --delete branch-name
```

## Helpful notes

- `main` is usually the stable branch.
- Use feature branches for new work.
- Push with `-u` the first time so future `git push` and `git pull` are simpler.
- Check `git status` often.
- Prefer `git switch` for branches and `git restore` for file undo when learning modern Git.
