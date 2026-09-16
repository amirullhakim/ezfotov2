import Link from "next/link"

import {
  ArrowRight,
  Bot,
  Camera,
  Check,
  GalleryHorizontalEnd,
  Globe2,
  Images,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react"


const services = [
  {
    icon: Globe2,
    title: "Photographer Website",
    description:
      "Build a professional photography website under your own brand, with your portfolio, packages and contact details.",
    status: "Available now",
  },
  {
    icon: GalleryHorizontalEnd,
    title: "Client Galleries",
    description:
      "Deliver beautiful private galleries where clients can view, favourite and download their photographs.",
    status: "Coming next",
  },
  {
    icon: ShoppingBag,
    title: "Event Photo Sales",
    description:
      "Upload event photography and let customers discover and purchase the photos that matter to them.",
    status: "Coming soon",
  },
]


const highlights = [
  {
    icon: Search,
    title: "AI-powered discovery",
    description:
      "Help event customers find their photos using bib numbers and intelligent face search.",
  },
  {
    icon: Images,
    title: "One media workspace",
    description:
      "Manage your website, galleries and event photography from one organised platform.",
  },
  {
    icon: ShieldCheck,
    title: "Built for your brand",
    description:
      "Your photography stays at the centre while EZFOTOO works quietly behind the scenes.",
  },
]


export default function Home() {
  return (
    <main className="min-h-screen bg-[#F7FAFB] text-[#112D38]">

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-[#E3ECEF]/80 bg-white/90 backdrop-blur-xl">

        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between px-5 sm:px-8">

          <Link
            href="/"
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#073B4C] shadow-sm">
              <Camera className="h-5 w-5 text-[#47C6CE]" />
            </div>

            <div>
              <p className="text-lg font-extrabold tracking-[-0.04em] text-[#073B4C]">
                EZFOTOO
              </p>

              <p className="text-[8px] font-bold uppercase tracking-[0.28em] text-[#789098]">
                Capture · Share · Grow
              </p>
            </div>
          </Link>


          <nav className="hidden items-center gap-7 md:flex">

            <a
              href="#platform"
              className="text-sm font-semibold text-[#58717A] transition hover:text-[#073B4C]"
            >
              Platform
            </a>

            <a
              href="#features"
              className="text-sm font-semibold text-[#58717A] transition hover:text-[#073B4C]"
            >
              Features
            </a>

            <a
              href="#how-it-works"
              className="text-sm font-semibold text-[#58717A] transition hover:text-[#073B4C]"
            >
              How it works
            </a>

          </nav>


          <div className="flex items-center gap-2">

            <Link
              href="https://app.ezfotoo.com/login"
              className="hidden h-10 items-center rounded-xl px-4 text-sm font-semibold text-[#36545D] transition hover:bg-[#F1F6F7] sm:flex"
            >
              Sign in
            </Link>

            <Link
              href="https://app.ezfotoo.com/register"
              className="flex h-10 items-center gap-2 rounded-xl bg-[#073B4C] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B5363]"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>

          </div>

        </div>

      </header>


      {/* HERO */}
      <section className="relative overflow-hidden border-b border-[#E4ECEE]">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(28,201,216,0.13),transparent_32%),radial-gradient(circle_at_20%_80%,rgba(7,59,76,0.07),transparent_35%)]" />


        <div className="relative mx-auto grid max-w-[1240px] gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:py-28">

          <div>

            <div className="inline-flex items-center gap-2 rounded-full border border-[#BFE7EA] bg-[#EAF9FA] px-4 py-2 text-xs font-bold text-[#087F8C]">

              <Sparkles className="h-4 w-4" />

              Built for modern photographers

            </div>


            <h1 className="mt-7 max-w-[760px] text-[46px] font-extrabold leading-[1.04] tracking-[-0.055em] text-[#0A303B] sm:text-[58px] lg:text-[68px]">

              Your photography business,

              <span className="block text-[#1AAEBC]">
                beautifully connected.
              </span>

            </h1>


            <p className="mt-7 max-w-[680px] text-base leading-8 text-[#607981] sm:text-lg">

              Build your brand, deliver client galleries and sell event photos with intelligent photo discovery — all from one professional photography platform.

            </p>


            <div className="mt-9 flex flex-col gap-3 sm:flex-row">

              <Link
                href="https://app.ezfotoo.com/register"
                className="flex h-13 items-center justify-center gap-2 rounded-xl bg-[#073B4C] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(7,59,76,0.18)] transition hover:-translate-y-0.5 hover:bg-[#0B5363]"
              >
                Start with EZFOTOO
                <ArrowRight className="h-4 w-4" />
              </Link>


              <Link
                href="https://app.ezfotoo.com/login"
                className="flex h-13 items-center justify-center gap-2 rounded-xl border border-[#D7E3E6] bg-white px-6 py-3.5 text-sm font-semibold text-[#36545D] transition hover:border-[#AFD7DB] hover:bg-[#F9FCFC]"
              >
                Photographer login
              </Link>

            </div>


            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3">

              {[
                "Professional website",
                "Cloud photo management",
                "AI-ready platform",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 text-xs font-semibold text-[#6A8088]"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DFF7F8]">
                    <Check className="h-3 w-3 text-[#0B8D99]" />
                  </div>

                  {item}
                </div>
              ))}

            </div>

          </div>


          {/* PRODUCT PREVIEW */}
          <div className="relative">

            <div className="absolute -inset-5 rounded-[36px] bg-[#1CC9D8]/10 blur-3xl" />


            <div className="relative overflow-hidden rounded-[30px] border border-[#DCE7E9] bg-white p-3 shadow-[0_35px_90px_rgba(7,59,76,0.14)]">

              <div className="overflow-hidden rounded-[22px] bg-[#F5F9FA]">

                <div className="flex items-center justify-between border-b border-[#E3EBED] bg-white px-5 py-4">

                  <div className="flex items-center gap-3">

                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#073B4C]">
                      <Camera className="h-4 w-4 text-[#47C6CE]" />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-[#24444D]">
                        Photography Workspace
                      </p>

                      <p className="text-[10px] text-[#8A9BA1]">
                        Everything in one place
                      </p>
                    </div>

                  </div>


                  <div className="rounded-full bg-[#E4F6F0] px-3 py-1 text-[10px] font-bold text-[#198064]">
                    LIVE
                  </div>

                </div>


                <div className="grid gap-3 p-5 sm:grid-cols-2">

                  <ProductCard
                    icon={Globe2}
                    title="Website"
                    text="Build your brand"
                  />

                  <ProductCard
                    icon={GalleryHorizontalEnd}
                    title="Client Gallery"
                    text="Deliver beautifully"
                  />

                  <ProductCard
                    icon={ShoppingBag}
                    title="Event Sales"
                    text="Sell your photos"
                  />

                  <ProductCard
                    icon={Bot}
                    title="AI Studio"
                    text="Work smarter"
                  />

                </div>


                <div className="mx-5 mb-5 rounded-2xl bg-[#073B4C] p-5 text-white">

                  <div className="flex items-start justify-between gap-4">

                    <div>

                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#69D8E1]">
                        Your photography platform
                      </p>

                      <p className="mt-2 max-w-xs text-lg font-semibold tracking-[-0.025em]">
                        One workspace. Your brand. Your business.
                      </p>

                    </div>


                    <Zap className="h-6 w-6 text-[#47C6CE]" />

                  </div>

                </div>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* PLATFORM */}
      <section
        id="platform"
        className="bg-white py-20 sm:py-24"
      >

        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">

          <div className="mx-auto max-w-[690px] text-center">

            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0A98A5]">
              One photography platform
            </p>

            <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em] text-[#123540] sm:text-4xl">
              Everything your photography business needs.
            </h2>

            <p className="mt-5 text-base leading-7 text-[#6A8088]">
              Start with the tools you need today and grow into one connected workspace for your entire photography business.
            </p>

          </div>


          <div className="mt-14 grid gap-5 lg:grid-cols-3">

            {services.map((service) => {

              const Icon = service.icon

              return (
                <div
                  key={service.title}
                  className="group rounded-[24px] border border-[#E1EAEC] bg-[#FBFDFD] p-7 transition duration-300 hover:-translate-y-1 hover:border-[#B9DDE1] hover:bg-white hover:shadow-[0_20px_55px_rgba(7,59,76,0.08)]"
                >

                  <div className="flex items-start justify-between gap-4">

                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E5F7F8] text-[#0A929F]">
                      <Icon className="h-5 w-5" />
                    </div>


                    <span className="rounded-full border border-[#DDE9EB] bg-white px-3 py-1 text-[10px] font-bold text-[#789098]">
                      {service.status}
                    </span>

                  </div>


                  <h3 className="mt-6 text-xl font-semibold tracking-[-0.025em] text-[#23444D]">
                    {service.title}
                  </h3>


                  <p className="mt-3 text-sm leading-7 text-[#71878E]">
                    {service.description}
                  </p>

                </div>
              )
            })}

          </div>

        </div>

      </section>


      {/* FEATURES */}
      <section
        id="features"
        className="border-y border-[#E2EAEC] bg-[#F3F8F9] py-20 sm:py-24"
      >

        <div className="mx-auto grid max-w-[1240px] gap-14 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">

          <div>

            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0A98A5]">
              Built differently
            </p>


            <h2 className="mt-4 text-3xl font-bold leading-tight tracking-[-0.04em] text-[#123540] sm:text-4xl">
              Let the technology work behind your photography.
            </h2>


            <p className="mt-5 max-w-xl text-base leading-8 text-[#687F87]">
              EZFOTOO is designed so photographers spend less time managing scattered tools and more time creating, delivering and growing their business.
            </p>

          </div>


          <div className="grid gap-4">

            {highlights.map((item) => {

              const Icon = item.icon

              return (
                <div
                  key={item.title}
                  className="flex gap-5 rounded-2xl border border-[#DDE8EA] bg-white p-6 shadow-sm"
                >

                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8F8F9] text-[#0A929F]">
                    <Icon className="h-5 w-5" />
                  </div>


                  <div>

                    <h3 className="font-semibold text-[#294A53]">
                      {item.title}
                    </h3>


                    <p className="mt-2 text-sm leading-6 text-[#748990]">
                      {item.description}
                    </p>

                  </div>

                </div>
              )
            })}

          </div>

        </div>

      </section>


      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="bg-white py-20 sm:py-24"
      >

        <div className="mx-auto max-w-[1240px] px-5 sm:px-8">

          <div className="text-center">

            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0A98A5]">
              Simple from day one
            </p>

            <h2 className="mt-4 text-3xl font-bold tracking-[-0.04em] text-[#123540] sm:text-4xl">
              From photographer to professional platform.
            </h2>

          </div>


          <div className="mt-14 grid gap-5 md:grid-cols-3">

            <Step
              number="01"
              title="Create your workspace"
              description="Set up your photography brand and choose the services your business needs."
            />

            <Step
              number="02"
              title="Build your presence"
              description="Create your website, upload your work and organise everything from one dashboard."
            />

            <Step
              number="03"
              title="Share and grow"
              description="Publish, deliver and sell photography through your own branded experience."
            />

          </div>

        </div>

      </section>


      {/* CTA */}
      <section className="px-5 pb-20 sm:px-8 sm:pb-24">

        <div className="mx-auto max-w-[1240px] overflow-hidden rounded-[30px] bg-[#073B4C]">

          <div className="relative px-7 py-14 text-center sm:px-12 sm:py-16">

            <div className="absolute left-1/2 top-0 h-[260px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1CC9D8]/15 blur-[90px]" />


            <div className="relative">

              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#61D6E0]">
                Your photography. Your platform.
              </p>


              <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-[-0.04em] text-white sm:text-4xl">
                Build a better photography business with EZFOTOO.
              </h2>


              <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#B8D3D9] sm:text-base">
                Start building your professional photography presence today and unlock more tools as your business grows.
              </p>


              <div className="mt-8 flex justify-center">

                <Link
                  href="https://app.ezfotoo.com/register"
                  className="flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-[#073B4C] shadow-lg transition hover:-translate-y-0.5"
                >
                  Create your workspace

                  <ArrowRight className="h-4 w-4" />
                </Link>

              </div>

            </div>

          </div>

        </div>

      </section>


      {/* FOOTER */}
      <footer className="border-t border-[#E2EAEC] bg-white">

        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#073B4C]">
              <Camera className="h-4 w-4 text-[#47C6CE]" />
            </div>

            <div>
              <p className="text-sm font-bold text-[#173943]">
                EZFOTOO
              </p>

              <p className="text-[10px] text-[#8A9BA1]">
                Capture · Share · Grow
              </p>
            </div>

          </div>


          <p className="text-xs text-[#82959B]">
            © 2026 EZFOTOO. Built for photographers.
          </p>


          <div className="flex items-center gap-5">

            <Link
              href="https://app.ezfotoo.com/login"
              className="text-xs font-semibold text-[#647C84] hover:text-[#073B4C]"
            >
              Sign in
            </Link>

            <Link
              href="https://app.ezfotoo.com/register"
              className="text-xs font-semibold text-[#0A929F]"
            >
              Get started
            </Link>

          </div>

        </div>

      </footer>

    </main>
  )
}


function ProductCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Globe2
  title: string
  text: string
}) {
  return (
    <div className="rounded-2xl border border-[#E1EAEC] bg-white p-4">

      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF8F9] text-[#0A929F]">
        <Icon className="h-4 w-4" />
      </div>

      <p className="mt-4 text-sm font-semibold text-[#294A53]">
        {title}
      </p>

      <p className="mt-1 text-xs text-[#899A9F]">
        {text}
      </p>

    </div>
  )
}


function Step({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-[22px] border border-[#E2EAEC] bg-[#FAFCFC] p-7">

      <p className="text-xs font-extrabold tracking-[0.12em] text-[#0A9BA8]">
        {number}
      </p>

      <h3 className="mt-5 text-lg font-semibold tracking-[-0.025em] text-[#294A53]">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-7 text-[#72878E]">
        {description}
      </p>

    </div>
  )
}