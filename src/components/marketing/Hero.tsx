import Image from 'next/image';
import { ButtonLink } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

export function Hero({
  image,
  eyebrow,
  title,
  lede,
  primaryAction,
  secondaryAction,
}: {
  image: { url: string; alt: string };
  eyebrow?: string;
  title: string;
  lede: string;
  primaryAction: { href: string; label: string };
  secondaryAction?: { href: string; label: string };
}) {
  return (
    <section className="relative flex min-h-[88svh] items-end overflow-hidden">
      <Image
        src={image.url}
        alt={image.alt}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* Two stacked scrims: a soft top wash so the transparent header stays
          legible, and a heavier foot so the headline holds over any photograph. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

      <Container size="wide" className="relative z-10 pb-20 pt-32 sm:pb-24">
        <div className="max-w-2xl animate-rise">
          {eyebrow ? (
            <p className="mb-5 text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-white/70">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="display text-[clamp(2.5rem,6.5vw,4.5rem)] text-white">{title}</h1>
          <p className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-white/85">{lede}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink
              href={primaryAction.href}
              size="lg"
              className="bg-white text-[var(--color-ink)] hover:bg-white/90"
            >
              {primaryAction.label}
            </ButtonLink>
            {secondaryAction ? (
              <ButtonLink
                href={secondaryAction.href}
                size="lg"
                variant="secondary"
                className="border-white/40 bg-white/5 text-white backdrop-blur-sm hover:border-white hover:bg-white/10"
              >
                {secondaryAction.label}
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
