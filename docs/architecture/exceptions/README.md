# Governed architecture exceptions

Exceptions are temporary JSON records validated by `npm run architecture:check`. Copy the fields from `schema.json`, use a future ISO review date, and scope `affectedPaths` to the smallest project-relative files or directories. Repository-wide globs and parent traversal are rejected.

An exception does not disable a rule automatically. The relevant guard must explicitly read the record, which keeps every bypass reviewable. Remove the record and bypass together when `removalTask` is complete.
