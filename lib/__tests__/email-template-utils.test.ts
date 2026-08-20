import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  applyVariables,
  resolveTemplate,
  defaultTemplate,
  isDefaultTemplateContent,
  isDefaultTemplateContentAnyLocale,
  DEFAULT_TEMPLATES,
  type TemplateType,
} from '@/lib/email-template-utils'

describe('isDefaultTemplateContentAnyLocale', () => {
  it('matches the built-in English default', () => {
    const base = DEFAULT_TEMPLATES.rejection
    expect(isDefaultTemplateContentAnyLocale('rejection', base.subject, base.body)).toBe(true)
    expect(isDefaultTemplateContent('rejection', base.subject, base.body)).toBe(true)
  })

  it('matches a non-English default (ka) that the plain English check misses', () => {
    const ka = defaultTemplate('rejection', 'ka')
    expect(isDefaultTemplateContentAnyLocale('rejection', ka.subject, ka.body)).toBe(true)
    expect(isDefaultTemplateContent('rejection', ka.subject, ka.body)).toBe(false)
  })

  it('is false once the recruiter customizes the content', () => {
    expect(isDefaultTemplateContentAnyLocale('rejection', 'Custom subject', 'Custom body')).toBe(false)
  })
})

// ─── escapeHtml ───────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes & to &amp;', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes < to &lt;', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes > to &gt;', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b')
  })

  it('escapes " to &quot;', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
  })

  it("escapes ' to &#x27;", () => {
    expect(escapeHtml("it's")).toBe("it&#x27;s")
  })

  it('escapes all special chars in one string', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#x27;')
  })

  it('returns plain string unchanged when no special chars', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World')
  })

  it('returns empty string unchanged', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('escapes multiple & occurrences', () => {
    expect(escapeHtml('A & B & C')).toBe('A &amp; B &amp; C')
  })

  it('does not double-escape already-escaped entities', () => {
    // &amp; itself contains & which gets escaped to &amp;amp;
    expect(escapeHtml('&amp;')).toBe('&amp;amp;')
  })

  it('preserves normal alphanumeric and punctuation', () => {
    const safe = 'Hello, World! 123 - test.'
    expect(escapeHtml(safe)).toBe(safe)
  })
})

// ─── applyVariables ───────────────────────────────────────────────────────────

describe('applyVariables', () => {
  it('substitutes a single variable', () => {
    expect(applyVariables('Hello {{name}}', { name: 'Alice' })).toBe('Hello Alice')
  })

  it('substitutes multiple variables', () => {
    expect(applyVariables('{{greeting}} {{name}}!', { greeting: 'Hi', name: 'Bob' })).toBe(
      'Hi Bob!'
    )
  })

  it('substitutes the same variable appearing twice', () => {
    expect(applyVariables('{{a}} and {{a}}', { a: 'x' })).toBe('x and x')
  })

  it('replaces a missing variable with empty string', () => {
    expect(applyVariables('Hello {{name}}', {})).toBe('Hello ')
  })

  it('replaces a variable with empty string value with empty string', () => {
    expect(applyVariables('Hello {{name}}', { name: '' })).toBe('Hello ')
  })

  it('HTML-escapes the substituted value', () => {
    expect(applyVariables('Hello {{name}}', { name: '<script>alert(1)</script>' })).toBe(
      'Hello &lt;script&gt;alert(1)&lt;/script&gt;'
    )
  })

  it('HTML-escapes & in substituted value', () => {
    expect(applyVariables('Company: {{company}}', { company: 'AT&T' })).toBe(
      'Company: AT&amp;T'
    )
  })

  it('HTML-escapes double quotes in substituted value', () => {
    expect(applyVariables('Note: {{note}}', { note: '"quoted"' })).toBe(
      'Note: &quot;quoted&quot;'
    )
  })

  it("HTML-escapes single quotes in substituted value", () => {
    expect(applyVariables('{{msg}}', { msg: "it's here" })).toBe("it&#x27;s here")
  })

  it('returns text unchanged when there are no placeholders', () => {
    expect(applyVariables('No placeholders here', { name: 'Alice' })).toBe(
      'No placeholders here'
    )
  })

  it('returns empty string when text is empty', () => {
    expect(applyVariables('', { name: 'Alice' })).toBe('')
  })

  it('handles multiple missing variables', () => {
    expect(applyVariables('{{a}} {{b}} {{c}}', {})).toBe('  ')
  })

  it('does not substitute partial placeholder syntax (no closing braces)', () => {
    // {{name without closing}} is not a valid placeholder — regex requires }}
    expect(applyVariables('{{name', { name: 'Alice' })).toBe('{{name')
  })

  it('substitutes variable next to other text with no spaces', () => {
    expect(applyVariables('Hi{{name}}!', { name: 'Alice' })).toBe('HiAlice!')
  })

  it('handles vars object with extra keys beyond what the template needs', () => {
    expect(applyVariables('Hello {{name}}', { name: 'Alice', extra: 'ignored' })).toBe(
      'Hello Alice'
    )
  })
})

// ─── resolveTemplate ─────────────────────────────────────────────────────────

describe('resolveTemplate', () => {
  it('returns the saved template when provided', () => {
    const saved = {
      template_type: 'rejection' as TemplateType,
      subject: 'Custom subject',
      body: 'Custom body',
    }
    const result = resolveTemplate(saved, 'rejection')
    expect(result.subject).toBe('Custom subject')
    expect(result.body).toBe('Custom body')
  })

  it('falls back to the default template when saved is null', () => {
    const result = resolveTemplate(null, 'rejection')
    expect(result).toEqual(DEFAULT_TEMPLATES.rejection)
  })

  it('falls back for application_received type', () => {
    const result = resolveTemplate(null, 'application_received')
    expect(result).toEqual(DEFAULT_TEMPLATES.application_received)
  })

  it('falls back for interview_invitation type', () => {
    const result = resolveTemplate(null, 'interview_invitation')
    expect(result).toEqual(DEFAULT_TEMPLATES.interview_invitation)
  })

  it('returned default template has expected template_type field', () => {
    const result = resolveTemplate(null, 'rejection')
    expect(result.template_type).toBe('rejection')
  })
})

// ─── DEFAULT_TEMPLATES ────────────────────────────────────────────────────────

describe('DEFAULT_TEMPLATES', () => {
  const types: TemplateType[] = ['application_received', 'interview_invitation', 'rejection']

  for (const type of types) {
    it(`${type} default template has non-empty subject and body`, () => {
      expect(DEFAULT_TEMPLATES[type].subject.length).toBeGreaterThan(0)
      expect(DEFAULT_TEMPLATES[type].body.length).toBeGreaterThan(0)
    })

    it(`${type} default template has correct template_type field`, () => {
      expect(DEFAULT_TEMPLATES[type].template_type).toBe(type)
    })
  }

  it('rejection default subject contains {{company}} and {{role}} placeholders', () => {
    expect(DEFAULT_TEMPLATES.rejection.subject).toMatch(/\{\{company\}\}/)
    expect(DEFAULT_TEMPLATES.rejection.subject).toMatch(/\{\{role\}\}/)
  })

  it('interview_invitation default subject contains {{role}} and {{company}} placeholders', () => {
    expect(DEFAULT_TEMPLATES.interview_invitation.subject).toMatch(/\{\{role\}\}/)
    expect(DEFAULT_TEMPLATES.interview_invitation.subject).toMatch(/\{\{company\}\}/)
  })
})
