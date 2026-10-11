#!/usr/bin/env node
/**
 * Run a command with .env.local loaded into the environment first.
 *
 *   node scripts/with-env-local.mjs next build
 *
 * `next build` / `next start` load .env.production.local ahead of .env.local,
 * and a local .env.production.local may point at the PRODUCTION database. Next
 * never overrides a variable that is already set, so loading .env.local here
 * keeps a local production build on staging. Used by `npm run guide:serve`.
 */
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { spawn } from 'node:child_process'

const [cmd, ...args] = process.argv.slice(2)
if (!cmd) {
  console.error('usage: node scripts/with-env-local.mjs <command> [args…]')
  process.exit(1)
}
const env = { ...process.env, ...parseEnv(readFileSync('.env.local', 'utf8')) }
const child = spawn(cmd, args, { env, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 1))
