// Maps API cards onto the shape the existing components render, so the UI keeps its
// current props while the data comes from the Go API.
//
// shortcut: the API has no duration / audio / learning-objectives yet, so those keep
// their defaults. Add them to the books table when the Studio needs to edit them.

import type { Book } from '../data/books'
import type { Card, Tag } from './catalog'

export function tagNameLookup(tags: Tag[]): Map<string, string> {
  return new Map(tags.map((tag) => [tag.slug, tag.name]))
}

function ageRange(card: Card): string {
  if (card.age_min === null && card.age_max === null) return ''
  if (card.age_min !== null && card.age_max !== null) {
    return `${card.age_min}–${card.age_max} tuổi`
  }
  return `${card.age_min ?? card.age_max} tuổi`
}

export function cardToBook(card: Card, tagNames: Map<string, string>): Book {
  const firstTag = card.tag_slugs[0]

  return {
    kind: card.kind,
    slug: card.slug,
    title: card.title,
    cover: card.cover_url,
    epubUrl: '',
    // A bundle has no topic of its own: say how many books it contains instead.
    category:
      card.kind === 'bundle'
        ? `Gói sách · ${card.book_count ?? 0} sách`
        : ((firstTag && tagNames.get(firstTag)) ?? ''),
    ageRange: ageRange(card),
    duration: '',
    description: '',
    hasAudio: Boolean(card.has_audio),
    hasVideo: Boolean(card.has_video),
    pageCount: card.page_count && card.page_count > 0 ? card.page_count : undefined,
    isFree: card.access_type === 'free',
    price: card.price_vnd ?? undefined,
    learningObjectives: [],
    published: true,
  }
}

export const cardsToBooks = (cards: Card[], tagNames: Map<string, string>): Book[] =>
  cards.map((card) => cardToBook(card, tagNames))
