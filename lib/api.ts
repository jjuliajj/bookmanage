import axios from 'axios';
import {
  fetchBooksDirect,
  createBookDirect,
  updateBookDirect,
  deleteBookDirect,
  deleteBatchBooksDirect,
  deleteAllBooksDirect,
  fetchStripeSettingsDirect,
  addStripeSettingDirect,
  updateStripeSettingDirect,
  activateStripeSettingDirect,
  deleteStripeSettingDirect,
} from './supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : 'https://logbook-snowy-gamma.vercel.app/api');

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export interface Book {
  id: string;
  site_id?: string;
  title: string;
  author: string;
  description: string;
  category: string;
  price: string;
  details: any;
  file_url: string;
  cover_url: string;
  created_at: string;
}

export interface StripeSetting {
  id: string;
  site_id?: string;
  account_name: string;
  publishable_key: string;
  secret_key: string;
  is_active: boolean;
  created_at: string;
}

export interface StorefrontSite {
  id: string;
  name: string;
  code: string;
  domain?: string;
  themeColor: string;
  badgeBg: string;
  badgeText: string;
  description: string;
}

export const STOREFRONTS: StorefrontSite[] = [
  { id: 'bookbazaar', code: 'bookbazaar', name: 'BookBazaar', domain: 'book-bazaar-alpha.vercel.app', themeColor: '#0C4A60', badgeBg: 'bg-teal-50 border-teal-200', badgeText: 'text-teal-800', description: 'British Bookseller & Curated Volumes' },
  { id: 'bookhavenmart', code: 'bookhavenmart', name: 'BookHavenMart', domain: 'book-haven-mart.vercel.app', themeColor: '#4F46E5', badgeBg: 'bg-indigo-50 border-indigo-200', badgeText: 'text-indigo-800', description: 'Literary Sanctuary & Modern Store' },
  { id: 'booknookstore', code: 'booknookstore', name: 'BookNookStore', domain: 'book-nook-store.vercel.app', themeColor: '#059669', badgeBg: 'bg-emerald-50 border-emerald-200', badgeText: 'text-emerald-800', description: 'Cozy Reading Nook & EPUB Collections' },
  { id: 'bookoutletpro', code: 'bookoutletpro', name: 'BookOutletPro', domain: 'book-outlet-pro.vercel.app', themeColor: '#DC2626', badgeBg: 'bg-rose-50 border-rose-200', badgeText: 'text-rose-800', description: 'Outlet Deals & Best Value Titles' },
  { id: 'bookstallhq', code: 'bookstallhq', name: 'BookStallHQ', domain: 'book-stall-hq.vercel.app', themeColor: '#7C3AED', badgeBg: 'bg-purple-50 border-purple-200', badgeText: 'text-purple-800', description: 'Curated Stall & Rare Discoveries' },
  { id: 'bookvendorco', code: 'bookvendorco', name: 'BookVendorCo', domain: 'book-vendor-co.vercel.app', themeColor: '#2563EB', badgeBg: 'bg-blue-50 border-blue-200', badgeText: 'text-blue-800', description: 'Premium Commercial Bookseller' },
  { id: 'buybound', code: 'buybound', name: 'BuyBound', domain: 'buy-bound.vercel.app', themeColor: '#D97706', badgeBg: 'bg-amber-50 border-amber-200', badgeText: 'text-amber-800', description: 'Marketplace for Bound Books & EPUBs' },
  { id: 'orderpages', code: 'orderpages', name: 'OrderPages', domain: 'order-pages.vercel.app', themeColor: '#0D9488', badgeBg: 'bg-cyan-50 border-cyan-200', badgeText: 'text-cyan-800', description: 'Linear Reader Bookshop' },
  { id: 'picktomes', code: 'picktomes', name: 'PickTomes', domain: 'pick-tomes.vercel.app', themeColor: '#B45309', badgeBg: 'bg-orange-50 border-orange-200', badgeText: 'text-orange-800', description: 'Linen & Ink Archival Tome Vault' },
  { id: 'readcart', code: 'readcart', name: 'ReadCart', domain: 'read-cart.vercel.app', themeColor: '#9333EA', badgeBg: 'bg-fuchsia-50 border-fuchsia-200', badgeText: 'text-fuchsia-800', description: 'Instant Digital Reader Cart' },
  { id: 'bookpatr', code: 'bookpatr', name: 'BookPatr', domain: 'www.logicnode.ink', themeColor: '#E11D48', badgeBg: 'bg-rose-50 border-rose-200', badgeText: 'text-rose-800', description: 'Artisanal Literature & eBook Market' },
];

// Direct Supabase calls with Axios fallback (Zero Vercel Fast Origin Transfer)
export const getBooks = async (site?: string) => {
  try {
    const data = await fetchBooksDirect(site);
    return { data };
  } catch (err) {
    console.warn('Direct fetch failed, falling back to API:', err);
    const params = site && site !== 'all' ? { site } : {};
    return api.get<Book[]>('/books', { params });
  }
};

export const getBook = async (id: string) => {
  return api.get<Book>(`/books/${id}`);
};

export const createBook = async (formData: FormData | any) => {
  if (formData instanceof FormData) {
    // If sent as FormData without prior upload, fallback to api
    return api.post<Book>('/books', formData);
  }
  const data = await createBookDirect(formData);
  return { data };
};

export const updateBook = async (id: string, data: FormData | Partial<Book>) => {
  if (data instanceof FormData) {
    return api.put<Book>(`/books/${id}`, data);
  }
  try {
    const res = await updateBookDirect(id, data as any);
    return { data: res };
  } catch (err) {
    return api.put<Book>(`/books/${id}`, data);
  }
};

export const deleteBook = async (id: string) => {
  try {
    await deleteBookDirect(id);
    return { data: { message: 'Book deleted' } };
  } catch {
    return api.delete(`/books/${id}`);
  }
};

export const deleteBatchBooks = async (ids: string[]) => {
  try {
    await deleteBatchBooksDirect(ids);
    return { data: { message: 'Books deleted' } };
  } catch {
    return api.post('/books/delete-batch', { ids });
  }
};

export const deleteAllBooks = async (site?: string) => {
  try {
    await deleteAllBooksDirect(site);
    return { data: { message: 'All books deleted' } };
  } catch {
    const params = site && site !== 'all' ? { site } : {};
    return api.delete('/books/all/truncate', { params });
  }
};

export const getStripeSettings = async (site?: string) => {
  try {
    const data = await fetchStripeSettingsDirect(site);
    return { data };
  } catch {
    const params = site && site !== 'all' ? { site } : {};
    return api.get<StripeSetting[]>('/checkout/stripe-settings', { params });
  }
};

export const addStripeSetting = async (data: {
  site_id?: string;
  account_name: string;
  publishable_key?: string;
  secret_key: string;
  is_active?: boolean;
}) => {
  try {
    const res = await addStripeSettingDirect(data);
    return { data: res };
  } catch {
    return api.post<StripeSetting>('/checkout/stripe-settings', data);
  }
};

export const activateStripeSetting = async (id: string, siteId?: string) => {
  try {
    const res = await activateStripeSettingDirect(id, siteId);
    return { data: res };
  } catch {
    return api.put<StripeSetting>(`/checkout/stripe-settings/${id}/activate`);
  }
};

export const updateStripeSetting = async (id: string, data: Partial<StripeSetting>) => {
  try {
    const res = await updateStripeSettingDirect(id, data);
    return { data: res };
  } catch {
    return api.put<StripeSetting>(`/checkout/stripe-settings/${id}`, data);
  }
};

export const deleteStripeSetting = async (id: string) => {
  try {
    await deleteStripeSettingDirect(id);
    return { data: { message: 'Deleted' } };
  } catch {
    return api.delete(`/checkout/stripe-settings/${id}`);
  }
};
