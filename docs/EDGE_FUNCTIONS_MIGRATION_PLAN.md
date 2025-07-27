# Edge Functions Migration Plan

## Overview
Migrating from Netlify Functions (Node.js, 10s timeout) to Edge Functions (Deno, 30s timeout) to address timeout issues.

## Technical Differences

### Runtime Changes
| Feature | Current (Functions) | Edge Functions |
|---------|-------------------|----------------|
| Runtime | Node.js | Deno |
| Timeout | 10 seconds | 30 seconds |
| Module System | CommonJS/ESM | ESM only |
| NPM packages | Direct support | Limited/via CDN |
| Environment vars | `process.env.VAR` | `Netlify.env.get('VAR')` |
| Request/Response | `event` object | Web Standards API |

## Migration Tasks

### 1. Convert Dependencies
**Resend Email SDK**
- Current: `const { Resend } = require('resend')`
- Edge: Must use HTTP API directly (no Deno SDK)
- Solution: Replace with fetch calls to Resend API

### 2. Update Imports/Exports
- Current: `exports.handler = async (event) => {}`
- Edge: `export default async (request, context) => {}`

### 3. Environment Variables
- Current: `process.env.TALENOX_API_KEY`
- Edge: `Netlify.env.get('TALENOX_API_KEY')`

### 4. Request Handling
- Current: `JSON.parse(event.body)`
- Edge: `await request.json()`

### 5. Response Format
- Current: `return { statusCode: 200, body: JSON.stringify(data) }`
- Edge: `return new Response(JSON.stringify(data), { status: 200 })`

## Potential Downsides & Risks

### 🚨 Critical Issues

1. **No Resend SDK for Deno**
   - Must rewrite email sending with raw HTTP calls
   - More code to maintain
   - Potential for bugs in email formatting

2. **Development Experience**
   - Different local testing setup (`netlify dev` needs Deno)
   - Less familiar Deno debugging tools
   - Harder to find solutions online

3. **Error Handling Differences**
   - Stack traces look different
   - Some Node.js patterns don't work
   - Different async/await behavior in edge cases

### ⚠️ Moderate Concerns

4. **30 Seconds Still Might Not Be Enough**
   - If Talenox API is slow (5+ seconds per call)
   - 4 sequential calls could still timeout
   - No guarantee this solves the problem

5. **Edge Function Limitations**
   - 50MB response size limit
   - No file system access
   - Limited CPU time
   - Cold starts might be slower

6. **Monitoring & Logging**
   - Different log format
   - Less mature tooling
   - Harder to debug production issues

### 💡 Minor Considerations

7. **Future Maintenance**
   - Deno ecosystem is smaller
   - Fewer developers know Deno
   - Potential hiring/handoff challenges

8. **Testing Complexity**
   - Need new test setup for Deno
   - Can't reuse existing Node.js tests
   - Integration tests more complex

## Risk Assessment

### High Risk Items
- **Email functionality rewrite** - Most likely source of bugs
- **Still might timeout** - 30s may not be enough for 4+ API calls
- **Production debugging** - Harder with Edge Functions

### Medium Risk Items  
- **Development velocity** - Slower due to unfamiliar stack
- **Error handling** - Different patterns might miss edge cases

### Low Risk Items
- **Performance** - Should be faster (edge locations)
- **Cost** - Actually cheaper than Functions

## Alternative Quick Wins to Try First

Before migrating to Edge Functions, consider:

1. **Optimize Current Function** (1 hour effort)
   - Make Talenox API calls parallel where possible
   - Cache employee list in memory for 5 minutes
   - Return success immediately, process async

2. **Use Netlify Background Functions** (2 hours effort)
   - 15-minute timeout!
   - Minimal code changes
   - Same Node.js environment

3. **Split into Multiple Functions** (3 hours effort)
   - One function returns immediately
   - Another processes in background
   - Use webhooks to notify completion

## Recommendation

**Try this order:**
1. ❗ First try **Background Functions** - easiest, 15-min timeout
2. If that fails, try **Edge Functions** - moderate effort, 30s timeout  
3. If that fails, go **self-hosted** - most effort, unlimited timeout

## Decision Required

Should I:
A) Start with Background Functions (minimal changes, 15-min timeout)?
B) Proceed with Edge Functions migration (moderate changes, 30s timeout)?
C) Jump straight to self-hosting (most control, unlimited timeout)?

The Background Functions option wasn't mentioned before but might be your best bet - same code, just longer timeout!