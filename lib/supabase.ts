import { createClient } from '@supabase/supabase-js';
import { Book, StripeSetting, PayPalSetting } from './api';

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

// Helper to parse and extract site_id and clean display name from a stripe setting
export function parseStripeSetting(r: any): StripeSetting {
  if (!r) return r;
  let site_id = r.site_id;
  let cleanName = r.account_name || '';

  // Extract [site_id] prefix from account_name if present
  const match = r.account_name && r.account_name.match(/^\[([a-zA-Z0-9_\-]+)\]\s*(.*)$/);
  if (match) {
    site_id = match[1];
    cleanName = match[2] || r.account_name;
  } else if (!site_id) {
    site_id = 'bookpatr'; // default legacy records to bookpatr
  }

  return {
    ...r,
    site_id: (site_id || 'bookpatr').toLowerCase().trim(),
    account_name: cleanName,
  };
}

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
  } catch {
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

// 11. Stripe Settings Direct Operations (Site-Isolated Multi-Tenant)
export async function fetchStripeSettingsDirect(siteId?: string): Promise<StripeSetting[]> {
  const { data, error } = await supabase
    .from('stripe_settings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  let settings = (data || []).map(parseStripeSetting);

  if (siteId && siteId !== 'all') {
    settings = settings.filter((s: any) => s.site_id === 'all' || s.site_id === siteId.toLowerCase().trim());
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
  const targetSite = (data.site_id || 'all').toLowerCase().trim();
  const cleanName = data.account_name.replace(/^\[[a-zA-Z0-9_\-]+\]\s*/, '').trim();
  const formattedAccountName = `[${targetSite}] ${cleanName}`;

  if (data.is_active) {
    const { data: allData } = await supabase.from('stripe_settings').select('*');
    if (allData) {
      const toDeactivate = allData
        .map(parseStripeSetting)
        .filter((s: any) => s.site_id === targetSite && s.is_active)
        .map((s: any) => s.id);
      if (toDeactivate.length > 0) {
        await supabase.from('stripe_settings').update({ is_active: false }).in('id', toDeactivate);
      }
    }
  }

  const insertPayload = {
    account_name: formattedAccountName,
    publishable_key: data.publishable_key || '',
    secret_key: data.secret_key,
    is_active: Boolean(data.is_active),
  };

  let inserted: any = null;
  try {
    const { data: res, error } = await supabase
      .from('stripe_settings')
      .insert([{ ...insertPayload, site_id: targetSite }])
      .select();
    if (error) throw error;
    inserted = res;
  } catch {
    const { data: res, error } = await supabase
      .from('stripe_settings')
      .insert([insertPayload])
      .select();
    if (error) throw error;
    inserted = res;
  }

  return parseStripeSetting(inserted[0]);
}

export async function updateStripeSettingDirect(
  id: string,
  data: Partial<StripeSetting>
): Promise<StripeSetting> {
  const { data: currentRecord } = await supabase.from('stripe_settings').select('*').eq('id', id).single();
  const currentParsed = parseStripeSetting(currentRecord);

  const targetSite = (data.site_id || currentParsed?.site_id || 'all').toLowerCase().trim();
  const cleanName = (data.account_name !== undefined ? data.account_name : currentParsed?.account_name || '')
    .replace(/^\[[a-zA-Z0-9_\-]+\]\s*/, '').trim();
  const formattedAccountName = `[${targetSite}] ${cleanName}`;

  const updateFields: any = {
    account_name: formattedAccountName,
  };
  if (data.publishable_key !== undefined) updateFields.publishable_key = data.publishable_key;
  if (data.secret_key !== undefined) updateFields.secret_key = data.secret_key;
  if (data.is_active !== undefined) updateFields.is_active = data.is_active;

  if (data.is_active) {
    const { data: allData } = await supabase.from('stripe_settings').select('*');
    if (allData) {
      const toDeactivate = allData
        .map(parseStripeSetting)
        .filter((s: any) => s.id !== id && s.site_id === targetSite && s.is_active)
        .map((s: any) => s.id);
      if (toDeactivate.length > 0) {
        await supabase.from('stripe_settings').update({ is_active: false }).in('id', toDeactivate);
      }
    }
  }

  let updated: any = null;
  try {
    const { data: res, error } = await supabase
      .from('stripe_settings')
      .update({ ...updateFields, site_id: targetSite })
      .eq('id', id)
      .select();
    if (error) throw error;
    updated = res;
  } catch {
    const { data: res, error } = await supabase
      .from('stripe_settings')
      .update(updateFields)
      .eq('id', id)
      .select();
    if (error) throw error;
    updated = res;
  }

  return parseStripeSetting(updated[0]);
}

export async function activateStripeSettingDirect(id: string, siteId?: string): Promise<StripeSetting> {
  const { data: targetRecord } = await supabase.from('stripe_settings').select('*').eq('id', id).single();
  const parsed = parseStripeSetting(targetRecord);
  const targetSite = (siteId || parsed.site_id || 'all').toLowerCase().trim();

  // Deactivate other accounts belonging to this site only
  const { data: allData } = await supabase.from('stripe_settings').select('*');
  if (allData) {
    const toDeactivate = allData
      .map(parseStripeSetting)
      .filter((s: any) => s.id !== id && s.site_id === targetSite && s.is_active)
      .map((s: any) => s.id);
    if (toDeactivate.length > 0) {
      await supabase.from('stripe_settings').update({ is_active: false }).in('id', toDeactivate);
    }
  }

  const { data, error } = await supabase
    .from('stripe_settings')
    .update({ is_active: true })
    .eq('id', id)
    .select();

  if (error) throw error;
  return parseStripeSetting(data[0]);
}

export async function deleteStripeSettingDirect(id: string): Promise<void> {
  const { error } = await supabase.from('stripe_settings').delete().eq('id', id);
  if (error) throw error;
}

// 12. Helper to parse and extract site_id and clean display name from a paypal setting
export function parsePayPalSetting(r: any): PayPalSetting {
  if (!r) return r;
  let site_id = r.site_id;
  let cleanName = r.account_name || '';

  // Extract [site_id] prefix from account_name if present
  const match = r.account_name && r.account_name.match(/^\[([a-zA-Z0-9_\-]+)\]\s*(.*)$/);
  if (match) {
    site_id = match[1];
    cleanName = match[2] || r.account_name;
  } else if (!site_id) {
    site_id = 'bookpatr';
  }

  return {
    ...r,
    site_id: (site_id || 'bookpatr').toLowerCase().trim(),
    account_name: cleanName,
    mode: (r.mode || 'live').toLowerCase().trim(),
  };
}

// 13. PayPal Settings Direct Operations (Site-Isolated Multi-Tenant)
export async function fetchPayPalSettingsDirect(siteId?: string): Promise<PayPalSetting[]> {
  const { data, error } = await supabase
    .from('paypal_settings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  let settings = (data || []).map(parsePayPalSetting);

  if (siteId && siteId !== 'all') {
    settings = settings.filter((s: any) => s.site_id === 'all' || s.site_id === siteId.toLowerCase().trim());
  }

  return settings;
}

export async function addPayPalSettingDirect(data: {
  site_id?: string;
  account_name: string;
  client_id: string;
  client_secret: string;
  mode?: 'live' | 'sandbox';
  is_active?: boolean;
}): Promise<PayPalSetting> {
  const targetSite = (data.site_id || 'all').toLowerCase().trim();
  const cleanName = data.account_name.replace(/^\[[a-zA-Z0-9_\-]+\]\s*/, '').trim();
  const formattedAccountName = `[${targetSite}] ${cleanName}`;

  if (data.is_active) {
    const { data: allData } = await supabase.from('paypal_settings').select('*');
    if (allData) {
      const toDeactivate = allData
        .map(parsePayPalSetting)
        .filter((s: any) => s.site_id === targetSite && s.is_active)
        .map((s: any) => s.id);
      if (toDeactivate.length > 0) {
        await supabase.from('paypal_settings').update({ is_active: false }).in('id', toDeactivate);
      }
    }
  }

  const insertPayload = {
    account_name: formattedAccountName,
    client_id: data.client_id.trim(),
    client_secret: data.client_secret.trim(),
    mode: (data.mode || 'live').toLowerCase().trim(),
    is_active: Boolean(data.is_active),
  };

  let inserted: any = null;
  try {
    const { data: res, error } = await supabase
      .from('paypal_settings')
      .insert([{ ...insertPayload, site_id: targetSite }])
      .select();
    if (error) throw error;
    inserted = res;
  } catch {
    const { data: res, error } = await supabase
      .from('paypal_settings')
      .insert([insertPayload])
      .select();
    if (error) throw error;
    inserted = res;
  }

  return parsePayPalSetting(inserted[0]);
}

export async function updatePayPalSettingDirect(
  id: string,
  data: Partial<PayPalSetting>
): Promise<PayPalSetting> {
  const { data: currentRecord } = await supabase.from('paypal_settings').select('*').eq('id', id).single();
  const currentParsed = parsePayPalSetting(currentRecord);

  const targetSite = (data.site_id || currentParsed?.site_id || 'all').toLowerCase().trim();
  const cleanName = (data.account_name !== undefined ? data.account_name : currentParsed?.account_name || '')
    .replace(/^\[[a-zA-Z0-9_\-]+\]\s*/, '').trim();
  const formattedAccountName = `[${targetSite}] ${cleanName}`;

  const updateFields: any = {
    account_name: formattedAccountName,
  };
  if (data.client_id !== undefined) updateFields.client_id = data.client_id.trim();
  if (data.client_secret !== undefined) updateFields.client_secret = data.client_secret.trim();
  if (data.mode !== undefined) updateFields.mode = data.mode.toLowerCase().trim();
  if (data.is_active !== undefined) updateFields.is_active = data.is_active;

  if (data.is_active) {
    const { data: allData } = await supabase.from('paypal_settings').select('*');
    if (allData) {
      const toDeactivate = allData
        .map(parsePayPalSetting)
        .filter((s: any) => s.id !== id && s.site_id === targetSite && s.is_active)
        .map((s: any) => s.id);
      if (toDeactivate.length > 0) {
        await supabase.from('paypal_settings').update({ is_active: false }).in('id', toDeactivate);
      }
    }
  }

  let updated: any = null;
  try {
    const { data: res, error } = await supabase
      .from('paypal_settings')
      .update({ ...updateFields, site_id: targetSite })
      .eq('id', id)
      .select();
    if (error) throw error;
    updated = res;
  } catch {
    const { data: res, error } = await supabase
      .from('paypal_settings')
      .update(updateFields)
      .eq('id', id)
      .select();
    if (error) throw error;
    updated = res;
  }

  return parsePayPalSetting(updated[0]);
}

export async function activatePayPalSettingDirect(id: string, siteId?: string): Promise<PayPalSetting> {
  const { data: targetRecord } = await supabase.from('paypal_settings').select('*').eq('id', id).single();
  const parsed = parsePayPalSetting(targetRecord);
  const targetSite = (siteId || parsed.site_id || 'all').toLowerCase().trim();

  // Deactivate other accounts belonging to this site only
  const { data: allData } = await supabase.from('paypal_settings').select('*');
  if (allData) {
    const toDeactivate = allData
      .map(parsePayPalSetting)
      .filter((s: any) => s.id !== id && s.site_id === targetSite && s.is_active)
      .map((s: any) => s.id);
    if (toDeactivate.length > 0) {
      await supabase.from('paypal_settings').update({ is_active: false }).in('id', toDeactivate);
    }
  }

  const { data, error } = await supabase
    .from('paypal_settings')
    .update({ is_active: true })
    .eq('id', id)
    .select();

  if (error) throw error;
  return parsePayPalSetting(data[0]);
}

export async function deletePayPalSettingDirect(id: string): Promise<void> {
  const { error } = await supabase.from('paypal_settings').delete().eq('id', id);
  if (error) throw error;
}

// ==========================================
// SUPPORT TICKETS / INQUIRIES
// ==========================================
export async function fetchSupportTicketsDirect(site?: string): Promise<any[]> {
  let query = supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
  if (site && site !== 'all') {
    query = query.eq('site_id', site);
  }
  const { data, error } = await query;
  if (error) {
    console.warn('fetchSupportTicketsDirect notice:', error.message);
    return [];
  }
  return data || [];
}

export async function updateSupportTicketStatusDirect(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteSupportTicketDirect(id: string): Promise<void> {
  const { error } = await supabase.from('support_tickets').delete().eq('id', id);
  if (error) throw error;
}

// ==========================================
// CUSTOMER ORDERS
// ==========================================
export async function fetchOrdersDirect(site?: string, status?: string): Promise<any[]> {
  let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (site && site !== 'all') {
    query = query.eq('site_id', site);
  }
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  const { data, error } = await query;
  if (error) {
    console.warn('fetchOrdersDirect notice:', error.message);
    return [];
  }
  return data || [];
}

export async function updateOrderStatusDirect(id: string, status: string): Promise<void> {
  const { error } = await supabase.from('orders').update({
    status,
    updated_at: new Date().toISOString()
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteOrderDirect(id: string): Promise<void> {
  const { error } = await supabase.from('orders').delete().eq('id', id);
  if (error) throw error;
}

export async function cleanupExpiredOrdersDirect(): Promise<{ deleted_count: number }> {
  const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('orders')
    .delete()
    .eq('status', 'pending')
    .lt('created_at', twoDaysAgo)
    .select();

  if (error) {
    console.warn('cleanupExpiredOrdersDirect notice:', error.message);
    return { deleted_count: 0 };
  }
  return { deleted_count: data ? data.length : 0 };
}

// ==========================================
// WHOP DIRECT OPERATIONS (0 Vercel FOT)
// ==========================================

const DEFAULT_WHOP_USERS = [
  { id: 'whop-user-1', name: 'User 1', slug: 'user-1', description: 'Tài khoản Whop chính 1', color: '#FF6243', sort_order: 1, created_at: new Date().toISOString() },
  { id: 'whop-user-2', name: 'User 2', slug: 'user-2', description: 'Tài khoản Whop phụ 2', color: '#6366F1', sort_order: 2, created_at: new Date().toISOString() }
];

const DEFAULT_WHOP_LINKS = [
  {
    id: 'link-sample-1',
    user_id: 'whop-user-1',
    user_name: 'User 1',
    title: 'Gói Ebook VIP & Tài Liệu Độc Quyền',
    url: 'https://whop.com/checkout/plan_sample1',
    price: '$29.00',
    category: 'Ebook & Tài Liệu',
    description: 'Truy cập toàn bộ kho sách điện tử cao cấp',
    site_id: 'all',
    clicks_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'link-sample-2',
    user_id: 'whop-user-2',
    user_name: 'User 2',
    title: 'Membership Khóa Học Kinh Doanh & Marketing',
    url: 'https://whop.com/checkout/plan_sample2',
    price: '$49.00',
    category: 'Khóa Học VIP',
    description: 'Gói thành viên truy cập hàng tháng',
    site_id: 'all',
    clicks_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Helper to get local stored fallback data
function getLocalWhopUsers(): any[] {
  if (typeof window === 'undefined') return DEFAULT_WHOP_USERS;
  try {
    const raw = localStorage.getItem('bm_whop_users');
    return raw ? JSON.parse(raw) : DEFAULT_WHOP_USERS;
  } catch {
    return DEFAULT_WHOP_USERS;
  }
}

function saveLocalWhopUsers(users: any[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('bm_whop_users', JSON.stringify(users));
  } catch {}
}

function getLocalWhopLinks(): any[] {
  if (typeof window === 'undefined') return DEFAULT_WHOP_LINKS;
  try {
    const raw = localStorage.getItem('bm_whop_links');
    return raw ? JSON.parse(raw) : DEFAULT_WHOP_LINKS;
  } catch {
    return DEFAULT_WHOP_LINKS;
  }
}

function saveLocalWhopLinks(links: any[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('bm_whop_links', JSON.stringify(links));
  } catch {}
}

const isUUID = (str?: string) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

// 1. Fetch Whop Users
export async function fetchWhopUsersDirect(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('whop_users')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!error && data) {
      if (data.length > 0) {
        saveLocalWhopUsers(data);
        return data;
      } else {
        // Table exists in Supabase but has 0 rows -> Seed initial default users so they get real UUIDs!
        const defaultToSeed = [
          { name: 'Acc chính đã xác minh', slug: 'acc-chinh', description: 'Tài khoản chính', color: '#FF6243', sort_order: 1 },
          { name: 'User 2', slug: 'user-2', description: 'Tài khoản phụ', color: '#6366F1', sort_order: 2 }
        ];
        const { data: seeded, error: seedErr } = await supabase
          .from('whop_users')
          .insert(defaultToSeed)
          .select();
        if (!seedErr && seeded && seeded.length > 0) {
          saveLocalWhopUsers(seeded);
          return seeded;
        }
      }
    }
  } catch (err: any) {
    console.warn('fetchWhopUsersDirect error, falling back:', err?.message);
  }
  return getLocalWhopUsers();
}

// 2. Create Whop User
export async function createWhopUserDirect(data: any): Promise<any> {
  const localList = getLocalWhopUsers();
  const newUser = {
    name: (data.name || 'User Mới').trim(),
    slug: data.slug || data.name?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `user-${Date.now()}`,
    description: data.description || '',
    color: data.color || '#FF6243',
    sort_order: data.sort_order !== undefined ? Number(data.sort_order) : localList.length + 1,
  };

  try {
    const { data: res, error } = await supabase
      .from('whop_users')
      .insert([newUser])
      .select();

    if (!error && res && res.length > 0) {
      const created = res[0];
      saveLocalWhopUsers([...localList, created]);
      return created;
    } else if (error) {
      console.error('createWhopUserDirect db error:', error);
    }
  } catch (err: any) {
    console.warn('createWhopUserDirect db error:', err?.message);
  }

  const fallbackUser = {
    id: `whop-user-${Date.now()}`,
    ...newUser,
    created_at: new Date().toISOString()
  };
  saveLocalWhopUsers([...localList, fallbackUser]);
  return fallbackUser;
}

// 3. Update Whop User
export async function updateWhopUserDirect(id: string, data: any): Promise<any> {
  const localList = getLocalWhopUsers();
  const updates: any = {};
  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.slug !== undefined) updates.slug = data.slug;
  if (data.description !== undefined) updates.description = data.description;
  if (data.color !== undefined) updates.color = data.color;
  if (data.sort_order !== undefined) updates.sort_order = Number(data.sort_order);

  try {
    const { data: res, error } = await supabase
      .from('whop_users')
      .update(updates)
      .eq('id', id)
      .select();

    if (!error && res && res.length > 0) {
      const updated = res[0];
      saveLocalWhopUsers(localList.map(u => u.id === id ? updated : u));
      return updated;
    }
  } catch (err: any) {
    console.warn('updateWhopUserDirect db error:', err?.message);
  }

  const updatedLocal = localList.map(u => u.id === id ? { ...u, ...updates } : u);
  saveLocalWhopUsers(updatedLocal);
  return updatedLocal.find(u => u.id === id) || { id, ...updates };
}

// 4. Delete Whop User
export async function deleteWhopUserDirect(id: string): Promise<void> {
  try {
    await supabase.from('whop_links').delete().eq('user_id', id);
    await supabase.from('whop_users').delete().eq('id', id);
  } catch (err: any) {
    console.warn('deleteWhopUserDirect db error:', err?.message);
  }

  const localList = getLocalWhopUsers().filter(u => u.id !== id);
  saveLocalWhopUsers(localList);

  const localLinks = getLocalWhopLinks().filter(l => l.user_id !== id);
  saveLocalWhopLinks(localLinks);
}

// 5. Fetch Whop Links
export async function fetchWhopLinksDirect(
  userId?: string,
  siteId?: string,
  category?: string,
  search?: string
): Promise<any[]> {
  try {
    let query = supabase
      .from('whop_links')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId && userId !== 'all' && isUUID(userId)) {
      query = query.eq('user_id', userId);
    }
    if (siteId && siteId !== 'all') {
      query = query.or(`site_id.eq.${siteId},site_id.eq.all`);
    }
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (!error && data) {
      saveLocalWhopLinks(data);
      let result = data;
      if (search && search.trim()) {
        const s = search.toLowerCase().trim();
        result = result.filter(l => 
          (l.title && l.title.toLowerCase().includes(s)) ||
          (l.url && l.url.toLowerCase().includes(s)) ||
          (l.category && l.category.toLowerCase().includes(s)) ||
          (l.description && l.description.toLowerCase().includes(s))
        );
      }
      return result;
    }
  } catch (err: any) {
    console.warn('fetchWhopLinksDirect db error:', err?.message);
  }

  let local = getLocalWhopLinks();
  if (userId && userId !== 'all') {
    local = local.filter(l => l.user_id === userId);
  }
  if (siteId && siteId !== 'all') {
    local = local.filter(l => !l.site_id || l.site_id === 'all' || l.site_id === siteId);
  }
  if (category && category !== 'all') {
    local = local.filter(l => l.category === category);
  }
  if (search && search.trim()) {
    const s = search.toLowerCase().trim();
    local = local.filter(l => 
      (l.title && l.title.toLowerCase().includes(s)) ||
      (l.url && l.url.toLowerCase().includes(s)) ||
      (l.category && l.category.toLowerCase().includes(s)) ||
      (l.description && l.description.toLowerCase().includes(s))
    );
  }
  return local.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return timeB - timeA;
  });
}

// 6. Create Whop Link
export async function createWhopLinkDirect(data: any): Promise<any> {
  const localLinks = getLocalWhopLinks();
  let formattedUrl = (data.url || '').trim();
  if (formattedUrl && !formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }

  // Ensure target user is a real UUID in Supabase
  let targetUserId = data.user_id;
  try {
    const { data: existingUsers } = await supabase.from('whop_users').select('id, name').order('created_at', { ascending: true });
    if (existingUsers && existingUsers.length > 0) {
      const matched = existingUsers.find(u => u.id === targetUserId || u.name === data.user_name);
      if (matched) {
        targetUserId = matched.id;
      } else if (!isUUID(targetUserId)) {
        targetUserId = existingUsers[0].id;
      }
    } else {
      // Seed first user in Supabase
      const { data: newU } = await supabase
        .from('whop_users')
        .insert([{ name: data.user_name || 'Acc chính đã xác minh', color: '#FF6243', sort_order: 1 }])
        .select();
      if (newU && newU.length > 0) {
        targetUserId = newU[0].id;
      }
    }
  } catch (userErr) {
    console.warn('Could not verify whop_user before link insert:', userErr);
  }

  const insertPayload: any = {
    title: (data.title || '').trim() || formattedUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    url: formattedUrl,
    description: (data.description || '').trim() || null,
    image_url: (data.image_url || '').trim() || null,
    site_name: (data.site_name || 'Whop').trim() || null,
    site_id: data.site_id || 'all'
  };

  if (targetUserId && isUUID(targetUserId)) {
    insertPayload.user_id = targetUserId;
  }
  if (data.user_name) insertPayload.user_name = data.user_name;
  if (data.price) insertPayload.price = data.price;
  if (data.category) insertPayload.category = data.category;

  try {
    const { data: res, error } = await supabase
      .from('whop_links')
      .insert([insertPayload])
      .select();

    if (!error && res && res.length > 0) {
      const created = res[0];
      saveLocalWhopLinks([created, ...localLinks]);
      return created;
    } else if (error) {
      console.error('Supabase whop_links insert error:', error);
      // Retry with minimal payload if some extra column doesn't exist
      const minimalPayload: any = {
        title: insertPayload.title,
        url: insertPayload.url,
        description: insertPayload.description,
        image_url: insertPayload.image_url,
        site_name: insertPayload.site_name
      };
      if (targetUserId && isUUID(targetUserId)) {
        minimalPayload.user_id = targetUserId;
      }
      const { data: minRes, error: minErr } = await supabase
        .from('whop_links')
        .insert([minimalPayload])
        .select();
      if (!minErr && minRes && minRes.length > 0) {
        const created = minRes[0];
        saveLocalWhopLinks([created, ...localLinks]);
        return created;
      }
    }
  } catch (err: any) {
    console.error('createWhopLinkDirect exception:', err);
  }

  const fallbackLink = {
    id: `whop-link-${Date.now()}`,
    ...insertPayload,
    user_id: targetUserId || 'whop-user-1',
    created_at: new Date().toISOString()
  };
  saveLocalWhopLinks([fallbackLink, ...localLinks]);
  return fallbackLink;
}

// 7. Update Whop Link
export async function updateWhopLinkDirect(id: string, data: any): Promise<any> {
  const localLinks = getLocalWhopLinks();
  const updates: any = {
    updated_at: new Date().toISOString()
  };
  if (data.user_id !== undefined) updates.user_id = data.user_id;
  if (data.user_name !== undefined) updates.user_name = data.user_name;
  if (data.title !== undefined) updates.title = data.title.trim();
  if (data.url !== undefined) {
    let formattedUrl = data.url.trim();
    if (formattedUrl && !formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    updates.url = formattedUrl;
  }
  if (data.price !== undefined) updates.price = data.price.trim();
  if (data.category !== undefined) updates.category = data.category.trim();
  if (data.description !== undefined) updates.description = data.description.trim();
  if (data.image_url !== undefined) updates.image_url = data.image_url.trim();
  if (data.site_name !== undefined) updates.site_name = data.site_name.trim();
  if (data.site_id !== undefined) updates.site_id = data.site_id;

  try {
    const { data: res, error } = await supabase
      .from('whop_links')
      .update(updates)
      .eq('id', id)
      .select();

    if (!error && res && res.length > 0) {
      const updated = res[0];
      saveLocalWhopLinks(localLinks.map(l => l.id === id ? updated : l));
      return updated;
    }
  } catch (err: any) {
    console.warn('updateWhopLinkDirect db error:', err?.message);
  }

  const updatedList = localLinks.map(l => l.id === id ? { ...l, ...updates } : l);
  saveLocalWhopLinks(updatedList);
  return updatedList.find(l => l.id === id) || { id, ...updates };
}

// 8. Delete Whop Link
export async function deleteWhopLinkDirect(id: string): Promise<void> {
  try {
    await supabase.from('whop_links').delete().eq('id', id);
  } catch (err: any) {
    console.warn('deleteWhopLinkDirect db error:', err?.message);
  }

  const localLinks = getLocalWhopLinks().filter(l => l.id !== id);
  saveLocalWhopLinks(localLinks);
}

// 9. Track Link Click
export async function trackWhopLinkClickDirect(id: string): Promise<void> {
  try {
    const { data: current } = await supabase.from('whop_links').select('clicks_count').eq('id', id).single();
    const currentCount = current ? (current.clicks_count || 0) : 0;
    await supabase.from('whop_links').update({ clicks_count: currentCount + 1 }).eq('id', id);
  } catch {}

  const localLinks = getLocalWhopLinks().map(l => {
    if (l.id === id) {
      return { ...l, clicks_count: (l.clicks_count || 0) + 1 };
    }
    return l;
  });
  saveLocalWhopLinks(localLinks);
}

