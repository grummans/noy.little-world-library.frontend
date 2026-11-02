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

export const books: Book[] = [
  {
    slug: "dong-vat-quanh-be",
    title: "Động vật quanh bé",
    cover: "/covers/dong-vat-quanh-be.png",
    epubUrl: "/books/dong-vat-quanh-be.epub",
    category: "Động vật",
    ageRange: "3–5 tuổi",
    duration: "8 phút",
    description:
      "Gặp gỡ những người bạn động vật gần gũi trong vườn nhà và quanh bé.",
    hasAudio: true,
    isFree: true,
    learningObjectives: [
      "Nhận biết động vật quen thuộc",
      "So sánh đặc điểm loài vật",
    ],
    published: true,
  },
  {
    slug: "the-gioi-thuc-vat",
    title: "Thế giới thực vật",
    cover: "/covers/the-gioi-thuc-vat.png",
    epubUrl: "/books/the-gioi-thuc-vat.epub",
    category: "Thiên nhiên",
    ageRange: "4–6 tuổi",
    duration: "8 phút",
    description:
      "Theo chân bé khám phá cây cối, hoa trái và khu vườn xanh mát.",
    hasAudio: true,
    isFree: true,
    learningObjectives: ["Nhận biết cây và hoa quả", "Chăm sóc cây xanh"],
    published: true,
  },
  {
    slug: "truong-mam-non",
    title: "Trường mầm non",
    cover: "/covers/truong-mam-non.png",
    epubUrl: "/books/truong-mam-non.epub",
    category: "Kỹ năng sống",
    ageRange: "3–5 tuổi",
    duration: "8 phút",
    description:
      "Cùng bé làm quen với lớp học, cô giáo và những người bạn thân thương.",
    hasAudio: true,
    isFree: true,
    learningObjectives: ["Làm quen với trường lớp", "Học cách chơi cùng bạn"],
    published: true,
  },
  {
    slug: "gia-dinh-cua-be",
    title: "Gia đình của bé",
    cover: "/covers/gia-dinh-cua-be.png",
    epubUrl: "/books/gia-dinh-cua-be.epub",
    category: "Gia đình",
    ageRange: "3–5 tuổi",
    duration: "7 phút",
    description: "Một ngày sum vầy bên ông bà, bố mẹ và những người thân yêu.",
    hasAudio: true,
    isFree: false,
    price: 25000,
    learningObjectives: [
      "Gọi tên thành viên gia đình",
      "Thể hiện tình cảm với người thân",
    ],
    published: true,
  },
  {
    slug: "nuoc-va-hien-tuong-tu-nhien",
    title: "Nước và hiện tượng tự nhiên",
    cover: "/covers/nuoc-va-hien-tuong-tu-nhien.png",
    epubUrl: "/books/nuoc-va-hien-tuong-tu-nhien.epub",
    category: "Thiên nhiên",
    ageRange: "4–6 tuổi",
    duration: "8 phút",
    description:
      "Bé khám phá nước, mưa, nắng và cầu vồng qua những trang sách rực rỡ.",
    hasAudio: true,
    isFree: false,
    price: 32000,
    learningObjectives: [
      "Nhận biết các hiện tượng tự nhiên",
      "Quan sát và đặt câu hỏi",
    ],
    published: true,
  },
  {
    slug: "que-huong-dat-nuoc",
    title: "Quê hương đất nước",
    cover: "/covers/que-huong-dat-nuoc.png",
    epubUrl: "/books/que-huong-dat-nuoc.epub",
    category: "Thiên nhiên",
    ageRange: "5–6 tuổi",
    duration: "7 phút",
    description:
      "Một chuyến đi nhỏ qua làng quê, sông núi và những nét đẹp của Việt Nam.",
    hasAudio: true,
    isFree: false,
    price: 29000,
    learningObjectives: [
      "Nhận biết cảnh đẹp quê hương",
      "Bồi đắp tình yêu đất nước",
    ],
    published: true,
  },
  {
    slug: "ban-than-cua-be",
    title: "Bản thân của bé",
    cover: "/covers/ban-than-cua-be.png",
    epubUrl: "/books/ban-than-cua-be.epub",
    category: "Cảm xúc",
    ageRange: "3–5 tuổi",
    duration: "9 phút",
    description:
      "Bé học về cơ thể, giác quan và những điều làm nên chính mình.",
    hasAudio: true,
    isFree: false,
    price: 35000,
    learningObjectives: ["Nhận biết bộ phận cơ thể", "Hiểu và gọi tên cảm xúc"],
    published: true,
  },
  {
    slug: "phuong-tien-giao-thong",
    title: "Phương tiện giao thông",
    cover: "/covers/phuong-tien-giao-thong.png",
    epubUrl: "/books/phuong-tien-giao-thong.epub",
    category: "Kỹ năng sống",
    ageRange: "3–5 tuổi",
    duration: "7 phút",
    description: "Bé nhận biết xe đạp, ô tô, máy bay và cách đi lại an toàn.",
    hasAudio: true,
    isFree: false,
    price: 19000,
    learningObjectives: [
      "Nhận biết phương tiện giao thông",
      "Học quy tắc an toàn đơn giản",
    ],
    published: true,
  },
  {
    slug: "nghe-nghiep",
    title: "Nghề nghiệp",
    cover: "/covers/nghe-nghiep.png",
    epubUrl: "/books/nghe-nghiep.epub",
    category: "Kỹ năng sống",
    ageRange: "4–6 tuổi",
    duration: "6 phút",
    description: "Khám phá những nghề nghiệp quen thuộc và ước mơ của bé.",
    hasAudio: true,
    isFree: false,
    price: 29000,
    learningObjectives: ["Khám phá các nghề nghiệp", "Nuôi dưỡng ước mơ"],
    published: true,
  },
  {
    slug: "bac-ho-voi-thieu-nhi",
    title: "Bác Hồ với thiếu nhi",
    cover: "/covers/bac-ho-voi-thieu-nhi.webp",
    epubUrl: "/books/bac-ho-voi-thieu-nhi.epub",
    category: "Cảm xúc",
    ageRange: "5–6 tuổi",
    duration: "6 phút",
    description:
      "Những câu chuyện ấm áp về tình cảm của Bác Hồ dành cho các em nhỏ.",
    hasAudio: true,
    isFree: false,
    price: 39000,
    learningObjectives: ["Hiểu tình cảm của Bác Hồ", "Bồi đắp lòng biết ơn"],
    published: true,
  },
];
