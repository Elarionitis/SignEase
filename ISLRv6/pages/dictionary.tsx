import * as React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
import fs from "fs"
import path from "path"
import type { GetStaticProps } from "next"
import Head from "next/head"
import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import Background from "@/components/background"
import { FaArrowRight, FaSearch, FaPlayCircle, FaTimes, FaVideoSlash } from 'react-icons/fa'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import signMap from "@/data/sign_to_prediction_index_map.json"

const pacifico = { className: "font-serif", variable: "font-serif" };
const inter = { variable: "font-sans" };

const SIGNS_PER_PAGE = 10;
const SUGGESTIONS = ["Hello", "Thank", "Bird", "Apple", "Happy", "Boy", "Girl", "Home", "Donkey"];

interface Sign {
  name: string;
  index: number;
  hasVideo: boolean;
}

interface SignSearchProps {
  signs: Sign[];
}

// The sign list and which demo videos exist are both known at build time, so
// the page ships with them instead of fetching and probing in the browser.
export const getStaticProps: GetStaticProps<SignSearchProps> = async () => {
  const videoDir = path.join(process.cwd(), "public", "videos", "signs");
  const videos = new Set(
    fs.existsSync(videoDir)
      ? fs.readdirSync(videoDir).filter((file) => file.endsWith(".mp4"))
      : []
  );
  const signs = Object.entries(signMap as Record<string, number>)
    .map(([name, index]) => ({ name, index, hasVideo: videos.has(`${index}.mp4`) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { props: { signs } };
};

function formatSignName(name: string) {
  return name.replace(/_/g, " ");
}

/** Page numbers to show, with null marking an ellipsis gap. */
function visiblePages(current: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(pages).filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result: Array<number | null> = [];
  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1] > 1) result.push(null);
    result.push(page);
  });
  return result;
}

// Add elegant shapes for visual consistency with home page
function ElegantShape({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "from-white/[0.08]",
}: {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  gradient?: string;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -150,
        rotate: rotate - 15,
      }}
      animate={{
        opacity: 1,
        y: 0,
        rotate: rotate,
      }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={{
          y: [0, 15, 0],
        }}
        transition={{
          duration: 12,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
        style={{
          width,
          height,
        }}
        className="relative"
      >
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-r to-transparent",
            gradient,
            "backdrop-blur-[2px] border-2 border-white/[0.15]",
            "shadow-[0_8px_32px_0_rgba(255,255,255,0.1)]",
            "after:absolute after:inset-0 after:rounded-full",
            "after:bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.2),transparent_70%)]",
          )}
        />
      </motion.div>
    </motion.div>
  );
}

const SignSearch: React.FC<SignSearchProps> = ({ signs }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSign, setSelectedSign] = useState<Sign | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Pre-fill the search from ?query= (used by the detection page's
  // "See how to sign it" link).
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("query");
    if (query) {
      setSearchQuery(query);
    }
  }, []);

  // Close the suggestions when clicking outside the search box.
  useEffect(() => {
    if (!showDropdown) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!searchBoxRef.current?.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showDropdown]);

  // Filter signs based on search query; names starting with the query first.
  const filteredSigns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase().replace(/\s+/g, "");
    if (!query) return [];

    return signs
      .filter((sign) => sign.name.toLowerCase().replace(/_/g, "").includes(query))
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(query);
        const bStarts = b.name.toLowerCase().startsWith(query);
        return aStarts === bStarts ? a.name.localeCompare(b.name) : aStarts ? -1 : 1;
      });
  }, [searchQuery, signs]);

  const totalPages = Math.max(1, Math.ceil(filteredSigns.length / SIGNS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);

  const currentSigns = useMemo(() => {
    const startIndex = (page - 1) * SIGNS_PER_PAGE;
    return filteredSigns.slice(startIndex, startIndex + SIGNS_PER_PAGE);
  }, [filteredSigns, page]);

  // Animation variants consistent with home page
  const fadeUpVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        duration: 1,
        delay: 0.5 + i * 0.2,
        ease: [0.25, 0.4, 0.25, 1],
      },
    }),
  };

  const updateQuery = (query: string, openDropdown: boolean) => {
    setSearchQuery(query);
    setShowDropdown(openDropdown);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    updateQuery("", false);
    setSelectedSign(null);
  };

  const openSign = (sign: Sign) => {
    setVideoFailed(false);
    setSelectedSign(sign);
    setShowDropdown(false);
  };

  const goToPage = (event: React.MouseEvent, target: number) => {
    event.preventDefault();
    setCurrentPage(Math.min(Math.max(1, target), totalPages));
  };

  return (
    <div className={cn("relative min-h-screen w-full overflow-hidden bg-[#030303]", inter.variable, pacifico.variable)}>
      <Head>
        <title>Sign Dictionary | SignEase</title>
        <meta name="description" content="Search the 250 ASL signs SignEase recognizes and watch how to perform them." />
      </Head>
      {/* Background with consistent styling */}
      <div className="fixed inset-0">
        <div className="absolute inset-0 bg-[#030303]" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.05] via-transparent to-rose-500/[0.05] blur-3xl" />
        <div className="absolute inset-0">
          <motion.div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),rgba(255,255,255,0)_60%)]" />
          <motion.div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/20" />
        </div>
      </div>

      {/* Add geometric shapes for visual consistency */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <ElegantShape
          delay={0.3}
          width={600}
          height={140}
          rotate={12}
          gradient="from-indigo-500/[0.15]"
          className="left-[-5vw] md:left-[5vw] top-[15vh] md:top-[20vh]"
        />

        <ElegantShape
          delay={0.5}
          width={500}
          height={120}
          rotate={-15}
          gradient="from-rose-500/[0.15]"
          className="right-[5vw] md:right-[10vw] top-[70vh] md:top-[75vh]"
        />

        <ElegantShape
          delay={0.4}
          width={300}
          height={80}
          rotate={-8}
          gradient="from-violet-500/[0.15]"
          className="left-[5%] md:left-[10%] bottom-[5%] md:bottom-[10%]"
        />
      </div>

      <Background key="background-component" />

      <div className="relative z-10">
        {/* Navigation with smooth blur gradient - styled like home page */}
        <nav className="fixed top-0 left-0 right-0 z-30 flex justify-between">
          <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none" />
          <div className="absolute inset-0 backdrop-blur-[8px] backdrop-saturate-150 bg-black/5 pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between w-full px-4 sm:px-6 min-h-[72px] sm:min-h-[80px] py-3 sm:py-4 gap-4">
            <motion.div
              custom={0}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-4"
            >
              <Link href="/" className="relative flex items-center h-[48px] hover:opacity-80 transition-opacity">
                <Image
                  src="/assets/SignEaseLogo.png"
                  alt="SignEase Logo"
                  width={40}
                  height={40}
                  className="object-contain"
                />
                <span className={cn(
                  "text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300 ml-3 leading-relaxed tracking-wide overflow-visible py-2",
                  pacifico.className
                )}>
                  SignEase
                </span>
              </Link>
            </motion.div>

            <motion.div
              custom={1}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="flex gap-3 sm:gap-4 text-sm sm:text-base text-white/90"
            >
              <Link
                href="/"
                className="hover:text-indigo-400 transition-all hover:scale-105"
              >
                Home
              </Link>
              <Link
                href="/sign-detection"
                className="hover:text-indigo-400 transition-all hover:scale-105"
              >
                Detection
              </Link>
              <Link
                href="/#technology"
                className="hidden md:inline hover:text-indigo-400 transition-all hover:scale-105"
              >
                Technology
              </Link>
              <Link
                href="/#team"
                className="hidden md:inline hover:text-indigo-400 transition-all hover:scale-105"
              >
                Team
              </Link>
            </motion.div>
          </div>
        </nav>

        {/* Main content */}
        <main className="relative py-4 px-4">
          <div className="container mx-auto">
            <div className="flex flex-col min-h-screen items-center justify-start pt-24">
              {/* Search introduction */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm mb-4"
              >
                <Image
                  src="/assets/SignEaseLogo.png"
                  alt="SignEase Logo"
                  width={24}
                  height={24}
                  className="object-contain"
                />
                <span className="text-sm text-white/80 tracking-wide font-medium">
                  Real-time Sign Language Recognition
                </span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="text-center mb-8 w-full max-w-3xl"
              >
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
                  <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                    Find your
                  </span>{" "}
                  <span className={cn(
                    "bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300",
                    pacifico.className
                  )}>
                    Sign
                  </span>
                </h1>

                <p className="text-base sm:text-lg text-white/60 max-w-2xl mx-auto mb-8">
                  Search for signs to find instructional videos and improve your sign language skills.
                  Didn't find the sign you were looking for in detection? Search our database here.
                </p>
              </motion.div>

              {/* Enhanced Search component */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.3 }}
                className="w-full max-w-3xl mx-auto mb-10"
              >
                <div className="relative" ref={searchBoxRef}>
                  <Input
                    type="text"
                    role="searchbox"
                    enterKeyHint="search"
                    autoComplete="off"
                    placeholder="Search for a sign (e.g., Hello, Thank you, Bird...)"
                    aria-label="Search signs"
                    className="w-full py-6 pl-5 pr-24 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl shadow-lg focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-colors duration-300"
                    value={searchQuery}
                    onChange={(event) => updateQuery(event.target.value, true)}
                    onFocus={() => searchQuery && setShowDropdown(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setShowDropdown(false);
                      if (event.key === "Enter" && filteredSigns.length > 0) openSign(filteredSigns[0]);
                    }}
                  />
                  {searchQuery && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={clearSearch}
                      aria-label="Clear sign search"
                      className="absolute right-12 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full text-white/50 hover:bg-white/10 hover:text-white"
                    >
                      <FaTimes className="text-base" />
                    </Button>
                  )}
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/40 pointer-events-none">
                    <FaSearch className="text-lg" />
                  </div>
                  {searchQuery && showDropdown && (
                    <div className="absolute left-0 right-0 mt-2 rounded-md shadow-lg bg-black/80 backdrop-blur-md border border-white/10 overflow-hidden z-50">
                      {filteredSigns.length > 0 ? (
                        filteredSigns.slice(0, 5).map((sign) => (
                          <Button
                            key={sign.index}
                            type="button"
                            variant="ghost"
                            className="w-full text-left px-4 py-2 text-white hover:bg-indigo-500/30 justify-start"
                            onClick={() => openSign(sign)}
                          >
                            <div className="flex items-center gap-2 capitalize">
                              {sign.hasVideo ? (
                                <FaPlayCircle className="text-indigo-400" />
                              ) : (
                                <FaVideoSlash className="text-white/30" />
                              )}
                              {formatSignName(sign.name)}
                            </div>
                          </Button>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-white/60">No results found</div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Search Results */}
              <div className="w-full max-w-3xl mx-auto">
                {searchQuery.trim() && (
                  <>
                    <motion.h2
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xl font-semibold text-white/90 mb-4"
                    >
                      {filteredSigns.length > 0
                        ? `Found ${filteredSigns.length} result${filteredSigns.length === 1 ? '' : 's'}`
                        : 'No results found'}
                    </motion.h2>

                    <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-6 shadow-xl min-h-[300px]">
                      {currentSigns.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow className="border-white/10 hover:bg-transparent">
                              <TableHead className="w-[80px] text-white font-semibold text-lg">#</TableHead>
                              <TableHead className="text-white font-semibold text-lg">Sign Name</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {currentSigns.map((sign) => (
                              <TableRow
                                key={sign.index}
                                className="border-white/10 hover:bg-white/5 cursor-pointer transition-colors"
                                onClick={() => openSign(sign)}
                              >
                                <TableCell className="font-medium text-white/70 text-lg tabular-nums">{sign.index}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <Button
                                      type="button"
                                      variant="link"
                                      className="h-auto p-0 text-indigo-400 hover:text-indigo-300 font-semibold text-lg flex items-center gap-2 capitalize"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        openSign(sign);
                                      }}
                                    >
                                      <FaPlayCircle className="text-sm" />
                                      {formatSignName(sign.name)}
                                    </Button>
                                    {!sign.hasVideo && (
                                      <span className="text-xs text-white/40 px-2 py-0.5 rounded-full border border-white/10">
                                        Video coming soon
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-[300px]">
                          <div className="text-5xl mb-4 text-white/30">🔍</div>
                          <h3 className="text-xl font-medium text-white/70 mb-2">No matches found</h3>
                          <p className="text-white/50 text-center max-w-md break-words">
                            Sorry, we couldn&apos;t find any signs matching &quot;{searchQuery}&quot;.
                            Try a different search term or check your spelling.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {!searchQuery.trim() && (
                  <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center shadow-xl">
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-rose-500/20 flex items-center justify-center mb-6">
                        <FaSearch className="text-3xl text-white/70" />
                      </div>
                      <h3 className="text-2xl font-medium text-white/90 mb-3">Search Our Sign Dictionary</h3>
                      <p className="text-white/60 max-w-lg mb-6">
                        Type the name of a sign above to find video tutorials and improve your sign language skills.
                      </p>
                      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 max-w-xl">
                        {SUGGESTIONS.map((suggestion) => (
                          <Button
                            key={suggestion}
                            type="button"
                            variant="outline"
                            onClick={() => updateQuery(suggestion, false)}
                            className="bg-white/5 hover:bg-white/10 border-white/10 text-white/80"
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {totalPages > 1 && (
                <Pagination className="mt-6">
                  <PaginationContent className="flex-wrap justify-center text-white">
                    {page > 1 && (
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          className="hover:bg-white/10 hover:text-white"
                          onClick={(event) => goToPage(event, page - 1)}
                        />
                      </PaginationItem>
                    )}
                    {visiblePages(page, totalPages).map((pageNumber, i) =>
                      pageNumber === null ? (
                        <PaginationItem key={`gap-${i}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            href="#"
                            isActive={pageNumber === page}
                            className={cn(
                              "hover:bg-white/10 hover:text-white",
                              pageNumber === page && "bg-white/10 border-white/20 text-white"
                            )}
                            onClick={(event) => goToPage(event, pageNumber)}
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}
                    {page < totalPages && (
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          className="hover:bg-white/10 hover:text-white"
                          onClick={(event) => goToPage(event, page + 1)}
                        />
                      </PaginationItem>
                    )}
                  </PaginationContent>
                </Pagination>
              )}

              <Dialog
                open={selectedSign !== null}
                onOpenChange={(open) => {
                  if (!open) setSelectedSign(null);
                }}
              >
                <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[600px] bg-black border border-white/10 text-white font-serif">
                  {selectedSign && (
                    <>
                      <DialogHeader>
                        <DialogTitle className="text-white font-semibold text-2xl capitalize">
                          {formatSignName(selectedSign.name)}
                        </DialogTitle>
                        <DialogDescription className="text-white/80 text-lg">
                          {selectedSign.hasVideo && !videoFailed
                            ? `Watch how to sign "${formatSignName(selectedSign.name)}"`
                            : "A demonstration video for this sign is not available yet."}
                        </DialogDescription>
                      </DialogHeader>
                      {selectedSign.hasVideo && !videoFailed ? (
                        <video
                          key={selectedSign.index}
                          src={`/videos/signs/${selectedSign.index}.mp4`}
                          controls
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="auto"
                          onError={() => setVideoFailed(true)}
                          className="w-full aspect-video mx-auto rounded-md shadow-lg bg-white/5"
                        >
                          Your browser does not support the video tag.
                        </video>
                      ) : (
                        <div className="w-full aspect-video rounded-md border border-white/10 bg-white/[0.03] flex flex-col items-center justify-center gap-3 text-center p-6">
                          <FaVideoSlash className="text-3xl text-white/40" />
                          <p className="text-white/60 text-sm max-w-xs">
                            You can still try it on the detection page: the model recognizes this sign.
                          </p>
                          <Link
                            href="/sign-detection"
                            className="inline-flex items-center gap-2 text-sm text-indigo-300 hover:text-indigo-200"
                          >
                            Go to detection <FaArrowRight className="text-xs" />
                          </Link>
                        </div>
                      )}
                    </>
                  )}
                </DialogContent>
              </Dialog>

              {/* Additional info section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.6 }}
                className="mt-16 w-full max-w-3xl mx-auto text-center"
              >
                <div className="bg-gradient-to-r from-indigo-500/10 via-white/5 to-rose-500/10 rounded-xl p-6 backdrop-blur-sm border border-white/10">
                  <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300 mb-3">
                    Can't find what you're looking for?
                  </h3>
                  <p className="text-white/60 mb-4">
                    Our sign database is continuously expanding. Return to the detection page to try recognition again or explore our learning resources.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Link
                      href="/sign-detection"
                      className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-rose-500 hover:opacity-90 text-white rounded-full flex items-center justify-center gap-2 transition-all"
                    >
                      Back to Detection <FaArrowRight className="text-sm" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SignSearch;
