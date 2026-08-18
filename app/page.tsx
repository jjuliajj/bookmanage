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
  Copy
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
  STOREFRONTS, 
  StorefrontSite 
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
  deleteStripeSettingDirect
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
  const [activeTab, setActiveTab] = useState<'books' | 'stripe'>('books');
  const [selectedSite, setSelectedSite] = useState<string>('bookpatr');
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  }, [selectedSite]);

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

          {/* CUSTOM SEARCHABLE WEBSITE SELECTOR DROPDOWN */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-grow sm:w-84" ref={dropdownRef}>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Chọn Website Cần Quản Lý:
              </label>

              {/* Dropdown Trigger Button */}
              <button
                type="button"
                onClick={() => setIsSiteDropdownOpen(!isSiteDropdownOpen)}
                className="w-full px-4 py-2.5 rounded-2xl border-2 border-indigo-600 bg-white hover:bg-indigo-50/40 text-slate-900 font-bold text-xs sm:text-sm flex items-center justify-between gap-3 shadow-xs transition-all focus:outline-none focus:ring-4 focus:ring-indigo-500/20 cursor-pointer"
              >
                <div className="flex items-center gap-2.5 truncate">
                  {selectedSite === 'all' ? (
                    <>
                      <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center flex-shrink-0">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div className="text-left truncate">
                        <span className="font-bold text-indigo-950 block text-xs sm:text-sm truncate">Tất cả {STOREFRONTS.length} Website</span>
                        <span className="text-[10px] text-slate-400 font-normal block">Xem tổng hợp danh mục</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div 
                        className="w-7 h-7 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0 shadow-xs"
                        style={{ backgroundColor: currentStorefront?.themeColor || '#4F46E5' }}
                      >
                        {currentStorefront?.name.substring(0, 2).toUpperCase() || 'WB'}
                      </div>
                      <div className="text-left truncate">
                        <span className="font-bold text-slate-900 block text-xs sm:text-sm truncate">{currentStorefront?.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal block truncate">{currentStorefront?.domain}</span>
                      </div>
                    </>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-indigo-600 transition-transform duration-200 ${isSiteDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Searchable Dropdown Popup Menu */}
              {isSiteDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  {/* Search Input Box */}
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

                  {/* Storefront List */}
                  <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
                    {/* Option: All Websites */}
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

                    {/* Filtered Storefronts */}
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

                    {filteredStorefronts.length === 0 && (
                      <div className="text-center py-4 text-xs text-slate-400">
                        Không tìm thấy website nào phù hợp
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-2xl self-end sm:self-center">
              <button
                onClick={() => setActiveTab('books')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
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
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'stripe'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Stripe ({currentSiteStripeSettings.length})
              </button>
            </div>
          </div>
        </header>

        {/* Current Active Storefront Banner */}
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
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-400">
              📚 Sách: <strong className="text-white">{books.length} cuốn</strong>
            </span>
            <span className="text-slate-400">
              💳 Cổng Stripe: <strong className={activeStripeSettingForSite ? "text-emerald-400" : "text-amber-400"}>
                {activeStripeSettingForSite ? activeStripeSettingForSite.account_name : "Chưa cấu hình"}
              </strong>
            </span>
          </div>
        </div>

        {/* TAB 1: BOOKS MANAGEMENT */}
        {activeTab === 'books' && (
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

        {/* TAB 2: STRIPE CONFIGURATION */}
        {activeTab === 'stripe' && (
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
      </div>

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
    </div>
  );
}
