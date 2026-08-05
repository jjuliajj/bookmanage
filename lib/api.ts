import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : 'https://logbook-snowy-gamma.vercel.app/api');

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export interface Book {
  id: string;
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
  account_name: string;
  publishable_key: string;
  secret_key: string;
  is_active: boolean;
  created_at: string;
}

export const getBooks = () => api.get<Book[]>('/books');
export const getBook = (id: string) => api.get<Book>(`/books/${id}`);
export const createBook = (formData: FormData) => api.post('/books', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const updateBook = (id: string, data: FormData | Partial<Book>) => {
  const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
  return api.put(`/books/${id}`, data, { headers });
};
export const deleteBook = (id: string) => api.delete(`/books/${id}`);
export const deleteBatchBooks = (ids: string[]) => api.post('/books/delete-batch', { ids });
export const deleteAllBooks = () => api.delete('/books/all/truncate');

export const getStripeSettings = () => api.get<StripeSetting[]>('/checkout/stripe-settings');
export const addStripeSetting = (data: { account_name: string; publishable_key?: string; secret_key: string; is_active?: boolean }) => 
  api.post<StripeSetting>('/checkout/stripe-settings', data);
export const activateStripeSetting = (id: string) => api.put<StripeSetting>(`/checkout/stripe-settings/${id}/activate`);
export const updateStripeSetting = (id: string, data: Partial<StripeSetting>) => api.put<StripeSetting>(`/checkout/stripe-settings/${id}`, data);
export const deleteStripeSetting = (id: string) => api.delete(`/checkout/stripe-settings/${id}`);
