"use client"

import {
  ArrowRight,
  Camera,
  Mail,
  MapPin,
} from "lucide-react"


export type PreviewSettings = {
  display_name: string
  tagline: string
  hero_title: string
  hero_subtitle: string
  hero_image_url: string
  hero_cta_text: string

  about_title: string
  about_text: string
  about_image_url: string

  contact_email: string
  contact_phone: string
  location: string

  instagram_url: string

  primary_color: string
  accent_color: string
}


type PreviewPortfolio = {
  id: string
  title: string
  category?: string | null
  image_url: string
}


type PreviewPackage = {
  id: string
  name: string
  description?: string | null
  price_rm?: string | number | null
  price_label?: string | null
  features_text?: string | null
}


export default function WebsitePreview({
  settings,
  portfolio,
  packages,
}: {
  settings: PreviewSettings
  portfolio: PreviewPortfolio[]
  packages: PreviewPackage[]
}) {
  const primary =
    settings.primary_color || "#073B4C"

  const accent =
    settings.accent_color || "#1CC9D8"


  return (
    <div className="overflow-hidden rounded-[20px] border border-[#DCE7EA] bg-white shadow-[0_24px_70px_rgba(7,59,76,0.09)]">

      {/* Browser Bar */}
      <div className="border-b border-[#E8EEF0] bg-[#F7FAFB] px-4 py-3">

        <div className="flex items-center gap-2">

          <span className="h-2.5 w-2.5 rounded-full bg-[#D9E2E5]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#D9E2E5]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#D9E2E5]" />

          <div className="ml-3 flex-1 rounded-lg border border-[#E2EAEC] bg-white px-3 py-1.5 text-center text-[10px] text-[#85969C]">
            photographer.ezfotoo.com
          </div>

        </div>

      </div>


      <div className="max-h-[760px] overflow-y-auto">

        {/* Navigation */}
        <nav className="flex items-center justify-between px-7 py-5">

          <div
            className="font-semibold tracking-[-0.03em]"
            style={{
              color: primary,
            }}
          >
            {settings.display_name ||
              "Your Photography"}
          </div>


          <div className="hidden gap-5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#71868D] sm:flex">

            <span>Portfolio</span>
            <span>About</span>
            <span>Packages</span>
            <span>Contact</span>

          </div>

        </nav>


        {/* Hero */}
        <section
          className="relative min-h-[350px] overflow-hidden px-8 py-14"
          style={{
            backgroundColor: primary,
          }}
        >

          {settings.hero_image_url && (
            <>
              <img
                src={settings.hero_image_url}
                alt="Hero"
                className="absolute inset-0 h-full w-full object-cover"
              />

              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(0,0,0,.66), rgba(0,0,0,.18))",
                }}
              />
            </>
          )}


          <div className="relative z-10 max-w-[470px]">

            {settings.tagline && (
              <p
                className="mb-4 text-[10px] font-bold uppercase tracking-[0.22em]"
                style={{
                  color: accent,
                }}
              >
                {settings.tagline}
              </p>
            )}


            <h1 className="text-[36px] font-medium leading-[1.06] tracking-[-0.045em] text-white">

              {settings.hero_title ||
                "Stories worth remembering."}

            </h1>


            <p className="mt-5 max-w-md text-[13px] leading-6 text-white/75">

              {settings.hero_subtitle ||
                "Timeless photography for meaningful moments, beautifully captured and thoughtfully delivered."}

            </p>


            <button
              type="button"
              className="mt-7 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold"
              style={{
                backgroundColor: accent,
                color: primary,
              }}
            >

              {settings.hero_cta_text ||
                "View Portfolio"}

              <ArrowRight className="h-3.5 w-3.5" />

            </button>

          </div>

        </section>


        {/* Portfolio */}
        <section className="px-7 py-11">

          <p
            className="text-[9px] font-bold uppercase tracking-[0.18em]"
            style={{
              color: accent,
            }}
          >
            Selected work
          </p>


          <h2
            className="mt-2 text-[25px] font-semibold tracking-[-0.035em]"
            style={{
              color: primary,
            }}
          >
            Portfolio
          </h2>


          {portfolio.length === 0 ? (

            <div className="mt-6 flex min-h-[170px] items-center justify-center rounded-xl border border-dashed border-[#DCE7EA] bg-[#FAFCFC] text-xs text-[#8A9BA1]">

              Portfolio photos will appear here.

            </div>

          ) : (

            <div className="mt-6 grid grid-cols-2 gap-2">

              {portfolio
                .slice(0, 6)
                .map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-[4/3] overflow-hidden rounded-lg"
                  >

                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />


                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/55 via-transparent to-transparent p-3">

                      <div>

                        <p className="text-xs font-semibold text-white">
                          {item.title}
                        </p>


                        {item.category && (
                          <p className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-white/70">

                            {item.category}

                          </p>
                        )}

                      </div>

                    </div>

                  </div>
                ))}

            </div>

          )}

        </section>


        {/* About */}
        <section className="grid gap-7 bg-[#F7FAFB] px-7 py-11 sm:grid-cols-2">

          <div>

            <p
              className="text-[9px] font-bold uppercase tracking-[0.18em]"
              style={{
                color: accent,
              }}
            >
              The photographer
            </p>


            <h2
              className="mt-2 text-[25px] font-semibold tracking-[-0.035em]"
              style={{
                color: primary,
              }}
            >

              {settings.about_title ||
                "About"}

            </h2>


            <p className="mt-4 text-[12px] leading-6 text-[#6A7E86]">

              {settings.about_text ||
                "Share the story behind your photography, your approach and what makes your work meaningful."}

            </p>

          </div>


          <div className="overflow-hidden rounded-xl bg-[#E6EEF0]">

            {settings.about_image_url ? (

              <img
                src={settings.about_image_url}
                alt="About photographer"
                className="h-full min-h-[180px] w-full object-cover"
              />

            ) : (

              <div className="flex min-h-[180px] items-center justify-center text-xs text-[#8A9BA1]">

                About photo

              </div>

            )}

          </div>

        </section>


        {/* Packages */}
        {packages.length > 0 && (
          <section className="px-7 py-11">

            <p
              className="text-[9px] font-bold uppercase tracking-[0.18em]"
              style={{
                color: accent,
              }}
            >
              Services
            </p>


            <h2
              className="mt-2 text-[25px] font-semibold tracking-[-0.035em]"
              style={{
                color: primary,
              }}
            >
              Photography Packages
            </h2>


            <div className="mt-6 grid gap-3 sm:grid-cols-2">

              {packages.map(
                (packageItem) => (
                  <div
                    key={packageItem.id}
                    className="rounded-xl border border-[#E3EAEC] p-5"
                  >

                    <h3
                      className="font-semibold"
                      style={{
                        color: primary,
                      }}
                    >
                      {packageItem.name}
                    </h3>


                    {packageItem.description && (
                      <p className="mt-2 text-[11px] leading-5 text-[#71858C]">

                        {packageItem.description}

                      </p>
                    )}


                    <p
                      className="mt-4 text-lg font-semibold"
                      style={{
                        color: primary,
                      }}
                    >

                      {packageItem.price_rm
                        ? `RM ${packageItem.price_rm}`
                        : packageItem.price_label ||
                          "Contact for pricing"}

                    </p>


                    {packageItem.features_text && (
                      <p className="mt-3 whitespace-pre-line text-[10px] leading-5 text-[#84969D]">

                        {packageItem.features_text}

                      </p>
                    )}

                  </div>
                )
              )}

            </div>

          </section>
        )}


        {/* Footer / Contact */}
        <footer
          className="px-7 py-10 text-white"
          style={{
            backgroundColor: primary,
          }}
        >

          <h2 className="text-xl font-semibold">

            Let&apos;s create something meaningful.

          </h2>


          <div className="mt-5 space-y-2 text-[11px] text-white/70">

            {settings.contact_email && (
              <div className="flex items-center gap-2">

                <Mail className="h-3.5 w-3.5" />

                {settings.contact_email}

              </div>
            )}


            {settings.contact_phone && (
              <div className="flex items-center gap-2">

                <Camera className="h-3.5 w-3.5" />

                {settings.contact_phone}

              </div>
            )}


            {settings.location && (
              <div className="flex items-center gap-2">

                <MapPin className="h-3.5 w-3.5" />

                {settings.location}

              </div>
            )}


            {settings.instagram_url && (
              <div className="flex items-center gap-2">

                <Camera className="h-3.5 w-3.5" />

                Instagram

              </div>
            )}

          </div>


          <div className="mt-8 border-t border-white/10 pt-5">

            <p className="text-[9px] uppercase tracking-[0.16em] text-white/40">

              Powered by EZFOTOO

            </p>

          </div>

        </footer>

      </div>

    </div>
  )
}