import JSZip from 'jszip';

export interface ExtractedEpubData {
  title: string;
  author: string;
  description: string;
  coverFile: File | null;
}

// Robust HTML & XML entity decoder
export function decodeHtmlEntities(text: string): string {
  if (!text) return "";
  return text
    // Hex entities e.g. &#x2014; -> —, &#x2019; -> ’
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try { return String.fromCharCode(parseInt(hex, 16)); } catch { return _; }
    })
    // Decimal entities e.g. &#8212; -> —, &#8217; -> ’
    .replace(/&#([0-9]+);/g, (_, dec) => {
      try { return String.fromCharCode(parseInt(dec, 10)); } catch { return _; }
    })
    // Named entities
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '…')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&copy;/gi, '©')
    .replace(/&reg;/gi, '®')
    .replace(/&trade;/gi, '™');
}

// Clean extracted text: decode entities, preserve paragraphs, strip duplicate "Introduction" titles
export function cleanExtractedDescription(text: string): string {
  if (!text) return "";

  // 1. Decode entities
  let clean = decodeHtmlEntities(text);

  // 2. Convert paragraph breaks and headings to newlines, remove all other tags
  clean = clean
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  // 3. Decode entities again after tag stripping
  clean = decodeHtmlEntities(clean);

  // 4. Remove duplicate leading "Introduction", "Preface", "Foreword" headers
  clean = clean
    .replace(/^(\s*introduction\s*)+/gi, '')
    .replace(/^(\s*preface\s*)+/gi, '')
    .replace(/^(\s*foreword\s*)+/gi, '')
    .replace(/^(\s*overview\s*)+/gi, '')
    .replace(/^(\s*summary\s*)+/gi, '');

  // 5. Normalize whitespace while preserving double line breaks for paragraphs
  clean = clean
    .split('\n')
    .map(line => line.trim().replace(/[ \t]+/g, ' '))
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return clean;
}

export async function parseEpubFile(file: File, defaultAuthor: string = ""): Promise<ExtractedEpubData> {
  // Clean Title from filename: strip leading numbers, dots, spaces, underscores, dashes
  let cleanTitle = file.name
    .replace(/\.[^/.]+$/, "") // remove extension .epub
    .replace(/^[\d\s.\-_]+/, "") // remove leading numbers, dots, spaces, dashes (e.g. "01. ", "02_")
    .replace(/_/g, " ")
    .trim();

  let author = defaultAuthor.trim();
  let description = "";
  let coverFile: File | null = null;

  try {
    const zip = await JSZip.loadAsync(file);

    // 1. Find container.xml to locate OPF file
    let opfPath = "";
    const containerFile = zip.file("META-INF/container.xml");
    if (containerFile) {
      const containerText = await containerFile.async("text");
      const match = containerText.match(/full-path="([^"]+)"/);
      if (match) opfPath = match[1];
    }

    // Fallback: search for any .opf file in zip if container.xml is missing
    if (!opfPath) {
      const opfEntry = Object.keys(zip.files).find(path => path.toLowerCase().endsWith(".opf"));
      if (opfEntry) opfPath = opfEntry;
    }

    let coverHref = "";

    if (opfPath && zip.file(opfPath)) {
      const opfContent = await zip.file(opfPath)!.async("text");
      const opfDir = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/")) + "/" : "";

      // Extract OPF title if cleanTitle is empty
      const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
      if (!cleanTitle && titleMatch) {
        cleanTitle = decodeHtmlEntities(titleMatch[1].trim());
      }

      // Extract OPF author if default author not provided
      const creatorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
      if (!author && creatorMatch) {
        author = decodeHtmlEntities(creatorMatch[1].trim());
      }

      // Extract OPF description
      const descMatch = opfContent.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
      if (descMatch) {
        description = cleanExtractedDescription(descMatch[1]);
      }

      // Find cover image reference in OPF
      const coverPropMatch = opfContent.match(/<item[^>]*properties="[^"]*cover-image[^"]*"[^>]*href="([^"]+)"/i) ||
                             opfContent.match(/<item[^>]*href="([^"]+)"[^>]*properties="[^"]*cover-image[^"]*"/i);
      if (coverPropMatch) {
        coverHref = opfDir + coverPropMatch[1];
      }

      if (!coverHref) {
        const metaCoverMatch = opfContent.match(/<meta[^>]*name="cover"[^>]*content="([^"]+)"/i) ||
                               opfContent.match(/<meta[^>]*content="([^"]+)"[^>]*name="cover"/i);
        if (metaCoverMatch) {
          const coverId = metaCoverMatch[1];
          const itemMatch = opfContent.match(new RegExp(`<item[^>]*id="${coverId}"[^>]*href="([^"]+)"`, 'i')) ||
                            opfContent.match(new RegExp(`<item[^>]*href="([^"]+)"[^>]*id="${coverId}"`, 'i'));
          if (itemMatch) {
            coverHref = opfDir + itemMatch[1];
          }
        }
      }

      if (!coverHref) {
        const coverIdMatch = opfContent.match(/<item[^>]*id="(?:cover|cover-image|coverimage|img-cover)"[^>]*href="([^"]+)"/i) ||
                             opfContent.match(/<item[^>]*href="([^"]+)"[^>]*id="(?:cover|cover-image|coverimage|img-cover)"/i);
        if (coverIdMatch) {
          coverHref = opfDir + coverIdMatch[1];
        }
      }
    }

    // 2. Extract description from chapters/html if OPF description is empty or too short
    if (!description || description.length < 50) {
      const htmlEntries = Object.keys(zip.files).filter(p => p.match(/\.(xhtml|html|htm)$/i));
      const introEntry = htmlEntries.find(p => p.match(/intro|preface|foreword|ch01|chapter1|01/i)) || htmlEntries[0];
      if (introEntry && zip.file(introEntry)) {
        const textContent = await zip.file(introEntry)!.async("text");
        const cleanText = cleanExtractedDescription(textContent);
        if (cleanText.length > 50) {
          description = cleanText; // Full introduction without artificial truncation!
        }
      }
    }

    // 3. Find cover image in ZIP entries if coverHref was not found directly
    if (!coverHref || !zip.file(coverHref)) {
      const normalizedHref = coverHref.replace(/^\//, '');
      const matchedKey = Object.keys(zip.files).find(k => 
        k.toLowerCase() === normalizedHref.toLowerCase() || 
        k.toLowerCase().endsWith(normalizedHref.toLowerCase())
      );

      if (matchedKey && zip.file(matchedKey)) {
        coverHref = matchedKey;
      } else {
        const imageEntries = Object.keys(zip.files).filter(p => p.match(/\.(jpg|jpeg|png|webp)$/i));
        const coverImageEntry = imageEntries.find(p => p.toLowerCase().includes("cover")) || imageEntries[0];
        if (coverImageEntry) {
          coverHref = coverImageEntry;
        }
      }
    }

    // 4. Convert cover image entry to File object
    if (coverHref && zip.file(coverHref)) {
      const imageZipFile = zip.file(coverHref)!;
      const arrayBuffer = await imageZipFile.async("arraybuffer");

      let mimeType = "image/jpeg";
      if (coverHref.toLowerCase().endsWith(".png")) mimeType = "image/png";
      else if (coverHref.toLowerCase().endsWith(".webp")) mimeType = "image/webp";

      const blob = new Blob([arrayBuffer], { type: mimeType });
      const coverFileName = `${cleanTitle.replace(/[^a-z0-9]/gi, '_')}_cover.${mimeType.split('/')[1]}`;
      coverFile = new File([blob], coverFileName, { type: mimeType });
    }
  } catch (err) {
    console.error("EPUB Parsing Error for", file.name, err);
  }

  return {
    title: cleanTitle || file.name.replace(/\.[^/.]+$/, ""),
    author: author || "Unknown Author",
    description: description || `Collection volume for ${cleanTitle}. An essential guide for readers.`,
    coverFile
  };
}
