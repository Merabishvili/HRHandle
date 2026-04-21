export type UUID = string
export type ISODateString = string
export type ISODateTimeString = string

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}
