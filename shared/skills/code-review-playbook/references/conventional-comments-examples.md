# Conventional Comments - Detailed Examples

Extended examples for each conventional comment label, showing proper format with code snippets and discussion.

## Praise

```
praise: Excellent use of TanStack Query caching with hierarchical keys!

This pattern makes cache invalidation much more precise.
```

## Issue with Solution

```
issue [blocking]: Missing error handling for API call

If fetchUserActivities() throws, the component crashes.

Add error boundary or try/catch:
```typescript
const { data, error } = useQuery({
  queryKey: ['user', userId, 'activities'],
  queryFn: () => fetchUserActivities(userId),
});

if (error) return <ErrorMessage error={error} />;
```
```

## Security Critical

```
security [blocking]: Sensitive data (user email) being logged to monitoring

Line 45: logger.info(`Processing activity for ${user.email}`)

Sensitive data must not be logged. Use user_id only:
```python
logger.info("Processing activity", extra={"user_id": user_id})
```
```

## Security

```
security [blocking]: Query missing tenant isolation filter

Line 78: session.query(Activity).all()

This returns ALL activities across all users (data breach).

Fix:
```python
session.query(Activity).filter_by(user_id=user_id).all()
```

Add test:
```python
def test_user_cannot_access_other_user_activities():
    response = client.get(f"/activities/{other_user_activity_id}")
    assert response.status_code == 403
```
```

## Suggestion

```
suggestion [non-blocking]: Consider extracting this logic to a custom hook

This pattern repeats in 3 components. Could be:
```typescript
function useActivityTracking(userId: string) {
  const queryClient = useQueryClient();

  const createActivity = useMutation({
    mutationFn: (data) => apiClient.createActivity(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['user', userId, 'activities']);
    },
  });

  return { createActivity };
}
```
```
