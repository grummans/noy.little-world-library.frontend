// Loads the published catalog once and exposes it in the shape the views already use.

import { onMounted, ref } from 'vue'
import { ApiError } from '../api/client'
import { listCatalog, listTags } from '../api/catalog'
import { cardsToBooks, tagNameLookup } from '../api/adapt'
import type { Book } from '../data/books'

// Library is small enough to filter and paginate in the browser for now.
// shortcut: switch to server-side paging when the catalog outgrows one page of 50.
const PAGE_LIMIT = 50

export function useCatalog(kind: 'book' | 'all' = 'book') {
  const books = ref<Book[]>([])
  const loading = ref(true)
  const error = ref('')

  const load = async () => {
    loading.value = true
    error.value = ''
    try {
      const [page, tags] = await Promise.all([
        listCatalog({ kind, limit: PAGE_LIMIT }),
        listTags().catch(() => []),
      ])
      books.value = cardsToBooks(page.items, tagNameLookup(tags))
    } catch (err) {
      error.value =
        err instanceof ApiError ? err.message : 'Không tải được thư viện.'
    } finally {
      loading.value = false
    }
  }

  onMounted(load)

  return { books, loading, error, reload: load }
}
