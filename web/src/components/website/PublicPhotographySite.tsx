"use client"

import {
  ArrowDown,
  ArrowRight,
  Camera,
  Mail,
  MapPin,
  Phone,
  MessageCircle,
  LockKeyhole,
} from "lucide-react"


type PortfolioItem = {
  id: string
  title: string
  category: string | null
  description: string | null
  image_url: string
}


type PackageItem = {
  id: string
  name: string
  description: string | null
  price_rm: string | null
  price_label: string | null
  features_text: string | null
}


type SiteData = {
  workspace: {
    id: string
    name: string
    slug: string
    domain: string
  }

  settings: {
    display_name: string | null
    tagline: string | null

    logo_url: string | null

    hero_title: string | null
    hero_subtitle: string | null
    hero_image_url: string | null
    hero_cta_text: string | null

    about_title: string | null
    about_text: string | null
    about_image_url: string | null

    contact_email: string | null
    contact_phone: string | null
    location: string | null

    instagram_url: string | null
    facebook_url: string | null
    tiktok_url: string | null

    primary_color: string
    accent_color: string
  }

  portfolio: PortfolioItem[]
  packages: PackageItem[]
  galleries?: {
    id: string
    title: string
    slug: string
    description: string | null
    shoot_date: string | null
    privacy_mode: "PUBLIC" | "PASSWORD"
    price_rm: string | null
    cover_url: string | null
  }[]
}


// WhatsApp needs international digits, without +, spaces or punctuation.
export function whatsappNumber(value: string | null): string | null {
  const input = value?.trim()
  if (!input || !/^\+?[0-9][0-9()\s.-]*$/.test(input)) return null
  let digits = input.replace(/[^0-9]/g, "")
  if (digits.startsWith("00")) digits = digits.slice(2)
  else if (digits.startsWith("0")) digits = `60${digits.slice(1)}`
  return /^[1-9][0-9]{7,14}$/.test(digits) ? digits : null
}

function packagePrice(item: PackageItem): string {
  if (item.price_label && /\bRM\s*\d/i.test(item.price_label)) return item.price_label
  if (item.price_rm !== null) {
    const amount = Number(item.price_rm)
    if (Number.isFinite(amount)) {
      const price = `RM ${amount.toLocaleString("en-MY", {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
      return item.price_label ? `${price} ${item.price_label}` : price
    }
  }
  return item.price_label || "Contact for pricing"
}

export default function PublicPhotographySite({
  site,
}: {
  site: SiteData
}) {
  const { workspace, settings } =
    site

  const primary =
    settings.primary_color ||
    "#073B4C"

  const accent =
    settings.accent_color ||
    "#1CC9D8"

  const brandName =
    settings.display_name ||
    workspace.name


  const galleries = site.galleries ?? []
  const number = whatsappNumber(settings.contact_phone)
  function enquiryLink(packageName?: string) {
    if (!number) return null
    const message = packageName
      ? `Hi ${brandName}, I'm interested in your "${packageName}" package. Could you share availability and details?`
      : `Hi ${brandName}, I'd like to enquire about your photography services.`
    return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
  }
  const whatsappLink = enquiryLink()


  function scrollTo(
    id: string
  ) {
    document
      .getElementById(id)
      ?.scrollIntoView({
        behavior: "smooth",
      })
  }


  return (
    <main className="min-h-screen bg-white text-[#18333C]">

      {/* NAVIGATION */}
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/92 backdrop-blur-xl">

        <div className="mx-auto flex h-[78px] max-w-[1380px] items-center justify-between px-6 lg:px-10">

          <button
            onClick={() =>
              scrollTo("home")
            }
            className="text-left"
          >

            <div
              className="text-xl font-semibold tracking-[-0.035em]"
              style={{
                color: primary,
              }}
            >
              {brandName}
            </div>

            {settings.tagline && (
              <p className="mt-0.5 hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-[#86979C] sm:block">
                {settings.tagline}
              </p>
            )}

          </button>


          <nav className="hidden items-center gap-8 text-xs font-semibold uppercase tracking-[0.1em] text-[#6E8188] md:flex">

            <button
              onClick={() =>
                scrollTo("portfolio")
              }
              className="transition hover:text-[#18333C]"
            >
              Portfolio
            </button>

            <button
              onClick={() =>
                scrollTo("about")
              }
              className="transition hover:text-[#18333C]"
            >
              About
            </button>

            {site.packages.length >
              0 && (
              <button
                onClick={() =>
                  scrollTo("packages")
                }
                className="transition hover:text-[#18333C]"
              >
                Packages
              </button>
            )}

            {galleries.length > 0 && (
              <button type="button" onClick={() => scrollTo("galleries")} className="transition hover:text-[#18333C]">Galleries</button>
            )}

            <button
              onClick={() =>
                scrollTo("contact")
              }
              className="transition hover:text-[#18333C]"
            >
              Contact
            </button>

          </nav>


          <button
            onClick={() =>
              scrollTo("contact")
            }
            className="rounded-full px-5 py-2.5 text-xs font-semibold transition"
            style={{
              backgroundColor:
                primary,
              color: "#ffffff",
            }}
          >
            Get in touch
          </button>

        </div>

      </header>


      {/* HERO */}
      <section
        id="home"
        className="relative flex min-h-[calc(100vh-78px)] items-end overflow-hidden"
        style={{
          backgroundColor: primary,
        }}
      >

        {settings.hero_image_url && (
          <img
            src={
              settings.hero_image_url
            }
            alt={brandName}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}


        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/38 to-black/10" />

        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/10" />


        <div className="relative z-10 mx-auto w-full max-w-[1380px] px-6 pb-16 pt-32 lg:px-10 lg:pb-24">

          <div className="max-w-3xl">

            {settings.tagline && (
              <p
                className="mb-6 text-xs font-bold uppercase tracking-[0.24em]"
                style={{
                  color: accent,
                }}
              >
                {settings.tagline}
              </p>
            )}


            <h1 className="max-w-[850px] text-[50px] font-medium leading-[0.98] tracking-[-0.055em] text-white sm:text-[68px] lg:text-[84px]">

              {settings.hero_title ||
                brandName}

            </h1>


            <p className="mt-7 max-w-xl text-[16px] leading-7 text-white/75">

              {settings.hero_subtitle ||
                "Photography for meaningful moments, beautifully captured and thoughtfully delivered."}

            </p>


            <div className="mt-9 flex flex-wrap gap-3">

              <button
                onClick={() =>
                  scrollTo("portfolio")
                }
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold"
                style={{
                  backgroundColor:
                    accent,
                  color: primary,
                }}
              >

                {settings.hero_cta_text ||
                  "View Portfolio"}

                <ArrowRight className="h-4 w-4" />

              </button>


              <button
                onClick={() =>
                  scrollTo("about")
                }
                className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur"
              >

                Our story

                <ArrowDown className="h-4 w-4" />

              </button>

            </div>

          </div>

        </div>

      </section>


      {/* PORTFOLIO */}
      <section
        id="portfolio"
        className="mx-auto max-w-[1380px] px-6 py-24 lg:px-10 lg:py-32"
      >

        <div className="max-w-xl">

          <p
            className="text-xs font-bold uppercase tracking-[0.2em]"
            style={{
              color: accent,
            }}
          >
            Selected work
          </p>


          <h2
            className="mt-4 text-[42px] font-semibold tracking-[-0.045em] sm:text-[52px]"
            style={{
              color: primary,
            }}
          >
            Stories through our lens.
          </h2>

        </div>


        {site.portfolio.length ===
        0 ? (

          <div className="mt-14 flex min-h-[320px] items-center justify-center rounded-[28px] border border-dashed border-[#D9E4E6] bg-[#F8FAFA]">

            <p className="text-sm text-[#84969D]">
              Portfolio coming soon.
            </p>

          </div>

        ) : (

          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">

            {site.portfolio.map(
              (
                item,
                index
              ) => (
                <article
                  key={item.id}
                  className={`group relative overflow-hidden rounded-[20px] bg-[#EEF2F3] ${
                    index % 5 === 0
                      ? "md:col-span-2 lg:col-span-2"
                      : ""
                  }`}
                >

                  <div
                    className={
                      index % 5 === 0
                        ? "aspect-[16/8]"
                        : "aspect-[4/5]"
                    }
                  >

                    <img
                      src={
                        item.image_url
                      }
                      alt={
                        item.title
                      }
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
                    />

                  </div>


                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-6 opacity-100">

                    <div>

                      <h3 className="text-lg font-semibold text-white">
                        {item.title}
                      </h3>

                      {item.category && (
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/65">
                          {
                            item.category
                          }
                        </p>
                      )}

                    </div>

                  </div>

                </article>
              )
            )}

          </div>

        )}

      </section>


      {/* ABOUT */}
      <section
        id="about"
        className="bg-[#F5F8F8]"
      >

        <div className="mx-auto grid max-w-[1380px] gap-14 px-6 py-24 lg:grid-cols-2 lg:items-center lg:px-10 lg:py-32">

          <div>

            <p
              className="text-xs font-bold uppercase tracking-[0.2em]"
              style={{
                color: accent,
              }}
            >
              Behind the camera
            </p>


            <h2
              className="mt-4 text-[42px] font-semibold leading-[1.04] tracking-[-0.045em]"
              style={{
                color: primary,
              }}
            >

              {settings.about_title ||
                "About"}

            </h2>


            <p className="mt-7 max-w-xl whitespace-pre-line text-[15px] leading-8 text-[#637980]">

              {settings.about_text ||
                "Every photograph carries a story. Share yours here and introduce the perspective behind your photography."}

            </p>

          </div>


          <div className="overflow-hidden rounded-[28px] bg-[#E7EDEF]">

            {settings.about_image_url ? (

              <img
                src={
                  settings.about_image_url
                }
                alt="Photographer"
                className="aspect-[4/3] h-full w-full object-cover"
              />

            ) : (

              <div className="flex aspect-[4/3] items-center justify-center">

                <Camera className="h-10 w-10 text-[#A2B1B5]" />

              </div>

            )}

          </div>

        </div>

      </section>


      {/* PACKAGES */}
      {site.packages.length >
        0 && (
        <section
          id="packages"
          className="mx-auto max-w-[1380px] px-6 py-24 lg:px-10 lg:py-32"
        >

          <p
            className="text-xs font-bold uppercase tracking-[0.2em]"
            style={{
              color: accent,
            }}
          >
            Photography services
          </p>


          <h2
            className="mt-4 max-w-xl text-[42px] font-semibold tracking-[-0.045em]"
            style={{
              color: primary,
            }}
          >
            Find the right experience for your story.
          </h2>


          <div className="mt-14 grid gap-5 lg:grid-cols-3">

            {site.packages.map(
              (
                packageItem,
                index
              ) => (
                <article
                  key={
                    packageItem.id
                  }
                  className={`rounded-[24px] border p-7 ${
                    index === 0
                      ? "border-transparent text-white"
                      : "border-[#DFE7E9] bg-white"
                  }`}
                  style={
                    index === 0
                      ? {
                          backgroundColor:
                            primary,
                        }
                      : undefined
                  }
                >

                  <p
                    className={`text-xs font-bold uppercase tracking-[0.14em] ${
                      index === 0
                        ? "text-white/55"
                        : "text-[#84979D]"
                    }`}
                  >
                    Package{" "}
                    {index + 1}
                  </p>


                  <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">
                    {
                      packageItem.name
                    }
                  </h3>


                  {packageItem.description && (
                    <p
                      className={`mt-4 text-sm leading-6 ${
                        index === 0
                          ? "text-white/65"
                          : "text-[#6E838A]"
                      }`}
                    >
                      {
                        packageItem.description
                      }
                    </p>
                  )}


                  <p className="mt-7 text-2xl font-semibold">

                    {packagePrice(packageItem)}

                  </p>


                  {packageItem.features_text && (
                    <div
                      className={`mt-6 whitespace-pre-line border-t pt-6 text-sm leading-7 ${
                        index === 0
                          ? "border-white/15 text-white/70"
                          : "border-[#E7EDEE] text-[#71858C]"
                      }`}
                    >
                      {
                        packageItem.features_text
                      }
                    </div>
                  )}

                  {number ? (
                    <a href={enquiryLink(packageItem.name)!} target="_blank" rel="noopener noreferrer"
                      className={`mt-7 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${index === 0 ? "bg-white text-[#18333C] hover:bg-white/90" : "bg-[#F0F6F6] text-[#18333C] hover:bg-[#E3EEEE]"}`}>
                      <MessageCircle className="h-4 w-4" /> Enquire on WhatsApp
                    </a>
                  ) : (
                    <button type="button" onClick={() => scrollTo("contact")}
                      className="mt-7 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4">
                      Enquire about this package <ArrowRight className="h-4 w-4" />
                    </button>
                  )}

                </article>
              )
            )}

          </div>

        </section>
      )}


      {galleries.length > 0 && (
        <section id="galleries" className="mx-auto max-w-[1380px] px-6 py-24 lg:px-10 lg:py-32">
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{color: accent}}>Client galleries</p>
          <h2 className="mt-4 text-[42px] font-semibold tracking-[-0.045em]" style={{color: primary}}>Explore our galleries.</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {galleries.map(gallery => {
              const href = `/site/${encodeURIComponent(workspace.slug)}/gallery/${encodeURIComponent(gallery.slug)}`
              const enquiry = number ? `https://wa.me/${number}?text=${encodeURIComponent(`Hi ${brandName}, I'm interested in the full "${gallery.title}" gallery. Could you share the details?`)}` : null
              return (
                <article key={gallery.id} className="overflow-hidden rounded-[24px] border border-[#DFE7E9] bg-white">
                  <a href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset" aria-label={`View ${gallery.title}`}>
                    {gallery.privacy_mode === "PUBLIC" && gallery.cover_url ? (
                      <img src={gallery.cover_url} alt={gallery.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                    ) : (
                      <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-[#F0F5F5] text-[#648088]">
                        {gallery.privacy_mode === "PASSWORD" ? <LockKeyhole className="h-8 w-8" /> : <Camera className="h-8 w-8" />}
                        <span className="text-xs font-semibold">{gallery.privacy_mode === "PASSWORD" ? "Password-protected gallery" : "Client gallery"}</span>
                      </div>
                    )}
                  </a>
                  <div className="p-6">
                    <h3 className="text-xl font-semibold tracking-tight" style={{color: primary}}>{gallery.title}</h3>
                    {gallery.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#6E838A]">{gallery.description}</p>}
                    <p className="mt-5 text-lg font-semibold" style={{color: primary}}>
                      {gallery.price_rm !== null ? `RM ${Number(gallery.price_rm).toLocaleString("en-MY", {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : "Enquire for pricing"}
                    </p>
                    {gallery.price_rm !== null && <p className="mt-1 text-xs text-[#84979D]">Full gallery</p>}
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                      <a href={href} className="inline-flex items-center gap-2 text-sm font-semibold" style={{color: primary}}>View gallery <ArrowRight className="h-4 w-4" /></a>
                      {enquiry ? (
                        <a href={enquiry} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#F0F6F6] px-4 py-2 text-sm font-semibold text-[#18333C]"><MessageCircle className="h-4 w-4" />Enquire</a>
                      ) : (
                        <button type="button" onClick={() => scrollTo("contact")} className="text-sm font-semibold underline underline-offset-4">Enquire</button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {/* CONTACT */}
      <section
        id="contact"
        style={{
          backgroundColor: primary,
        }}
      >

        <div className="mx-auto max-w-[1380px] px-6 py-24 text-white lg:px-10 lg:py-28">

          <div className="grid gap-16 lg:grid-cols-[1fr_0.7fr]">

            <div>

              <p
                className="text-xs font-bold uppercase tracking-[0.2em]"
                style={{
                  color: accent,
                }}
              >
                Contact
              </p>


              <h2 className="mt-4 max-w-xl text-[46px] font-semibold leading-[1.03] tracking-[-0.045em]">

                Let&apos;s create something meaningful.

              </h2>

            </div>


            <div className="space-y-5">

              {whatsappLink && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#18333C] transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  <MessageCircle className="h-5 w-5" /> Chat on WhatsApp
                </a>
              )}

              {settings.contact_email && (
                <ContactRow
                  icon={Mail}
                  label="Email"
                  value={
                    settings.contact_email
                  }
                />
              )}

              {settings.contact_phone && (
                <ContactRow
                  icon={Phone}
                  label="Phone"
                  value={
                    settings.contact_phone
                  }
                />
              )}

              {settings.location && (
                <ContactRow
                  icon={MapPin}
                  label="Based in"
                  value={
                    settings.location
                  }
                />
              )}

            </div>

          </div>


          <div className="mt-20 flex flex-col gap-4 border-t border-white/10 pt-7 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">

            <p>
              © {new Date().getFullYear()}{" "}
              {brandName}
            </p>

            <p>
              Powered by EZFOTOO
            </p>

          </div>

        </div>

      </section>

    </main>
  )
}


function ContactRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
  label: string
  value: string
}) {
  return (
    <div className="flex gap-4">

      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/5">

        <Icon className="h-5 w-5 text-white/75" />

      </div>


      <div>

        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {label}
        </p>

        <p className="mt-1 font-semibold text-white">
          {value}
        </p>

      </div>

    </div>
  )
}