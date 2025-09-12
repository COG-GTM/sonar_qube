# SonarQube Suppression Policy

This document outlines the policy for suppressing SonarQube issues in the Cal.com codebase.

## General Principles

- **Prefer fixing over suppressing**: Always attempt to fix the underlying issue before considering suppression
- **Prefer rule profile tuning**: Work with project administrators to adjust rule profiles rather than suppressing individual issues
- **Document all suppressions**: Every suppression must include a clear rationale and reference to relevant PR/issue

## Allowed Suppression Mechanisms

### 1. Rule-specific annotations (Preferred)
```typescript
// @ts-ignore: SonarQube rule squid:S1319 - Using concrete type required for API compatibility
// See: https://github.com/calcom/cal.com/issues/XXXX
const specificArray: Array<string> = getApiResponse();
```

### 2. Single-line NOSONAR (Limited use)
```typescript
const legacyCode = processLegacyData(); // NOSONAR - Legacy code scheduled for refactor in Q2 2024
```

## Forbidden Practices

- **File-wide NOSONAR**: Never suppress entire files without explicit approval from tech leads
- **Project-wide exclusions**: Avoid excluding entire directories to hide real issues
- **Blanket suppressions**: Do not suppress entire rule categories without justification
- **Undocumented suppressions**: All suppressions must include reasoning

## Approval Process

### Automatic Approval (No review needed)
- Single-line suppressions for false positives with clear documentation
- Test-specific suppressions for legitimate test patterns

### Review Required
- File-wide suppressions (requires tech lead approval)
- Suppressions affecting security or reliability rules
- Suppressions in critical path code

### Forbidden (Always rejected)
- Suppressions to artificially pass quality gates
- Suppressions without documentation
- Suppressions for convenience rather than necessity

## Examples

### ✅ Good Suppression
```typescript
// @ts-ignore: SonarQube rule typescript:S4144 - Duplicate implementation required for type safety
// This duplication is intentional to maintain strict typing between user and admin contexts
// See: https://github.com/calcom/cal.com/pull/XXXX
function processUserData(data: UserData): ProcessedData {
  // Implementation
}
```

### ❌ Bad Suppression
```typescript
// NOSONAR - This is too complex to fix right now
function complexFunction() {
  // 200 lines of complex code
}
```

## Monitoring and Review

- All suppressions are tracked in quarterly code quality reviews
- Suppressions with temporary justifications are reviewed for removal
- Patterns of suppressions indicate areas needing architectural attention

## Contact

For questions about this policy or approval requests, contact:
- Tech Leads via GitHub issues
- Code Quality Team via Slack #code-quality
