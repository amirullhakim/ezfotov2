import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "EZFOTOO",
    template: "%s | EZFOTOO",
  },
  description:
    "The photography business platform for galleries, event photo sales, AI search and branded photographer websites.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}