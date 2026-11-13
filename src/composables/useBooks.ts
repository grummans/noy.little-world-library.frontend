import type { Book } from '../data/books'

export interface LibraryFilters {
  search: string
  category: string
  age: string
  option: string
}

export const createLibraryFilters = (category = 'all'): LibraryFilters => ({
  search: '',
  category,
  age: 'all',
  option: 'all',
})

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()

const parseAgeRange = (value: string): [number, number] | null => {
  const match = value.match(/(\d+)\s*[–-]\s*(\d+)/)
  return match ? [Number(match[1]), Number(match[2])] : null
}

const matchesAge = (range: string, age: string) => {
  if (age === 'all') return true
  const bookRange = parseAgeRange(range)
  const filterRange = age.split('-').map(Number)
  if (!bookRange || filterRange.length !== 2) return false
  return bookRange[0] <= filterRange[1] && bookRange[1] >= filterRange[0]
}

const matchesOption = (book: Book, option: string) => {
  if (option === 'free') return book.isFree
  if (option === 'audio') return book.hasAudio
  if (option === 'free-audio') return book.isFree && book.hasAudio
  return true
}

export const filterBooks = (filters: LibraryFilters, source: Book[] = []) => {
  const search = normalize(filters.search)

  return source.filter((book) => {
    if (filters.category !== 'all' && book.category !== filters.category) {
      return false
    }
    if (!matchesAge(book.ageRange, filters.age)) return false
    if (!matchesOption(book, filters.option)) return false
    if (!search) return true

    const searchable = normalize(
      [book.title, book.category, book.description, book.ageRange].join(' '),
    )
    return searchable.includes(search)
  })
}
