# Common Atlassian Workflows

Cross-product patterns and automation workflows.

## Table of Contents
- [Search Strategy](#search-strategy)
- [Documentation Workflow](#documentation-workflow)
- [Sprint Planning Workflow](#sprint-planning-workflow)
- [Issue Triage Workflow](#issue-triage-workflow)
- [Cross-Reference Patterns](#cross-reference-patterns)
- [Reporting Patterns](#reporting-patterns)
- [Bulk Operations](#bulk-operations)
- [URL Handling Cheatsheet](#url-handling-cheatsheet)
- [Error Recovery](#error-recovery)

## Search Strategy

### Decision Tree

```
User query about Jira/Confluence?
│
├─ General search (default)
│  └─ Use: search(query)
│     - Natural language
│     - Searches both products
│     - Returns ARIs
│
├─ User mentions "JQL" or needs complex Jira filters
│  └─ Use: searchJiraIssuesUsingJql(jql)
│     - Date ranges, sprints, custom fields
│     - Precise field matching
│
└─ User mentions "CQL" or needs complex Confluence filters
   └─ Use: searchConfluenceUsingCql(cql)
      - Space filtering, labels, ancestors
      - Content type filtering
```

### Unified Search → Fetch Pattern

```
1. search(query="login authentication")
   → Returns ARIs like:
     - "ari:cloud:jira:abc123:issue/10107"
     - "ari:cloud:confluence:abc123:page/456789"

2. fetch(id="ari:cloud:jira:abc123:issue/10107")
   → Returns full issue/page details
```

## Documentation Workflow

### Create Documentation for Feature

```
1. Create parent page for feature
   createConfluencePage(cloudId, {
     spaceId, title: "Feature: User Auth",
     body: "# Overview\n\n..."
   })
   → pageId: "111"

2. Create child pages
   createConfluencePage(cloudId, {
     spaceId, parentId: "111",
     title: "Technical Design",
     body: "..."
   })

3. Link to Jira epic
   # Add page link in Jira issue description
   editJiraIssue(cloudId, "PROJ-100", {
     fields: {
       description: "See [Technical Design](confluence-url)"
     }
   })
```

### Update Docs When Issue Closes

```
1. Get issue details
   getJiraIssue(cloudId, "PROJ-123")
   → Extract linked Confluence pages from description

2. Update Confluence page
   updateConfluencePage(cloudId, pageId, {
     body: updatedContent,
     versionMessage: "Updated per PROJ-123 completion"
   })

3. Add footer comment
   createConfluenceFooterComment(cloudId, {
     pageId,
     body: "Updated based on [PROJ-123] implementation"
   })
```

## Sprint Planning Workflow

### Get Sprint Status

```
1. Search for sprint issues
   searchJiraIssuesUsingJql(cloudId, {
     jql: "project = PROJ AND sprint in openSprints()"
   })

2. Group by status
   - To Do: status = "To Do"
   - In Progress: status = "In Progress"
   - Done: status = "Done"

3. Calculate velocity
   - Count story points in Done
   - Compare to sprint commitment
```

### Move Issues to Sprint

```
1. Get sprint ID
   # Sprint IDs are in issue sprint field

2. Update issue
   editJiraIssue(cloudId, issueKey, {
     fields: {
       customfield_10020: sprintId  # Sprint field ID varies
     }
   })
```

## Issue Triage Workflow

### New Bug Triage

```
1. Get unassigned bugs
   searchJiraIssuesUsingJql(cloudId, {
     jql: "project = PROJ AND type = Bug AND assignee is EMPTY ORDER BY created DESC"
   })

2. For each bug:
   a. Review details
      getJiraIssue(cloudId, issueKey)

   b. Set priority
      editJiraIssue(cloudId, issueKey, {
        fields: { priority: { name: "High" } }
      })

   c. Assign to developer
      editJiraIssue(cloudId, issueKey, {
        fields: { assignee: { accountId: "..." } }
      })

   d. Add triage comment
      addCommentToJiraIssue(cloudId, issueKey,
        "Triaged: Priority set to High, assigned to @developer")
```

## Cross-Reference Patterns

### Find Related Content

```
1. Search Jira for topic
   searchJiraIssuesUsingJql(cloudId, {
     jql: 'text ~ "authentication"'
   })

2. Search Confluence for same topic
   searchConfluenceUsingCql(cloudId, {
     cql: 'text ~ "authentication"'
   })

3. Get remote links from Jira issues
   getJiraIssueRemoteIssueLinks(cloudId, issueKey)
   → Returns linked Confluence pages
```

### Link Issue to Documentation

```
# In Jira issue description, add Confluence link:
editJiraIssue(cloudId, issueKey, {
  fields: {
    description: "Implementation details: [Auth Docs](https://site.atlassian.net/wiki/...)"
  }
})
```

## Reporting Patterns

### Weekly Status Report

```
1. Get completed issues this week
   searchJiraIssuesUsingJql(cloudId, {
     jql: 'project = PROJ AND status changed to Done DURING (startOfWeek(), now())'
   })

2. Get in-progress issues
   searchJiraIssuesUsingJql(cloudId, {
     jql: 'project = PROJ AND status = "In Progress"'
   })

3. Create Confluence report page
   createConfluencePage(cloudId, {
     spaceId, title: "Week of [Date] Status",
     body: "# Completed\n..." + "# In Progress\n..."
   })
```

### Overdue Issues Report

```
searchJiraIssuesUsingJql(cloudId, {
  jql: 'project = PROJ AND due < now() AND status != Done ORDER BY due ASC'
})
```

## Bulk Operations

### Bulk Update Issues

```
1. Search for issues to update
   searchJiraIssuesUsingJql(cloudId, {
     jql: "project = PROJ AND labels = old-label"
   })

2. For each issue:
   editJiraIssue(cloudId, issueKey, {
     fields: { labels: ["new-label"] }
   })

# Note: MCP doesn't have bulk API, iterate one by one
# For large batches, consider rate limiting
```

### Bulk Close Stale Issues

```
1. Find stale issues
   searchJiraIssuesUsingJql(cloudId, {
     jql: "project = PROJ AND updated < -90d AND status != Done"
   })

2. For each issue:
   a. Add comment explaining closure
      addCommentToJiraIssue(cloudId, issueKey,
        "Closing due to inactivity. Reopen if still relevant.")

   b. Transition to closed
      getTransitionsForJiraIssue(cloudId, issueKey)
      transitionJiraIssue(cloudId, issueKey, {
        transition: { id: closeTransitionId }
      })
```

## URL Handling Cheatsheet

### Parse Jira URL

```
https://site.atlassian.net/browse/PROJ-123
                                   └─ issueKey

https://site.atlassian.net/jira/software/projects/PROJ/boards/1
                                                   └─ projectKey

https://site.atlassian.net/jira/software/projects/PROJ/boards/1/backlog?selectedIssue=PROJ-456
                                                                                        └─ issueKey
```

### Parse Confluence URL

```
https://site.atlassian.net/wiki/spaces/DEV/pages/123456789/Page+Title
                                       └─ spaceKey   └─ pageId

https://site.atlassian.net/wiki/spaces/DEV/overview
                                       └─ spaceKey (space home)
```

### CloudId from URL

```
https://site.atlassian.net/...
        └─ Use full base URL as cloudId parameter
           MCP handles conversion to UUID internally
```

## Error Recovery

### Retry Pattern

```
For transient errors (rate limits, timeouts):

1. Catch error
2. Wait with exponential backoff: 1s, 2s, 4s, 8s
3. Retry up to 3 times
4. Report failure if all retries exhausted
```

### Validation Before Action

```
# Before creating issue:
1. getVisibleJiraProjects() - Verify project access
2. getJiraProjectIssueTypesMetadata() - Verify issue type exists

# Before updating page:
1. getConfluencePage() - Verify page exists and readable
2. Check current content to avoid overwriting

# Before transitioning:
1. getTransitionsForJiraIssue() - Verify transition available
```
