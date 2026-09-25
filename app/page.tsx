"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  FileText, 
  Image as ImageIcon, 
  Loader2, 
  X, 
  Book as BookIcon, 
  ExternalLink, 
  Filter, 
  RotateCcw, 
  Trash, 
  CreditCard, 
  CheckCircle2, 
  Key, 
  ShieldCheck, 
  Zap, 
  Check, 
  DollarSign, 
  Sparkles, 
  Dices, 
  Globe, 
  Layers, 
  Store, 
  ChevronRight, 
  RefreshCw, 
  AlertCircle, 
  ChevronDown,
  Shuffle,
  Tag,
  Sliders,
  CheckSquare,
  Square,
  Eye,
  EyeOff,
  Copy,
  Mail,
  MessageSquare,
  Headphones,
  Inbox,
  Clock,
  ShoppingBag,
  Receipt,
  PackageCheck,
  PackageX,
  Users,
  UserPlus,
  ArrowUpRight,
  Link2,
  Share2,
  LayoutGrid,
  ListFilter,
  Flame,
  UserCheck,
  Palette,
  Lock,
  Unlock,
  LogIn,
  LogOut,
  Shield
} from "lucide-react";
import { 
  getBooks, 
  deleteBook, 
  deleteBatchBooks, 
  deleteAllBooks, 
  createBook, 
  updateBook, 
  Book, 
  getStripeSettings, 
  addStripeSetting, 
  updateStripeSetting, 
  activateStripeSetting, 
  deleteStripeSetting, 
  StripeSetting, 
  getPayPalSettings,
  addPayPalSetting,
  updatePayPalSetting,
  activatePayPalSetting,
  deletePayPalSetting,
  PayPalSetting,
  SupportTicket,
  getSupportTickets,
  updateSupportTicketStatus,
  deleteSupportTicket,
  Order,
  getOrders,
  updateOrderStatus,
  deleteOrder,
  cleanupExpiredOrders,
  STOREFRONTS, 
  StorefrontSite,
  WhopUser,
  WhopLink,
  getWhopUsers,
  createWhopUser,
  updateWhopUser,
  deleteWhopUser,
  getWhopLinks,
  createWhopLink,
  updateWhopLink,
  deleteWhopLink,
  trackWhopLinkClick,
  getWhopLinkPreview
} from "@/lib/api";
import { 
  uploadBookFileDirect, 
  uploadCoverFileDirect, 
  createBookDirect, 
  updateBookDirect, 
  batchUpdateCategoriesDirect, 
  batchUpdatePricesDirect,
  fetchBooksDirect,
  deleteBookDirect,
  deleteBatchBooksDirect,
  deleteAllBooksDirect,
  fetchStripeSettingsDirect,
  addStripeSettingDirect,
  updateStripeSettingDirect,
  activateStripeSettingDirect,
  deleteStripeSettingDirect,
  fetchPayPalSettingsDirect,
  addPayPalSettingDirect,
  updatePayPalSettingDirect,
  activatePayPalSettingDirect,
  deletePayPalSettingDirect,
  fetchSupportTicketsDirect,
  updateSupportTicketStatusDirect,
  deleteSupportTicketDirect,
  fetchOrdersDirect,
  updateOrderStatusDirect,
  deleteOrderDirect,
  cleanupExpiredOrdersDirect,
  fetchWhopUsersDirect,
  createWhopUserDirect,
  updateWhopUserDirect,
  deleteWhopUserDirect,
  fetchWhopLinksDirect,
  createWhopLinkDirect,
  updateWhopLinkDirect,
  deleteWhopLinkDirect,
  trackWhopLinkClickDirect
} from "@/lib/supabase";
import { parseEpubFile, cleanExtractedDescription } from "@/lib/epubParser";

export const DEFAULT_CATEGORIES = [
  "Fiction",
  "Non-Fiction",
  "Philosophy",
  "Classic",
  "Poetry",
  "Sci-Fi",
  "Self-Help",
  "History",
  "Biography",
  "Business",
  "Mystery",
  "Psychology"
];

// Helper to shuffle array immutably
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Balanced round-robin category allocator
function getBalancedCategories(count: number, pool: string[]): string[] {
  if (!pool || pool.length === 0) return Array(count).fill("General");
  const result: string[] = [];
  const fullCycles = Math.floor(count / pool.length);
  const remainder = count % pool.length;

  for (let c = 0; c < fullCycles; c++) {
    result.push(...shuffleArray(pool));
  }
  if (remainder > 0) {
    result.push(...shuffleArray(pool).slice(0, remainder));
  }
  return result;
}

export default function BookManagePage() {
  const [activeTab, setActiveTab] = useState<'books' | 'stripe' | 'paypal' | 'tickets' | 'orders' | 'whop'>('books');
  const [selectedSite, setSelectedSite] = useState<string>('bookpatr');
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Whop Management states
  const [whopUsers, setWhopUsers] = useState<WhopUser[]>([]);
  const [whopLinks, setWhopLinks] = useState<WhopLink[]>([]);
  const [whopLoading, setWhopLoading] = useState(false);
  const [selectedWhopUser, setSelectedWhopUser] = useState<string>('');
  const [whopSearchTerm, setWhopSearchTerm] = useState<string>('');
  const [selectedWhopCategory, setSelectedWhopCategory] = useState<string>('all');
  const [whopViewMode, setWhopViewMode] = useState<'grid' | 'table'>('grid');

  // Whop Link modal
  const [isWhopLinkModalOpen, setIsWhopLinkModalOpen] = useState(false);
  const [editingWhopLink, setEditingWhopLink] = useState<WhopLink | null>(null);
  const [whopLinkFormData, setWhopLinkFormData] = useState({
    user_id: '',
    title: '',
    url: '',
    price: '',
    category: 'Khóa Học VIP',
    description: '',
    site_id: 'all'
  });

  // Whop User modal
  const [isWhopUserModalOpen, setIsWhopUserModalOpen] = useState(false);
  const [editingWhopUser, setEditingWhopUser] = useState<WhopUser | null>(null);
  const [whopUserFormData, setWhopUserFormData] = useState({
    name: '',
    description: '',
    color: '#FF6243'
  });
  const [copiedWhopLinkId, setCopiedWhopLinkId] = useState<string | null>(null);

  // Admin Authentication State
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginUsername, setLoginUsername] = useState<string>("lichdt");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>("");

  // Sync admin login state from localStorage on mount
  useEffect(() => {
    try {
      const savedAuth = localStorage.getItem('bookmanage_admin_auth');
      if (savedAuth === 'true') {
        setIsAdminLoggedIn(true);
      } else {
        setIsAdminLoggedIn(false);
        setActiveTab('whop');
      }
    } catch {
      setIsAdminLoggedIn(false);
      setActiveTab('whop');
    }
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (loginUsername.trim() === 'lichdt' && loginPassword === '389363') {
      setIsAdminLoggedIn(true);
      try {
        localStorage.setItem('bookmanage_admin_auth', 'true');
      } catch {}
      setIsLoginModalOpen(false);
      setLoginPassword("");
    } else {
      setLoginError("Tài khoản hoặc mật khẩu không chính xác. (Tài khoản: lichdt, Mật khẩu: 389363)");
    }
  };

  const handleLogout = () => {
    if (confirm("Bạn có chắc chắn muốn đăng xuất tài khoản quản trị?")) {
      setIsAdminLoggedIn(false);
      try {
        localStorage.removeItem('bookmanage_admin_auth');
      } catch {}
      setActiveTab('whop');
    }
  };

  // Customer Orders states
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderSearchTerm, setOrderSearchTerm] = useState<string>("");
  const [selectedOrderForView, setSelectedOrderForView] = useState<Order | null>(null);
  const [isCleaningOrders, setIsCleaningOrders] = useState(false);

  // Support Tickets states
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [selectedTicketForView, setSelectedTicketForView] = useState<SupportTicket | null>(null);

  // Custom Website Selector Dropdown States
  const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState(false);
  const [siteSearchTerm, setSiteSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsSiteDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Selection & Filter states
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [selectedAuthor, setSelectedAuthor] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedPriceFilter, setSelectedPriceFilter] = useState("");

  // Stripe Settings states
  const [stripeSettings, setStripeSettings] = useState<StripeSetting[]>([]);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [isStripeModalOpen, setIsStripeModalOpen] = useState(false);
  const [editingStripeSetting, setEditingStripeSetting] = useState<StripeSetting | null>(null);
  const [stripeFormData, setStripeFormData] = useState({
    site_id: "bookbazaar",
    account_name: "",
    publishable_key: "",
    secret_key: "",
    is_active: true
  });
  const [visibleKeys, setVisibleKeys] = useState<{ [key: string]: boolean }>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [showModalSecretKey, setShowModalSecretKey] = useState(false);
  const [showModalPublishableKey, setShowModalPublishableKey] = useState(false);

  // PayPal Settings states
  const [paypalSettings, setPaypalSettings] = useState<PayPalSetting[]>([]);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [isPayPalModalOpen, setIsPayPalModalOpen] = useState(false);
  const [editingPayPalSetting, setEditingPayPalSetting] = useState<PayPalSetting | null>(null);
  const [paypalFormData, setPaypalFormData] = useState({
    site_id: "bookbazaar",
    account_name: "",
    client_id: "",
    client_secret: "",
    mode: "live" as 'live' | 'sandbox',
    is_active: true
  });
  const [showModalPayPalSecret, setShowModalPayPalSecret] = useState(false);
  const [showModalPayPalClientId, setShowModalPayPalClientId] = useState(false);

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => ({
      ...prev,
      [keyId]: !prev[keyId]
    }));
  };

  const handleCopyKey = async (text: string, identifier: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyId(identifier);
      setTimeout(() => {
        setCopiedKeyId(prev => (prev === identifier ? null : prev));
      }, 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  // Randomize Prices states
  const [isRandomPriceModalOpen, setIsRandomPriceModalOpen] = useState(false);
  const [randomPriceInput, setRandomPriceInput] = useState("$0.50\n$0.99\n$1.50\n$2.99\n$4.99\n$9.99\n$14.99\n$19.99");
  const [randomPriceTarget, setRandomPriceTarget] = useState<'all' | 'selected'>('all');
  const [randomPriceProgress, setRandomPriceProgress] = useState({ current: 0, total: 0 });

  // Randomize Categories states (NEW FEATURE)
  const [isRandomCategoryModalOpen, setIsRandomCategoryModalOpen] = useState(false);
  const [randomCategoryTarget, setRandomCategoryTarget] = useState<'all' | 'selected'>('all');
  const [randomCategoryPool, setRandomCategoryPool] = useState<string[]>(DEFAULT_CATEGORIES);
  const [randomCategoryMode, setRandomCategoryMode] = useState<'balanced' | 'pure_random'>('balanced');
  const [randomCategoryProgress, setRandomCategoryProgress] = useState({ current: 0, total: 0 });
  const [newCustomCategoryInput, setNewCustomCategoryInput] = useState("");

  // Single Book Form states
  const [formData, setFormData] = useState({
    site_id: "bookbazaar",
    title: "",
    author: "",
    description: "",
    category: "",
    price: "",
    publisher: "",
    pages: ""
  });
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);

  // Bulk upload states
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkBookFiles, setBulkBookFiles] = useState<File[]>([]);
  const [bulkCoverFiles, setBulkCoverFiles] = useState<File[]>([]);
  const [bulkAuthor, setBulkAuthor] = useState("Martin Chavez");
  const [bulkPrice, setBulkPrice] = useState("$12.00");
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  
  // Bulk upload category distribution states
  const [bulkCategoryMode, setBulkCategoryMode] = useState<'balanced_random' | 'single'>('balanced_random');
  const [bulkSingleCategory, setBulkSingleCategory] = useState("Non-Fiction");
  const [bulkCategoryPool, setBulkCategoryPool] = useState<string[]>(DEFAULT_CATEGORIES);
  const [bulkNewCategoryInput, setBulkNewCategoryInput] = useState("");

  useEffect(() => {
    fetchBooks();
    fetchStripeSettings();
    fetchPayPalSettings();
    fetchTickets();
    fetchOrders();
    fetchWhopData();
  }, [selectedSite, orderStatusFilter]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const response = await getBooks(selectedSite);
      setBooks(response.data);
      setSelectedBookIds([]);
    } catch (error) {
      console.error("Failed to fetch books:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStripeSettings = async () => {
    setStripeLoading(true);
    try {
      const response = await getStripeSettings();
      setStripeSettings(response.data);
    } catch (error) {
      console.error("Failed to fetch Stripe settings:", error);
    } finally {
      setStripeLoading(false);
    }
  };

  const fetchPayPalSettings = async () => {
    setPaypalLoading(true);
    try {
      const response = await getPayPalSettings();
      setPaypalSettings(response.data);
    } catch (error) {
      console.error("Failed to fetch PayPal settings:", error);
    } finally {
      setPaypalLoading(false);
    }
  };

  const fetchTickets = async () => {
    setTicketsLoading(true);
    try {
      const response = await getSupportTickets(selectedSite);
      setTickets(response.data || []);
    } catch (error) {
      console.error("Failed to fetch support tickets:", error);
    } finally {
      setTicketsLoading(false);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const response = await getOrders(selectedSite, orderStatusFilter);
      setOrders(response.data || []);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchWhopData = async () => {
    setWhopLoading(true);
    try {
      const [uRes, lRes] = await Promise.all([
        getWhopUsers(),
        getWhopLinks(undefined, selectedSite)
      ]);
      const users = uRes.data || [];
      const links = (lRes.data || []).sort((a: any, b: any) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });
      setWhopUsers(users);
      setWhopLinks(links);
      setSelectedWhopUser(prev => {
        if (!prev || prev === 'all' || !users.some(u => u.id === prev)) {
          return users[0]?.id || '';
        }
        return prev;
      });
    } catch (error) {
      console.error("Failed to fetch Whop data:", error);
    } finally {
      setWhopLoading(false);
    }
  };

  const currentStorefront = STOREFRONTS.find(s => s.id === selectedSite);

  // Filter stripe settings for current selected site
  const currentSiteStripeSettings = useMemo(() => {
    if (selectedSite === 'all') return stripeSettings;
    return stripeSettings.filter(s => s.site_id === selectedSite || s.site_id === 'all');
  }, [stripeSettings, selectedSite]);

  const activeStripeSettingForSite = useMemo(() => {
    if (selectedSite === 'all') {
      return stripeSettings.find(s => s.is_active);
    }
    return stripeSettings.find(s => s.site_id === selectedSite && s.is_active) || 
           stripeSettings.find(s => s.site_id === 'all' && s.is_active);
  }, [stripeSettings, selectedSite]);

  // Filter PayPal settings for current selected site
  const currentSitePayPalSettings = useMemo(() => {
    if (selectedSite === 'all') return paypalSettings;
    return paypalSettings.filter(s => s.site_id === selectedSite || s.site_id === 'all');
  }, [paypalSettings, selectedSite]);

  const activePayPalSettingForSite = useMemo(() => {
    if (selectedSite === 'all') {
      return paypalSettings.find(s => s.is_active);
    }
    return paypalSettings.find(s => s.site_id === selectedSite && s.is_active) || 
           paypalSettings.find(s => s.site_id === 'all' && s.is_active);
  }, [paypalSettings, selectedSite]);

  // Filter Support Tickets for current selected site
  const currentSiteTickets = useMemo(() => {
    if (selectedSite === 'all') return tickets;
    return tickets.filter(t => t.site_id === selectedSite);
  }, [tickets, selectedSite]);

  // Filter Customer Orders for current selected site & status & search
  const currentSiteOrders = useMemo(() => {
    let list = selectedSite === 'all' ? orders : orders.filter(o => o.site_id === selectedSite);
    if (orderStatusFilter !== 'all') {
      list = list.filter(o => o.status === orderStatusFilter);
    }
    if (orderSearchTerm.trim()) {
      const term = orderSearchTerm.toLowerCase().trim();
      list = list.filter(o => 
        (o.order_code && o.order_code.toLowerCase().includes(term)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(term)) ||
        (o.customer_email && o.customer_email.toLowerCase().includes(term))
      );
    }
    return list;
  }, [orders, selectedSite, orderStatusFilter, orderSearchTerm]);

  // Author List for filtering
  const authors = useMemo(() => {
    const list = Array.from(new Set(books.map(b => b.author).filter(Boolean)));
    return list.sort();
  }, [books]);

  // Categories List for filtering
  const categories = useMemo(() => {
    const list = Array.from(new Set(books.map(b => b.category).filter(Boolean)));
    return list.sort();
  }, [books]);

  // Prices List for filtering
  const prices = useMemo(() => {
    const list = Array.from(new Set(books.map(b => b.price).filter(Boolean)));
    return list.sort();
  }, [books]);

  // Real-time balanced category preview for bulk upload
  const assignedBulkCategories = useMemo(() => {
    if (bulkCategoryMode === 'single') {
      return bulkBookFiles.map(() => bulkSingleCategory || 'Non-Fiction');
    }
    const pool = bulkCategoryPool.length > 0 ? bulkCategoryPool : DEFAULT_CATEGORIES;
    return getBalancedCategories(bulkBookFiles.length, pool);
  }, [bulkBookFiles.length, bulkCategoryMode, bulkSingleCategory, bulkCategoryPool]);

  // Computed Filtered Books
  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const matchesSearch =
        book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (book.description && book.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesAuthor = selectedAuthor ? book.author === selectedAuthor : true;
      const matchesCategory = selectedCategory ? book.category === selectedCategory : true;
      const matchesPrice = selectedPriceFilter ? book.price === selectedPriceFilter : true;

      return matchesSearch && matchesAuthor && matchesCategory && matchesPrice;
    });
  }, [books, searchTerm, selectedAuthor, selectedCategory, selectedPriceFilter]);

  const isAllSelected = filteredBooks.length > 0 && selectedBookIds.length === filteredBooks.length;
  const isAnyFilterActive = Boolean(searchTerm || selectedAuthor || selectedCategory || selectedPriceFilter);

  // Whop Filtered Links for Active User (Newest First)
  const filteredWhopLinks = useMemo(() => {
    let list = whopLinks;
    const activeUserId = selectedWhopUser || whopUsers[0]?.id;
    if (activeUserId) {
      list = list.filter(l => l.user_id === activeUserId);
    }
    // Always guarantee newest link is at the top
    return [...list].sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [whopLinks, selectedWhopUser, whopUsers]);

  const whopCategories = useMemo(() => {
    const list = Array.from(new Set(whopLinks.map(l => l.category).filter(Boolean) as string[]));
    return list.sort();
  }, [whopLinks]);

  // Whop Quick Add State & Auto OpenGraph Preview
  const [quickWhopUrl, setQuickWhopUrl] = useState("");
  const [quickWhopTitle, setQuickWhopTitle] = useState("");
  const [quickWhopPreview, setQuickWhopPreview] = useState<{
    title: string;
    description: string;
    image: string;
    site_name: string;
    url: string;
  } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Debounced auto-fetch rich preview when user pastes / types Whop URL
  useEffect(() => {
    const trimmed = quickWhopUrl.trim();
    if (!trimmed || (!trimmed.includes('.') && !trimmed.startsWith('http'))) {
      setQuickWhopPreview(null);
      setIsPreviewLoading(false);
      return;
    }

    let isMounted = true;
    setIsPreviewLoading(true);

    const timer = setTimeout(async () => {
      try {
        const preview = await getWhopLinkPreview(trimmed);
        if (isMounted && preview) {
          setQuickWhopPreview(preview);
        }
      } catch (err) {
        console.warn('Preview auto-fetch failed:', err);
      } finally {
        if (isMounted) setIsPreviewLoading(false);
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [quickWhopUrl]);

  const handleQuickAddWhopLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickWhopUrl.trim()) return;

    const targetUserId = selectedWhopUser !== 'all' ? selectedWhopUser : (whopUsers[0]?.id || 'whop-user-1');
    const assignedUser = whopUsers.find(u => u.id === targetUserId);

    let formattedUrl = quickWhopUrl.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    // Use fetched preview if available, otherwise quick fetch
    let previewData = quickWhopPreview;
    if (!previewData || previewData.url !== formattedUrl) {
      try {
        previewData = await getWhopLinkPreview(formattedUrl);
      } catch {}
    }

    const title = quickWhopTitle.trim() || previewData?.title || formattedUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const description = previewData?.description || '';
    const imageUrl = previewData?.image || '';
    const siteName = previewData?.site_name || 'Whop';

    setIsSubmitting(true);
    try {
      await createWhopLink({
        user_id: targetUserId,
        user_name: assignedUser ? assignedUser.name : 'User',
        url: formattedUrl,
        title: title,
        description: description,
        image_url: imageUrl,
        site_name: siteName,
        site_id: selectedSite !== 'all' ? selectedSite : 'all'
      });
      setQuickWhopUrl("");
      setQuickWhopTitle("");
      setQuickWhopPreview(null);
      await fetchWhopData();
    } catch (err: any) {
      console.error("Failed to quick add Whop link:", err);
      alert("Không thể thêm link Whop.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Whop Link Handlers
  const handleStartAddWhopLink = (userId?: string) => {
    const defaultUserId = userId || (selectedWhopUser !== 'all' ? selectedWhopUser : (whopUsers[0]?.id || 'whop-user-1'));
    setEditingWhopLink(null);
    setWhopLinkFormData({
      user_id: defaultUserId,
      title: '',
      url: '',
      price: '',
      category: '',
      description: '',
      site_id: selectedSite !== 'all' ? selectedSite : 'all'
    });
    setIsWhopLinkModalOpen(true);
  };

  const handleStartEditWhopLink = (link: WhopLink) => {
    setEditingWhopLink(link);
    setWhopLinkFormData({
      user_id: link.user_id || (whopUsers[0]?.id || ''),
      title: link.title || '',
      url: link.url,
      price: '',
      category: '',
      description: '',
      site_id: link.site_id || 'all'
    });
    setIsWhopLinkModalOpen(true);
  };

  const handleSaveWhopLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whopLinkFormData.url.trim()) {
      alert("Vui lòng nhập đường link Whop.");
      return;
    }

    let formattedUrl = whopLinkFormData.url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const assignedUser = whopUsers.find(u => u.id === whopLinkFormData.user_id);
    const finalTitle = whopLinkFormData.title.trim() || formattedUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const payload = {
      user_id: whopLinkFormData.user_id || (whopUsers[0]?.id || 'whop-user-1'),
      user_name: assignedUser ? assignedUser.name : 'User',
      url: formattedUrl,
      title: finalTitle,
      site_id: whopLinkFormData.site_id || 'all'
    };

    setIsSubmitting(true);
    try {
      if (editingWhopLink) {
        await updateWhopLink(editingWhopLink.id, payload);
      } else {
        await createWhopLink(payload);
      }
      await fetchWhopData();
      setIsWhopLinkModalOpen(false);
      setEditingWhopLink(null);
    } catch (err: any) {
      console.error("Failed to save Whop link:", err);
      alert(err.message || "Không thể lưu link Whop.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWhopLink = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa link Whop này?")) return;
    try {
      await deleteWhopLink(id);
      await fetchWhopData();
    } catch (err) {
      alert("Không thể xóa link Whop.");
    }
  };

  const handleOpenWhopLink = (link: WhopLink) => {
    if (!link.url) return;
    let url = link.url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    trackWhopLinkClick(link.id);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyWhopLink = async (link: WhopLink) => {
    if (!link.url) return;
    let url = link.url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedWhopLinkId(link.id);
      setTimeout(() => {
        setCopiedWhopLinkId(prev => (prev === link.id ? null : prev));
      }, 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  // Whop User Handlers
  const handleStartAddWhopUser = () => {
    setEditingWhopUser(null);
    setWhopUserFormData({
      name: `User ${whopUsers.length + 1}`,
      description: '',
      color: ['#FF6243', '#6366F1', '#10B981', '#0EA5E9', '#8B5CF6', '#F43F5E', '#F59E0B'][whopUsers.length % 7]
    });
    setIsWhopUserModalOpen(true);
  };

  const handleStartEditWhopUser = (user: WhopUser) => {
    setEditingWhopUser(user);
    setWhopUserFormData({
      name: user.name,
      description: user.description || '',
      color: user.color || '#FF6243'
    });
    setIsWhopUserModalOpen(true);
  };

  const handleSaveWhopUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whopUserFormData.name.trim()) {
      alert("Vui lòng nhập tên User Whop.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingWhopUser) {
        await updateWhopUser(editingWhopUser.id, whopUserFormData);
      } else {
        const created = await createWhopUser(whopUserFormData);
        if (created?.data?.id) {
          setSelectedWhopUser(created.data.id);
        }
      }
      await fetchWhopData();
      setIsWhopUserModalOpen(false);
      setEditingWhopUser(null);
    } catch (err: any) {
      console.error("Failed to save Whop user:", err);
      alert(err.message || "Không thể lưu User Whop.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWhopUser = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tab "${name}" và toàn bộ các link của user này không?`)) return;
    try {
      await deleteWhopUser(id);
      if (selectedWhopUser === id) {
        setSelectedWhopUser('all');
      }
      await fetchWhopData();
    } catch (err) {
      alert("Không thể xóa User Whop.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this book?")) return;
    try {
      await deleteBook(id);
      setBooks(books.filter(b => b.id !== id));
      setSelectedBookIds(selectedBookIds.filter(itemId => itemId !== id));
    } catch (error) {
      alert("Failed to delete book");
    }
  };

  const handleSelectAll = () => {
    if (selectedBookIds.length === filteredBooks.length && filteredBooks.length > 0) {
      setSelectedBookIds([]);
    } else {
      setSelectedBookIds(filteredBooks.map(b => b.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedBookIds.includes(id)) {
      setSelectedBookIds(selectedBookIds.filter(itemId => itemId !== id));
    } else {
      setSelectedBookIds([...selectedBookIds, id]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedBookIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedBookIds.length} selected book(s)?`)) return;

    try {
      setIsSubmitting(true);
      await deleteBatchBooks(selectedBookIds);
      setBooks(books.filter(b => !selectedBookIds.includes(b.id)));
      setSelectedBookIds([]);
    } catch (error) {
      console.error("Batch delete failed:", error);
      alert("Failed to delete selected books.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (books.length === 0) return;
    const siteLabel = selectedSite === 'all' ? 'TẤT CẢ sách trên hệ thống' : `tất cả sách của ${currentStorefront?.name || selectedSite}`;
    if (!confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa ${siteLabel}? Hành động này không thể hoàn tác!`)) return;

    try {
      setIsSubmitting(true);
      await deleteAllBooks(selectedSite);
      await fetchBooks();
      setSelectedBookIds([]);
    } catch (error) {
      console.error("Delete all failed:", error);
      alert("Failed to delete books.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedAuthor("");
    setSelectedCategory("");
    setSelectedPriceFilter("");
  };

  const handleStartAddStripeSetting = () => {
    setEditingStripeSetting(null);
    const targetSite = selectedSite !== 'all' ? selectedSite : 'bookbazaar';
    const siteObj = STOREFRONTS.find(s => s.id === targetSite);
    setStripeFormData({ 
      site_id: targetSite,
      account_name: siteObj ? `${siteObj.name} Primary Gateway` : "Main Stripe Gateway",
      publishable_key: "", 
      secret_key: "", 
      is_active: true 
    });
    setIsStripeModalOpen(true);
  };

  const handleStartEditStripeSetting = (setting: StripeSetting) => {
    setEditingStripeSetting(setting);
    setStripeFormData({
      site_id: setting.site_id || (selectedSite !== 'all' ? selectedSite : "bookbazaar"),
      account_name: setting.account_name,
      publishable_key: setting.publishable_key || "",
      secret_key: setting.secret_key || "",
      is_active: setting.is_active
    });
    setIsStripeModalOpen(true);
  };

  const handleAddStripeSettingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripeFormData.account_name || !stripeFormData.secret_key) {
      alert("Please enter Account Name and Secret Key.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingStripeSetting) {
        await updateStripeSetting(editingStripeSetting.id, stripeFormData);
      } else {
        await addStripeSetting(stripeFormData);
      }
      await fetchStripeSettings();
      setIsStripeModalOpen(false);
      setEditingStripeSetting(null);
    } catch (error: any) {
      console.error("Failed to save Stripe account:", error);
      alert(error.response?.data?.error || error.message || "Failed to save Stripe account configuration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct Supabase Batch Random Prices (0 Vercel FOT)
  const handleBulkRandomizePricesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const rawLines = randomPriceInput.split('\n');
    const inputPrices = rawLines
      .map(line => line.trim().replace(/[^0-9.]/g, ''))
      .filter(val => val.length > 0)
      .map(val => {
        const num = parseFloat(val);
        return isNaN(num) ? null : `$${num.toFixed(2)}`;
      })
      .filter((val): val is string => val !== null);

    if (inputPrices.length === 0) {
      alert("Please enter at least one valid price (e.g. 0.50, 0.99, 1.50)");
      return;
    }

    const targetBooks = randomPriceTarget === 'selected' && selectedBookIds.length > 0
      ? books.filter(b => selectedBookIds.includes(b.id))
      : books;

    if (targetBooks.length === 0) {
      alert("No books selected to update!");
      return;
    }

    setIsSubmitting(true);
    setRandomPriceProgress({ current: 0, total: targetBooks.length });

    try {
      const updates = targetBooks.map(book => ({
        id: book.id,
        price: inputPrices[Math.floor(Math.random() * inputPrices.length)]
      }));

      await batchUpdatePricesDirect(updates, (current, total) => {
        setRandomPriceProgress({ current, total });
      });

      await fetchBooks();
      setIsRandomPriceModalOpen(false);
      alert(`Đã gán giá ngẫu nhiên thành công cho ${targetBooks.length} cuốn sách của ${currentStorefront?.name || 'trang web'}!`);
    } catch (error) {
      console.error("Bulk price randomization failed:", error);
      alert("Failed to randomize prices. Check console for details.");
    } finally {
      setIsSubmitting(false);
      setRandomPriceProgress({ current: 0, total: 0 });
    }
  };

  // Direct Supabase Batch Random Categories (NEW FEATURE - 0 Vercel FOT)
  const handleBulkRandomizeCategoriesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (randomCategoryPool.length === 0) {
      alert("Vui lòng chọn ít nhất 1 thể loại trong danh sách!");
      return;
    }

    const targetBooks = randomCategoryTarget === 'selected' && selectedBookIds.length > 0
      ? books.filter(b => selectedBookIds.includes(b.id))
      : books;

    if (targetBooks.length === 0) {
      alert("Không có cuốn sách nào được chọn để cập nhật thể loại!");
      return;
    }

    setIsSubmitting(true);
    setRandomCategoryProgress({ current: 0, total: targetBooks.length });

    try {
      const assigned = randomCategoryMode === 'balanced'
        ? getBalancedCategories(targetBooks.length, randomCategoryPool)
        : targetBooks.map(() => randomCategoryPool[Math.floor(Math.random() * randomCategoryPool.length)]);

      const updates = targetBooks.map((b, idx) => ({
        id: b.id,
        category: assigned[idx]
      }));

      await batchUpdateCategoriesDirect(updates, (current, total) => {
        setRandomCategoryProgress({ current, total });
      });

      await fetchBooks();
      setIsRandomCategoryModalOpen(false);
      alert(`Đã phân bổ thể loại thành công cho ${targetBooks.length} cuốn sách của ${currentStorefront?.name || 'trang web'}!`);
    } catch (error) {
      console.error("Bulk category randomization failed:", error);
      alert("Cập nhật thể loại thất bại. Vui lòng kiểm tra console.");
    } finally {
      setIsSubmitting(false);
      setRandomCategoryProgress({ current: 0, total: 0 });
    }
  };

  const handleActivateStripeSetting = async (id: string) => {
    try {
      await activateStripeSetting(id, selectedSite);
      await fetchStripeSettings();
    } catch (error) {
      alert("Failed to activate Stripe account");
    }
  };

  const handleDeleteStripeSetting = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Stripe configuration?")) return;
    try {
      await deleteStripeSetting(id);
      await fetchStripeSettings();
    } catch (error) {
      alert("Failed to delete Stripe configuration");
    }
  };

  // PayPal Handlers
  const handleStartAddPayPalSetting = () => {
    setEditingPayPalSetting(null);
    const targetSite = selectedSite !== 'all' ? selectedSite : 'bookbazaar';
    const siteObj = STOREFRONTS.find(s => s.id === targetSite);
    setPaypalFormData({ 
      site_id: targetSite,
      account_name: siteObj ? `${siteObj.name} PayPal Gateway` : "Main PayPal Gateway",
      client_id: "", 
      client_secret: "", 
      mode: "live",
      is_active: true 
    });
    setIsPayPalModalOpen(true);
  };

  const handleStartEditPayPalSetting = (setting: PayPalSetting) => {
    setEditingPayPalSetting(setting);
    setPaypalFormData({
      site_id: setting.site_id || (selectedSite !== 'all' ? selectedSite : "bookbazaar"),
      account_name: setting.account_name,
      client_id: setting.client_id || "",
      client_secret: setting.client_secret || "",
      mode: setting.mode || "live",
      is_active: setting.is_active
    });
    setIsPayPalModalOpen(true);
  };

  const handleAddPayPalSettingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paypalFormData.account_name || !paypalFormData.client_id || !paypalFormData.client_secret) {
      alert("Please enter Account Name, Client ID, and Client Secret.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingPayPalSetting) {
        await updatePayPalSetting(editingPayPalSetting.id, paypalFormData);
      } else {
        await addPayPalSetting(paypalFormData);
      }
      await fetchPayPalSettings();
      setIsPayPalModalOpen(false);
      setEditingPayPalSetting(null);
    } catch (error: any) {
      console.error("Failed to save PayPal account:", error);
      alert(error.response?.data?.error || error.message || "Failed to save PayPal account configuration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivatePayPalSetting = async (id: string) => {
    try {
      await activatePayPalSetting(id, selectedSite);
      await fetchPayPalSettings();
    } catch (error) {
      alert("Failed to activate PayPal account");
    }
  };

  const handleDeletePayPalSetting = async (id: string) => {
    if (!confirm("Are you sure you want to delete this PayPal configuration?")) return;
    try {
      await deletePayPalSetting(id);
      await fetchPayPalSettings();
    } catch (error) {
      alert("Failed to delete PayPal configuration");
    }
  };

  const handleToggleTicketStatus = async (ticket: SupportTicket) => {
    const nextStatus = ticket.status === 'resolved' ? 'pending' : 'resolved';
    try {
      await updateSupportTicketStatus(ticket.id, nextStatus);
      await fetchTickets();
    } catch (error) {
      alert("Không thể cập nhật trạng thái tin nhắn.");
    }
  };

  const handleDeleteTicket = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa tin nhắn hỗ trợ này không?")) return;
    try {
      await deleteSupportTicket(id);
      await fetchTickets();
      if (selectedTicketForView?.id === id) {
        setSelectedTicketForView(null);
      }
    } catch (error) {
      alert("Không thể xóa tin nhắn hỗ trợ.");
    }
  };

  const handleUpdateOrderStatus = async (order: Order, nextStatus: string) => {
    try {
      await updateOrderStatus(order.id, nextStatus);
      await fetchOrders();
      if (selectedOrderForView?.id === order.id) {
        setSelectedOrderForView({ ...selectedOrderForView, status: nextStatus });
      }
    } catch (error) {
      alert("Không thể cập nhật trạng thái đơn hàng.");
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa đơn hàng này không?")) return;
    try {
      await deleteOrder(id);
      await fetchOrders();
      if (selectedOrderForView?.id === id) {
        setSelectedOrderForView(null);
      }
    } catch (error) {
      alert("Không thể xóa đơn hàng.");
    }
  };

  const handleCleanupExpiredOrders = async () => {
    if (!confirm("Hệ thống sẽ tự động tìm và xóa tất cả các đơn hàng 'Chờ thanh toán' đã quá 2 ngày. Bạn có muốn thực hiện không?")) return;
    setIsCleaningOrders(true);
    try {
      const res: any = await cleanupExpiredOrders();
      const count = res?.data?.deleted_count ?? 0;
      await fetchOrders();
      alert(`Đã dọn dẹp thành công ${count} đơn hàng chờ thanh toán quá hạn 2 ngày!`);
    } catch (error) {
      console.error("Cleanup error:", error);
      alert("Dọn dẹp đơn hàng thất bại. Vui lòng kiểm tra console.");
    } finally {
      setIsCleaningOrders(false);
    }
  };

  const handleEdit = (book: Book) => {
    setEditingBook(book);
    setFormData({
      site_id: book.site_id || (selectedSite !== 'all' ? selectedSite : "bookbazaar"),
      title: book.title,
      author: book.author,
      description: cleanExtractedDescription(book.description || ""),
      category: book.category,
      price: book.price,
      publisher: book.details?.Publisher || "",
      pages: book.details?.Pages || ""
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      site_id: selectedSite !== 'all' ? selectedSite : 'bookbazaar',
      title: "",
      author: "",
      description: "",
      category: "",
      price: "",
      publisher: "",
      pages: ""
    });
    setBookFile(null);
    setCoverImage(null);
    setEditingBook(null);
    setIsModalOpen(false);
  };

  // Direct Supabase Single Book Submit (0 Vercel FOT)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let fileUrl = editingBook?.file_url || "";
      let coverUrl = editingBook?.cover_url || "";

      // 1. Direct Supabase Storage Uploads if files provided
      if (bookFile) {
        fileUrl = await uploadBookFileDirect(bookFile);
      }
      if (coverImage) {
        coverUrl = await uploadCoverFileDirect(coverImage);
      }

      const targetSite = formData.site_id || (selectedSite !== 'all' ? selectedSite : 'bookbazaar');
      const details = { Publisher: formData.publisher, Pages: formData.pages, site_id: targetSite };

      if (editingBook) {
        await updateBookDirect(editingBook.id, {
          site_id: targetSite,
          title: formData.title,
          author: formData.author,
          description: formData.description,
          category: formData.category,
          price: formData.price,
          details,
          file_url: fileUrl,
          cover_url: coverUrl
        });
      } else {
        await createBookDirect({
          site_id: targetSite,
          title: formData.title,
          author: formData.author,
          description: formData.description,
          category: formData.category,
          price: formData.price,
          details,
          file_url: fileUrl,
          cover_url: coverUrl
        });
      }
      
      await fetchBooks();
      resetForm();
    } catch (error) {
      console.error("Submission failed:", error);
      alert("Operation failed. Check console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Direct Supabase Bulk EPUB Submit with Balanced Category Distribution (0 Vercel FOT)
  const handleBulkSubmit = async () => {
    if (bulkBookFiles.length === 0) return;
    setIsSubmitting(true);
    setBulkProgress({ current: 0, total: bulkBookFiles.length });

    const targetSiteId = selectedSite !== 'all' ? selectedSite : 'bookpatr';

    try {
      for (let i = 0; i < bulkBookFiles.length; i++) {
        setBulkProgress({ current: i + 1, total: bulkBookFiles.length });
        const file = bulkBookFiles[i];
        const manualCover = bulkCoverFiles[i] || null;

        let title = file.name
          .replace(/\.[^/.]+$/, "")
          .replace(/^[\d\s.\-_]+/, "")
          .replace(/_/g, " ")
          .trim();

        let author = bulkAuthor.trim() || "Unknown Author";
        let description = "";
        let extractedCoverFile: File | null = null;

        if (file.name.toLowerCase().endsWith(".epub")) {
          const epubData = await parseEpubFile(file, bulkAuthor);
          if (epubData.title) title = epubData.title;
          if (epubData.author && (!bulkAuthor || bulkAuthor.trim() === "")) {
            author = epubData.author;
          }
          if (epubData.description) description = epubData.description;
          extractedCoverFile = epubData.coverFile;
        }

        if (!description) {
          description = `Collection volume for ${title}. An essential guide for readers.`;
        }

        const finalCover = manualCover || extractedCoverFile;

        // 1. Direct Supabase Storage Uploads (0 Vercel FOT)
        const fileUrl = await uploadBookFileDirect(file);
        let coverUrl = "";
        if (finalCover) {
          coverUrl = await uploadCoverFileDirect(finalCover);
        }

        const assignedCategory = assignedBulkCategories[i] || bulkSingleCategory || "Non-Fiction";

        // 2. Direct Supabase Database Insert (0 Vercel FOT)
        await createBookDirect({
          site_id: targetSiteId,
          title,
          author,
          description,
          category: assignedCategory,
          price: bulkPrice || "$12.00",
          details: { Publisher: "Signature Press", Pages: "120", site_id: targetSiteId },
          file_url: fileUrl,
          cover_url: coverUrl
        });
      }

      await fetchBooks();
      setBulkBookFiles([]);
      setBulkCoverFiles([]);
      setIsBulkModalOpen(false);
      alert(`Đã upload thành công ${bulkBookFiles.length} cuốn sách lên website ${targetSiteId.toUpperCase()}!`);
    } catch (error: any) {
      console.error("Bulk upload failed:", error);
      const errDetail = error.message || "Unknown error";
      alert(`Bulk upload failed at index ${bulkProgress.current}: ${errDetail}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter storefronts for dropdown search
  const filteredStorefronts = useMemo(() => {
    if (!siteSearchTerm.trim()) return STOREFRONTS;
    const term = siteSearchTerm.toLowerCase();
    return STOREFRONTS.filter(s => 
      s.name.toLowerCase().includes(term) || 
      (s.domain && s.domain.toLowerCase().includes(term)) ||
      s.id.toLowerCase().includes(term)
    );
  }, [siteSearchTerm]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Main Header & Website Dropdown Selector */}
        <header className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 flex-shrink-0">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Book Management System
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Zap className="w-3 h-3 text-emerald-600" /> Direct Supabase (0 FOT)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Quản lý kho sách, tối ưu hóa tốc độ tải và cấu hình cổng thanh toán Stripe riêng biệt.
              </p>
            </div>
          </div>

          {/* RIGHT SIDE: ADMIN CONTROLS OR GUEST LOGIN */}
          {isAdminLoggedIn ? (
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full lg:w-auto">
              {/* CUSTOM SEARCHABLE WEBSITE SELECTOR DROPDOWN */}
              <div className="relative flex-grow sm:w-80" ref={dropdownRef}>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Chọn Website Cần Quản Lý:
                </label>

                {/* Dropdown Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsSiteDropdownOpen(!isSiteDropdownOpen)}
                  className="w-full px-4 py-2 rounded-2xl border-2 border-indigo-600 bg-white hover:bg-indigo-50/40 text-slate-900 font-bold text-xs flex items-center justify-between gap-3 shadow-xs transition-all focus:outline-none focus:ring-4 focus:ring-indigo-500/20 cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    {selectedSite === 'all' ? (
                      <>
                        <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                          <Globe className="w-3.5 h-3.5" />
                        </div>
                        <div className="text-left truncate">
                          <span className="font-bold text-indigo-950 block text-xs truncate">Tất cả {STOREFRONTS.length} Website</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div 
                          className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-black text-[10px] flex-shrink-0 shadow-xs"
                          style={{ backgroundColor: currentStorefront?.themeColor || '#4F46E5' }}
                        >
                          {currentStorefront?.name.substring(0, 2).toUpperCase() || 'WB'}
                        </div>
                        <div className="text-left truncate">
                          <span className="font-bold text-slate-900 block text-xs truncate">{currentStorefront?.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono block truncate">{currentStorefront?.domain}</span>
                        </div>
                      </>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-indigo-600 transition-transform duration-200 ${isSiteDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Searchable Dropdown Popup Menu */}
                {isSiteDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    <div className="p-2.5 border-b border-slate-100 bg-slate-50/70">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Tìm tên website hoặc domain..."
                          value={siteSearchTerm}
                          onChange={(e) => setSiteSearchTerm(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                        />
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSite('all');
                          setIsSiteDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          selectedSite === 'all' 
                            ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200' 
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                            <Globe className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="font-bold">🌐 Xem Tất Cả ({STOREFRONTS.length} Website)</div>
                            <div className="text-[10px] text-slate-400">Xem và lọc toàn bộ sách hệ thống</div>
                          </div>
                        </div>
                        {selectedSite === 'all' && <Check className="w-4 h-4 text-indigo-600" />}
                      </button>

                      <div className="h-px bg-slate-100 my-1" />

                      {filteredStorefronts.map((site) => {
                        const isSelected = selectedSite === site.id;
                        return (
                          <button
                            key={site.id}
                            type="button"
                            onClick={() => {
                              setSelectedSite(site.id);
                              setIsSiteDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                              isSelected 
                                ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200' 
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate pr-2">
                              <div 
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-white font-extrabold text-[10px] shadow-xs flex-shrink-0"
                                style={{ backgroundColor: site.themeColor }}
                              >
                                {site.name.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="truncate">
                                <div className="font-bold text-slate-800 truncate">{site.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono truncate">{site.domain}</div>
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Tabs */}
              <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-2xl">
                <button
                  onClick={() => setActiveTab('books')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'books'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <BookIcon className="w-3.5 h-3.5" />
                  Sách ({books.length})
                </button>
                <button
                  onClick={() => setActiveTab('stripe')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'stripe'
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Stripe ({currentSiteStripeSettings.length})
                </button>
                <button
                  onClick={() => setActiveTab('paypal')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'paypal'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="font-extrabold text-[#0079C1] text-xs">P</span>
                  PayPal ({currentSitePayPalSettings.length})
                </button>
                <button
                  onClick={() => setActiveTab('tickets')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'tickets'
                      ? 'bg-white text-rose-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Hỗ Trợ ({currentSiteTickets.length})
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'orders'
                      ? 'bg-white text-emerald-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Đơn Hàng ({currentSiteOrders.length})
                </button>
                <button
                  onClick={() => setActiveTab('whop')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'whop'
                      ? 'bg-white text-orange-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#FF6243] animate-pulse"></span>
                  <span className="font-extrabold text-[#FF6243]">W</span>
                  Whop ({whopLinks.length})
                </button>
              </div>

              {/* Admin Profile & Logout Button */}
              <div className="flex items-center gap-2 pl-1">
                <span className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  lichdt
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 transition-colors cursor-pointer"
                  title="Đăng xuất quản trị"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 flex items-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <Lock className="w-4 h-4" />
                <span>Đăng Nhập Quản Trị</span>
              </button>
            </div>
          )}
        </header>

        {/* Current Active Storefront Banner (Admin Only) */}
        {isAdminLoggedIn && (
          <div className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-md">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs text-slate-300 font-medium">Đang làm việc trên:</span>
              <span className="text-sm font-bold text-white flex items-center gap-2">
                {selectedSite === 'all' ? 'Tất Cả 11 Website' : currentStorefront?.name}
                {selectedSite !== 'all' && currentStorefront?.domain && (
                  <span className="text-xs text-slate-400 font-normal">({currentStorefront.domain})</span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs flex-wrap">
              <span className="text-slate-400">
                📚 Sách: <strong className="text-white">{books.length} cuốn</strong>
              </span>
              <span className="text-slate-400">
                💳 Cổng Stripe: <strong className={activeStripeSettingForSite ? "text-emerald-400" : "text-amber-400"}>
                  {activeStripeSettingForSite ? activeStripeSettingForSite.account_name : "Chưa cấu hình"}
                </strong>
              </span>
              <span className="text-slate-400">
                🅿️ Cổng PayPal: <strong className={activePayPalSettingForSite ? "text-blue-400" : "text-amber-400"}>
                  {activePayPalSettingForSite ? `${activePayPalSettingForSite.account_name} (${activePayPalSettingForSite.mode.toUpperCase()})` : "Chưa cấu hình"}
                </strong>
              </span>
              <span className="text-slate-400">
                ⚡ Whop Links: <strong className="text-orange-400">{whopLinks.length} links ({whopUsers.length} users)</strong>
              </span>
            </div>
          </div>
        )}

        {/* TAB 1: BOOKS MANAGEMENT (ADMIN ONLY) */}
        {isAdminLoggedIn && activeTab === 'books' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex flex-wrap items-center gap-2">
                {selectedBookIds.length > 0 && (
                  <button 
                    onClick={handleDeleteSelected}
                    disabled={isSubmitting}
                    className="bg-rose-50 text-rose-600 border border-rose-200 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-100 transition-all text-xs"
                  >
                    <Trash2 className="w-4 h-4" />
                    Xóa Đã Chọn ({selectedBookIds.length})
                  </button>
                )}
                
                {books.length > 0 && (
                  <button 
                    onClick={handleDeleteAll}
                    disabled={isSubmitting}
                    className="bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-red-700 transition-all text-xs shadow-sm shadow-red-200 disabled:opacity-50"
                  >
                    <Trash className="w-4 h-4" />
                    Xóa Tất Cả ({books.length})
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2.5">
                {/* NEW FEATURE: Standalone Random Categories Button */}
                <button 
                  onClick={() => setIsRandomCategoryModalOpen(true)}
                  className="bg-purple-50 text-purple-700 border border-purple-200 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-purple-100 transition-all text-xs shadow-xs cursor-pointer"
                >
                  <Shuffle className="w-4 h-4 text-purple-600" />
                  Random Thể Loại
                </button>

                {/* Random Prices Button */}
                <button 
                  onClick={() => setIsRandomPriceModalOpen(true)}
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-100 transition-all text-xs shadow-xs cursor-pointer"
                >
                  <Dices className="w-4 h-4 text-emerald-600" />
                  Random Giá Sách
                </button>

                {/* Bulk EPUB Upload Button */}
                <button 
                  onClick={() => setIsBulkModalOpen(true)}
                  className="bg-white text-indigo-600 border-2 border-indigo-600 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-50 transition-all text-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Upload EPUB Hàng Loạt
                </button>

                {/* Single Book Add Button */}
                <button 
                  onClick={() => {
                    setFormData({
                      ...formData,
                      site_id: selectedSite !== 'all' ? selectedSite : 'bookbazaar'
                    });
                    setIsModalOpen(true);
                  }}
                  className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 text-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Thêm Sách Mới
                </button>
              </div>
            </div>

            {/* Filters & Search Control Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col lg:flex-row gap-3 justify-between items-center">
                {/* Search Box */}
                <div className="relative w-full lg:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Tìm tên sách hoặc tác giả..."
                    className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 w-full lg:w-auto items-center">
                  {/* Author Filter */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select 
                      value={selectedAuthor} 
                      onChange={(e) => setSelectedAuthor(e.target.value)}
                      className="bg-transparent border-none focus:outline-none text-slate-700 font-medium text-xs cursor-pointer"
                    >
                      <option value="">Tất cả tác giả ({authors.length})</option>
                      {authors.map(author => (
                        <option key={author} value={author}>{author}</option>
                      ))}
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    <select 
                      value={selectedCategory} 
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-transparent border-none focus:outline-none text-slate-700 font-medium text-xs cursor-pointer"
                    >
                      <option value="">Tất cả thể loại ({categories.length})</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Price Filter */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                    <select 
                      value={selectedPriceFilter} 
                      onChange={(e) => setSelectedPriceFilter(e.target.value)}
                      className="bg-transparent border-none focus:outline-none text-slate-700 font-medium text-xs cursor-pointer"
                    >
                      <option value="">Tất cả mức giá</option>
                      {prices.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  {isAnyFilterActive && (
                    <button 
                      onClick={clearFilters}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      title="Xóa bộ lọc"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="text-slate-400 text-xs font-semibold px-2">
                    Hiển thị {filteredBooks.length} / {books.length} cuốn sách
                  </div>
                </div>
              </div>

              {/* Books Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="w-12 px-4 py-3.5 text-center">
                        <input 
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-3.5">Chi Tiết Sách</th>
                      <th className="px-6 py-3.5">Website</th>
                      <th className="px-6 py-3.5">Thể Loại</th>
                      <th className="px-6 py-3.5">Giá Bán</th>
                      <th className="px-6 py-3.5">Files</th>
                      <th className="px-6 py-3.5 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                          <span>Đang tải danh sách sách từ Supabase...</span>
                        </td>
                      </tr>
                    ) : filteredBooks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center text-slate-400">
                          <BookIcon className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                          <p className="font-bold text-slate-600 text-sm">Chưa có cuốn sách nào trên website này.</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Bấm &quot;+ Thêm Sách Mới&quot; hoặc &quot;Upload EPUB Hàng Loạt&quot; để đăng tải sách cho {currentStorefront?.name || 'website này'}!
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredBooks.map((book) => {
                        const isSelected = selectedBookIds.includes(book.id);
                        const bookSite = STOREFRONTS.find(s => s.id === book.site_id);

                        return (
                          <tr 
                            key={book.id} 
                            className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}
                          >
                            <td className="w-12 px-4 py-4 text-center">
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelect(book.id)}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-16 bg-slate-100 rounded overflow-hidden flex-shrink-0 shadow-sm border border-slate-200">
                                  {book.cover_url ? (
                                    <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <ImageIcon className="w-5 h-5 text-slate-300" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-800 line-clamp-1">{book.title}</div>
                                  <div className="text-xs text-slate-500">{book.author}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {bookSite ? (
                                <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md border ${bookSite.badgeBg} ${bookSite.badgeText}`}>
                                  {bookSite.name}
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md border border-slate-200">
                                  🌐 Chung
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full border border-indigo-100">
                                {book.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-700 text-sm">{book.price}</td>
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                {book.file_url ? (
                                  <a href={book.file_url} target="_blank" className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-100 hover:text-indigo-600 transition-colors" title="Download Book">
                                    <FileText className="w-4 h-4" />
                                  </a>
                                ) : (
                                  <span className="text-slate-300 text-xs">No file</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleEdit(book)}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="Edit Book"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDelete(book.id)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Delete Book"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: STRIPE CONFIGURATION (ADMIN ONLY) */}
        {isAdminLoggedIn && activeTab === 'stripe' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-sm font-bold text-slate-800">
                  Cấu hình cổng thanh toán Stripe
                </h2>
                <p className="text-xs text-slate-400">
                  Mỗi website có thể được gán một tài khoản Stripe riêng để nhận thanh toán độc lập.
                </p>
              </div>
              <button 
                onClick={handleStartAddStripeSetting}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 text-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Thêm Cổng Stripe Mới
              </button>
            </div>

            {/* Stripe Accounts Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Tên Cổng / Gợi Nhớ</th>
                      <th className="px-6 py-3.5">Áp Dụng Cho Website</th>
                      <th className="px-6 py-3.5">Khóa Cổng (Publishable & Secret Key)</th>
                      <th className="px-6 py-3.5">Trạng Thái</th>
                      <th className="px-6 py-3.5 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {stripeLoading ? (
                      <tr>
                        <td colSpan={5} className="py-20 text-center text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600 mb-2" />
                          <span>Đang tải cấu hình Stripe...</span>
                        </td>
                      </tr>
                    ) : currentSiteStripeSettings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-16 text-center text-slate-400">
                          <CreditCard className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                          <p className="font-bold text-slate-600">Chưa có cấu hình Stripe nào cho website này.</p>
                          <p className="text-xs text-slate-400 mt-1">Bấm &quot;Thêm Cổng Stripe Mới&quot; để thiết lập nhận thanh toán!</p>
                        </td>
                      </tr>
                    ) : (
                      currentSiteStripeSettings.map((setting) => {
                        const siteObj = STOREFRONTS.find(s => s.id === setting.site_id);
                        return (
                          <tr key={setting.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-800">{setting.account_name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">ID: {setting.id.substring(0, 8)}...</div>
                            </td>
                            <td className="px-6 py-4">
                              {siteObj ? (
                                <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md border ${siteObj.badgeBg} ${siteObj.badgeText}`}>
                                  {siteObj.name}
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md border border-slate-200">
                                  🌐 Chung Cho Tất Cả
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1.5 min-w-[280px]">
                                {/* Publishable Key Row */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded flex-shrink-0 w-7 text-center">
                                    PK
                                  </span>
                                  {setting.publishable_key ? (
                                    <div className="flex items-center justify-between gap-1 flex-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                                      <span className="font-mono text-[11px] text-slate-700 select-all truncate max-w-[180px] sm:max-w-[240px]">
                                        {visibleKeys[`pk_${setting.id}`]
                                          ? setting.publishable_key
                                          : `${setting.publishable_key.substring(0, 12)}••••••••••••`}
                                      </span>
                                      <div className="flex items-center gap-0.5 flex-shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => toggleKeyVisibility(`pk_${setting.id}`)}
                                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition-colors cursor-pointer"
                                          title={visibleKeys[`pk_${setting.id}`] ? "Ẩn Publishable Key" : "Xem full Publishable Key"}
                                        >
                                          {visibleKeys[`pk_${setting.id}`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-indigo-600" />}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyKey(setting.publishable_key || '', `pk_${setting.id}`)}
                                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-white rounded transition-colors cursor-pointer"
                                          title="Sao chép Publishable Key"
                                        >
                                          {copiedKeyId === `pk_${setting.id}` ? (
                                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                                              <Check className="w-3 h-3" /> Đã chép
                                            </span>
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">Chưa nhập PK</span>
                                  )}
                                </div>

                                {/* Secret Key Row */}
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded flex-shrink-0 w-7 text-center">
                                    SK
                                  </span>
                                  {setting.secret_key ? (
                                    <div className="flex items-center justify-between gap-1 flex-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                                      <span className="font-mono text-[11px] text-slate-700 select-all truncate max-w-[180px] sm:max-w-[240px]">
                                        {visibleKeys[`sk_${setting.id}`]
                                          ? setting.secret_key
                                          : `${setting.secret_key.substring(0, 10)}••••••••••••••••`}
                                      </span>
                                      <div className="flex items-center gap-0.5 flex-shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => toggleKeyVisibility(`sk_${setting.id}`)}
                                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-white rounded transition-colors cursor-pointer"
                                          title={visibleKeys[`sk_${setting.id}`] ? "Ẩn Secret Key" : "Xem full Secret Key"}
                                        >
                                          {visibleKeys[`sk_${setting.id}`] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-indigo-600" />}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyKey(setting.secret_key || '', `sk_${setting.id}`)}
                                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-white rounded transition-colors cursor-pointer"
                                          title="Sao chép Secret Key"
                                        >
                                          {copiedKeyId === `sk_${setting.id}` ? (
                                            <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">
                                              <Check className="w-3 h-3" /> Đã chép
                                            </span>
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-slate-400 italic">Chưa nhập SK</span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {setting.is_active ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  Đang Hoạt Động
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full">
                                  Chưa Kích Hoạt
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {!setting.is_active && (
                                  <button
                                    onClick={() => handleActivateStripeSetting(setting.id)}
                                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg font-bold text-xs hover:bg-emerald-700 transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Kích Hoạt
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleStartEditStripeSetting(setting)}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                  title="Edit Configuration"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteStripeSetting(setting.id)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                  title="Delete Configuration"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PAYPAL SETTINGS MANAGEMENT (ADMIN ONLY) */}
        {isAdminLoggedIn && activeTab === 'paypal' && (
          <div className="space-y-4">
            {/* Header / Actions */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 text-[#0079C1] flex items-center justify-center font-extrabold text-sm border border-blue-200">
                    P
                  </span>
                  Cấu Hình Cổng Thanh Toán PayPal REST API
                  {selectedSite !== 'all' && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-bold border border-blue-100">
                      Website: {currentStorefront?.name}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Mỗi website có thể cấu hình tài khoản PayPal riêng (hỗ trợ cả Live & Sandbox), nhận tiền trực tiếp từ khách hàng thanh toán qua PayPal.
                </p>
              </div>
              <button
                onClick={handleStartAddPayPalSetting}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-200 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Thêm Cổng PayPal Cho {selectedSite === 'all' ? 'Hệ Thống' : currentStorefront?.name}
              </button>
            </div>

            {/* PayPal Settings Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3.5 px-6">Website / Domain</th>
                      <th className="py-3.5 px-6">Tên Cấu Hình</th>
                      <th className="py-3.5 px-6">Chế Độ</th>
                      <th className="py-3.5 px-6">Client ID</th>
                      <th className="py-3.5 px-6">Client Secret</th>
                      <th className="py-3.5 px-6 text-center">Trạng Thái</th>
                      <th className="py-3.5 px-6 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {paypalLoading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                          Đang tải danh sách tài khoản PayPal...
                        </td>
                      </tr>
                    ) : currentSitePayPalSettings.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400">
                          Chưa có tài khoản PayPal nào được cấu hình cho {selectedSite === 'all' ? 'hệ thống' : currentStorefront?.name}.
                          <div className="mt-3">
                            <button
                              onClick={handleStartAddPayPalSetting}
                              className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs hover:bg-blue-700 transition-all cursor-pointer"
                            >
                              Thêm Cổng PayPal Ngay
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentSitePayPalSettings.map((setting) => {
                        const siteObj = STOREFRONTS.find(s => s.id === setting.site_id);
                        const isGlobal = setting.site_id === 'all';
                        const isLive = (setting.mode || 'live').toLowerCase() === 'live';
                        const clientIdId = `paypal_client_${setting.id}`;
                        const secretKeyId = `paypal_secret_${setting.id}`;
                        const isClientIdVisible = visibleKeys[clientIdId];
                        const isSecretKeyVisible = visibleKeys[secretKeyId];

                        return (
                          <tr key={setting.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-2">
                                {isGlobal ? (
                                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[11px] flex items-center gap-1">
                                    🌐 Toàn Hệ Thống (Fallback)
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span 
                                      className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] ${siteObj?.badgeBg || 'bg-slate-50 border-slate-200'} ${siteObj?.badgeText || 'text-slate-800'}`}
                                    >
                                      {siteObj?.name || setting.site_id}
                                    </span>
                                    {siteObj?.domain && (
                                      <span className="text-[10px] text-slate-400 font-mono">({siteObj.domain})</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6 font-bold text-slate-900">
                              {setting.account_name}
                            </td>
                            <td className="py-4 px-6">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                isLive 
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {isLive ? 'LIVE' : 'SANDBOX'}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg w-fit">
                                <span>
                                  {isClientIdVisible 
                                    ? setting.client_id 
                                    : (setting.client_id ? `${setting.client_id.substring(0, 8)}••••••••` : 'None')}
                                </span>
                                {setting.client_id && (
                                  <>
                                    <button 
                                      onClick={() => toggleKeyVisibility(clientIdId)}
                                      className="p-1 hover:text-blue-600 text-slate-400 cursor-pointer"
                                      title={isClientIdVisible ? "Ẩn Client ID" : "Xem Client ID"}
                                    >
                                      {isClientIdVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                    <button 
                                      onClick={() => handleCopyKey(setting.client_id, clientIdId)}
                                      className="p-1 hover:text-blue-600 text-slate-400 cursor-pointer"
                                      title="Sao chép Client ID"
                                    >
                                      {copiedKeyId === clientIdId ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg w-fit">
                                <span>
                                  {isSecretKeyVisible 
                                    ? setting.client_secret 
                                    : (setting.client_secret ? `${setting.client_secret.substring(0, 6)}••••••••` : '••••••••')}
                                </span>
                                {setting.client_secret && (
                                  <>
                                    <button 
                                      onClick={() => toggleKeyVisibility(secretKeyId)}
                                      className="p-1 hover:text-blue-600 text-slate-400 cursor-pointer"
                                      title={isSecretKeyVisible ? "Ẩn Secret Key" : "Xem Secret Key"}
                                    >
                                      {isSecretKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                    <button 
                                      onClick={() => handleCopyKey(setting.client_secret, secretKeyId)}
                                      className="p-1 hover:text-blue-600 text-slate-400 cursor-pointer"
                                      title="Sao chép Secret Key"
                                    >
                                      {copiedKeyId === secretKeyId ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-center">
                              {setting.is_active ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check className="w-3.5 h-3.5" /> Đang Hoạt Động
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-400">
                                  Chưa Kích Hoạt
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {!setting.is_active && (
                                  <button
                                    onClick={() => handleActivatePayPalSetting(setting.id)}
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Kích Hoạt
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleStartEditPayPalSetting(setting)}
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer"
                                  title="Edit Configuration"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeletePayPalSetting(setting.id)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                  title="Delete Configuration"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SUPPORT INQUIRIES & TICKETS (ADMIN ONLY) */}
        {isAdminLoggedIn && activeTab === 'tickets' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-800">
                    Hộp Thư Hỗ Trợ & Yêu Cầu Khách Hàng (Support Desk)
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                    {currentSiteTickets.length} Tin Nhắn
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tất cả tin nhắn gửi từ trang /contact của {selectedSite === 'all' ? 'toàn bộ 11 website' : currentStorefront?.name}. Tự động đồng bộ thời gian thực.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchTickets}
                  disabled={ticketsLoading}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ticketsLoading ? 'animate-spin' : ''}`} />
                  Làm mới
                </button>
              </div>
            </div>

            {/* Tickets Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Thời Gian</th>
                      <th className="px-6 py-3.5">Website</th>
                      <th className="px-6 py-3.5">Khách Hàng (Tên & Email)</th>
                      <th className="px-6 py-3.5">Tiêu Đề & Nội Dung</th>
                      <th className="px-6 py-3.5 text-center">Trạng Thái</th>
                      <th className="px-6 py-3.5 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {ticketsLoading ? (
                      <tr>
                        <td colSpan={6} className="py-20 text-center text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-rose-600 mb-2" />
                          <span>Đang tải danh sách tin nhắn hỗ trợ...</span>
                        </td>
                      </tr>
                    ) : currentSiteTickets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-slate-400">
                          <Inbox className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                          <p className="font-bold text-slate-600">Chưa có tin nhắn hỗ trợ nào cho website này.</p>
                          <p className="text-xs text-slate-400 mt-1">Khi khách hàng gửi form trên trang /contact, tin nhắn sẽ xuất hiện tại đây!</p>
                        </td>
                      </tr>
                    ) : (
                      currentSiteTickets.map((ticket) => {
                        const siteObj = STOREFRONTS.find(s => s.id === ticket.site_id);
                        const isResolved = ticket.status === 'resolved';
                        const dateStr = new Date(ticket.created_at).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        return (
                          <tr key={ticket.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                              {dateStr}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {siteObj ? (
                                <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md border ${siteObj.badgeBg} ${siteObj.badgeText}`}>
                                  {siteObj.name}
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md border border-slate-200">
                                  {ticket.site_id}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900">{ticket.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <a 
                                  href={`mailto:${ticket.email}?subject=Re: ${encodeURIComponent(ticket.subject)}`}
                                  className="text-indigo-600 hover:underline font-mono text-[11px]"
                                >
                                  {ticket.email}
                                </a>
                                <button
                                  onClick={() => handleCopyKey(ticket.email, `ticket_email_${ticket.id}`)}
                                  className="text-slate-400 hover:text-indigo-600 cursor-pointer"
                                  title="Sao chép email"
                                >
                                  {copiedKeyId === `ticket_email_${ticket.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 max-w-xs">
                              <div className="font-bold text-slate-800 truncate">{ticket.subject}</div>
                              <div className="text-slate-500 truncate text-[11px] mt-0.5">{ticket.message}</div>
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => handleToggleTicketStatus(ticket)}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all cursor-pointer inline-flex items-center gap-1 border ${
                                  isResolved
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                }`}
                                title="Bấm để đổi trạng thái"
                              >
                                {isResolved ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Đã Xử Lý
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    Chờ Xử Lý
                                  </>
                                )}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedTicketForView(ticket)}
                                  className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Xem chi tiết tin nhắn"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Chi Tiết
                                </button>
                                <a
                                  href={`mailto:${ticket.email}?subject=Re: [${ticket.site_id.toUpperCase()}] ${encodeURIComponent(ticket.subject)}`}
                                  className="px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                                  title="Gửi email phản hồi khách"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  Trả Lời
                                </a>
                                <button
                                  onClick={() => handleDeleteTicket(ticket.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                  title="Xóa tin nhắn"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CUSTOMER ORDERS (ADMIN ONLY) */}
        {isAdminLoggedIn && activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-emerald-600" />
                    Quản Lý Đơn Hàng & Vòng Đời Thanh Toán
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {currentSiteOrders.length} Đơn
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Đơn hàng được lưu khi khách hàng checkout. Đơn &quot;Chờ thanh toán&quot; sẽ tự động xóa sau 1-2 ngày để giải phóng bộ nhớ.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
                <button
                  onClick={handleCleanupExpiredOrders}
                  disabled={isCleaningOrders}
                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-amber-200 transition-colors cursor-pointer disabled:opacity-50"
                  title="Xóa tất cả các đơn Chờ thanh toán đã quá hạn 2 ngày"
                >
                  <Trash2 className={`w-3.5 h-3.5 ${isCleaningOrders ? 'animate-spin' : ''}`} />
                  <span>Dọn Dẹp Đơn Quá Hạn</span>
                </button>
                <button
                  onClick={fetchOrders}
                  disabled={ordersLoading}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
                  <span>Làm mới</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
              {/* Status Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                {[
                  { id: 'all', label: 'Tất Cả' },
                  { id: 'pending', label: '⏳ Chờ Thanh Toán' },
                  { id: 'completed', label: '✅ Đã Thanh Toán' },
                  { id: 'cancelled', label: '❌ Đã Hủy' }
                ].map((tab) => {
                  const isSelected = orderStatusFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setOrderStatusFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Search Box */}
              <div className="relative w-full md:w-72">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm mã đơn, tên, email khách..."
                  value={orderSearchTerm}
                  onChange={(e) => setOrderSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-3.5">Mã Đơn</th>
                      <th className="px-6 py-3.5">Thời Gian</th>
                      <th className="px-6 py-3.5">Website</th>
                      <th className="px-6 py-3.5">Khách Hàng</th>
                      <th className="px-6 py-3.5">Sách Đặt Mua</th>
                      <th className="px-6 py-3.5">Tổng Tiền</th>
                      <th className="px-6 py-3.5">Cổng TT</th>
                      <th className="px-6 py-3.5 text-center">Trạng Thái</th>
                      <th className="px-6 py-3.5 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {ordersLoading ? (
                      <tr>
                        <td colSpan={9} className="py-20 text-center text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" />
                          <span>Đang tải danh sách đơn hàng...</span>
                        </td>
                      </tr>
                    ) : currentSiteOrders.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-16 text-center text-slate-400">
                          <ShoppingBag className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                          <p className="font-bold text-slate-600">Chưa có đơn hàng nào phù hợp.</p>
                          <p className="text-xs text-slate-400 mt-1">Khi khách hàng đặt mua sách, đơn hàng sẽ tự động lưu trữ tại đây!</p>
                        </td>
                      </tr>
                    ) : (
                      currentSiteOrders.map((order) => {
                        const siteObj = STOREFRONTS.find(s => s.id === order.site_id);
                        const isCompleted = order.status === 'completed';
                        const isPending = order.status === 'pending';
                        const dateStr = new Date(order.created_at).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });

                        const itemCount = Array.isArray(order.items) ? order.items.length : 0;
                        const firstItemTitle = Array.isArray(order.items) && order.items[0]?.title ? order.items[0].title : 'Sách điện tử';

                        return (
                          <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-md text-[11px] border border-slate-200">
                                {order.order_code || `#${order.id.substring(0, 8)}`}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                              {dateStr}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {siteObj ? (
                                <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-md border ${siteObj.badgeBg} ${siteObj.badgeText}`}>
                                  {siteObj.name}
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md border border-slate-200">
                                  {order.site_id}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900">{order.customer_name || 'Khách hàng'}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-slate-500 font-mono text-[11px]">{order.customer_email}</span>
                                <button
                                  onClick={() => handleCopyKey(order.customer_email, `order_email_${order.id}`)}
                                  className="text-slate-400 hover:text-emerald-600 cursor-pointer"
                                  title="Sao chép email"
                                >
                                  {copiedKeyId === `order_email_${order.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 max-w-xs">
                              <div className="font-semibold text-slate-800 truncate" title={firstItemTitle}>
                                {firstItemTitle}
                              </div>
                              <div className="text-slate-400 text-[10px]">
                                {itemCount > 1 ? `+ ${itemCount - 1} cuốn sách khác` : '1 cuốn sách'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900 font-mono">
                              ${Number(order.total_amount || 0).toFixed(2)} {order.currency || 'USD'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {order.payment_method === 'paypal' ? (
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md font-bold text-[10px] flex items-center gap-1 w-fit">
                                  <span className="font-extrabold text-[#0079C1]">P</span> PayPal
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-bold text-[10px] flex items-center gap-1 w-fit">
                                  <CreditCard className="w-3 h-3 text-indigo-600" /> Stripe
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => handleUpdateOrderStatus(order, isCompleted ? 'pending' : 'completed')}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all cursor-pointer inline-flex items-center gap-1 border ${
                                  isCompleted
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                    : isPending
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                                title="Bấm để đổi trạng thái"
                              >
                                {isCompleted ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Đã Thanh Toán
                                  </>
                                ) : isPending ? (
                                  <>
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    Chờ Thanh Toán
                                  </>
                                ) : (
                                  <>
                                    <PackageX className="w-3 h-3 text-slate-400" />
                                    {order.status}
                                  </>
                                )}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedOrderForView(order)}
                                  className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Xem chi tiết đơn hàng"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Chi Tiết
                                </button>
                                <button
                                  onClick={() => handleDeleteOrder(order.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                  title="Xóa đơn hàng"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: WHOP LINKS & ACCOUNTS MANAGEMENT (SUPER CLEAN & FAST) */}
        {activeTab === 'whop' && (
          <div className="space-y-5">
            {/* User Sub-Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {whopUsers.map((u) => {
                const isSelected = (selectedWhopUser || whopUsers[0]?.id) === u.id;
                const count = whopLinks.filter(l => l.user_id === u.id).length;
                const uColor = u.color || '#FF6243';
                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedWhopUser(u.id)}
                    className={`group px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer border ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-slate-900/10'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs'
                    }`}
                  >
                    <span 
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-xs ring-2 ring-white" 
                      style={{ backgroundColor: uColor }} 
                    />
                    <span>{u.name}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {count}
                    </span>

                    {/* Quick Edit & Delete user buttons */}
                    <div className="flex items-center gap-0.5 pl-1 border-l border-slate-300/40">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditWhopUser(u);
                        }}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          isSelected
                            ? 'text-slate-300 hover:text-white hover:bg-white/20'
                            : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                        }`}
                        title={`Sửa tên & màu tab ${u.name}`}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteWhopUser(u.id, u.name);
                        }}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          isSelected
                            ? 'text-slate-300 hover:text-rose-300 hover:bg-rose-500/20'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                        title={`Xóa tab ${u.name}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={handleStartAddWhopUser}
                className="px-3.5 py-2 rounded-2xl text-xs font-bold border border-dashed border-slate-300 hover:border-orange-500 bg-white hover:bg-orange-50/50 text-slate-600 hover:text-orange-600 flex items-center gap-1.5 flex-shrink-0 transition-all cursor-pointer shadow-2xs"
                title="Thêm tab User mới"
              >
                <Plus className="w-3.5 h-3.5 text-orange-500" /> Thêm Tab
              </button>
            </div>

            {/* Quick Add Bar: Dán Link là Thêm Ngay! */}
            <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-3">
              <form onSubmit={handleQuickAddWhopLink} className="flex flex-col sm:flex-row items-center gap-2.5">
                <div className="relative flex-1 w-full">
                  <Link2 className="w-4 h-4 text-orange-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Dán đường link Whop vào đây (ví dụ: https://whop.com/get-landed/...)..."
                    value={quickWhopUrl}
                    onChange={(e) => setQuickWhopUrl(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono text-slate-800 bg-slate-50 focus:bg-white"
                  />
                </div>

                <div className="w-full sm:w-56">
                  <input
                    type="text"
                    placeholder="Tên gợi nhớ (tùy chọn)"
                    value={quickWhopTitle}
                    onChange={(e) => setQuickWhopTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-slate-800 bg-slate-50 focus:bg-white font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!quickWhopUrl.trim() || isSubmitting}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 flex-shrink-0"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Thêm Link
                </button>
              </form>

              {/* Live Preview Box (Rich OpenGraph Card preview while pasting) */}
              {isPreviewLoading && (
                <div className="p-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  <span>Đang tải thông tin & hình ảnh xem trước từ link Whop...</span>
                </div>
              )}

              {quickWhopPreview && !isPreviewLoading && (
                <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1 text-orange-600 font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      Xem trước thông tin (Rich Preview):
                    </span>
                    <span className="font-mono truncate max-w-xs">{quickWhopPreview.url}</span>
                  </div>

                  {/* Telegram / Discord Embed Box */}
                  <div className="border-l-4 border-orange-500 pl-3.5 py-1 space-y-1.5 bg-white/70 p-3 rounded-xl border-r border-t border-b border-slate-200/70 shadow-xs">
                    <div className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">
                      {quickWhopPreview.site_name || 'Whop'}
                    </div>
                    <div className="font-bold text-slate-900 text-sm">
                      {quickWhopTitle.trim() || quickWhopPreview.title}
                    </div>
                    {quickWhopPreview.description && (
                      <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {quickWhopPreview.description}
                      </div>
                    )}
                    {quickWhopPreview.image && (
                      <div className="pt-1">
                        <img
                          src={quickWhopPreview.image}
                          alt="Whop preview banner"
                          className="w-full max-h-48 object-cover rounded-xl border border-slate-200 shadow-xs"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Links List */}
            {whopLoading ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-orange-500 mb-2" />
                <span className="text-xs text-slate-500 font-bold">Đang tải danh sách link...</span>
              </div>
            ) : filteredWhopLinks.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto border border-orange-100">
                  <Link2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Chưa có link Whop nào</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Dán đường link Whop vào ô trên để thêm link truy cập nhanh!
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWhopLinks.map((link) => {
                  const userObj = whopUsers.find(u => u.id === link.user_id);
                  const isCopied = copiedWhopLinkId === link.id;
                  const uColor = userObj?.color || '#FF6243';

                  return (
                    <div
                      key={link.id}
                      className="bg-white rounded-2xl border border-slate-200 hover:border-orange-300 shadow-xs hover:shadow-md transition-all p-4 flex flex-col justify-between gap-3.5 group"
                    >
                      <div className="space-y-2.5">
                        {/* User & Meta Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            <span 
                              className="w-2 h-2 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: uColor }} 
                            />
                            <span>{userObj?.name || link.user_name || 'User'}</span>
                          </span>

                          <span className="text-[10px] text-slate-400 font-mono">
                            {link.created_at ? new Date(link.created_at).toLocaleDateString('vi-VN') : ''}
                          </span>
                        </div>

                        {/* Top URL string (Telegram style) */}
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-sky-600 hover:text-sky-700 hover:underline truncate block"
                          title={link.url}
                        >
                          {link.url}
                        </a>

                        {/* Telegram Rich Embed Card Container */}
                        <div className="border-l-4 pl-3 py-1 space-y-1.5 bg-slate-50/60 p-3 rounded-xl border border-slate-100" style={{ borderLeftColor: uColor }}>
                          <div className="text-[10px] font-bold text-orange-600 uppercase tracking-wider flex items-center justify-between">
                            <span>{link.site_name || 'Whop'}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 opacity-60" />
                          </div>

                          <div className="font-bold text-slate-900 text-sm line-clamp-2 group-hover:text-orange-600 transition-colors">
                            {link.title || link.url}
                          </div>

                          {link.description && (
                            <div className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                              {link.description}
                            </div>
                          )}

                          {/* Image preview banner if present */}
                          {link.image_url && (
                            <div className="pt-1">
                              <img
                                src={link.image_url}
                                alt={link.title || 'Whop preview'}
                                className="w-full max-h-40 object-cover rounded-xl border border-slate-200 shadow-2xs group-hover:scale-[1.01] transition-transform"
                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                        {/* Open Link / Buy Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenWhopLink(link)}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Zap className="w-3.5 h-3.5 fill-current" />
                          <span>Mở Whop Mua</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>

                        {/* Copy Link Button */}
                        <button
                          type="button"
                          onClick={() => handleCopyWhopLink(link)}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            isCopied
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                          title="Sao chép link"
                        >
                          {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => handleStartEditWhopLink(link)}
                          className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="Sửa link"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteWhopLink(link.id)}
                          className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Xóa link"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Whop Link Modal */}
      {isWhopLinkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-xs">
                  W
                </span>
                {editingWhopLink ? "Sửa Link Whop" : "Thêm Link Whop Mới"}
              </h2>
              <button 
                onClick={() => setIsWhopLinkModalOpen(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWhopLinkSubmit} className="p-6 sm:p-7 space-y-4 text-xs">
              {/* Select User */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Tài Khoản Whop (User) <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={whopLinkFormData.user_id}
                  onChange={(e) => setWhopLinkFormData({ ...whopLinkFormData, user_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-slate-800 text-sm font-semibold bg-white cursor-pointer"
                >
                  {whopUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      👤 {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Whop URL */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Đường Link Whop <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="https://whop.com/checkout/..."
                  value={whopLinkFormData.url}
                  onChange={(e) => setWhopLinkFormData({ ...whopLinkFormData, url: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none font-mono text-xs text-slate-800"
                />
              </div>

              {/* Title (Optional) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Tên Gợi Nhớ (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Ebook Vip, Khóa học kinh doanh..."
                  value={whopLinkFormData.title}
                  onChange={(e) => setWhopLinkFormData({ ...whopLinkFormData, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-slate-800 text-sm"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsWhopLinkModalOpen(false)}
                  className="flex-1 px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all text-xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  disabled={isSubmitting}
                  type="submit"
                  className="flex-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingWhopLink ? "Cập Nhật Link" : "Lưu Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Whop User Modal */}
      {isWhopUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <span 
                  className="w-7 h-7 rounded-xl flex items-center justify-center text-white shadow-xs"
                  style={{ backgroundColor: whopUserFormData.color || '#FF6243' }}
                >
                  <Users className="w-4 h-4" />
                </span>
                {editingWhopUser ? "Sửa Tên & Màu Tab User" : "Thêm Tab User Mới"}
              </h2>
              <button
                onClick={() => setIsWhopUserModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWhopUserSubmit} className="p-6 space-y-4 text-xs">
              {/* User Tab Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Tên Tab User <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ví dụ: User 1, User 2, Whop Store US, Nick Phụ..."
                  value={whopUserFormData.name}
                  onChange={(e) => setWhopUserFormData({ ...whopUserFormData, name: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-slate-800 text-sm font-semibold"
                />
              </div>

              {/* Color Picker Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-orange-500" />
                    Màu Nhận Diện Tab
                  </label>
                  <span className="text-[11px] font-mono text-slate-400 uppercase">
                    {whopUserFormData.color || '#FF6243'}
                  </span>
                </div>

                {/* Preset Palette */}
                <div className="grid grid-cols-6 gap-2 mb-3">
                  {[
                    { color: '#FF6243', label: 'Whop Cam' },
                    { color: '#6366F1', label: 'Indigo' },
                    { color: '#10B981', label: 'Emerald' },
                    { color: '#0EA5E9', label: 'Sky Blue' },
                    { color: '#8B5CF6', label: 'Purple' },
                    { color: '#F43F5E', label: 'Rose Red' },
                    { color: '#F59E0B', label: 'Amber' },
                    { color: '#06B6D4', label: 'Cyan' },
                    { color: '#84CC16', label: 'Lime' },
                    { color: '#EC4899', label: 'Pink' },
                    { color: '#14B8A6', label: 'Teal' },
                    { color: '#3B82F6', label: 'Blue' },
                  ].map((item) => (
                    <button
                      key={item.color}
                      type="button"
                      onClick={() => setWhopUserFormData({ ...whopUserFormData, color: item.color })}
                      className={`h-8 rounded-xl transition-all cursor-pointer flex items-center justify-center border ${
                        whopUserFormData.color?.toLowerCase() === item.color.toLowerCase()
                          ? 'border-slate-800 ring-2 ring-slate-800/30 scale-105 shadow-xs'
                          : 'border-transparent opacity-85 hover:opacity-100 hover:scale-105'
                      }`}
                      style={{ backgroundColor: item.color }}
                      title={item.label}
                    >
                      {whopUserFormData.color?.toLowerCase() === item.color.toLowerCase() && (
                        <Check className="w-4 h-4 text-white stroke-[3] drop-shadow-sm" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Custom Color Input */}
                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  <input
                    type="color"
                    value={whopUserFormData.color || '#FF6243'}
                    onChange={(e) => setWhopUserFormData({ ...whopUserFormData, color: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent p-0"
                    title="Tùy chọn màu bất kỳ"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={whopUserFormData.color}
                      onChange={(e) => setWhopUserFormData({ ...whopUserFormData, color: e.target.value })}
                      placeholder="#FF6243"
                      className="w-full bg-white px-3 py-1 text-xs font-mono rounded-lg border border-slate-200 outline-none uppercase font-bold text-slate-700"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700">
                    <span 
                      className="w-2.5 h-2.5 rounded-full" 
                      style={{ backgroundColor: whopUserFormData.color || '#FF6243' }} 
                    />
                    <span>{whopUserFormData.name || 'Preview'}</span>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 flex items-center justify-between gap-2 border-t border-slate-100">
                {editingWhopUser ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsWhopUserModalOpen(false);
                      handleDeleteWhopUser(editingWhopUser.id, editingWhopUser.name);
                    }}
                    className="px-3.5 py-2.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xóa User
                  </button>
                ) : (
                  <div></div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsWhopUserModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all text-xs cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    disabled={isSubmitting}
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-md shadow-orange-500/20 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingWhopUser ? "Lưu Thay Đổi" : "Tạo Tab Mới"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Stripe Account Modal */}
      {isStripeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-indigo-600" />
                {editingStripeSetting ? "Sửa Tài Khoản Stripe" : "Thêm Cổng Stripe Mới"}
              </h2>
              <button onClick={() => setIsStripeModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStripeSettingSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Website Áp Dụng Cổng Stripe Này</label>
                <select
                  required
                  value={stripeFormData.site_id}
                  onChange={(e) => {
                    const chosen = e.target.value;
                    const siteObj = STOREFRONTS.find(s => s.id === chosen);
                    setStripeFormData({
                      ...stripeFormData,
                      site_id: chosen,
                      account_name: stripeFormData.account_name || (siteObj ? `${siteObj.name} Gateway` : "")
                    });
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 text-sm font-semibold bg-white"
                >
                  {STOREFRONTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.domain})
                    </option>
                  ))}
                  <option value="all">🌐 Dùng Chung Cho Tất Cả Website (Fallback)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tên Gợi Nhớ (Account Label)</label>
                <input 
                  required
                  type="text" 
                  placeholder="Ví dụ: BookBazaar Main Stripe Account"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 text-sm"
                  value={stripeFormData.account_name}
                  onChange={(e) => setStripeFormData({...stripeFormData, account_name: e.target.value})}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Publishable Key (pk_live_... hoặc pk_test_...)</label>
                  {stripeFormData.publishable_key && (
                    <button
                      type="button"
                      onClick={() => handleCopyKey(stripeFormData.publishable_key, 'modal_pk')}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKeyId === 'modal_pk' ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Đã chép PK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Copy className="w-3.5 h-3.5" /> Sao chép PK
                        </span>
                      )}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type={showModalPublishableKey ? "text" : "password"} 
                    placeholder="pk_live_..."
                    className="w-full pl-4 pr-11 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-xs text-slate-800"
                    value={stripeFormData.publishable_key}
                    onChange={(e) => setStripeFormData({...stripeFormData, publishable_key: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPublishableKey(!showModalPublishableKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg cursor-pointer transition-colors"
                    title={showModalPublishableKey ? "Ẩn Publishable Key" : "Xem Publishable Key"}
                  >
                    {showModalPublishableKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Secret Key (sk_live_... hoặc sk_test_...)</label>
                  {stripeFormData.secret_key && (
                    <button
                      type="button"
                      onClick={() => handleCopyKey(stripeFormData.secret_key, 'modal_sk')}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKeyId === 'modal_sk' ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Đã chép SK
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Copy className="w-3.5 h-3.5" /> Sao chép SK
                        </span>
                      )}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input 
                    required
                    type={showModalSecretKey ? "text" : "password"} 
                    placeholder="sk_live_... hoặc sk_test_..."
                    className="w-full pl-4 pr-11 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-xs text-slate-800"
                    value={stripeFormData.secret_key}
                    onChange={(e) => setStripeFormData({...stripeFormData, secret_key: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalSecretKey(!showModalSecretKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg cursor-pointer transition-colors"
                    title={showModalSecretKey ? "Ẩn Secret Key" : "Xem Secret Key"}
                  >
                    {showModalSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Secret Key được sử dụng an toàn trên máy chủ backend để tạo phiên thanh toán.</p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input 
                  type="checkbox"
                  id="is_active_checkbox"
                  checked={stripeFormData.is_active}
                  onChange={(e) => setStripeFormData({...stripeFormData, is_active: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="is_active_checkbox" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Kích hoạt cổng này làm cổng nhận tiền chính của website ngay lập tức
                </label>
              </div>

              <div className="pt-4 flex gap-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsStripeModalOpen(false)}
                  className="flex-1 px-6 py-3.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all text-xs"
                >
                  Hủy
                </button>
                <button 
                  disabled={isSubmitting}
                  type="submit" 
                  className="flex-2 px-8 py-3.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Lưu Cổng Stripe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit PayPal Account Modal */}
      {isPayPalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-blue-50 text-[#0079C1] flex items-center justify-center font-extrabold text-sm border border-blue-200">
                  P
                </span>
                {editingPayPalSetting ? "Sửa Tài Khoản PayPal" : "Thêm Cổng PayPal Mới"}
              </h2>
              <button onClick={() => setIsPayPalModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPayPalSettingSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Website Áp Dụng Cổng PayPal Này</label>
                <select
                  required
                  value={paypalFormData.site_id}
                  onChange={(e) => {
                    const chosen = e.target.value;
                    const siteObj = STOREFRONTS.find(s => s.id === chosen);
                    setPaypalFormData({
                      ...paypalFormData,
                      site_id: chosen,
                      account_name: paypalFormData.account_name || (siteObj ? `${siteObj.name} PayPal Gateway` : "")
                    });
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-800 text-sm font-semibold bg-white"
                >
                  {STOREFRONTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.domain})
                    </option>
                  ))}
                  <option value="all">🌐 Dùng Chung Cho Tất Cả Website (Fallback)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tên Gợi Nhớ (Account Label)</label>
                <input 
                  required
                  type="text" 
                  placeholder="Ví dụ: BookBazaar Main PayPal Account"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-slate-800 text-sm"
                  value={paypalFormData.account_name}
                  onChange={(e) => setPaypalFormData({...paypalFormData, account_name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Môi Trường Hoạt Động (Environment)</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaypalFormData({ ...paypalFormData, mode: 'live' })}
                    className={`px-4 py-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      paypalFormData.mode === 'live'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    LIVE (Thanh Toán Thật)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaypalFormData({ ...paypalFormData, mode: 'sandbox' })}
                    className={`px-4 py-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      paypalFormData.mode === 'sandbox'
                        ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    SANDBOX (Thử Nghiệm)
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Client ID (REST API App Client ID)</label>
                  {paypalFormData.client_id && (
                    <button
                      type="button"
                      onClick={() => handleCopyKey(paypalFormData.client_id, 'modal_paypal_cid')}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKeyId === 'modal_paypal_cid' ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Đã chép Client ID
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Copy className="w-3.5 h-3.5" /> Sao chép Client ID
                        </span>
                      )}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input 
                    required
                    type={showModalPayPalClientId ? "text" : "password"} 
                    placeholder="PayPal Client ID..."
                    className="w-full pl-4 pr-11 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono text-xs text-slate-800"
                    value={paypalFormData.client_id}
                    onChange={(e) => setPaypalFormData({...paypalFormData, client_id: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPayPalClientId(!showModalPayPalClientId)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer transition-colors"
                    title={showModalPayPalClientId ? "Ẩn Client ID" : "Xem Client ID"}
                  >
                    {showModalPayPalClientId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">Secret Key / Client Secret</label>
                  {paypalFormData.client_secret && (
                    <button
                      type="button"
                      onClick={() => handleCopyKey(paypalFormData.client_secret, 'modal_paypal_sec')}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKeyId === 'modal_paypal_sec' ? (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Đã chép Secret
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Copy className="w-3.5 h-3.5" /> Sao chép Secret
                        </span>
                      )}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input 
                    required
                    type={showModalPayPalSecret ? "text" : "password"} 
                    placeholder="PayPal Secret Key..."
                    className="w-full pl-4 pr-11 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-mono text-xs text-slate-800"
                    value={paypalFormData.client_secret}
                    onChange={(e) => setPaypalFormData({...paypalFormData, client_secret: e.target.value})}
                  />
                  <button
                    type="button"
                    onClick={() => setShowModalPayPalSecret(!showModalPayPalSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 rounded-lg cursor-pointer transition-colors"
                    title={showModalPayPalSecret ? "Ẩn Secret Key" : "Xem Secret Key"}
                  >
                    {showModalPayPalSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Client ID & Secret được lưu trữ bảo mật để xử lý các yêu cầu PayPal Checkout.</p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input 
                  type="checkbox"
                  id="paypal_is_active_checkbox"
                  checked={paypalFormData.is_active}
                  onChange={(e) => setPaypalFormData({...paypalFormData, is_active: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="paypal_is_active_checkbox" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Kích hoạt cổng này làm cổng PayPal nhận tiền chính của website ngay lập tức
                </label>
              </div>

              <div className="pt-4 flex gap-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsPayPalModalOpen(false)}
                  className="flex-1 px-6 py-3.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all text-xs"
                >
                  Hủy
                </button>
                <button 
                  disabled={isSubmitting}
                  type="submit" 
                  className="flex-2 px-8 py-3.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Lưu Cổng PayPal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk EPUB Upload Modal with Balanced Category Randomization */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[92vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Plus className="w-6 h-6 text-indigo-600" />
                  Upload EPUB Hàng Loạt
                </h2>
                <p className="text-xs text-indigo-600 font-bold mt-1">
                  Website đích: {selectedSite === 'all' ? 'BookBazaar (Mặc định)' : currentStorefront?.name}
                </p>
              </div>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-5 overflow-y-auto flex-1">
              {/* Batch Metadata Settings */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Thông tin mặc định đính kèm</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    ⚡ Upload trực tiếp Supabase
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tác giả mặc định</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Martin Chavez"
                      value={bulkAuthor}
                      onChange={(e) => setBulkAuthor(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Giá bán mặc định</label>
                    <input 
                      type="text" 
                      placeholder="$12.00"
                      value={bulkPrice}
                      onChange={(e) => setBulkPrice(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white font-medium text-slate-800"
                    />
                  </div>
                </div>

                {/* CATEGORY DISTRIBUTION SELECTOR (NEW FEATURE) */}
                <div className="pt-2 border-t border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-600" />
                      Chế độ gán Thể loại:
                    </label>
                    <div className="flex bg-slate-200/70 p-1 rounded-xl gap-1">
                      <button
                        type="button"
                        onClick={() => setBulkCategoryMode('balanced_random')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                          bulkCategoryMode === 'balanced_random'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Shuffle className="w-3 h-3" />
                        🎲 Phân bổ đều / Random
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkCategoryMode('single')}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          bulkCategoryMode === 'single'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Cố định 1 thể loại
                      </button>
                    </div>
                  </div>

                  {/* Mode 1: Single Category */}
                  {bulkCategoryMode === 'single' && (
                    <div>
                      <select 
                        value={bulkSingleCategory}
                        onChange={(e) => setBulkSingleCategory(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white font-bold text-indigo-950"
                      >
                        {DEFAULT_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Mode 2: Balanced Random Category Pool */}
                  {bulkCategoryMode === 'balanced_random' && (
                    <div className="space-y-2 bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-indigo-900">
                          Kho thể loại ngẫu nhiên ({bulkCategoryPool.length} thể loại được chọn):
                        </span>
                        <div className="flex gap-2 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setBulkCategoryPool(DEFAULT_CATEGORIES)}
                            className="text-indigo-600 hover:underline font-bold"
                          >
                            Chọn tất cả
                          </button>
                          <button
                            type="button"
                            onClick={() => setBulkCategoryPool([])}
                            className="text-slate-400 hover:underline"
                          >
                            Bỏ chọn
                          </button>
                        </div>
                      </div>

                      {/* Chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {DEFAULT_CATEGORIES.map(cat => {
                          const isSelected = bulkCategoryPool.includes(cat);
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setBulkCategoryPool(bulkCategoryPool.filter(c => c !== cat));
                                } else {
                                  setBulkCategoryPool([...bulkCategoryPool, cat]);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'
                              }`}
                            >
                              {isSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3 text-slate-300" />}
                              {cat}
                            </button>
                          );
                        })}
                      </div>

                      <p className="text-[10px] text-indigo-600 font-medium">
                        💡 Thuật toán Balanced Round-Robin: Khi tải lên {bulkBookFiles.length || 0} file, các thể loại đã chọn sẽ được chia đều tỷ lệ 1:1 một cách ngẫu nhiên.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700">1. Chọn các file EPUB/PDF ({bulkBookFiles.length})</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center hover:border-indigo-400 transition-colors relative bg-white">
                    <input 
                      type="file" 
                      multiple
                      accept=".pdf,.epub,.doc,.docx"
                      onChange={(e) => setBulkBookFiles(Array.from(e.target.files || []))}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <FileText className="w-7 h-7 text-indigo-500 mx-auto mb-1.5" />
                    <p className="text-xs text-slate-600 font-bold">Kéo thả file EPUB vào đây</p>
                    <p className="text-[10px] text-slate-400 mt-1">Ảnh bìa & mô tả sẽ được tự động trích xuất!</p>
                  </div>

                  {/* File List with Assigned Category Preview */}
                  <div className="max-h-48 overflow-y-auto text-[11px] text-slate-500 space-y-1.5 pr-1">
                    {bulkBookFiles.map((f, idx) => {
                      const cleanedName = f.name.replace(/\.[^/.]+$/, "").replace(/^[\d\s.\-_]+/, "").replace(/_/g, " ").trim();
                      const categoryForThisFile = assignedBulkCategories[idx] || "Non-Fiction";

                      return (
                        <div key={f.name + idx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <div className="truncate flex-grow pr-2">
                            <div className="font-bold text-slate-800 truncate">{cleanedName}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-extrabold flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5" /> {categoryForThisFile}
                              </span>
                              {f.name.toLowerCase().endsWith(".epub") && (
                                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                                  Auto Cover
                                </span>
                              )}
                            </div>
                          </div>
                          <button 
                            onClick={() => setBulkBookFiles(bulkBookFiles.filter((_, i) => i !== idx))}
                            className="text-slate-300 hover:text-rose-500 transition-colors ml-2 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700">2. Ảnh bìa thủ công ngoài (Tùy chọn) ({bulkCoverFiles.length})</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-5 text-center hover:border-indigo-400 transition-colors relative bg-white">
                    <input 
                      type="file" 
                      multiple
                      accept="image/*"
                      onChange={(e) => setBulkCoverFiles(Array.from(e.target.files || []))}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <ImageIcon className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs text-slate-400 font-medium">Kéo thả ảnh bìa (nếu có)</p>
                    <p className="text-[10px] text-slate-400 mt-1">Để trống nếu muốn dùng ảnh bìa sẵn có trong EPUB</p>
                  </div>
                  <div className="max-h-48 overflow-y-auto text-[11px] text-slate-500 space-y-1.5 pr-1">
                    {bulkCoverFiles.map((f, idx) => (
                      <div key={f.name + idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="truncate flex-grow">{f.name}</span>
                        <button 
                          onClick={() => setBulkCoverFiles(bulkCoverFiles.filter((_, i) => i !== idx))}
                          className="text-slate-300 hover:text-rose-500 transition-colors ml-2 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {isSubmitting && (
                <div className="space-y-2 bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                  <div className="flex justify-between text-xs font-bold text-indigo-700 uppercase tracking-widest">
                    <span>Đang upload trực tiếp lên Supabase...</span>
                    <span>{bulkProgress.current} / {bulkProgress.total}</span>
                  </div>
                  <div className="w-full bg-indigo-200 h-2.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-300" 
                      style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-4">
              <button 
                onClick={() => setIsBulkModalOpen(false)}
                className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-100 transition-all text-xs"
              >
                Hủy
              </button>
              <button 
                disabled={isSubmitting || bulkBookFiles.length === 0}
                onClick={handleBulkSubmit}
                className="flex-2 px-10 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Bắt Đầu Đăng {bulkBookFiles.length} Cuốn Sách
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Randomize Categories Modal (NEW FEATURE) */}
      {isRandomCategoryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Shuffle className="w-6 h-6 text-purple-600" />
                Random Thể Loại Cho {selectedSite === 'all' ? 'Tất cả website' : currentStorefront?.name}
              </h2>
              <button 
                onClick={() => setIsRandomCategoryModalOpen(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkRandomizeCategoriesSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Chọn các thể loại trong tập hợp phân bổ:
                </label>
                <p className="text-[11px] text-slate-500 mb-3">
                  Hệ thống sẽ tự động phân bổ đều các thể loại này cho danh sách sách mục tiêu.
                </p>

                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  {DEFAULT_CATEGORIES.map(cat => {
                    const isSelected = randomCategoryPool.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setRandomCategoryPool(randomCategoryPool.filter(c => c !== cat));
                          } else {
                            setRandomCategoryPool([...randomCategoryPool, cat]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:border-purple-300'
                        }`}
                      >
                        {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5 text-slate-300" />}
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Phương Thức Phân Bổ:</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`p-3.5 rounded-2xl border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                    randomCategoryMode === 'balanced' ? 'border-purple-500 bg-purple-50/40 text-purple-900 font-bold' : 'border-slate-200 text-slate-600'
                  }`}>
                    <input 
                      type="radio" 
                      name="catMode" 
                      checked={randomCategoryMode === 'balanced'} 
                      onChange={() => setRandomCategoryMode('balanced')}
                      className="w-4 h-4 text-purple-600"
                    />
                    <div>
                      <span className="text-xs block">Phân bổ đều 1:1</span>
                      <span className="text-[10px] text-slate-400 font-normal">Cân bằng số lượng sách</span>
                    </div>
                  </label>

                  <label className={`p-3.5 rounded-2xl border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                    randomCategoryMode === 'pure_random' ? 'border-purple-500 bg-purple-50/40 text-purple-900 font-bold' : 'border-slate-200 text-slate-600'
                  }`}>
                    <input 
                      type="radio" 
                      name="catMode" 
                      checked={randomCategoryMode === 'pure_random'} 
                      onChange={() => setRandomCategoryMode('pure_random')}
                      className="w-4 h-4 text-purple-600"
                    />
                    <div>
                      <span className="text-xs block">Ngẫu nhiên tự do</span>
                      <span className="text-[10px] text-slate-400 font-normal">Random hoàn toàn</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Áp Dụng Cho:</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`p-3.5 rounded-2xl border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                    randomCategoryTarget === 'all' ? 'border-purple-500 bg-purple-50/40 text-purple-900 font-bold' : 'border-slate-200 text-slate-600'
                  }`}>
                    <input 
                      type="radio" 
                      name="catTarget" 
                      checked={randomCategoryTarget === 'all'} 
                      onChange={() => setRandomCategoryTarget('all')}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-xs">Tất cả sách ({books.length} cuốn)</span>
                  </label>

                  <label className={`p-3.5 rounded-2xl border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                    selectedBookIds.length === 0 ? 'opacity-50 pointer-events-none border-slate-200' :
                    randomCategoryTarget === 'selected' ? 'border-purple-500 bg-purple-50/40 text-purple-900 font-bold' : 'border-slate-200 text-slate-600'
                  }`}>
                    <input 
                      type="radio" 
                      name="catTarget" 
                      disabled={selectedBookIds.length === 0}
                      checked={randomCategoryTarget === 'selected'} 
                      onChange={() => setRandomCategoryTarget('selected')}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-xs">Sách đã chọn ({selectedBookIds.length} cuốn)</span>
                  </label>
                </div>
              </div>

              {randomCategoryProgress.total > 0 && (
                <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-200 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-purple-800">
                    <span>Đang cập nhật thể loại trực tiếp trên Supabase...</span>
                    <span>{randomCategoryProgress.current} / {randomCategoryProgress.total}</span>
                  </div>
                  <div className="w-full bg-purple-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-purple-600 h-full transition-all duration-200" 
                      style={{ width: `${(randomCategoryProgress.current / randomCategoryProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 flex gap-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsRandomCategoryModalOpen(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all text-xs"
                >
                  Hủy
                </button>
                <button 
                  disabled={isSubmitting || randomCategoryPool.length === 0}
                  type="submit" 
                  className="flex-2 px-8 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-all shadow-md shadow-purple-200 disabled:opacity-50 flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang Phân Bổ...</span>
                    </>
                  ) : (
                    <>
                      <Shuffle className="w-4 h-4" />
                      <span>Phân Bổ Thể Loại</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Book Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">
                {editingBook ? "Chỉnh Sửa Chi Tiết Sách" : "Thêm Cuốn Sách Mới"}
              </h2>
              <button onClick={resetForm} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                
                {/* Storefront Selector */}
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Website Đăng Sách</label>
                  <select 
                    value={formData.site_id}
                    onChange={(e) => setFormData({...formData, site_id: e.target.value})}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs font-bold text-indigo-900 bg-white"
                  >
                    {STOREFRONTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.domain})
                      </option>
                    ))}
                    <option value="all">🌐 Dùng Chung Cho Tất Cả Website</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tựa Đề Sách (Title)</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tác Giả (Author)</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs"
                    value={formData.author}
                    onChange={(e) => setFormData({...formData, author: e.target.value})}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Thể Loại (Category)</label>
                  <select 
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="">Chọn Thể Loại</option>
                    {DEFAULT_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giá Bán (Ví dụ: $14.99)</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                  />
                </div>
                <div className="col-span-1">
                   <label className="block text-xs font-bold text-slate-700 mb-1">Số Trang (Pages)</label>
                   <input 
                     type="text" 
                     className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs"
                     value={formData.pages}
                     onChange={(e) => setFormData({...formData, pages: e.target.value})}
                   />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mô Tả Giới Thiệu (Description)</label>
                  <textarea 
                    rows={4}
                    placeholder="Mô tả chi tiết cuốn sách..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-y text-xs leading-relaxed"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> File Sách (PDF/EPUB)
                  </label>
                  <input 
                    type="file" 
                    accept=".pdf,.epub,.doc,.docx"
                    onChange={(e) => setBookFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" /> Ảnh Bìa (Cover)
                  </label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
                    className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all text-xs"
                >
                  Hủy
                </button>
                <button 
                  disabled={isSubmitting}
                  type="submit" 
                  className="flex-2 px-10 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingBook ? "Lưu Thay Đổi" : "Lưu Sách Mới"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Randomize Prices Modal */}
      {isRandomPriceModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Dices className="w-6 h-6 text-emerald-600" />
                Random Giá Sách Cho {selectedSite === 'all' ? 'Tất cả website' : currentStorefront?.name}
              </h2>
              <button 
                onClick={() => setIsRandomPriceModalOpen(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkRandomizePricesSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Danh Sách Mức Giá Mục Tiêu (Mỗi dòng một mức giá)
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Nhập các mức giá ngăn cách bằng Enter. Hệ thống sẽ bốc ngẫu nhiên một giá từ danh sách này để gán cho từng cuốn sách!
                </p>
                <textarea 
                  required
                  rows={5}
                  value={randomPriceInput}
                  onChange={(e) => setRandomPriceInput(e.target.value)}
                  placeholder="0.50&#10;0.99&#10;1.50&#10;2.99&#10;4.99&#10;9.99"
                  className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-mono text-xs leading-relaxed text-slate-800"
                />
                <div className="mt-1.5 text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {randomPriceInput.split('\n').filter(l => l.trim().length > 0).length} mức giá trong kho
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Áp Dụng Cho:</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`p-3.5 rounded-2xl border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                    randomPriceTarget === 'all' ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900 font-bold' : 'border-slate-200 text-slate-600'
                  }`}>
                    <input 
                      type="radio" 
                      name="randomTarget" 
                      checked={randomPriceTarget === 'all'} 
                      onChange={() => setRandomPriceTarget('all')}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span className="text-xs">Tất cả sách ({books.length} cuốn)</span>
                  </label>

                  <label className={`p-3.5 rounded-2xl border-2 flex items-center gap-2.5 cursor-pointer transition-all ${
                    selectedBookIds.length === 0 ? 'opacity-50 pointer-events-none border-slate-200' :
                    randomPriceTarget === 'selected' ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900 font-bold' : 'border-slate-200 text-slate-600'
                  }`}>
                    <input 
                      type="radio" 
                      name="randomTarget" 
                      disabled={selectedBookIds.length === 0}
                      checked={randomPriceTarget === 'selected'} 
                      onChange={() => setRandomPriceTarget('selected')}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span className="text-xs">Sách đã chọn ({selectedBookIds.length} cuốn)</span>
                  </label>
                </div>
              </div>

              {randomPriceProgress.total > 0 && (
                <div className="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-emerald-800">
                    <span>Đang cập nhật giá trực tiếp trên Supabase...</span>
                    <span>{randomPriceProgress.current} / {randomPriceProgress.total}</span>
                  </div>
                  <div className="w-full bg-emerald-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-emerald-600 h-full transition-all duration-200" 
                      style={{ width: `${(randomPriceProgress.current / randomPriceProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 flex gap-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsRandomPriceModalOpen(false)}
                  className="flex-1 px-6 py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all text-xs"
                >
                  Hủy
                </button>
                <button 
                  disabled={isSubmitting}
                  type="submit" 
                  className="flex-2 px-8 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang Gán Giá...</span>
                    </>
                  ) : (
                    <>
                      <Dices className="w-4 h-4" />
                      <span>Gán Giá Ngẫu Nhiên</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Support Ticket Modal */}
      {selectedTicketForView && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Chi Tiết Tin Nhắn Hỗ Trợ</h3>
                  <div className="text-[11px] text-slate-400 font-mono">ID: {selectedTicketForView.id}</div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTicketForView(null)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Khách Hàng</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedTicketForView.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Website</span>
                  <span className="font-bold text-indigo-700 uppercase">{selectedTicketForView.site_id}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Email Khách</span>
                  <span className="font-bold text-slate-800 font-mono">{selectedTicketForView.email}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Thời Gian Gửi</span>
                  <span className="text-slate-600 font-mono">
                    {new Date(selectedTicketForView.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tiêu Đề</label>
                <div className="p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-900 text-sm">
                  {selectedTicketForView.subject}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nội Dung Tin Nhắn</label>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 whitespace-pre-wrap leading-relaxed text-xs">
                  {selectedTicketForView.message}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleToggleTicketStatus(selectedTicketForView)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedTicketForView.status === 'resolved'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {selectedTicketForView.status === 'resolved' ? 'Đổi về Chờ Xử Lý' : 'Đánh dấu Đã Xử Lý'}
                </button>

                <a
                  href={`mailto:${selectedTicketForView.email}?subject=Re: [${selectedTicketForView.site_id.toUpperCase()}] ${encodeURIComponent(selectedTicketForView.subject)}`}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-md shadow-indigo-200 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Trả Lời Khách Hàng
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Customer Order Details Modal */}
      {selectedOrderForView && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Chi Tiết Đơn Hàng {selectedOrderForView.order_code || `#${selectedOrderForView.id.substring(0, 8)}`}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                      selectedOrderForView.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : selectedOrderForView.status === 'pending'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {selectedOrderForView.status === 'completed' ? 'Đã Thanh Toán' : selectedOrderForView.status === 'pending' ? 'Chờ Thanh Toán' : selectedOrderForView.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {selectedOrderForView.id}</div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedOrderForView(null)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-xs overflow-y-auto">
              {/* Order Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Khách Hàng</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedOrderForView.customer_name || 'Khách Hàng'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Website Đặt Hàng</span>
                  <span className="font-bold text-indigo-700 uppercase">{selectedOrderForView.site_id}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Tổng Tiền</span>
                  <span className="font-bold text-emerald-700 font-mono text-sm">
                    ${Number(selectedOrderForView.total_amount || 0).toFixed(2)} {selectedOrderForView.currency || 'USD'}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Email Nhận Sách</span>
                  <span className="font-bold text-slate-800 font-mono">{selectedOrderForView.customer_email}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Cổng Thanh Toán</span>
                  <span className="font-bold text-slate-800 uppercase">{selectedOrderForView.payment_method || 'Stripe'}</span>
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Mã Giao Dịch (Payment ID)</span>
                  <span className="font-mono text-slate-600 truncate block text-[11px]">
                    {selectedOrderForView.payment_id || 'Chưa phát sinh (Đang chờ khách thanh toán)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block text-[10px] uppercase">Thời Gian Tạo</span>
                  <span className="text-slate-600 font-mono">
                    {new Date(selectedOrderForView.created_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>

              {/* Items in Order */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Danh Sách Sách Trong Đơn Hàng ({Array.isArray(selectedOrderForView.items) ? selectedOrderForView.items.length : 0})
                  </label>
                </div>
                
                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white">
                  {Array.isArray(selectedOrderForView.items) && selectedOrderForView.items.length > 0 ? (
                    selectedOrderForView.items.map((item, idx) => (
                      <div key={idx} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          {item.cover_url ? (
                            <img src={item.cover_url} alt={item.title} className="w-10 h-14 object-cover rounded-md flex-shrink-0 shadow-xs border border-slate-100" />
                          ) : (
                            <div className="w-10 h-14 bg-slate-100 rounded-md flex items-center justify-center text-slate-400 flex-shrink-0">
                              <BookIcon className="w-5 h-5" />
                            </div>
                          )}
                          <div className="truncate">
                            <h4 className="font-bold text-slate-900 truncate text-xs">{item.title || 'Sách điện tử'}</h4>
                            <p className="text-[11px] text-slate-400 truncate">{item.author || 'Tác giả ẩn danh'}</p>
                            <span className="text-[10px] text-slate-500 font-mono">SL: {item.quantity || 1}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-bold font-mono text-slate-900 text-xs">{item.price || '$0.50'}</span>
                          {item.file_url && (
                            <a
                              href={item.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-[10px] text-indigo-600 hover:underline font-medium mt-0.5"
                            >
                              Tải File ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-400 text-xs">
                      Không có thông tin chi tiết từng cuốn sách.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateOrderStatus(
                    selectedOrderForView, 
                    selectedOrderForView.status === 'completed' ? 'pending' : 'completed'
                  )}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedOrderForView.status === 'completed'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {selectedOrderForView.status === 'completed' ? 'Đổi về Chờ Thanh Toán' : 'Đánh dấu Đã Thanh Toán'}
                </button>
                <button
                  onClick={() => handleDeleteOrder(selectedOrderForView.id)}
                  className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-rose-200"
                >
                  Xóa Đơn
                </button>
              </div>

              <a
                href={`mailto:${selectedOrderForView.customer_email}?subject=Xác nhận đơn hàng [${selectedOrderForView.order_code || selectedOrderForView.id.substring(0, 6)}] - ${selectedOrderForView.site_id.toUpperCase()}`}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-md shadow-indigo-200 transition-colors"
              >
                <Mail className="w-4 h-4" />
                Gửi Email Cho Khách
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50/70 to-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Đăng Nhập Quản Trị</h2>
                  <p className="text-[11px] text-slate-400">Truy cập toàn bộ cài đặt hệ thống</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsLoginModalOpen(false);
                  setLoginError("");
                }} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} className="p-6 space-y-4 text-xs">
              {loginError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Username Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Tài Khoản (Username) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="lichdt"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 text-sm font-semibold"
                />
              </div>

              {/* Password Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Mật Khẩu <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    required
                    placeholder="Nhập mật khẩu..."
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 text-sm font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Helper badge */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Tài khoản: <strong className="text-indigo-600 font-mono">lichdt</strong></span>
                <span>Mật khẩu: <strong className="text-indigo-600 font-mono">389363</strong></span>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsLoginModalOpen(false);
                    setLoginError("");
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all text-xs cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-102 active:scale-98"
                >
                  <LogIn className="w-4 h-4" />
                  Đăng Nhập Quản Trị
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
