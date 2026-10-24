Workbench brings agent activity, coordinator conversations and specialist launches into one Paseo screen. Use Command to see running agents and permission requests, Launch to start work, and Overview to follow agent teams and manage worktrees.

## Setup

Requires Paseo 0.12.0 or later and an authenticated agent provider on each host where you launch work. Choose a default provider/model in Workbench's Settings. For a second opinion or committee, also choose the profile's second reviewer model.

Coordinators need Paseo's agent tools enabled on their host. Schedule management, coordinator renaming and adopting existing agents use the Paseo CLI on that host. Pull-request workflows also need Git and an authenticated GitHub CLI. Workbench uses `PASEO_CLI` when configured, the macOS app's bundled CLI when available, or `paseo` on the command path.

## Working with agents

- Launch built-in or custom specialists for a workspace, uncommitted changes, a branch, a pull request or an agent conversation. Pull-request reviews use a separate Paseo worktree.
- Run a single specialist, request a second opinion, or form a committee that exchanges reviews before producing a consensus. Reports are relayed between the participating agents.
- Launch persistent coordinators for selected workspaces or projects, chat with them in Command, and let them start, message and cancel agents. You can assign existing top-level agents to a coordinator and release them later.
- Create recurring workspace tasks or coordinator check-ins. Workspace schedules can be paused or deleted; check-ins can be removed.
- Load specialist instructions from Markdown files in a folder you choose on the host, or import and export specialist settings.

## Access, permissions and costs

Workbench reads workspace and agent metadata, permission summaries and selected conversation timelines through Paseo. It stores profiles in Paseo plugin settings and coordinator context and relay state under `plugin-data/workbench` in the daemon's data directory. The configured specialists folder is read for Markdown instructions. Context snapshots include project and workspace names, agent IDs, titles and statuses.

Prompts, selected session transcripts, project context and review reports supplied to agents are processed by their chosen providers, which may be remote. Agents can inspect repository files and use tools according to their provider permissions. Workbench does not add a separate external data service or software downloader.

For registered coordinators, Workbench automatically approves selected Paseo agent-management requests. PR managers also receive automatic approval for selected GitHub CLI and Git requests. Coordinators continue to spend model tokens as they delegate; scheduled work continues on its cadence. Archive coordinators and remove their check-ins separately to stop both. Second opinions and committees use additional model calls.

Specialist read-only profiles use Claude plan mode or request Codex's read-only sandbox. Existing Claude always-allow rules still apply, and approving a write permits it. Codex's sandbox is requested but cannot be confirmed by Workbench at each launch. Coordinator project assignments guide the agent; they do not enforce filesystem isolation.

Removing a worktree deletes its folder and archives its agents while retaining its branch. Workbench asks for confirmation and labels uncommitted changes before discarding them. Archiving the last agent in an unused, clean Workbench PR-review worktree also removes that worktree.

## Limitations

Coordinators operate through their own host's tools. Directory views poll periodically, and provider-native subagents appear only when their events are observed while the view is open. The author reports testing the web interface at desktop and phone sizes, with native mobile apps untested.
