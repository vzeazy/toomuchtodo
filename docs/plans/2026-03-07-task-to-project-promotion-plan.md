# Task To Project Promotion Plan

## Goal

Add the ability to promote an individual task into a project in a way that is safe, predictable, and efficient within the app's existing task tree and project tree architecture.

## Date

- Prepared: 2026-03-07

## Current Baseline

The current model separates tasks and projects clearly:

- Tasks can form hierarchies via `parentId` in [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts).
- Projects can also form hierarchies via `parentId` in [src/types.ts](/home/vas/sites/node/toomuchtodo/src/types.ts).
- Tasks reference projects by `projectId`.
- Projects currently carry only structural metadata: `id`, `name`, `color`, `parentId`, `updatedAt`, `deletedAt`.
- Task tree movement logic already exists in [src/features/tasks/taskTree.ts](/home/vas/sites/node/toomuchtodo/src/features/tasks/taskTree.ts).
- Project tree helpers already exist in [src/lib/projectTree.ts](/home/vas/sites/node/toomuchtodo/src/lib/projectTree.ts).
- Store mutations for tasks and projects live centrally in [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts).
- The task action surfaces currently live in:
  - [src/features/tasks/TaskRow.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskRow.tsx)
  - [src/features/tasks/OutlineTaskRow.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/OutlineTaskRow.tsx)
  - [src/features/tasks/TaskModal.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskModal.tsx)

That means the best implementation is not a new parallel system. It should be one orchestrated store operation that creates a project and rehomes the selected task subtree appropriately.

## Recommendation

Implement promotion as a dedicated store action:

- `promoteTaskToProject(taskId, options?)`

For MVP, promotion should be safe and lossless.

Recommended MVP behavior:

1. Create a new project using the task title.
2. If the task already belongs to a project, make the new project a child of that existing project.
3. Move the promoted task into the new project.
4. If the promoted task was nested under another task, detach it from that parent so it becomes a top-level root task inside the new project.
5. Reassign the entire task subtree to the new project.
6. Keep the promoted task itself as the root task inside the new project.

This is the safest default because it preserves all existing task metadata:

- title
- description
- subtasks
- due date
- day part
- completion state
- tags
- starred state

## Why This MVP Is Better Than Full Conversion

There are two possible interpretations of “promote task to project”:

### Option A: Promote and keep the task

Create a project and keep the original task as the root task in that project.

### Option B: Convert the task into a project and remove the task

Create a project, delete or archive the source task, and lift subtasks into the project.

Option B sounds cleaner conceptually, but it creates immediate product problems:

- where does the source task description go?
- what happens if the task has no subtasks?
- what happens to due date, status, day part, and tags?
- how do we avoid silent data loss?

Because projects currently have no notes or schedule fields, full conversion is not yet a good default.

The safest efficient path is:

- MVP: promote and keep the task
- later enhancement: add `convert to project` once project notes exist and metadata transfer rules are explicit

## Target Behavior In Detail

### Case 1: Top-level task with no existing project

Input:

- task `Write launch plan`
- `projectId = null`
- `parentId = null`

Result:

- create project `Write launch plan`
- set task `projectId = newProject.id`
- keep `parentId = null`

### Case 2: Top-level task already inside a project

Input:

- task `Website redesign`
- `projectId = marketingProject.id`
- `parentId = null`

Result:

- create project `Website redesign`
- set new project `parentId = marketingProject.id`
- move task subtree to `projectId = newProject.id`

This preserves project nesting semantics and mirrors how the user likely thinks about sub-projects.

### Case 3: Nested task under another task

Input:

- task `Pricing research`
- `parentId = strategyTask.id`

Result:

- create project `Pricing research`
- set promoted task `parentId = null`
- keep its descendants nested under it
- move full subtree into `projectId = newProject.id`

This prevents the promoted task from remaining trapped under a parent task that belongs to a different context.

## Recommended Store Algorithm

Implement in [src/store/useAppStore.ts](/home/vas/sites/node/toomuchtodo/src/store/useAppStore.ts) as one transactional update inside `setSharedState`.

Pseudo-flow:

```ts
promoteTaskToProject(taskId) {
  setSharedState((prev) => {
    const task = findTask(taskId)
    if (!task) return prev

    const newProjectId = uid('proj')
    const newProject = {
      id: newProjectId,
      name: task.title.trim() || 'Untitled project',
      parentId: task.projectId,
      updatedAt: now,
      deletedAt: null,
    }

    const subtreeIds = getTaskSubtreeIds(taskId, prev.tasks)

    const nextTasks = prev.tasks.map((candidate) => {
      if (!subtreeIds.has(candidate.id)) return candidate

      if (candidate.id === taskId) {
        return touchTask({
          ...candidate,
          projectId: newProjectId,
          parentId: null,
        })
      }

      return touchTask({
        ...candidate,
        projectId: newProjectId,
      })
    })

    return {
      ...prev,
      projects: [...prev.projects, newProject],
      tasks: nextTasks,
    }
  })
}
```

Recommended supporting helper:

- add `getTaskSubtreeIds(taskId, tasks)` in [src/features/tasks/taskTree.ts](/home/vas/sites/node/toomuchtodo/src/features/tasks/taskTree.ts)

That helper will also be useful for future bulk operations.

## UI Integration Plan

### Primary entry point: task actions menu

Add `Promote to project` to the action menus in:

- [src/features/tasks/TaskRow.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskRow.tsx)
- [src/features/tasks/OutlineTaskRow.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/OutlineTaskRow.tsx)

This is the most discoverable and natural location because promotion is an action on one task.

### Secondary entry point: task modal

Add the same action to [src/features/tasks/TaskModal.tsx](/home/vas/sites/node/toomuchtodo/src/features/tasks/TaskModal.tsx), likely in the metadata section or footer actions.

This matters because promotion is a higher-stakes structural action and users may expect to find it in the full task details view.

### Confirmation UX

Recommended confirmation copy for nested tasks or tasks that already belong to a project:

- `Create a new project from this task and move this task subtree into it?`

For plain top-level tasks, confirmation can be skipped if the app wants a faster workflow.

My recommendation:

- no confirmation for top-level tasks with no descendants
- lightweight confirmation for nested tasks or tasks with descendants

## Naming and Parent Project Rules

Recommended defaults:

- new project name = task title, trimmed
- new project parent = old `task.projectId`
- new project color = undefined initially

Why parent project should come from `task.projectId`:

- it preserves the user's current project context
- it creates natural project nesting
- it does not require a second prompt during promotion

## Task Subtree Rules

These rules should be explicit in the implementation:

1. Every descendant in the promoted subtree gets `projectId = newProject.id`.
2. The promoted root task gets `parentId = null`.
3. Descendants keep their existing `parentId` relationships.
4. Tasks outside the subtree are untouched.

This keeps the operation small, deterministic, and easy to reason about.

## What Should Not Happen

Avoid these behaviors in MVP:

- do not delete the original task automatically
- do not lift all subtasks to top level
- do not rewrite task statuses or due dates
- do not auto-complete the promoted task
- do not auto-change task areas
- do not prompt for many options during promotion

All of those add complexity without being necessary for the first useful version.

## Sync and Persistence Impact

Good news: MVP promotion does not require any new schema.

It only creates and updates existing entities:

- one new `project`
- one updated task subtree

That means the current sync model in:

- [src/lib/sync/operations.ts](/home/vas/sites/node/toomuchtodo/src/lib/sync/operations.ts)
- [worker/src/routes/sync.ts](/home/vas/sites/node/toomuchtodo/worker/src/routes/sync.ts)

can already carry the result once the store mutation is implemented.

This is one reason task promotion is a good near-term feature. It is operationally cheap compared with notes.

## Recommended Implementation Phases

### Phase 1: Store primitive

- add subtree helper in task tree utilities
- add `promoteTaskToProject(taskId)` in store
- ensure timestamps are updated on all changed tasks and the new project

### Phase 2: UI surface

- add action to task row menu
- add action to outline row menu
- add action to task modal
- after promotion, navigate to the new project or keep current context and toast the result

Navigation recommendation:

- after promotion, open the new project view

That gives immediate feedback that the operation succeeded and shows the new container in context.

### Phase 3: Polish

- add undo support if the app later gains toasts/history
- add command palette action for promoting the currently open task
- optionally preselect the new project in the sidebar

## Edge Cases

### Completed task promotion

Allowed. The project can contain a completed root task. Do not special-case it.

### Task with empty or whitespace title

Use `Untitled project` as fallback.

### Task already matches an existing project name

Still allow promotion. Duplicate names are acceptable in the current data model.

### Task already inside a nested project

Create the new project under that current project. This gives a natural sub-project chain.

### Selected task has descendants with mixed project IDs

Normalize the entire subtree to the new project. The promoted subtree should become one coherent project unit.

### Selected task has descendants with mixed areas

Leave areas unchanged in MVP. Area is task-level metadata today, and rewriting it would be a hidden side effect.

## Future Enhancement: True Conversion

Once project notes exist, a richer second-stage feature becomes possible:

- `Promote and convert`

That flow could:

1. create a new project
2. move the task description into a project note
3. either archive the source task or convert it into a first task template
4. optionally lift children to top-level tasks in the new project

This should be considered phase 2, not MVP.

Without project notes, that flow is too lossy and too ambiguous.

## Open Decisions

1. Should promotion immediately navigate into the new project, or should it stay in place and show a lightweight toast?
2. Should nested-task promotion always ask for confirmation, or only when descendants exist?
3. After the notes system lands, should the app offer both `Promote and keep task` and `Convert to project` as separate actions?

## Final Recommendation

Implement task promotion now as a safe structural operation that creates a project and moves the selected task subtree into it while keeping the source task as the project's root task.

This gives the feature quickly, fits the existing data model, requires no new sync schema, and avoids all of the ambiguity and data-loss risk of full task-to-project conversion.