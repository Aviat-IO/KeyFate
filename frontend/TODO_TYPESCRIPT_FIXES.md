# TypeScript Compilation Fixes

## Core Issues to Fix:

1. **Test Framework Types** ✅ (Fixed via tsconfig)
   - Added vitest types to tsconfig.json

2. **NextRequest Type Mismatches in Tests**
   - API tests expect NextRequest but receive standard Request

3. **Session User Object Missing `id` Property**
   - NextAuth session.user doesn't include id by default

4. **Database Schema Type Issues**
   - updatedAt field not in SecretUpdate type
   - Database operations with .rows property issues

5. **Test API Mock Issues**
   - Methods expecting 0 arguments but receiving 1

## Priority Order:
1. Fix NextAuth session types (user.id issue)
2. Fix NextRequest issues in tests
3. Fix database type mismatches
4. Fix test mocks