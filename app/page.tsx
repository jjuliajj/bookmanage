"use client";

import { useState, useEffect } from "react";
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
  Dices
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
  StripeSetting
} from "@/lib/api";
import { parseEpubFile, cleanExtractedDescription } from "@/lib/epubParser";

export default function BookManagePage() {
  const [activeTab, setActiveTab] = useState<'books' | 'stripe'>('books');
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
  }, []);

  const fetchBooks = async () => {
    try {
      const response = await getBooks();
      setBooks(response.data);
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
    if (!confirm("WARNING: Are you sure you want to delete ALL books in the collection? This cannot be undone!")) return;

    try {
      setIsSubmitting(true);
      await deleteAllBooks();
      setBooks([]);
      setSelectedBookIds([]);
    } catch (error) {
      console.error("Delete all failed:", error);
      alert("Failed to delete all books.");
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
    setStripeFormData({ account_name: "", publishable_key: "", secret_key: "", is_active: true });
    setIsStripeModalOpen(true);
  };

  const handleStartEditStripeSetting = (setting: StripeSetting) => {
    setEditingStripeSetting(setting);
    setStripeFormData({
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
      setStripeFormData({ account_name: "", publishable_key: "", secret_key: "", is_active: true });
    } catch (error: any) {
      console.error("Failed to save Stripe account:", error);
      alert(error.response?.data?.error || "Failed to save Stripe account configuration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkRandomizePricesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse prices from multiline text input
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
        // Pick a random price from the parsed prices array
        const randomPrice = prices[Math.floor(Math.random() * prices.length)];

        await updateBook(book.id, {
          title: book.title,
          author: book.author,
          category: book.category,
          price: randomPrice
        });
      }

      await fetchBooks();
      setIsRandomPriceModalOpen(false);
      alert(`Successfully assigned random prices to ${targetBooks.length} books!`);
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
      alert(`Successfully archived ${bulkBookFiles.length} books!`);
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
    const numericPrice = parseFloat((book.price || "").replace(/[^0-9.]/g, "")) || 0;
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
  const activeStripeSetting = stripeSettings.find(s => s.is_active);

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Navigation Tabs Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
              <BookIcon className="w-8 h-8 text-indigo-600" />
              Bookpatr Management
            </h1>
            <p className="text-slate-500 mt-1">Manage your literary collection, archival files, and Stripe payment accounts.</p>
          </div>

          <div className="flex bg-slate-200/70 p-1.5 rounded-2xl border border-slate-300/50">
            <button 
              onClick={() => setActiveTab('books')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                activeTab === 'books'
                  ? 'bg-white text-indigo-600 shadow-md shadow-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookIcon className="w-4 h-4" />
              Book Collection ({books.length})
            </button>
            <button 
              onClick={() => setActiveTab('stripe')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
                activeTab === 'stripe'
                  ? 'bg-white text-indigo-600 shadow-md shadow-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Stripe Accounts ({stripeSettings.length})
              {activeStripeSetting && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Active Stripe Account configured" />
              )}
            </button>
          </div>
        </header>

        {activeTab === 'books' ? (
          <>
            {/* Action Buttons Header Bar */}
            <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
              <div className="flex flex-wrap gap-3">
                {selectedBookIds.length > 0 && (
                  <button 
                    onClick={handleDeleteSelected}
                    disabled={isSubmitting}
                    className="bg-rose-50 text-rose-600 border border-rose-200 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-100 transition-all text-sm disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Selected ({selectedBookIds.length})
                  </button>
                )}
                
                {books.length > 0 && (
                  <button 
                    onClick={handleDeleteAll}
                    disabled={isSubmitting}
                    className="bg-red-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-red-700 transition-all text-sm shadow-md shadow-red-200 disabled:opacity-50"
                  >
                    <Trash className="w-4 h-4" />
                    Delete All ({books.length})
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={() => setIsRandomPriceModalOpen(true)}
                  className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-100 transition-all text-sm"
                  title="Randomize prices across books"
                >
                  <Dices className="w-4 h-4 text-emerald-600" />
                  Randomize Prices
                </button>
                <button 
                  onClick={() => setIsBulkModalOpen(true)}
                  className="bg-white text-indigo-600 border-2 border-indigo-600 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-50 transition-all text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Bulk Archival
                </button>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add New Book
                </button>
              </div>
            </div>

            {/* Filters & Search Control Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
              <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-col lg:flex-row gap-3 justify-between items-center">
                {/* Search Box */}
                <div className="relative w-full lg:w-80">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search title or author..."
                    className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
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
                      <option value="">All Authors ({uniqueAuthors.length})</option>
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
                      <option value="">All Categories ({uniqueCategories.length})</option>
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
                      <option value="">All Price Ranges</option>
                      <option value="under5">Under $5.00</option>
                      <option value="5to10">$5.00 - $10.00</option>
                      <option value="over10">Over $10.00</option>
                      <option value="priceAsc">Price: Low to High</option>
                      <option value="priceDesc">Price: High to Low</option>
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
                      Clear Filters
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
                  Showing {filteredBooks.length} / {books.length} books
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
                      <th className="px-6 py-4">Book Details</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Price</th>
                      <th className="px-6 py-4">Files</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-20 text-center">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                          <span className="text-slate-400">Loading your collection...</span>
                        </td>
                      </tr>
                    ) : filteredBooks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-20 text-center">
                          <p className="text-slate-400">No books found matching your criteria.</p>
                          {isAnyFilterActive && (
                            <button 
                              onClick={clearFilters}
                              className="mt-3 text-xs text-indigo-600 font-bold hover:underline"
                            >
                              Clear All Filters
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredBooks.map((book) => {
                        const isSelected = selectedBookIds.includes(book.id);
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
                                  <div className="font-bold text-slate-800">{book.title}</div>
                                  <div className="text-sm text-slate-500">{book.author}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full border border-indigo-100">
                                {book.category}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-700">{book.price}</td>
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
          <div className="space-y-6">
            {/* Active Account Banner */}
            <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-full border border-emerald-500/30">
                    <Zap className="w-3.5 h-3.5" /> Dynamic Multi-Account Payment Router
                  </div>
                  <h2 className="text-2xl font-bold">Stripe Account Configurations</h2>
                  <p className="text-slate-300 text-sm max-w-2xl">
                    Add multiple Stripe accounts and switch active destination keys with 1-click. Customers will automatically pay directly to the selected active Stripe account without redeploying Vercel!
                  </p>
                </div>
                <button 
                  onClick={handleStartAddStripeSetting}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-6 py-3.5 rounded-2xl flex items-center gap-2 shadow-lg shadow-indigo-500/30 transition-all text-sm whitespace-nowrap"
                >
                  <Plus className="w-5 h-5" />
                  Add Stripe Account
                </button>
              </div>

              {activeStripeSetting ? (
                <div className="mt-8 pt-6 border-t border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/5 p-4 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Currently Active Receiving Account</div>
                      <div className="text-lg font-bold text-emerald-300 flex items-center gap-2">
                        {activeStripeSetting.account_name}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-300 font-mono bg-black/30 px-3 py-1.5 rounded-lg border border-white/10">
                    Secret Key: {activeStripeSetting.secret_key.slice(0, 12)}••••••••
                  </div>
                </div>
              ) : (
                <div className="mt-8 pt-6 border-t border-white/10 text-xs text-amber-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  No custom active Stripe account selected. Currently falling back to default Vercel environment variables.
                </div>
              )}
            </div>

            {/* Accounts Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  Configured Stripe Accounts ({stripeSettings.length})
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-bold border-b border-slate-100">
                      <th className="px-6 py-4">Account Name</th>
                      <th className="px-6 py-4">Publishable Key</th>
                      <th className="px-6 py-4">Secret Key</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stripeLoading ? (
                      <tr>
                        <td colSpan={5} className="py-16 text-center">
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-2" />
                          <span className="text-slate-400">Loading Stripe configurations...</span>
                        </td>
                      </tr>
                    ) : stripeSettings.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-16 text-center">
                          <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500 font-bold">No custom Stripe accounts configured yet.</p>
                          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            Click "+ Add Stripe Account" above to add your Publishable & Secret keys and receive payments directly into your account!
                          </p>
                        </td>
                      </tr>
                    ) : (
                      stripeSettings.map((setting) => (
                        <tr key={setting.id} className={`hover:bg-slate-50/60 transition-colors ${setting.is_active ? 'bg-emerald-50/30' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-800 flex items-center gap-2">
                              {setting.account_name}
                              {setting.is_active && (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
                                  ACTIVE
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
                              {setting.secret_key.slice(0, 12)}••••••••
                            </code>
                          </td>
                          <td className="px-6 py-4">
                            {setting.is_active ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                                <CheckCircle2 className="w-4 h-4" /> Active Destination
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-slate-400">Inactive</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end items-center gap-2">
                              {!setting.is_active && (
                                <button 
                                  onClick={() => handleActivateStripeSetting(setting.id)}
                                  className="px-3.5 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-indigo-200"
                                >
                                  <Check className="w-3.5 h-3.5" /> Activate Account
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Stripe Account Modal */}
      {isStripeModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-indigo-600" />
                Add Stripe Account Configuration
              </h2>
              <button onClick={() => setIsStripeModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStripeSettingSubmit} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Account Name</label>
                <input 
                  required
                  type="text" 
                  placeholder="e.g. BookPatr Main Store, Backup Account"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800"
                  value={stripeFormData.account_name}
                  onChange={(e) => setStripeFormData({...stripeFormData, account_name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Publishable Key (pk_live_... or pk_test_...)</label>
                <input 
                  type="text" 
                  placeholder="pk_live_51U0CrfRMPnMtVmqSBawUCkd..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-xs text-slate-800"
                  value={stripeFormData.publishable_key}
                  onChange={(e) => setStripeFormData({...stripeFormData, publishable_key: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Secret Key (sk_live_... or sk_test_...)</label>
                <input 
                  required
                  type="password" 
                  placeholder="sk_live_... or sk_test_..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-mono text-xs text-slate-800"
                  value={stripeFormData.secret_key}
                  onChange={(e) => setStripeFormData({...stripeFormData, secret_key: e.target.value})}
                />
                <p className="text-[11px] text-slate-400 mt-1">Secret Key is used on backend to instantiate Stripe checkout sessions.</p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input 
                  type="checkbox"
                  id="is_active_checkbox"
                  checked={stripeFormData.is_active}
                  onChange={(e) => setStripeFormData({...stripeFormData, is_active: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="is_active_checkbox" className="text-sm font-bold text-slate-700 cursor-pointer">
                  Set as active payment receiving account immediately
                </label>
              </div>

              <div className="pt-6 flex gap-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsStripeModalOpen(false)}
                  className="flex-1 px-6 py-4 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  disabled={isSubmitting}
                  type="submit" 
                  className="flex-2 px-12 py-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                  Save Stripe Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-6 h-6 text-indigo-600" />
                Bulk Archive Library
              </h2>
              <button onClick={() => setIsBulkModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-6">
              {/* Batch Metadata Settings */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Batch Metadata Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Author Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Martin Chavez"
                      value={bulkAuthor}
                      onChange={(e) => setBulkAuthor(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white font-medium text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                    <select 
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white font-medium text-slate-800"
                    >
                      <option value="Non-Fiction">Non-Fiction</option>
                      <option value="Fiction">Fiction</option>
                      <option value="Philosophy">Philosophy</option>
                      <option value="Classic">Classic</option>
                      <option value="Poetry">Poetry</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Price</label>
                    <input 
                      type="text" 
                      placeholder="$12.00"
                      value={bulkPrice}
                      onChange={(e) => setBulkPrice(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white font-medium text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-700">1. Select EPUB/PDF Files ({bulkBookFiles.length})</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-indigo-400 transition-colors relative bg-white">
                    <input 
                      type="file" 
                      multiple
                      accept=".pdf,.epub,.doc,.docx"
                      onChange={(e) => setBulkBookFiles(Array.from(e.target.files || []))}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <FileText className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-600 font-bold">Drop EPUB/PDF Files Here</p>
                    <p className="text-[10px] text-slate-400 mt-1">EPUB covers & descriptions are auto-extracted!</p>
                  </div>
                  <div className="max-h-36 overflow-y-auto text-[11px] text-slate-500 space-y-1.5 pr-2">
                    {bulkBookFiles.map((f, idx) => {
                      const cleanedName = f.name.replace(/\.[^/.]+$/, "").replace(/^[\d\s.\-_]+/, "").replace(/_/g, " ").trim();
                      return (
                        <div key={f.name + idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100 group/item">
                          <div className="truncate flex-grow pr-2">
                            <span className="font-medium text-slate-700">{cleanedName}</span>
                            {f.name.toLowerCase().endsWith(".epub") && (
                              <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                                Auto Cover & Intro
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

                <div className="space-y-4">
                  <label className="block text-sm font-bold text-slate-700">2. Optional Manual Covers ({bulkCoverFiles.length})</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-indigo-400 transition-colors relative bg-white">
                    <input 
                      type="file" 
                      multiple
                      accept="image/*"
                      onChange={(e) => setBulkCoverFiles(Array.from(e.target.files || []))}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-medium">Drop External Covers (If Needed)</p>
                    <p className="text-[10px] text-slate-400 mt-1">Leaves empty if using built-in EPUB covers</p>
                  </div>
                  <div className="max-h-36 overflow-y-auto text-[11px] text-slate-500 space-y-1.5 pr-2">
                    {bulkCoverFiles.map((f, idx) => (
                      <div key={f.name + idx} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100 group/item">
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
                    <span>Archiving in progress...</span>
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
                  className="flex-1 px-6 py-4 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  disabled={isSubmitting || bulkBookFiles.length === 0}
                  onClick={handleBulkSubmit}
                  className="flex-2 px-12 py-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                  Archive Collection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">
                {editingBook ? "Edit Book Details" : "Add New Volume"}
              </h2>
              <button onClick={resetForm} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Book Title</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Author</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.author}
                    onChange={(e) => setFormData({...formData, author: e.target.value})}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Category</label>
                  <select 
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="">Select Category</option>
                    <option value="Fiction">Fiction</option>
                    <option value="Non-Fiction">Non-Fiction</option>
                    <option value="Philosophy">Philosophy</option>
                    <option value="Classic">Classic</option>
                    <option value="Poetry">Poetry</option>
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Price (e.g. $24.00)</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                  />
                </div>
                <div className="col-span-1">
                   <label className="block text-sm font-bold text-slate-700 mb-2">Pages</label>
                   <input 
                     type="text" 
                     className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                     value={formData.pages}
                     onChange={(e) => setFormData({...formData, pages: e.target.value})}
                   />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                  <textarea 
                    rows={6}
                    placeholder="Full introduction & description..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-y text-sm leading-relaxed"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
              </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" /> Book File (PDF/EPUB)
                    </label>
                    <input 
                      type="file" 
                      accept=".pdf,.epub,.doc,.docx"
                      onChange={(e) => setBookFile(e.target.files?.[0] || null)}
                      className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" /> Cover Image
                    </label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
                      className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                    />
                  </div>
                </div>

              <div className="pt-6 flex gap-4">
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="flex-1 px-6 py-4 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  disabled={isSubmitting}
                  type="submit" 
                  className="flex-2 px-12 py-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
                  {editingBook ? "Save Changes" : "Archive Book"}
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
                Bulk Randomize Book Prices
              </h2>
              <button 
                onClick={() => setIsRandomPriceModalOpen(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkRandomizePricesSubmit} className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Target Price Pool (One price per line)
                </label>
                <p className="text-xs text-slate-500 mb-3">
                  Enter prices separated by ENTER. Every target book will be assigned a randomly chosen price from this list!
                </p>
                <textarea
                  required
                  rows={6}
                  value={randomPriceInput}
                  onChange={(e) => setRandomPriceInput(e.target.value)}
                  placeholder="0.50&#10;0.99&#10;1.50&#10;2.99&#10;4.99&#10;9.99"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none font-mono text-sm leading-relaxed text-slate-800"
                />
                <div className="mt-2 text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {randomPriceInput.split('\n').filter(l => l.trim().length > 0).length} prices in pool
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Apply To:</label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={`p-4 rounded-2xl border-2 flex items-center gap-3 cursor-pointer transition-all ${
                    randomPriceTarget === 'all' ? 'border-emerald-500 bg-emerald-50/40 text-emerald-900 font-bold' : 'border-slate-200 text-slate-600'
                  }`}>
                    <input 
                      type="radio" 
                      name="randomTarget" 
                      checked={randomPriceTarget === 'all'} 
                      onChange={() => setRandomPriceTarget('all')}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span className="text-xs">All Books ({books.length} items)</span>
                  </label>

                  <label className={`p-4 rounded-2xl border-2 flex items-center gap-3 cursor-pointer transition-all ${
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
                    <span className="text-xs">Selected Books ({selectedBookIds.length} items)</span>
                  </label>
                </div>
              </div>

              {randomPriceProgress.total > 0 && (
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-emerald-800">
                    <span>Randomizing prices...</span>
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

              <div className="pt-4 flex gap-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setIsRandomPriceModalOpen(false)}
                  className="flex-1 px-6 py-3.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all text-sm"
                >
                  Cancel
                </button>
                <button 
                  disabled={isSubmitting}
                  type="submit" 
                  className="flex-2 px-8 py-3.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Applying Prices...</span>
                    </>
                  ) : (
                    <>
                      <Dices className="w-4 h-4" />
                      <span>Apply Random Prices</span>
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
