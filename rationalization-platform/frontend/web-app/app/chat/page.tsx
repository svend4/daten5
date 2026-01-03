'use client'
import { useState } from 'react'

export default function Chat() {
  const [messages, setMessages] = useState([])
  return <div className="p-8"><h1 className="text-4xl font-bold">AI Chat</h1></div>
}
