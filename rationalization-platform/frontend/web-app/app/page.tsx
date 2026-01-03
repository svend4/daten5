import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen p-24">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-5xl font-bold mb-6">
          Rationalization Platform
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          B2B Operating System for discovering and integrating digital solutions
        </p>

        <div className="grid grid-cols-3 gap-6 mt-12">
          <Link href="/applications" className="p-6 border rounded-lg hover:border-blue-500">
            <h3 className="text-xl font-semibold mb-2">Applications</h3>
            <p className="text-gray-600">Discover software solutions</p>
          </Link>

          <Link href="/blueprints" className="p-6 border rounded-lg hover:border-blue-500">
            <h3 className="text-xl font-semibold mb-2">Blueprints</h3>
            <p className="text-gray-600">Pre-configured solutions</p>
          </Link>

          <Link href="/chat" className="p-6 border rounded-lg hover:border-blue-500">
            <h3 className="text-xl font-semibold mb-2">AI Assistant</h3>
            <p className="text-gray-600">Chat with AI to find solutions</p>
          </Link>
        </div>
      </div>
    </main>
  )
}
