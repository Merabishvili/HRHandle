#!/usr/bin/env node
// PreToolUse guard: asks before anything that could touch the production
// Supabase project or start a local production build against production env.
// See docs/claude-code-workflow.md ("Safety hooks").
import { readFileSync } from 'node:fs'

const PROD_REF = 'fnpyfwhvgzoxgyjafbsg'

let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {
  process.exit(0)
}
const tool = input.tool_name ?? ''
const args = input.tool_input ?? {}

function ask(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: reason,
      },
    }),
  )
  process.exit(0)
}

if (tool === 'Bash') {
  const cmd = String(args.command ?? '')
  if (cmd.includes(PROD_REF)) {
    ask('This command names the PRODUCTION Supabase project. Production changes need the owner\'s explicit approval.')
  }
  if (/\bsupabase\s+(db\s+push|migration\s+up|link)\b/.test(cmd) && !cmd.includes('quotchdymcnjlnwtjmgu')) {
    ask('Supabase CLI write/link without the staging project ref. Make sure this is staging, not production.')
  }
  // next start / next build load .env.production.local (production DB) first.
  if (/\b(next|npm\s+run)\s+start\b/.test(cmd) && !cmd.includes('with-env-local') && !cmd.includes('guide:serve')) {
    ask('`next start` loads .env.production.local, which points at the PRODUCTION database. Use `npm run guide:serve` or `node scripts/with-env-local.mjs …` instead.')
  }
  process.exit(0)
}

// Supabase MCP servers (claude.ai connector or .mcp.json): any write-capable
// call aimed at the production project.
if (/supabase/i.test(tool)) {
  const target = JSON.stringify(args)
  if (target.includes(PROD_REF) && !/__(list_|get_|search_docs)/.test(tool)) {
    ask(`${tool} targets the PRODUCTION Supabase project. Production migrations and SQL need the owner's explicit approval.`)
  }
}
process.exit(0)
