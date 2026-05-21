import Image from 'next/image'

interface ScreenshotProps {
  src: string
  alt: string
  caption?: string
  width?: number
  height?: number
}

export function Screenshot({ src, alt, caption, width = 1440, height = 900 }: ScreenshotProps) {
  return (
    <figure className="my-6 space-y-2">
      <div className="overflow-hidden rounded-lg border border-border bg-muted/30 shadow-sm">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="h-auto w-full"
          unoptimized
        />
      </div>
      {caption && (
        <figcaption className="text-center text-sm text-muted-foreground">{caption}</figcaption>
      )}
    </figure>
  )
}
