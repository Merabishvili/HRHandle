import Image from 'next/image'
import manifest from '@/content/guides/screenshots.json'
import type { Locale } from '@/lib/i18n/locales'

/** Pixel size of every captured shot, per language — written by `npm run guide:screenshots`. */
const SIZES: Partial<Record<Locale, Record<string, number[]>>> = manifest

export function screenshotSrc(locale: Locale, name: string): string {
  return `/guide/screenshots/${locale}/${name}.webp`
}

interface ScreenshotProps {
  /** Language folder to read from — the language the article body is in. */
  locale: Locale
  /** Shot name from `scripts/screenshot-config.ts` (file name without extension). */
  name: string
  alt: string
  caption?: string
}

export function Screenshot({ locale, name, alt, caption }: ScreenshotProps) {
  const src = screenshotSrc(locale, name)
  const [width = 1440, height = 900] = SIZES[locale]?.[name] ?? []
  return (
    <figure className="my-6 space-y-2">
      {/* Opens the full-size image — UI text is small at article width. */}
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-lg border border-border bg-muted/30 shadow-sm"
      >
        <Image src={src} alt={alt} width={width} height={height} className="h-auto w-full" unoptimized />
      </a>
      {caption && <figcaption className="text-center text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  )
}
