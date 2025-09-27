# Contributing to YouTube MCP Extended

## Welcome Contributors!

Thank you for your interest in contributing to YouTube MCP Extended! This guide will help you understand our development process, coding standards, and how to submit contributions effectively.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Submitting Changes](#submitting-changes)
- [Review Process](#review-process)
- [Community Guidelines](#community-guidelines)

## Getting Started

### Prerequisites

Before contributing, ensure you have:

- **Node.js** 20.0.0 or higher
- **npm** 9.0.0 or higher
- **Git** 2.30 or higher
- **TypeScript** knowledge (intermediate level recommended)
- **YouTube Data API** familiarity (helpful but not required)

### Initial Setup

1. **Fork the Repository**:
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/your-username/youtube-mcp-extended.git
   cd youtube-mcp-extended
   ```

2. **Set Up Upstream Remote**:
   ```bash
   git remote add upstream https://github.com/original-owner/youtube-mcp-extended.git
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Environment Setup**:
   ```bash
   cp .env.example .env.local
   # Configure your YouTube API credentials
   ```

5. **Verify Setup**:
   ```bash
   npm run check
   ```

### Development Environment

We recommend using VS Code with these extensions:
- TypeScript Importer
- ESLint
- Prettier
- GitLens

## Development Workflow

### Branch Strategy

We use a simplified Git Flow:

- **`main`**: Production-ready code
- **`develop`**: Integration branch for features
- **`feature/*`**: New features and enhancements
- **`fix/*`**: Bug fixes
- **`docs/*`**: Documentation updates

### Starting Work

1. **Sync with Upstream**:
   ```bash
   git checkout main
   git pull upstream main
   git push origin main
   ```

2. **Create Feature Branch**:
   ```bash
   # For features
   git checkout -b feature/your-feature-name

   # For bug fixes
   git checkout -b fix/issue-description

   # For documentation
   git checkout -b docs/documentation-update
   ```

3. **Development Process**:
   ```bash
   # Start development server
   npm run dev:basic

   # Make changes, test frequently
   npm run type-check
   npm run lint
   npm test

   # Run full checks before committing
   npm run check
   ```

### Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format: type(scope): description
git commit -m "feat(metadata): add AI-powered title optimization"
git commit -m "fix(auth): handle token refresh edge case"
git commit -m "docs(api): update authentication flow documentation"
git commit -m "test(scheduler): add integration tests for batch processing"
```

#### Commit Types

- **feat**: New features
- **fix**: Bug fixes
- **docs**: Documentation changes
- **style**: Code style changes (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

#### Commit Message Guidelines

- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Limit first line to 72 characters
- Reference issues and pull requests when applicable

### Testing Requirements

All contributions must include appropriate tests:

1. **Unit Tests** for new functions/classes:
   ```typescript
   // src/module/__tests__/module.test.ts
   describe('ModuleName', () => {
     it('should handle valid input', () => {
       // Test implementation
     });
   });
   ```

2. **Integration Tests** for service interactions:
   ```typescript
   // src/__tests__/integration/feature.test.ts
   describe('Feature Integration', () => {
     it('should work end-to-end', async () => {
       // Test implementation
     });
   });
   ```

3. **Test Coverage**: Maintain >80% coverage for new code

### Code Quality Checks

Before submitting, ensure your code passes all checks:

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Formatting
npm run format

# Testing
npm test

# All checks
npm run check
```

## Code Standards

### TypeScript Standards

1. **Strict Type Safety**:
   ```typescript
   // ✅ Good: Explicit types
   interface UserData {
     id: string;
     name: string;
     email?: string;
   }

   function processUser(user: UserData): Promise<ProcessResult> {
     // Implementation
   }

   // ❌ Bad: Any types
   function processUser(user: any): any {
     // Implementation
   }
   ```

2. **Interface Naming**:
   ```typescript
   // ✅ Good: Descriptive interface names
   interface VideoMetadata {
     title: string;
     description: string;
   }

   interface YouTubeClientConfig {
     apiKey: string;
     timeout: number;
   }

   // ❌ Bad: Generic names
   interface Data {
     stuff: any;
   }
   ```

3. **Error Handling**:
   ```typescript
   // ✅ Good: Specific error types
   class ValidationError extends Error {
     constructor(
       message: string,
       public field: string,
       public value: unknown
     ) {
       super(message);
       this.name = 'ValidationError';
     }
   }

   // Handle errors appropriately
   try {
     await operation();
   } catch (error) {
     if (error instanceof ValidationError) {
       return { success: false, error: error.message };
     }
     throw error; // Re-throw unknown errors
   }
   ```

### Documentation Standards

1. **JSDoc Comments**:
   ```typescript
   /**
    * Generates metadata suggestions for a YouTube video.
    *
    * @param input - Video metadata and content for analysis
    * @param options - Generation options and preferences
    * @returns Promise resolving to metadata suggestions with confidence scores
    *
    * @example
    * ```typescript
    * const suggestions = await generateMetadata({
    *   videoId: 'abc123',
    *   title: 'My Video',
    *   description: 'Video description'
    * });
    * ```
    *
    * @throws {ValidationError} When input validation fails
    * @throws {APIError} When YouTube API call fails
    */
   export async function generateMetadata(
     input: MetadataInput,
     options?: GenerationOptions
   ): Promise<MetadataSuggestion> {
     // Implementation
   }
   ```

2. **README Updates**: Update relevant documentation when adding features

3. **Code Comments**: Explain complex logic and business rules

### File Organization

```typescript
// ✅ Good: Organized imports
import type { YouTubeVideo } from '../types/index.js';
import { ConfigManager } from '../config/index.js';
import { validateInput } from '../utils/validation.js';

// ✅ Good: Logical grouping
export class VideoProcessor {
  // Public methods first
  async processVideo(video: YouTubeVideo): Promise<ProcessResult> {
    // Implementation
  }

  // Private methods last
  private validateVideo(video: YouTubeVideo): boolean {
    // Implementation
  }
}
```

## Submitting Changes

### Pull Request Process

1. **Prepare Your Branch**:
   ```bash
   # Rebase on latest main
   git checkout main
   git pull upstream main
   git checkout your-feature-branch
   git rebase main

   # Run final checks
   npm run check
   ```

2. **Create Pull Request**:
   - Use clear, descriptive title
   - Fill out the PR template completely
   - Reference related issues
   - Include screenshots/demos for UI changes

3. **PR Title Format**:
   ```
   feat(scope): add descriptive feature name
   fix(scope): resolve specific issue description
   docs: update contribution guidelines
   ```

### Pull Request Template

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Test coverage maintained/improved

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes (or properly documented)

## Related Issues
Fixes #(issue_number)
```

### Code Review Guidelines

**For Authors:**
- Respond to feedback promptly
- Make requested changes in separate commits
- Explain complex decisions in PR comments
- Update tests and documentation as needed

**For Reviewers:**
- Focus on code quality, not personal preferences
- Provide constructive feedback with suggestions
- Approve when code meets standards
- Request changes for critical issues only

## Review Process

### Review Criteria

1. **Functionality**: Does the code work as intended?
2. **Code Quality**: Is the code readable and maintainable?
3. **Performance**: Are there any performance concerns?
4. **Security**: Are there security implications?
5. **Testing**: Is the code adequately tested?
6. **Documentation**: Is the code properly documented?

### Review Timeline

- **Initial Review**: Within 2-3 business days
- **Follow-up Reviews**: Within 1-2 business days
- **Merge**: After approval from at least one maintainer

### Merge Requirements

- [ ] All CI checks pass
- [ ] At least one maintainer approval
- [ ] No unresolved conversations
- [ ] Up-to-date with main branch
- [ ] All tests pass
- [ ] Documentation updated

## Issue Reporting

### Bug Reports

Use the bug report template:

```markdown
**Bug Description**
Clear description of the bug.

**Steps to Reproduce**
1. Step one
2. Step two
3. Step three

**Expected Behavior**
What should happen.

**Actual Behavior**
What actually happens.

**Environment**
- OS: [e.g., macOS 12.0]
- Node.js: [e.g., 20.1.0]
- Version: [e.g., 1.2.3]

**Additional Context**
Any other relevant information.
```

### Feature Requests

Use the feature request template:

```markdown
**Feature Description**
Clear description of the proposed feature.

**Problem/Motivation**
What problem does this solve?

**Proposed Solution**
How should this be implemented?

**Alternatives Considered**
What other approaches were considered?

**Additional Context**
Any other relevant information.
```

## Community Guidelines

### Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and professional
- Focus on constructive feedback
- Help others learn and grow
- Report inappropriate behavior

### Communication

- **GitHub Issues**: Bug reports, feature requests
- **Pull Requests**: Code discussions
- **Discussions**: General questions and ideas

### Getting Help

If you need help:

1. Check existing documentation
2. Search GitHub issues
3. Create a new issue with details
4. Join our community discussions

### Recognition

Contributors are recognized through:
- Contributor mentions in releases
- GitHub contributor stats
- Special recognition for significant contributions

## Development Resources

### Useful Links

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [YouTube Data API Documentation](https://developers.google.com/youtube/v3)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Zod Documentation](https://zod.dev/)

### Development Tools

- **VS Code**: Recommended IDE
- **GitHub CLI**: For efficient GitHub interaction
- **Thunder Client**: API testing
- **npm-check-updates**: Dependency management

### Best Practices Resources

- [Clean Code principles](https://github.com/ryanmcdermott/clean-code-javascript)
- [TypeScript best practices](https://typescript-eslint.io/rules/)
- [Testing best practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

Thank you for contributing to YouTube MCP Extended! Your contributions help make this project better for everyone.