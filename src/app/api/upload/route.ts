import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { compressImage } from '@/lib/image-compress';
import { requireAuth } from '@/lib/admin-auth';
import { NextRequest } from 'next/server';

const BUCKET = process.env.EVENT_IMAGES_BUCKET || process.env.NEXT_PUBLIC_EVENT_IMAGES_BUCKET || 'event-images';
const MAX_IMAGE_SIZE_KB = 30;

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req); // Both admins and moderators can upload images
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  try {
    console.log('[upload] start');
    const { data, error } = await supabaseAdmin.storage.listBuckets();
    console.log('buckets', data, error);
     
    const form = await req.formData();
    const file = form.get('file');
    const eventId = form.get('event_id') as string | null;
    const positionRaw = form.get('position') as string | null;
    const position = positionRaw ? parseInt(positionRaw, 10) : 0;
    console.log('[upload] form parsed', { hasFile: file instanceof File, eventId, position });

    if (!(file instanceof File)) {
      console.log('[upload] missing file');
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    // Check bucket exists (do not auto-create to avoid RLS issues)
    console.log('[upload] checking bucket', { bucket: BUCKET });
    const { data: bucketInfo, error: bucketErr } = await supabaseAdmin.storage.getBucket(BUCKET);

    console.log('[upload] getBucket', { bucket: BUCKET, hasBucket: !!bucketInfo, bucketErr: bucketErr?.message });
    if (bucketErr && !bucketInfo) {
      return NextResponse.json({
        error: `Storage bucket "${BUCKET}" not found. Set EVENT_IMAGES_BUCKET or create the bucket in Supabase Storage and try again. (${bucketErr.message})`
      }, { status: 500 });
    }

    // Compress image before upload
    const arrayBuffer = await file.arrayBuffer();
    const compressedBuffer = await compressImage(arrayBuffer, MAX_IMAGE_SIZE_KB);
    
    // Determine file extension and content type
    const originalExt = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const isImage = file.type?.startsWith('image/');
    const fileExt = isImage ? (compressedBuffer.length < arrayBuffer.byteLength ? 'jpg' : originalExt) : originalExt;
    const contentType = isImage ? 'image/jpeg' : (file.type || 'application/octet-stream');
    
    const rand = Math.random().toString(36).slice(2);
    const fileName = `${Date.now()}-${rand}.${fileExt}`;
    const path = eventId ? `${eventId}/${fileName}` : `misc/${fileName}`;
    
    const originalSizeKB = (arrayBuffer.byteLength / 1024).toFixed(2);
    const compressedSizeKB = (compressedBuffer.length / 1024).toFixed(2);
    console.log('[upload] compression', { 
      originalSizeKB, 
      compressedSizeKB, 
      fileName, 
      path, 
      fileType: contentType 
    });

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, new Uint8Array(compressedBuffer), {
        contentType,
        upsert: false,
      });
    if (uploadError) {
      console.error('[upload] uploadError', uploadError.message);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
    const url = publicUrlData.publicUrl;
    console.log('[upload] publicUrl', { url });

    let imageRow = null as any;
    if (eventId) {
      const { data, error } = await supabaseAdmin
        .from('event_images')
        .insert({ event_id: eventId, url, position })
        .select('*')
        .single();
      if (error) {
        console.error('[upload] db insert error', error.message);
        return NextResponse.json({ error: `DB insert failed: ${error.message}`, url }, { status: 500 });
      }
      imageRow = data;
    }

    console.log('[upload] success');
    return NextResponse.json({ url, image: imageRow });
  } catch (e: any) {
    console.error('[upload] exception', e);
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const host = (() => {
      try {
        const u = new URL(process.env.SUPABASE_URL || '');
        return u.host;
      } catch {
        return null;
      }
    })();
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    if (error) {
      return NextResponse.json({ error: error.message, bucket: BUCKET, host }, { status: 500 });
    }
    const names = (buckets || []).map((b: any) => b.id || b.name);
    const exists = names.includes(BUCKET);
    return NextResponse.json({ bucket: BUCKET, exists, buckets: names, host });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal error' }, { status: 500 });
  }
}


