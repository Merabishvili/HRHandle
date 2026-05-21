import type { MDXComponents } from 'mdx/types'
import { Screenshot } from './screenshot'

export const guideMdxComponents: MDXComponents = {
  Screenshot,
  h1: ({ children }) => (
    <h1 className="mb-4 mt-8 text-3xl font-bold tracking-tight text-foreground">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-8 text-xl font-semibold text-foreground">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-6 text-lg font-semibold text-foreground">{children}</h3>
  ),
  p: ({ children }) => <p className="mb-4 leading-7 text-foreground/90">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 ml-6 list-disc space-y-1 text-foreground/90">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal space-y-1 text-foreground/90">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{children}</code>
  ),
  hr: () => <hr className="my-8 border-border" />,
  table: ({ children }) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border last:border-0">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-3 py-2 align-top text-foreground/90">{children}</td>,
}
