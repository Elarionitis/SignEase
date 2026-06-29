import Link from "next/link";

export function Navbar() {
  return (
    <nav className="bg-gray-800 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-white text-2xl font-bold">
          SignEase
        </Link>
        <Link href="/" className="text-white hover:text-gray-300">
          Home
        </Link>
        <a
          className="hover:text-indigo-400 transition-all hover:scale-105"
          href="#faq"
        >
          FAQ
        </a>
      </div>
    </nav>
  );
}
