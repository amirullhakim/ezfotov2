import { createClient } from "@/lib/supabase/client"


const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://127.0.0.1:8000"


export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error("Authentication required.")
  }

  const headers = new Headers(init.headers)

  headers.set(
    "Authorization",
    `Bearer ${session.access_token}`
  )

  if (init.body && !headers.has("Content-Type")) {
    headers.set(
      "Content-Type",
      "application/json"
    )
  }

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...init,
      headers,
    }
  )

  if (!response.ok) {
    let message = `Request failed (${response.status}).`

    try {
      const body = await response.json()

      if (typeof body.detail === "string") {
        message = body.detail
      } else if (body.detail) {
        message = JSON.stringify(body.detail)
      }
    } catch {
      // Keep default message.
    }

    throw new Error(message)
  }

  return response.json()
}