# Jira Patterns Reference

Detailed patterns for Jira MCP tool usage.

## Table of Contents
- [Issue Lifecycle](#issue-lifecycle)
- [Issue Fields](#issue-fields)
- [JQL Patterns](#jql-patterns)
- [Transitions](#transitions)
- [Worklogs](#worklogs)
- [Remote Links](#remote-links)
- [Project Discovery](#project-discovery)
- [Error Handling](#error-handling)

## Issue Lifecycle

### Create → Assign → Transition → Close

```
1. createJiraIssue(cloudId, projectKey, issueTypeName, summary)
   → Returns issue key (e.g., "PROJ-123")

2. editJiraIssue(cloudId, "PROJ-123", {
     fields: { assignee: { accountId: "user-account-id" } }
   })

3. getTransitionsForJiraIssue(cloudId, "PROJ-123")
   → Returns available transitions with IDs

4. transitionJiraIssue(cloudId, "PROJ-123", {
     transition: { id: "31" }  // "In Progress" transition ID
   })

5. addCommentToJiraIssue(cloudId, "PROJ-123", "Work completed")

6. transitionJiraIssue(cloudId, "PROJ-123", {
     transition: { id: "41" }  // "Done" transition ID
   })
```

### Find User Account ID

```
lookupJiraAccountId(cloudId, searchString="john.doe@example.com")
→ Returns matching users with accountId

# Use accountId for assignee, reporter fields
```

### Get Current User

```
atlassianUserInfo()
→ Returns current authenticated user info including accountId
```

## Issue Fields

### Standard Fields

```javascript
{
  fields: {
    summary: "Issue title",
    description: "Detailed description in markdown",
    assignee: { accountId: "557058:..." },
    reporter: { accountId: "557058:..." },
    priority: { name: "High" },  // High, Medium, Low
    labels: ["backend", "urgent"],
    components: [{ name: "API" }],
    fixVersions: [{ name: "1.0.0" }]
  }
}
```

### Custom Fields

Custom fields use `customfield_XXXXX` format:

```javascript
{
  fields: {
    customfield_10001: "Custom text value",
    customfield_10002: { value: "Option A" },  // Select list
    customfield_10003: [{ value: "A" }, { value: "B" }]  // Multi-select
  }
}
```

**Find custom field IDs:**
```
getJiraIssueTypeMetaWithFields(cloudId, projectKey, issueTypeId)
→ Returns all fields including custom field IDs and schemas
```

## JQL Patterns

### By Status

```sql
-- Open issues
status in (Open, "In Progress", "To Do")

-- Closed issues
status in (Done, Closed, Resolved)

-- Not done
status != Done
```

### By Date

```sql
-- Created in last 7 days
created >= -7d

-- Updated today
updated >= startOfDay()

-- Due this week
due >= startOfWeek() AND due <= endOfWeek()

-- Overdue
due < now() AND status != Done
```

### By User

```sql
-- Assigned to me
assignee = currentUser()

-- Reported by me
reporter = currentUser()

-- Watched by me
watcher = currentUser()

-- Unassigned
assignee is EMPTY
```

### By Sprint

```sql
-- Current sprint
sprint in openSprints()

-- Specific sprint
sprint = "Sprint 23"

-- Future sprints
sprint in futureSprints()

-- No sprint (backlog)
sprint is EMPTY
```

### Complex Queries

```sql
-- High priority bugs in current sprint
project = PROJ
  AND type = Bug
  AND priority in (High, Highest)
  AND sprint in openSprints()

-- My unfinished work
assignee = currentUser()
  AND status != Done
  AND due <= endOfWeek()
  ORDER BY priority DESC, due ASC

-- Recently updated by team
project = PROJ
  AND updated >= -1d
  AND updatedBy in membersOf("developers")
  ORDER BY updated DESC
```

## Transitions

### Get Available Transitions

```
getTransitionsForJiraIssue(cloudId, issueIdOrKey)

Response:
{
  transitions: [
    { id: "11", name: "To Do", to: { name: "To Do" } },
    { id: "21", name: "In Progress", to: { name: "In Progress" } },
    { id: "31", name: "Done", to: { name: "Done" } }
  ]
}
```

### Transition with Fields

Some transitions require fields (e.g., resolution):

```javascript
transitionJiraIssue(cloudId, issueIdOrKey, {
  transition: { id: "31" },
  fields: {
    resolution: { name: "Done" }
  }
})
```

### Transition with Comment

```javascript
transitionJiraIssue(cloudId, issueIdOrKey, {
  transition: { id: "31" },
  update: {
    comment: [{
      add: { body: "Closing as completed" }
    }]
  }
})
```

## Worklogs

### Add Time Spent

```
addWorklogToJiraIssue(cloudId, issueIdOrKey, timeSpent="2h")

# Time formats:
# "2h" - 2 hours
# "30m" - 30 minutes
# "1d" - 1 day (8 hours by default)
# "1w" - 1 week
```

### Restricted Visibility

```javascript
addWorklogToJiraIssue(cloudId, issueIdOrKey, {
  timeSpent: "2h",
  visibility: {
    type: "group",
    value: "jira-developers"
  }
})
```

## Remote Links

### Get Confluence Links

```
getJiraIssueRemoteIssueLinks(cloudId, issueIdOrKey)

# Returns linked Confluence pages, external URLs, etc.
# Filter by globalId for specific integrations
```

## Project Discovery

### List Projects

```
getVisibleJiraProjects(cloudId, {
  action: "create",  // Filter by permission
  searchString: "myproject",  // Filter by name
  maxResults: 50
})
```

### Get Issue Types

```
getJiraProjectIssueTypesMetadata(cloudId, projectKey)

# Returns available issue types: Bug, Story, Task, Epic, etc.
# Each type has different required fields
```

### Get Field Metadata

```
getJiraIssueTypeMetaWithFields(cloudId, projectKey, issueTypeId)

# Returns all fields for an issue type:
# - Required vs optional
# - Field types and schemas
# - Allowed values for select fields
# - Custom field IDs
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Issue does not exist` | Invalid key/ID | Verify issue key format |
| `Field 'X' cannot be set` | Read-only or wrong type | Check field metadata |
| `Transition not available` | Invalid from current status | Get available transitions first |
| `User not found` | Invalid accountId | Use lookupJiraAccountId |
| `Permission denied` | Insufficient access | Verify project permissions |

### Validation Pattern

```
1. getJiraIssue() - Verify issue exists
2. getTransitionsForJiraIssue() - Verify transition available
3. transitionJiraIssue() - Execute transition
```
