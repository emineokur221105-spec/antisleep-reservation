const IG_URL = "https://www.instagram.com/antisleepclubtaipei/";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="font-mono text-sm tracking-widest text-foreground">
            anti sleep <span className="text-foreground-muted">™</span>
          </div>
          <a
            href={IG_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-foreground px-4 py-1.5 text-xs uppercase tracking-widest transition hover:bg-foreground hover:text-background"
          >
            IG DM 訂位
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-32">
        {/* Subtle grid background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative z-10 max-w-3xl text-center">
          <p className="mb-8 font-mono text-xs uppercase tracking-[0.3em] text-foreground-muted">
            Taipei · est. 2024
          </p>
          <h1 className="text-6xl font-light leading-none tracking-tight md:text-8xl">
            anti
            <br />
            sleep
            <span className="ml-3 align-top text-2xl text-foreground-muted md:text-4xl">
              ™
            </span>
          </h1>
          <p className="mt-10 text-base text-foreground-muted md:text-lg">
            一間不讓你入睡的酒吧
          </p>
          <a
            href={IG_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-12 inline-flex items-center gap-3 rounded-full bg-accent px-8 py-3 text-sm font-medium uppercase tracking-widest text-background transition hover:opacity-90"
          >
            IG DM 訂位 <span aria-hidden>→</span>
          </a>
        </div>
      </section>

      {/* Tonight / Announcement */}
      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-[200px_1fr]">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-foreground-muted">
              Tonight
            </p>
            <div>
              <h2 className="text-2xl font-light leading-snug md:text-3xl">
                Jazz Night・週六 21:00
              </h2>
              <p className="mt-4 max-w-xl text-foreground-muted">
                本週六由 trio 帶來一晚輕盈的藍調與 standards。座位有限，建議線上預約。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Menu */}
      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-[200px_1fr]">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-foreground-muted">
              Menu
            </p>
            <div>
              <h2 className="mb-10 text-2xl font-light leading-snug md:text-3xl">
                Signature Cocktails
              </h2>
              <div className="grid gap-px bg-border md:grid-cols-2">
                {SIGNATURES.map((item) => (
                  <div
                    key={item.name}
                    className="bg-background p-8 transition hover:bg-background-elevated"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <h3 className="font-mono text-sm uppercase tracking-widest">
                        {item.name}
                      </h3>
                      <span className="font-mono text-sm text-accent">
                        NT$ {item.price}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
              <a
                href="#"
                className="mt-8 inline-flex items-center gap-2 text-xs uppercase tracking-widest text-foreground-muted hover:text-foreground"
              >
                完整酒單 <span aria-hidden>↓</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Visit */}
      <section className="border-t border-border px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 md:grid-cols-[200px_1fr]">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-foreground-muted">
              Visit
            </p>
            <div className="grid gap-12 md:grid-cols-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-foreground-muted">
                  Hours
                </p>
                <p className="mt-3 leading-relaxed">
                  Tue – Sun
                  <br />
                  20:00 – 02:00
                  <br />
                  <span className="text-foreground-muted">週一公休</span>
                </p>
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-foreground-muted">
                  Address
                </p>
                <p className="mt-3 leading-relaxed">
                  台北市 ──
                  <br />
                  <span className="text-foreground-muted">
                    （等朋友提供）
                  </span>
                </p>
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-widest text-foreground-muted">
                  Follow
                </p>
                <a
                  href="https://www.instagram.com/antisleepclubtaipei/"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block transition hover:text-accent"
                >
                  @antisleepclubtaipei
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-xs text-foreground-muted">
          <p className="font-mono">© 2026 anti sleep ™ Club</p>
          <p className="font-mono">Taipei</p>
        </div>
      </footer>
    </div>
  );
}

const SIGNATURES = [
  {
    name: "Negroni Rouge",
    price: 380,
    desc: "Campari, Bordeaux Reserve, Sweet Vermouth",
  },
  {
    name: "Smoke & Velvet",
    price: 420,
    desc: "Mezcal, Cocoa Bitter, Aged Rum",
  },
  {
    name: "Midnight Garden",
    price: 360,
    desc: "Gin, Elderflower, Cucumber, Lime",
  },
  {
    name: "After Hours",
    price: 400,
    desc: "Bourbon, Black Tea, Honey, Smoke",
  },
];
