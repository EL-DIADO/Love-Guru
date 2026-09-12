import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'

type AIRequestBody = {
  mode?: string
  message?: string
  image?: string | null
}

function extractMediaTypeAndData(dataUrl: string) {
  // Expected format: "data:image/png;base64,AAAA..."
  const match = /^data:(image\/[a-zA-Z+.-]+);base64,(.+)$/.exec(dataUrl)

  if (!match) return null

  return {
    mediaType: match[1],
    base64: match[2],
  }
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Server is missing ANTHROPIC_API_KEY. Add it to your environment variables.',
        },
        { status: 500 },
      )
    }

    const body: AIRequestBody = await req.json()
    const { message, image } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'No message provided.' },
        { status: 400 },
      )
    }

    const contentBlocks: Record<string, unknown>[] = []

    if (image) {
      const parsedImage = extractMediaTypeAndData(image)

      if (!parsedImage) {
        return NextResponse.json(
          { success: false, error: 'Unsupported image format.' },
          { status: 400 },
        )
      }

      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: parsedImage.mediaType,
          data: parsedImage.base64,
        },
      })
    }

    contentBlocks.push({
      type: 'text',
      text: message,
    })

    const response = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: contentBlocks,
          },
        ],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      const errorMessage =
        data?.error?.message || `Anthropic API request failed (${response.status}).`

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: response.status },
      )
    }

    const textBlock = Array.isArray(data.content)
      ? data.content.find((block: { type: string }) => block.type === 'text')
      : null

    if (!textBlock || typeof textBlock.text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Love Guru returned an empty response.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true, reply: textBlock.text })
  } catch (error) {
    console.error('LOVE GURU /api/ai ERROR:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected server error while contacting Love Guru AI.',
      },
      { status: 500 },
    )
  }
}
