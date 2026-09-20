import PublicEventGallery from "@/components/public-events/PublicEventGallery"


export default async function PublicEventPage({
  params,
}: {
  params: Promise<{
    slug: string
    eventSlug: string
  }>
}) {
  const {
    slug,
    eventSlug,
  } = await params


  return (
    <PublicEventGallery
      workspaceSlug={
        slug
      }
      eventSlug={
        eventSlug
      }
    />
  )
}