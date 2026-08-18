import { createClient } from '@supabase/supabase-js';
import { Book, StripeSetting } from './api';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://efpyuqiycwciooowuway.supabase.co';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_KGfuUm7wfewla-9GqdIuOg_Q6xdK0dP';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Helper to resolve site_id from book object
export const resolveBookSite = (b: any): string => {
  if (b.site_id && b.site_id !== 'all') return b.site_id;
  if (b.details && b.details.site_id && b.details.site_id !== 'all') return b.details.site_id;
  return 'bookpatr';
};

// 1. Direct Upload of Book EPUB/PDF to Supabase Storage (Bypasses Vercel Serverless Function -> 0 FOT)
export async function uploadBookFileDirect(file: File): Promise<string> {
  const cleanName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  const fileName = `${Date.now()}_${cleanName || 'book.epub'}`;

  const { error } = await supabase.storage
    .from('books')
    .upload(fileName, file, {
      contentType: file.type || 'application/epub+zip',
      upsert: true,
    });

  if (error) {
    console.error('Direct Supabase book upload error:', error);
    throw new Error(`Supabase Book Upload Error: ${error.message}`);
  }

  const { data } = supabase.storage.from('books').getPublicUrl(fileName);
  return data.publicUrl;
}

// 2. Direct Upload of Cover Image to Supabase Storage (Bypasses Vercel Serverless Function -> 0 FOT)
export async function uploadCoverFileDirect(file: File): Promise<string> {
  const cleanName = file.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  const fileName = `${Date.now()}_${cleanName || 'cover.jpg'}`;

  const { error } = await supabase.storage
    .from('covers')
    .upload(fileName, file, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    });

  if (error) {
    console.error('Direct Supabase cover upload error:', error);
    throw new Error(`Supabase Cover Upload Error: ${error.message}`);
  }

  const { data } = supabase.storage.from('covers').getPublicUrl(fileName);
  return data.publicUrl;
}

// 3. Fetch Books directly from Supabase Database
export async function fetchBooksDirect(siteId?: string): Promise<Book[]> {
  let query = supabase
    .from('books')
    .select('*')
    .order('created_at', { ascending: false });

  if (siteId && siteId !== 'all') {
    // Attempt filtered query
    try {
      const { data, error } = await query.eq('site_id', siteId);
      if (!error && data) {
        return data.map((b: any) => ({ ...b, site_id: resolveBookSite(b) }));
      }
    } catch {
      // Fallback if column filtering has issues
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  let books = (data || []).map((b: any) => ({
    ...b,
    site_id: resolveBookSite(b),
  }));

  if (siteId && siteId !== 'all') {
    books = books.filter((b) => b.site_id === siteId);
  }

  return books;
}

// 4. Create Book directly in Supabase Database
export async function createBookDirect(bookData: {
  site_id: string;
  title: string;
  author: string;
  description: string;
  category: string;
  price: string;
  details: any;
  file_url: string;
  cover_url: string;
}): Promise<Book> {
  const payload = {
    ...bookData,
    details: {
      ...(bookData.details || {}),
      site_id: bookData.site_id,
    },
  };

  try {
    const { data, error } = await supabase
      .from('books')
      .insert([payload])
      .select();

    if (error) throw error;
    const item = data[0];
    return { ...item, site_id: resolveBookSite(item) };
  } catch (err: any) {
    // Fallback without site_id column if needed
    const fallbackPayload = { ...payload };
    delete (fallbackPayload as any).site_id;

    const { data, error } = await supabase
      .from('books')
      .insert([fallbackPayload])
      .select();

    if (error) throw error;
    const item = data[0];
    return { ...item, site_id: resolveBookSite(item) };
  }
}

// 5. Update Book directly in Supabase Database
export async function updateBookDirect(
  id: string,
  updateData: {
    site_id?: string;
    title?: string;
    author?: string;
    description?: string;
    category?: string;
    price?: string;
    details?: any;
    file_url?: string;
    cover_url?: string;
  }
): Promise<Book> {
  const payload: any = { ...updateData };
  if (updateData.site_id) {
    payload.details = {
      ...(updateData.details || {}),
      site_id: updateData.site_id,
    };
  }

  try {
    const { data, error } = await supabase
      .from('books')
      .update(payload)
      .eq('id', id)
      .select();

    if (error) throw error;
    const item = data[0];
    return { ...item, site_id: resolveBookSite(item) };
  } catch {
    delete payload.site_id;
    const { data, error } = await supabase
      .from('books')
      .update(payload)
      .eq('id', id)
      .select();

    if (error) throw error;
    const item = data[0];
    return { ...item, site_id: resolveBookSite(item) };
  }
}

// 6. Batch update categories directly in Supabase (Concurrent chunks, 0 Vercel FOT)
export async function batchUpdateCategoriesDirect(
  updates: { id: string; category: string }[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const total = updates.length;
  let completed = 0;
  const chunkSize = 5;

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (u) => {
        await supabase
          .from('books')
          .update({ category: u.category })
          .eq('id', u.id);
        completed++;
        if (onProgress) onProgress(completed, total);
      })
    );
  }
}

// 7. Batch update prices directly in Supabase (Concurrent chunks, 0 Vercel FOT)
export async function batchUpdatePricesDirect(
  updates: { id: string; price: string }[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const total = updates.length;
  let completed = 0;
  const chunkSize = 5;

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (u) => {
        await supabase
          .from('books')
          .update({ price: u.price })
          .eq('id', u.id);
        completed++;
        if (onProgress) onProgress(completed, total);
      })
    );
  }
}

// 8. Delete Single Book directly
export async function deleteBookDirect(id: string): Promise<void> {
  const { error } = await supabase.from('books').delete().eq('id', id);
  if (error) throw error;
}

// 9. Delete Batch Books directly
export async function deleteBatchBooksDirect(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  const { error } = await supabase.from('books').delete().in('id', ids);
  if (error) throw error;
}

// 10. Delete All Books directly (Optionally filtered by site)
export async function deleteAllBooksDirect(siteId?: string): Promise<void> {
  if (!siteId || siteId === 'all') {
    const { error } = await supabase
      .from('books')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    return;
  }

  // Get books for site and delete
  const { data: allBooks, error: fetchErr } = await supabase.from('books').select('*');
  if (fetchErr) throw fetchErr;

  const ids = (allBooks || [])
    .filter((b: any) => resolveBookSite(b) === siteId)
    .map((b: any) => b.id);

  if (ids.length > 0) {
    const { error } = await supabase.from('books').delete().in('id', ids);
    if (error) throw error;
  }
}

// 11. Stripe Settings Direct Operations
export async function fetchStripeSettingsDirect(siteId?: string): Promise<StripeSetting[]> {
  const { data, error } = await supabase
    .from('stripe_settings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  let settings = data || [];

  if (siteId && siteId !== 'all') {
    settings = settings.filter((s: any) => !s.site_id || s.site_id === 'all' || s.site_id === siteId);
  }

  return settings;
}

export async function addStripeSettingDirect(data: {
  site_id?: string;
  account_name: string;
  publishable_key?: string;
  secret_key: string;
  is_active?: boolean;
}): Promise<StripeSetting> {
  const targetSite = data.site_id || 'all';

  if (data.is_active) {
    try {
      await supabase
        .from('stripe_settings')
        .update({ is_active: false })
        .eq('site_id', targetSite);
    } catch {
      await supabase
        .from('stripe_settings')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000');
    }
  }

  const { data: inserted, error } = await supabase
    .from('stripe_settings')
    .insert([
      {
        site_id: targetSite,
        account_name: data.account_name,
        publishable_key: data.publishable_key || '',
        secret_key: data.secret_key,
        is_active: Boolean(data.is_active),
      },
    ])
    .select();

  if (error) throw error;
  return inserted[0];
}

export async function updateStripeSettingDirect(
  id: string,
  data: Partial<StripeSetting>
): Promise<StripeSetting> {
  if (data.is_active && data.site_id) {
    await supabase
      .from('stripe_settings')
      .update({ is_active: false })
      .eq('site_id', data.site_id)
      .neq('id', id);
  }

  const { data: updated, error } = await supabase
    .from('stripe_settings')
    .update(data)
    .eq('id', id)
    .select();

  if (error) throw error;
  return updated[0];
}

export async function activateStripeSettingDirect(id: string, siteId?: string): Promise<StripeSetting> {
  const targetSite = siteId || 'all';

  try {
    await supabase
      .from('stripe_settings')
      .update({ is_active: false })
      .eq('site_id', targetSite);
  } catch {
    await supabase
      .from('stripe_settings')
      .update({ is_active: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { data, error } = await supabase
    .from('stripe_settings')
    .update({ is_active: true })
    .eq('id', id)
    .select();

  if (error) throw error;
  return data[0];
}

export async function deleteStripeSettingDirect(id: string): Promise<void> {
  const { error } = await supabase.from('stripe_settings').delete().eq('id', id);
  if (error) throw error;
}
