import { ref } from 'vue'

// Every successful state change announces itself; views render AppToast with `message`.
export const useToast = () => {
  const message = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined

  const show = (text: string) => {
    message.value = text
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => (message.value = ''), 4000)
  }

  return { message, show }
}
