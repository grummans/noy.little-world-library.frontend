export type Activity = {
  slug: string
  title: string
  description: string
  gameType: string
  theme: 'animals' | 'plants'
  /** The Wordwall iframe `src`. Update this one value if Wordwall changes the link. */
  embedUrl: string
}

export const activities: Activity[] = [
  {
    slug: 'dong-vat',
    title: 'Chủ đề động vật',
    description: 'Bé nhận biết các con vật quen thuộc qua một trò chơi tương tác.',
    gameType: 'Ghép đôi',
    theme: 'animals',
    embedUrl:
      'https://wordwall.net/embed/629ec0e8ad7649f5b530f95fd81df87e?themeId=1&templateId=3&fontStackId=0',
  },
  {
    slug: 'the-gioi-thuc-vat',
    title: 'Chủ đề thế giới thực vật',
    description: 'Cùng bé khám phá cây cối và các loài hoa trong vườn.',
    gameType: 'Ghép đôi',
    theme: 'plants',
    embedUrl:
      'https://wordwall.net/embed/9dc14e870286476f9c37b78965bad24d?themeId=1&templateId=3&fontStackId=0',
  },
]

export const findActivity = (slug: string) => activities.find((activity) => activity.slug === slug)
