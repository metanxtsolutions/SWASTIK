import Link from "next/link";

export default function RootNotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 text-ink-soft">The page you are looking for does not exist.</p>
      <Link href="/" className="btn btn-primary mt-6">
        Go to the home page
      </Link>
    </div>
  );
}
