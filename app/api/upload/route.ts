export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const serviceSupabase = createServiceClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ]

  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Only PDF and Word documents are supported' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let extractedText = ''

  try {
    if (file.type === 'application/pdf') {
      const { extractText } = await import('unpdf')
      const { text } = await extractText(new Uint8Array(buffer))
      extractedText = Array.isArray(text) ? text.join('\n') : text
    } else {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value
    }
  } catch {
    return NextResponse.json({ error: 'Failed to parse file' }, { status: 500 })
  }

  // Upload to Supabase storage
  const fileName = `${user.id}/${Date.now()}-${file.name}`
  const { error: uploadError } = await serviceSupabase.storage
    .from('uploads')
    .upload(fileName, buffer, { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }

  const { data: urlData } = serviceSupabase.storage
    .from('uploads')
    .getPublicUrl(fileName)

  // Save to database
  const { data: uploadedFile, error: dbError } = await serviceSupabase
    .from('uploaded_files')
    .insert({
      user_id: user.id,
      file_name: file.name,
      file_url: urlData.publicUrl,
      extracted_text: extractedText,
      extraction_confirmed: false,
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ error: 'Failed to save file record' }, { status: 500 })
  }

  return NextResponse.json({ file: uploadedFile, extractedText })
}
