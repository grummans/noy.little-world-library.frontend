<script setup lang="ts">
import { RouterLink } from "vue-router";
import { formatPrice, type Book } from "../../data/books";

withDefaults(
  defineProps<{
    book: Book;
    variant?: "featured" | "library";
  }>(),
  { variant: "featured" },
);
</script>

<template>
  <RouterLink
    class="book"
    :class="`book--${variant}`"
    :to="book.kind === 'bundle' ? `/bundles/${book.slug}` : `/books/${book.slug}`"
  >
    <img
      v-if="book.cover"
      class="book__cover"
      :src="book.cover"
      :alt="`Bìa sách ${book.title}`"
      loading="lazy"
    />
    <div v-else class="book__cover book__cover--empty" aria-hidden="true">📚</div>
    <span v-if="book.kind === 'bundle'" class="book__chip">Gói sách</span>
    <div class="book__text">
      <h3>{{ book.title }}</h3>
      <p v-if="book.category || book.ageRange || book.bookCount">
        <template v-if="book.bookCount">{{ book.bookCount }} sách</template>
        <span v-if="book.bookCount && book.category" aria-hidden="true">•</span>
        <template v-if="book.category">{{ book.category }}</template>
        <span v-if="book.category && book.ageRange" aria-hidden="true">•</span>
        <template v-if="book.ageRange">{{ book.ageRange }}</template>
      </p>
    </div>
    <span v-if="!book.isFree" class="book__price">{{ formatPrice(book) }}</span>
    <span v-else class="book__price book__price--free">Miễn phí</span>
    <span v-if="variant === 'featured' && book.isFree && book.hasAudio" class="audio"
      >🔊 Có âm thanh</span
    >
  </RouterLink>
</template>
