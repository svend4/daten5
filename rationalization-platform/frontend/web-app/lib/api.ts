import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
})

export const nlApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_NL_API_URL || 'http://localhost:8002',
})
