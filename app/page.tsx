"use client";

import { useState, useEffect, useMemo } from "react";
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
  ChevronDown
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
import { parseEpubFile, cleanExtractedDescription } from "@/lib/epubParser";

export default function BookManagePage() {
  const [activeTab, setActiveTab] = useState<'books' | 'stripe'>('books');
  // Default to first storefront or 'all'
  const [selectedSite, setSelectedSite] = useState<string>('bookbazaar');
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Randomize Prices states
  const [isRandomPriceModalOpen, setIsRandomPriceModalOpen] = useState(false);
  const [randomPriceInput, setRandomPriceInput] = useState("$0.50\n$0.99\n$1.50\n$2.99\n$4.99\n$9.99\n$14.99\n$19.99");
  const [randomPriceTarget, setRandomPriceTarget] = useState<'all' | 'selected'>('all');
  const [randomPriceProgress, setRandomPriceProgress] = useState({ current: 0, total: 0 });

  // Form states
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
  const [bulkCategory, setBulkCategory] = useState("Non-Fiction");
  const [bulkPrice, setBulkPrice] = useState("$12.00");
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

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
    // Find active for this specific site first, then active global
    return stripeSettings.find(s => s.site_id === selectedSite && s.is_active) || 
           stripeSettings.find(s => (s.site_id === 'all' || !s.site_id) && s.is_active);
  }, [stripeSettings, selectedSite]);

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
      alert(error.response?.data?.error || "Failed to save Stripe account configuration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkRandomizePricesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const rawLines = randomPriceInput.split('\n');
    const prices = rawLines
      .map(line => line.trim().replace(/[^0-9.]/g, ''))
      .filter(val => val.length > 0)
      .map(val => {
        const num = parseFloat(val);
        return isNaN(num) ? null : `$${num.toFixed(2)}`;
      })
      .filter((val): val is string => val !== null);

    if (prices.length === 0) {
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
      for (let i = 0; i < targetBooks.length; i++) {
        setRandomPriceProgress({ current: i + 1, total: targetBooks.length });
        const book = targetBooks[i];
        const randomPrice = prices[Math.floor(Math.random() * prices.length)];

        await updateBook(book.id, {
          site_id: book.site_id || selectedSite || 'bookbazaar',
          title: book.title,
          author: book.author,
          category: book.category,
          price: randomPrice
        });
      }

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

  const handleActivateStripeSetting = async (id: string) => {
    try {
      await activateStripeSetting(id);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const data = new FormData();
      data.append("site_id", formData.site_id || (selectedSite !== 'all' ? selectedSite : 'bookbazaar'));
      data.append("title", formData.title);
      data.append("author", formData.author);
      data.append("description", formData.description);
      data.append("category", formData.category);
      data.append("price", formData.price);
      data.append("details", JSON.stringify({ Publisher: formData.publisher, Pages: formData.pages }));
      
      if (bookFile) data.append("file", bookFile);
      if (coverImage) data.append("cover", coverImage);

      if (editingBook) {
        await updateBook(editingBook.id, data);
      } else {
        await createBook(data);
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

  const handleBulkSubmit = async () => {
    if (bulkBookFiles.length === 0) return;
    setIsSubmitting(true);
    setBulkProgress({ current: 0, total: bulkBookFiles.length });

    const targetSiteId = selectedSite !== 'all' ? selectedSite : 'bookbazaar';

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

        const data = new FormData();
        data.append("site_id", targetSiteId);
        data.append("title", title);
        data.append("author", author);
        data.append("description", description);
        data.append("category", bulkCategory || "Non-Fiction");
        data.append("price", bulkPrice || "$12.00");
        data.append("details", JSON.stringify({ Publisher: "Signature Press", Pages: "120" }));
        data.append("file", file);
        if (finalCover) data.append("cover", finalCover);

        await createBook(data);
      }

      await fetchBooks();
      setBulkBookFiles([]);
      setBulkCoverFiles([]);
      setIsBulkModalOpen(false);
      alert(`Đã upload thành công ${bulkBookFiles.length} cuốn sách lên website ${targetSiteId.toUpperCase()}!`);
    } catch (error) {
      console.error("Bulk upload failed:", error);
      alert("Bulk upload failed at index " + bulkProgress.current);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get unique filter values
  const uniqueAuthors = Array.from(new Set(books.map(b => b.author).filter(Boolean))).sort();
  const uniqueCategories = Array.from(new Set(books.map(b => b.category).filter(Boolean))).sort();

  // Filter & Sort Logic
  const filteredBooks = books.filter(book => {
    const matchesSearch = 
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAuthor = !selectedAuthor || book.author === selectedAuthor;
    const matchesCategory = !selectedCategory || book.category === selectedCategory;
    
    let matchesPrice = true;
    const numericPrice = parseFloat((book.price || "0").replace(/[^0-9.]/g, "")) || 0;
    if (selectedPriceFilter === "under5") {
      matchesPrice = numericPrice < 5;
    } else if (selectedPriceFilter === "5to10") {
      matchesPrice = numericPrice >= 5 && numericPrice <= 10;
    } else if (selectedPriceFilter === "over10") {
      matchesPrice = numericPrice > 10;
    }

    return matchesSearch && matchesAuthor && matchesCategory && matchesPrice;
  }).sort((a, b) => {
    if (selectedPriceFilter === "priceAsc") {
      const priceA = parseFloat((a.price || "").replace(/[^0-9.]/g, "")) || 0;
      const priceB = parseFloat((b.price || "").replace(/[^0-9.]/g, "")) || 0;
      return priceA - priceB;
    }
    if (selectedPriceFilter === "priceDesc") {
      const priceA = parseFloat((a.price || "").replace(/[^0-9.]/g, "")) || 0;
      const priceB = parseFloat((b.price || "").replace(/[^0-9.]/g, "")) || 0;
      return priceB - priceA;
    }
    return 0;
  });

  const isAllSelected = filteredBooks.length > 0 && selectedBookIds.length === filteredBooks.length;
  const isAnyFilterActive = Boolean(searchTerm || selectedAuthor || selectedCategory || selectedPriceFilter);

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
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Quản lý kho sách và cấu hình cổng thanh toán Stripe riêng biệt cho từng website.
              </p>
            </div>
          </div>

          {/* WEBSITE SELECTOR DROPDOWN */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-grow sm:w-80">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Chọn Website Cần Quản Lý:
              </label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-600 pointer-events-none" />
                <select
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 rounded-2xl border-2 border-indigo-600 bg-indigo-50/50 text-indigo-950 font-bold text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/20 cursor-pointer appearance-none shadow-sm"
                >
                  <option value="all">🌐 Tất cả 10 Trang Web (Xem tổng hợp)</option>
                  <optgroup label="Danh sách 10 Website">
                    {STOREFRONTS.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name} ({site.domain})
                      </option>
                    ))}
                  </optgroup>
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-600 pointer-events-none" />
              </div>
            </div>

            {/* View Switcher: Books / Stripe */}
            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-end sm:self-auto mt-auto">
              <button 
                onClick={() => setActiveTab('books')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'books'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookIcon className="w-4 h-4" />
                Sách ({books.length})
              </button>
              <button 
                onClick={() => setActiveTab('stripe')}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                  activeTab === 'stripe'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Stripe ({currentSiteStripeSettings.length})
              </button>
            </div>
          </div>
        </header>

        {/* Current Selected Site Info Ribbon */}
        <div className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-md">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <span className="text-xs sm:text-sm font-bold">
              Đang làm việc trên: <span className="text-indigo-300 font-extrabold text-sm sm:text-base">{selectedSite === 'all' ? 'Tất cả các website' : currentStorefront?.name}</span>
              {currentStorefront?.domain && (
                <span className="text-slate-400 font-mono text-xs ml-2">({currentStorefront.domain})</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-300">
            <span>📚 Sách: <strong className="text-white">{books.length}</strong> cuốn</span>
            <span>💳 Cổng Stripe: <strong className="text-white">{activeStripeSettingForSite ? activeStripeSettingForSite.account_name : 'Mặc định (.env)'}</strong></span>
          </div>
        </div>

        {activeTab === 'books' ? (
          <>
            {/* Action Buttons Header Bar */}
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div className="flex flex-wrap gap-2.5">
                {selectedBookIds.length > 0 && (
                  <button 
                    onClick={handleDeleteSelected}
                    disabled={isSubmitting}
                    className="bg-rose-50 text-rose-600 border border-rose-200 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-100 transition-all text-xs disabled:opacity-50"
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
                <button 
                  onClick={() => setIsRandomPriceModalOpen(true)}
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-100 transition-all text-xs"
                >
                  <Dices className="w-4 h-4 text-emerald-600" />
                  Random Giá Sách
                </button>
                <button 
                  onClick={() => setIsBulkModalOpen(true)}
                  className="bg-white text-indigo-600 border-2 border-indigo-600 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-50 transition-all text-xs"
                >
                  <Plus className="w-4 h-4" />
                  Upload EPUB Hàng Loạt
                </button>
                <button 
                  onClick={() => {
                    setFormData({
                      ...formData,
                      site_id: selectedSite !== 'all' ? selectedSite : 'bookbazaar'
                    });
                    setIsModalOpen(true);
                  }}
                  className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 text-xs"
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
                      className="bg-transparent outline-none font-medium text-slate-700 cursor-pointer max-w-[140px] truncate"
                    >
                      <option value="">Tất cả tác giả ({uniqueAuthors.length})</option>
                      {uniqueAuthors.map(author => (
                        <option key={author} value={author}>{author}</option>
                      ))}
                    </select>
                  </div>

                  {/* Category Filter */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select 
                      value={selectedCategory} 
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="bg-transparent outline-none font-medium text-slate-700 cursor-pointer"
                    >
                      <option value="">Tất cả thể loại ({uniqueCategories.length})</option>
                      {uniqueCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Price Filter */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select 
                      value={selectedPriceFilter} 
                      onChange={(e) => setSelectedPriceFilter(e.target.value)}
                      className="bg-transparent outline-none font-medium text-slate-700 cursor-pointer"
                    >
                      <option value="">Tất cả mức giá</option>
                      <option value="under5">Dưới $5.00</option>
                      <option value="5to10">$5.00 - $10.00</option>
                      <option value="over10">Trên $10.00</option>
                      <option value="priceAsc">Giá: Thấp đến Cao</option>
                      <option value="priceDesc">Giá: Cao đến Thấp</option>
                    </select>
                  </div>

                  {/* Reset Filters */}
                  {isAnyFilterActive && (
                    <button 
                      onClick={clearFilters}
                      className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                      title="Clear Filters"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Xóa Bộ Lọc
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
                  Hiển thị {filteredBooks.length} / {books.length} cuốn sách
                </div>
              </div>
            </div>

            {/* Book List Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-bold border-b border-slate-100">
                      <th className="w-12 px-4 py-4 text-center">
                        <input 
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </th>
                      <th className="px-6 py-4">Chi tiết sách</th>
                      <th className="px-6 py-4">Website</th>
                      <th className="px-6 py-4">Thể loại</th>
                      <th className="px-6 py-4">Giá bán</th>
                      <th className="px-6 py-4">Files</th>
                      <th className="px-6 py-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                          <span className="text-slate-400">Đang tải danh sách sách của {selectedSite === 'all' ? 'tất cả website' : currentStorefront?.name}...</span>
                        </td>
                      </tr>
                    ) : filteredBooks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center space-y-3">
                          <BookIcon className="w-10 h-10 text-slate-300 mx-auto" />
                          <p className="text-slate-500 font-bold">Chưa có cuốn sách nào trên website này.</p>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            Bấm "+ Thêm Sách Mới" hoặc "Upload EPUB Hàng Loạt" để đăng tải sách cho {currentStorefront?.name || 'website này'}!
                          </p>
                          {isAnyFilterActive && (
                            <button 
                              onClick={clearFilters}
                              className="mt-2 text-xs text-indigo-600 font-bold hover:underline"
                            >
                              Xóa toàn bộ bộ lọc
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredBooks.map((book) => {
                        const isSelected = selectedBookIds.includes(book.id);
                        const bookSite = STOREFRONTS.find(s => s.id === (book.site_id || 'bookbazaar'));

                        return (
                          <tr 
                            key={book.id} 
                            className={`transition-colors group ${isSelected ? 'bg-indigo-50/40' : 'hover:bg-slate-50/50'}`}
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
                                {book.cover_url && (
                                   <a href={book.cover_url} target="_blank" className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-100 hover:text-indigo-600 transition-colors" title="View Cover">
                                     <ExternalLink className="w-4 h-4" />
                                   </a>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => handleEdit(book)}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="Edit book"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDelete(book.id)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                  title="Delete book"
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
          </>
        ) : (
          /* STRIPE CONFIGURATION TAB */
          <div className="space-y-8">
            
            {/* Active Stripe Gateway Banner for Selected Site */}
            <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-full border border-emerald-500/30">
                    <Zap className="w-3.5 h-3.5" /> Cổng Thanh Toán Stripe Riêng
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold">
                    Cấu hình Stripe cho {selectedSite === 'all' ? 'Tất cả các website' : currentStorefront?.name}
                  </h2>
                  <p className="text-slate-300 text-xs sm:text-sm max-w-2xl">
                    Mỗi trang web có thể cấu hình tài khoản Stripe riêng để nhận tiền trực tiếp. Khách hàng thanh toán trên website nào sẽ vào đúng tài khoản Stripe của website đó.
                  </p>
                </div>
                <button 
                  onClick={handleStartAddStripeSetting}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-6 py-3 rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-all text-xs sm:text-sm whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Thêm Cổng Stripe Mới
                </button>
              </div>

              {activeStripeSettingForSite ? (
                <div className="mt-6 pt-5 border-t border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/5 p-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Cổng nhận tiền đang kích hoạt:</div>
                      <div className="text-base sm:text-lg font-bold text-emerald-300 flex items-center gap-2">
                        {activeStripeSettingForSite.account_name}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-300 font-mono bg-black/30 px-3 py-1.5 rounded-lg border border-white/10">
                    Secret Key: {activeStripeSettingForSite.secret_key.slice(0, 10)}••••••••
                  </div>
                </div>
              ) : (
                <div className="mt-6 pt-5 border-t border-white/10 text-xs text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  Chưa có tài khoản Stripe riêng được kích hoạt cho website này. Hệ thống đang nhận qua tài khoản mặc định (.env).
                </div>
              )}
            </div>

            {/* Accounts Table for Current Site */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-base">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  Danh Sách Tài Khoản Stripe ({currentSiteStripeSettings.length})
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-bold border-b border-slate-100">
                      <th className="px-6 py-4">Website Áp Dụng</th>
                      <th className="px-6 py-4">Tên Tài Khoản</th>
                      <th className="px-6 py-4">Publishable Key</th>
                      <th className="px-6 py-4">Secret Key</th>
                      <th className="px-6 py-4">Trạng Thái</th>
                      <th className="px-6 py-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stripeLoading ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                          <span className="text-slate-400">Đang tải danh sách Stripe...</span>
                        </td>
                      </tr>
                    ) : currentSiteStripeSettings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center">
                          <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500 font-bold">Chưa có tài khoản Stripe nào cho website này.</p>
                          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            Bấm "+ Thêm Cổng Stripe Mới" ở trên để nhập Publishable & Secret key của website {currentStorefront?.name || 'này'}!
                          </p>
                        </td>
                      </tr>
                    ) : (
                      currentSiteStripeSettings.map((setting) => {
                        const targetSite = STOREFRONTS.find(s => s.id === (setting.site_id || 'bookbazaar'));

                        return (
                          <tr key={setting.id} className={`hover:bg-slate-50/60 transition-colors ${setting.is_active ? 'bg-emerald-50/30' : ''}`}>
                            <td className="px-6 py-4">
                              {targetSite ? (
                                <span className={`px-2.5 py-1 text-[10px] font-black rounded-md border ${targetSite.badgeBg} ${targetSite.badgeText}`}>
                                  {targetSite.name}
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md border border-slate-200">
                                  🌐 Chung (Tất cả)
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-800 flex items-center gap-2">
                                {setting.account_name}
                                {setting.is_active && (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
                                    ĐANG DÙNG
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <code className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                {setting.publishable_key ? `${setting.publishable_key.slice(0, 16)}...` : 'N/A'}
                              </code>
                            </td>
                            <td className="px-6 py-4">
                              <code className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                                {setting.secret_key.slice(0, 10)}••••••••
                              </code>
                            </td>
                            <td className="px-6 py-4">
                              {setting.is_active ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                                  <CheckCircle2 className="w-4 h-4" /> Đang nhận thanh toán
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-slate-400">Tắt</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end items-center gap-2">
                                {!setting.is_active && (
                                  <button 
                                    onClick={() => handleActivateStripeSetting(setting.id)}
                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-indigo-200"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Kích Hoạt
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleStartEditStripeSetting(setting)}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="Edit Configuration"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteStripeSetting(setting.id)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
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
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Publishable Key (pk_live_... hoặc pk_test_...)</label>
                <input 
                  type="text" 
                  placeholder="pk_live_..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-xs text-slate-800"
                  value={stripeFormData.publishable_key}
                  onChange={(e) => setStripeFormData({...stripeFormData, publishable_key: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Secret Key (sk_live_... hoặc sk_test_...)</label>
                <input 
                  required
                  type="password" 
                  placeholder="sk_live_... hoặc sk_test_..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-xs text-slate-800"
                  value={stripeFormData.secret_key}
                  onChange={(e) => setStripeFormData({...stripeFormData, secret_key: e.target.value})}
                />
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

      {/* Bulk Archival Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
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

            <div className="p-8 space-y-6">
              {/* Batch Metadata Settings */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Thông tin mặc định đính kèm</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tác giả</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Martin Chavez"
                      value={bulkAuthor}
                      onChange={(e) => setBulkAuthor(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Thể loại</label>
                    <select 
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white font-medium text-slate-800"
                    >
                      <option value="Non-Fiction">Non-Fiction</option>
                      <option value="Fiction">Fiction</option>
                      <option value="Philosophy">Philosophy</option>
                      <option value="Classic">Classic</option>
                      <option value="Poetry">Poetry</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Giá bán</label>
                    <input 
                      type="text" 
                      placeholder="$12.00"
                      value={bulkPrice}
                      onChange={(e) => setBulkPrice(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white font-medium text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
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
                  <div className="max-h-32 overflow-y-auto text-[11px] text-slate-500 space-y-1.5 pr-2">
                    {bulkBookFiles.map((f, idx) => {
                      const cleanedName = f.name.replace(/\.[^/.]+$/, "").replace(/^[\d\s.\-_]+/, "").replace(/_/g, " ").trim();
                      return (
                        <div key={f.name + idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <div className="truncate flex-grow pr-2">
                            <span className="font-medium text-slate-700">{cleanedName}</span>
                            {f.name.toLowerCase().endsWith(".epub") && (
                              <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                                Auto Cover
                              </span>
                            )}
                          </div>
                          <button 
                            onClick={() => setBulkBookFiles(bulkBookFiles.filter((_, i) => i !== idx))}
                            className="text-slate-300 hover:text-rose-500 transition-colors ml-2"
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
                  <div className="max-h-32 overflow-y-auto text-[11px] text-slate-500 space-y-1.5 pr-2">
                    {bulkCoverFiles.map((f, idx) => (
                      <div key={f.name + idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="truncate flex-grow">{f.name}</span>
                        <button 
                          onClick={() => setBulkCoverFiles(bulkCoverFiles.filter((_, i) => i !== idx))}
                          className="text-slate-300 hover:text-rose-500 transition-colors ml-2"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {isSubmitting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-indigo-600 uppercase tracking-widest">
                    <span>Đang tải lên kho sách...</span>
                    <span>{bulkProgress.current} / {bulkProgress.total}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full transition-all duration-300" 
                      style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={() => setIsBulkModalOpen(false)}
                  className="flex-1 px-6 py-3.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all text-xs"
                >
                  Hủy
                </button>
                <button 
                  disabled={isSubmitting || bulkBookFiles.length === 0}
                  onClick={handleBulkSubmit}
                  className="flex-2 px-10 py-3.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Bắt Đầu Đăng Sách
                </button>
              </div>
            </div>
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
                    <option value="Fiction">Fiction</option>
                    <option value="Non-Fiction">Non-Fiction</option>
                    <option value="Philosophy">Philosophy</option>
                    <option value="Classic">Classic</option>
                    <option value="Poetry">Poetry</option>
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
                  className="flex-2 px-10 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
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
                    <span>Đang cập nhật giá...</span>
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
                  className="flex-2 px-8 py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
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
