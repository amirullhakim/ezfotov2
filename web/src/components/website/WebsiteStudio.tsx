"use client"

import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  Globe2,
  Loader2,
  Palette,
  Save,
  Sparkles,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  FormEvent,
  useEffect,
  useState,
} from "react"

import WebsitePreview, {
  PreviewSettings,
} from "@/components/website/WebsitePreview"
import { apiFetch } from "@/lib/api"


type WebsiteSettingsResponse =
  PreviewSettings & {
    id: string
    is_published: boolean
    template_key: string
  }


type PortfolioItem = {
  id: string
  title: string
  category: string | null
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


const emptySettings: WebsiteSettingsResponse = {
  id: "",
  display_name: "",
  tagline: "",
  hero_title: "",
  hero_subtitle: "",
  hero_image_url: "",
  hero_cta_text: "View Portfolio",

  about_title: "About",
  about_text: "",
  about_image_url: "",

  contact_email: "",
  contact_phone: "",
  location: "",
  instagram_url: "",

  primary_color: "#073B4C",
  accent_color: "#1CC9D8",

  template_key: "SIGNATURE",
  is_published: false,
}


export default function WebsiteStudio() {
  const router = useRouter()

  const [settings, setSettings] =
    useState<WebsiteSettingsResponse>(
      emptySettings
    )

  const [portfolio, setPortfolio] =
    useState<PortfolioItem[]>([])

  const [packages, setPackages] =
    useState<PackageItem[]>([])

  const [loading, setLoading] =
    useState(true)

  const [saving, setSaving] =
    useState(false)

  const [status, setStatus] =
    useState("")


  useEffect(() => {
    async function load() {
      try {
        const [
          settingsResult,
          portfolioResult,
          packageResult,
        ] = await Promise.all([
          apiFetch<WebsiteSettingsResponse>(
            "/api/website/settings"
          ),

          apiFetch<{
            items: PortfolioItem[]
          }>("/api/website/portfolio"),

          apiFetch<{
            packages: PackageItem[]
          }>("/api/website/packages"),
        ])

        setSettings({
          ...emptySettings,
          ...settingsResult,
        })

        setPortfolio(
          portfolioResult.items
        )

        setPackages(
          packageResult.packages
        )

      } catch (error) {
        setStatus(
          error instanceof Error
            ? error.message
            : "Unable to load website."
        )

      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])


  function updateField(
    key: keyof WebsiteSettingsResponse,
    value: string | boolean
  ) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }))
  }


  async function saveSettings(
    event?: FormEvent
  ) {
    event?.preventDefault()

    setSaving(true)
    setStatus("")

    try {
      const updated =
        await apiFetch<WebsiteSettingsResponse>(
          "/api/website/settings",
          {
            method: "PUT",
            body: JSON.stringify({
              display_name:
                settings.display_name,

              tagline:
                settings.tagline,

              logo_url: null,
              favicon_url: null,

              hero_title:
                settings.hero_title,

              hero_subtitle:
                settings.hero_subtitle,

              hero_image_url:
                settings.hero_image_url,

              hero_cta_text:
                settings.hero_cta_text,

              about_title:
                settings.about_title,

              about_text:
                settings.about_text,

              about_image_url:
                settings.about_image_url,

              contact_email:
                settings.contact_email,

              contact_phone:
                settings.contact_phone,

              location:
                settings.location,

              instagram_url:
                settings.instagram_url,

              facebook_url: null,
              tiktok_url: null,

              primary_color:
                settings.primary_color,

              accent_color:
                settings.accent_color,

              template_key:
                settings.template_key,

              is_published:
                settings.is_published,
            }),
          }
        )

      setSettings({
        ...emptySettings,
        ...updated,
      })

      setStatus("Website saved.")

    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to save website."
      )

    } finally {
      setSaving(false)
    }
  }


  async function togglePublished() {
    const nextPublished =
      !settings.is_published

    setSettings((current) => ({
      ...current,
      is_published: nextPublished,
    }))

    setSaving(true)

    try {
      const updated =
        await apiFetch<WebsiteSettingsResponse>(
          "/api/website/settings",
          {
            method: "PUT",
            body: JSON.stringify({
              ...settings,
              is_published:
                nextPublished,
            }),
          }
        )

      setSettings({
        ...emptySettings,
        ...updated,
      })

      setStatus(
        nextPublished
          ? "Website published."
          : "Website unpublished."
      )

    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Unable to update publishing status."
      )

    } finally {
      setSaving(false)
    }
  }


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F9FA]">

        <div className="flex items-center gap-3 text-sm font-semibold text-[#58717A]">
          <Loader2 className="h-5 w-5 animate-spin text-[#0BA5B4]" />
          Loading Website Studio...
        </div>

      </div>
    )
  }


  return (
    <main className="min-h-screen bg-[#F4F8F9]">

      <header className="sticky top-0 z-30 border-b border-[#DFE8EA] bg-white/95 backdrop-blur">

        <div className="flex min-h-[76px] items-center justify-between px-5 lg:px-8">

          <div className="flex items-center gap-4">

            <button
              onClick={() =>
                router.push("/dashboard")
              }
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E1EAEC] bg-white text-[#58717A] transition hover:bg-[#F4F8F9]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>

            <div>
              <div className="flex items-center gap-2">

                <Globe2 className="h-4 w-4 text-[#0A99A7]" />

                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#0A8D99]">
                  Photographer Website
                </p>

              </div>

              <h1 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-[#183A44]">
                Website Studio
              </h1>
            </div>

          </div>


          <div className="flex items-center gap-3">

            {status && (
              <div className="hidden items-center gap-2 text-xs font-semibold text-[#658087] md:flex">

                <CheckCircle2 className="h-4 w-4 text-[#1B9B72]" />

                {status}

              </div>
            )}


            <button
              onClick={() =>
                saveSettings()
              }
              disabled={saving}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#DCE7E9] bg-white px-4 text-sm font-semibold text-[#36545D] transition hover:bg-[#F7FAFB]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}

              Save
            </button>


            <button
              onClick={togglePublished}
              disabled={saving}
              className={`flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                settings.is_published
                  ? "bg-[#E3F5EF] text-[#187D62]"
                  : "bg-[#073B4C] text-white hover:bg-[#0B5363]"
              }`}
            >
              {settings.is_published
                ? "Published"
                : "Publish"}
            </button>

          </div>

        </div>

      </header>


      <div className="grid min-h-[calc(100vh-76px)] xl:grid-cols-[520px_1fr]">

        <section className="border-r border-[#DFE8EA] bg-white">

          <form
            onSubmit={saveSettings}
            className="space-y-9 p-6 lg:p-8"
          >

            <SectionHeader
              eyebrow="Brand"
              title="Your photography identity"
              description="Set the name and short message customers will associate with your brand."
            />


            <Field
              label="Display name"
              value={settings.display_name}
              placeholder="Mirul Photography"
              onChange={(value) =>
                updateField(
                  "display_name",
                  value
                )
              }
            />

            <Field
              label="Tagline"
              value={settings.tagline}
              placeholder="Stories, beautifully captured."
              onChange={(value) =>
                updateField(
                  "tagline",
                  value
                )
              }
            />


            <Divider />


            <SectionHeader
              eyebrow="Home"
              title="Hero section"
              description="Create the first impression visitors see when they open your website."
            />


            <Field
              label="Headline"
              value={settings.hero_title}
              placeholder="Moments that stay with you."
              onChange={(value) =>
                updateField(
                  "hero_title",
                  value
                )
              }
            />

            <TextArea
              label="Introduction"
              value={settings.hero_subtitle}
              placeholder="Tell visitors what you photograph and what makes your approach special."
              onChange={(value) =>
                updateField(
                  "hero_subtitle",
                  value
                )
              }
            />

            <Field
              label="Hero image URL"
              value={settings.hero_image_url}
              placeholder="https://..."
              onChange={(value) =>
                updateField(
                  "hero_image_url",
                  value
                )
              }
              helper="Temporary during development. Proper image upload comes next."
            />

            <Field
              label="Button text"
              value={settings.hero_cta_text}
              placeholder="View Portfolio"
              onChange={(value) =>
                updateField(
                  "hero_cta_text",
                  value
                )
              }
            />


            <Divider />


            <SectionHeader
              eyebrow="About"
              title="Tell your story"
              description="Introduce the person and perspective behind the camera."
            />

            <Field
              label="Section title"
              value={settings.about_title}
              placeholder="About Me"
              onChange={(value) =>
                updateField(
                  "about_title",
                  value
                )
              }
            />

            <TextArea
              label="About text"
              value={settings.about_text}
              placeholder="Share your photography story..."
              onChange={(value) =>
                updateField(
                  "about_text",
                  value
                )
              }
            />

            <Field
              label="About image URL"
              value={settings.about_image_url}
              placeholder="https://..."
              onChange={(value) =>
                updateField(
                  "about_image_url",
                  value
                )
              }
            />


            <Divider />


            <SectionHeader
              eyebrow="Contact"
              title="Make it easy to connect"
              description="Show customers how they can reach you."
            />

            <Field
              label="Email"
              value={settings.contact_email}
              placeholder="hello@mirulphotography.com"
              onChange={(value) =>
                updateField(
                  "contact_email",
                  value
                )
              }
            />

            <Field
              label="Phone"
              value={settings.contact_phone}
              placeholder="+60 12-345 6789"
              onChange={(value) =>
                updateField(
                  "contact_phone",
                  value
                )
              }
            />

            <Field
              label="Location"
              value={settings.location}
              placeholder="Kuala Lumpur, Malaysia"
              onChange={(value) =>
                updateField(
                  "location",
                  value
                )
              }
            />

            <Field
              label="Instagram URL"
              value={settings.instagram_url}
              placeholder="https://instagram.com/..."
              onChange={(value) =>
                updateField(
                  "instagram_url",
                  value
                )
              }
            />


            <Divider />


            <SectionHeader
              eyebrow="Style"
              title="Website colours"
              description="Keep the site aligned with your photography brand."
            />


            <div className="grid grid-cols-2 gap-4">

              <ColorField
                label="Primary"
                value={settings.primary_color}
                onChange={(value) =>
                  updateField(
                    "primary_color",
                    value
                  )
                }
              />

              <ColorField
                label="Accent"
                value={settings.accent_color}
                onChange={(value) =>
                  updateField(
                    "accent_color",
                    value
                  )
                }
              />

            </div>


            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#073B4C] font-semibold text-white transition hover:bg-[#0B5363]"
            >
              <Save className="h-4 w-4" />
              Save Website
            </button>

          </form>

        </section>


        <section className="bg-[#EFF4F5]">

          <div className="sticky top-[76px] p-6 lg:p-10">

            <div className="mx-auto max-w-[880px]">

              <div className="mb-4 flex items-center justify-between">

                <div>

                  <div className="flex items-center gap-2">

                    <Eye className="h-4 w-4 text-[#0A99A7]" />

                    <p className="text-xs font-bold uppercase tracking-[0.13em] text-[#71868D]">
                      Live Preview
                    </p>

                  </div>

                  <p className="mt-1 text-xs text-[#8A9BA1]">
                    Changes appear here before publishing.
                  </p>

                </div>


                <div className="flex items-center gap-2 rounded-full border border-[#DCE6E8] bg-white px-3 py-1.5 text-xs font-semibold text-[#658087]">

                  <Sparkles className="h-3.5 w-3.5 text-[#0BA3B1]" />

                  Signature Template

                </div>

              </div>


              <WebsitePreview
                settings={settings}
                portfolio={portfolio}
                packages={packages}
              />

            </div>

          </div>

        </section>

      </div>

    </main>
  )
}


function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div>

      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0A929F]">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[#173943]">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-[#768B92]">
        {description}
      </p>

    </div>
  )
}


function Field({
  label,
  value,
  placeholder,
  onChange,
  helper,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
  helper?: string
}) {
  return (
    <div>

      <label className="mb-2 block text-sm font-semibold text-[#36535C]">
        {label}
      </label>

      <input
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="h-12 w-full rounded-xl border border-[#DCE6E8] bg-white px-4 text-sm text-[#203F48] outline-none transition placeholder:text-[#A4B2B7] focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
      />

      {helper && (
        <p className="mt-2 text-xs leading-5 text-[#8C9BA0]">
          {helper}
        </p>
      )}

    </div>
  )
}


function TextArea({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <div>

      <label className="mb-2 block text-sm font-semibold text-[#36535C]">
        {label}
      </label>

      <textarea
        value={value ?? ""}
        placeholder={placeholder}
        rows={5}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full resize-none rounded-xl border border-[#DCE6E8] bg-white px-4 py-3 text-sm leading-6 text-[#203F48] outline-none transition placeholder:text-[#A4B2B7] focus:border-[#2CC3D0] focus:ring-4 focus:ring-[#1CC9D8]/10"
      />

    </div>
  )
}


function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>

      <label className="mb-2 block text-sm font-semibold text-[#36535C]">
        {label}
      </label>

      <div className="flex h-12 items-center gap-3 rounded-xl border border-[#DCE6E8] bg-white px-3">

        <input
          type="color"
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          className="h-7 w-8 cursor-pointer border-0 bg-transparent"
        />

        <span className="text-xs font-semibold uppercase text-[#607981]">
          {value}
        </span>

        <Palette className="ml-auto h-4 w-4 text-[#91A1A6]" />

      </div>

    </div>
  )
}


function Divider() {
  return (
    <div className="border-t border-[#E9EFF0]" />
  )
}