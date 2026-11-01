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
      class="book__cover"
      :src="book.cover"
      :alt="`Bìa truyện ${book.title}`"
    />
    <div class="book__text">
      <h3>{{ book.title }}</h3>
      <p v-if="book.category || book.ageRange">
        <template v-if="book.category">{{ book.category }}</template>
        <span v-if="book.category && book.ageRange" aria-hidden="true">•</span>
        <template v-if="book.ageRange">{{ book.ageRange }}</template>
      </p>
    </div>
    <span v-if="!book.isFree" class="book__price">{{ formatPrice(book) }}</span>
    <span v-else-if="variant === 'featured' && book.hasAudio" class="audio"
      >🔊 Có âm thanh</span
    >
  </RouterLink>
</template>
