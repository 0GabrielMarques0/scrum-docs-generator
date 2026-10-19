export const MAX_IMAGES_PER_SCREEN = 10
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export interface ImagePayload {
  base64: string
  mimeType: string
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    // result is "data:image/png;base64,XXXX" - the API expects only the data part
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export async function filesToPayload(files: File[]): Promise<ImagePayload[]> {
  return Promise.all(
    files.map(async file => ({ base64: await fileToBase64(file), mimeType: file.type }))
  )
}

/** Safe file name from a screen or project name */
export function toFileName(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 80) || 'documento'
  )
}
