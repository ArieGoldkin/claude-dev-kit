# Confluence Patterns Reference

Detailed patterns for Confluence MCP tool usage.

## Table of Contents
- [Page Operations](#page-operations)
- [Space Operations](#space-operations)
- [Page Hierarchy](#page-hierarchy)
- [Comments](#comments)
- [CQL Patterns](#cql-patterns)
- [Content Formats](#content-formats)
- [Space Key to Space ID Conversion](#space-key-to-space-id-conversion)
- [Page ID Extraction](#page-id-extraction)
- [Error Handling](#error-handling)

## Page Operations

### Read Page Content

```
getConfluencePage(cloudId, pageId, contentFormat="markdown")

# contentFormat options:
# - "markdown" (default) - Human-readable
# - "adf" - Atlassian Document Format (JSON)
```

### Create Page

```javascript
createConfluencePage(cloudId, {
  spaceId: "12345",  // Numerical space ID (not key)
  title: "Page Title",
  body: "# Heading\n\nContent in markdown",
  contentFormat: "markdown",
  parentId: "67890"  // Optional: create as child page
})
```

### Update Page

```javascript
updateConfluencePage(cloudId, {
  pageId: "123456",
  body: "Updated content",
  contentFormat: "markdown",
  title: "New Title",  // Optional
  versionMessage: "Updated API documentation"  // Optional
})
```

### Create Live Doc

```javascript
createConfluencePage(cloudId, {
  spaceId: "12345",
  body: "Live doc content",
  subtype: "live"  // Creates live doc instead of regular page
})
```

## Space Operations

### List Spaces

```
getConfluenceSpaces(cloudId, {
  type: "global",  // global, personal, collaboration, knowledge_base
  status: "current",  // current, archived
  limit: 25
})
```

### Get Space by Key

```
getConfluenceSpaces(cloudId, keys=["DEV", "HR"])

# Returns space details including numerical spaceId
# Required for createConfluencePage, getPagesInConfluenceSpace
```

### Get Pages in Space

```
getPagesInConfluenceSpace(cloudId, {
  spaceId: "12345",  // Numerical ID from getConfluenceSpaces
  depth: "all",  // "all" or "root"
  status: "current",
  sort: "-modified-date",
  limit: 50
})
```

## Page Hierarchy

### Get Child Pages

```
getConfluencePageDescendants(cloudId, {
  pageId: "123456",
  depth: 2,  // How deep to traverse
  limit: 50
})
```

### Create Child Page

```javascript
createConfluencePage(cloudId, {
  spaceId: "12345",
  parentId: "123456",  // Parent page ID
  title: "Child Page",
  body: "Content"
})
```

## Comments

### Footer Comments

General comments at bottom of page:

```
# Read comments
getConfluencePageFooterComments(cloudId, pageId, {
  status: "current",
  sort: "-created-date"
})

# Create comment
createConfluenceFooterComment(cloudId, {
  pageId: "123456",
  body: "Comment in markdown"
})

# Reply to comment
createConfluenceFooterComment(cloudId, {
  pageId: "123456",
  parentCommentId: "789",
  body: "Reply content"
})
```

### Inline Comments

Comments on specific text:

```
# Read inline comments
getConfluencePageInlineComments(cloudId, pageId, {
  resolutionStatus: "open"  // open, resolved, dangling, reopened
})

# Create inline comment
createConfluenceInlineComment(cloudId, {
  pageId: "123456",
  body: "Comment on this text",
  inlineCommentProperties: {
    textSelection: "text to highlight",
    textSelectionMatchCount: 1,  // Total occurrences on page
    textSelectionMatchIndex: 0   // Which occurrence (0-based)
  }
})
```

## CQL Patterns

### By Space

```sql
-- All pages in space
space = "DEV" AND type = page

-- Multiple spaces
space in ("DEV", "QA", "PROD")
```

### By Type

```sql
-- Pages only
type = page

-- Blog posts
type = blogpost

-- Attachments
type = attachment
```

### By Title/Content

```sql
-- Title contains
title ~ "API"

-- Exact title
title = "API Documentation"

-- Content contains
text ~ "authentication"
```

### By Date

```sql
-- Modified in last week
lastModified >= now("-7d")

-- Created this month
created >= startOfMonth()

-- Modified by user
lastModified >= now("-1d") AND contributor = "user-account-id"
```

### By Label

```sql
-- Single label
label = "architecture"

-- Multiple labels (AND)
label = "api" AND label = "v2"

-- Multiple labels (OR)
label in ("draft", "review")
```

### By Ancestor

```sql
-- All descendants of a page
ancestor = "123456"
```

### Complex Queries

```sql
-- API docs modified recently
space = "DEV"
  AND type = page
  AND label = "api"
  AND lastModified >= now("-7d")
  ORDER BY lastModified DESC

-- Draft pages needing review
space = "DEV"
  AND label = "draft"
  AND label != "archived"
  ORDER BY created ASC
```

## Content Formats

### Markdown (Recommended)

```markdown
# Heading 1
## Heading 2

**Bold** and *italic*

- Bullet list
- Item 2

1. Numbered list
2. Item 2

[Link text](https://example.com)

| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |

```code block```
```

### Atlassian Document Format (ADF)

For complex formatting, use ADF JSON:

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 1 },
      "content": [{ "type": "text", "text": "Title" }]
    },
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "Content" }]
    }
  ]
}
```

## Space Key to Space ID Conversion

Many APIs require numerical `spaceId` but users provide `spaceKey`:

```
# Step 1: Get space details by key
getConfluenceSpaces(cloudId, keys=["DEV"])

# Response includes:
{
  results: [{
    id: "12345",      // <-- Use this for spaceId
    key: "DEV",
    name: "Development"
  }]
}

# Step 2: Use numerical ID
getPagesInConfluenceSpace(cloudId, spaceId="12345")
```

## Page ID Extraction

### From URL

```
URL: https://site.atlassian.net/wiki/spaces/DEV/pages/123456789/Page+Title
                                                      ↑
                                                   pageId
```

### From Search Results

```
search(query="page title")
→ Returns ARI: "ari:cloud:confluence:cloudId:page/123456789"
                                                 ↑
                                              pageId
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Space not found` | Invalid spaceId/key | Use getConfluenceSpaces to verify |
| `Page not found` | Invalid pageId | Extract from URL or search |
| `Cannot update` | Page locked or no permission | Check page restrictions |
| `Invalid content` | Malformed markdown/ADF | Validate content format |
| `Title already exists` | Duplicate in space | Use unique title |

### Validation Pattern

```
1. getConfluenceSpaces(keys=[KEY]) - Verify space, get spaceId
2. getConfluencePage(pageId) - Verify page exists (for updates)
3. createConfluencePage/updateConfluencePage - Execute operation
```
