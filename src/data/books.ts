export interface Book {
  kind?: "book" | "bundle";
  // How many books a bundle holds; only set for bundles.
  bookCount?: number;
  slug: string;
  title: string;
  cover: string;
  epubUrl: string;
  category: string;
  ageRange: string;
  duration: string;
  description: string;
  hasAudio: boolean;
  hasVideo?: boolean;
  pageCount?: number;
  isFree: boolean;
  price?: number;
  learningObjectives: string[];
  published: boolean;
}

export const formatPrice = (book: Book) =>
  book.isFree || !book.price
    ? "Miễn phí"
    : `${book.price.toLocaleString("vi-VN")}đ`;
