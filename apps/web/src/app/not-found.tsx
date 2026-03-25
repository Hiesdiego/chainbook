import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
      <p className="text-6xl">📡</p>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted-foreground text-sm max-w-xs">
        This page doesn&apos;t exist on-chain or off-chain.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
      >
        Back to Feed
      </Link>
    </div>
  )
}