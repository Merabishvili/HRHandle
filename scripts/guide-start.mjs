#!/usr/bin/env node
/**
 * Start the built app for guide screenshots (`npm run guide:serve`).
 *
 * Runs `next start -p 3123` through with-env-local.mjs (staging, never the
 * production database) and preloads guide-mocks/calendly-api.mjs, which answers
 * Calendly's API for the demo organizations' token only. Calendly also needs
 * its OAuth app to count as configured — placeholder values are set here when
 * the environment has none (no OAuth round-trip happens in the walkthroughs).
 */
import { spawn } from 'node:child_process'
import { delimiter, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const mock = pathToFileURL(resolve('scripts/guide-mocks/calendly-api.mjs')).href
const env = {
  ...process.env,
  // `next` resolves when run directly too, not only from an npm script.
  PATH: `${resolve('node_modules/.bin')}${delimiter}${process.env.PATH ?? ''}`,
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import ${mock}`.trim(),
  CALENDLY_CLIENT_ID: process.env.CALENDLY_CLIENT_ID || 'guide-demo',
  CALENDLY_CLIENT_SECRET: process.env.CALENDLY_CLIENT_SECRET || 'guide-demo',
}
const child = spawn('node', ['scripts/with-env-local.mjs', 'next', 'start', '-p', '3123'], { env, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 1))
