"use client"

import * as React from "react"
import { useState, useEffect, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import Background from "@/components/background"
import { FaArrowRight, FaSearch, FaExternalLinkAlt, FaPlayCircle } from 'react-icons/fa'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

const pacifico = { className: "font-serif", variable: "font-serif" };
const inter = { variable: "font-sans" };

interface Sign {
  name: string;
  index: number;
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

const SignSearch: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isClient, setIsClient] = useState(false);
  const [signDatabase, setSignDatabase] = useState<Sign[]>([]);
  const [selectedSignIndex, setSelectedSignIndex] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [open, setOpen] = React.useState(false)
  const videoRef = useRef<HTMLVideoElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const signsPerPage = 10; // You can adjust this value

  useEffect(() => {
    const loadData = async () => {
      try {
        // Fetch the sign map JSON file
        const response = await fetch('/sign_to_prediction_index_map (1).json');
        const signMap = await response.json();

        // Create the sign database
        const signs: Sign[] = Object.entries(signMap).map(([signName, index]) => {
          return {
            name: signName,
            index: parseInt(index as string),
          };
        });

        setSignDatabase(signs);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };

    loadData();
  }, []);

  // Prevent hydration errors
  useEffect(() => {
    setIsClient(true);
    setMounted(true);

    // Check for URL params to pre-fill search
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');
    if (query) {
      setSearchQuery(query);
    }
  }, []);

  // Filter signs based on search query
  const filteredSigns = useMemo(() => {
    if (!searchQuery) return [];

    return signDatabase.filter(sign =>
      sign.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, signDatabase]);

  const totalSigns = filteredSigns.length;
  const totalPages = Math.ceil(totalSigns / signsPerPage);

  const currentSigns = useMemo(() => {
    const startIndex = (currentPage - 1) * signsPerPage;
    const endIndex = startIndex + signsPerPage;
    return filteredSigns.slice(startIndex, endIndex);
  }, [filteredSigns, currentPage, signsPerPage]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowDropdown(true); // Show dropdown on input change
    setCurrentPage(1); // Reset to first page on new search
  };

  const handleSignClick = (index: number) => {
    setSelectedSignIndex(index);
    
    // This will trigger the Dialog to open with the selected sign
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.src = `/videos/signs/${index}.mp4`;
        videoRef.current.load();
        videoRef.current.play().catch(e => {
          console.log("Auto-play failed, may need user interaction:", e);
        });
      }
    }, 100);
  };

  useEffect(() => {
    if (selectedSignIndex !== null && videoRef.current) {
      const videoSource = `/videos/signs/${selectedSignIndex}.mp4`;
      videoRef.current.src = videoSource;
      videoRef.current.load();
      videoRef.current.play();
    }
  }, [selectedSignIndex]);

  if (!isClient) {
    return null; // Prevent hydration issues
  }

  if (!mounted) return null;

  return (
    <div className={cn("relative min-h-screen w-full overflow-hidden bg-[#030303]", inter.variable, pacifico.variable)} suppressHydrationWarning>
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

          <div className="relative z-10 flex items-center justify-between w-full px-6 min-h-[80px] py-4">
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
              className="flex gap-4 text-white/90"
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
                className="hover:text-indigo-400 transition-all hover:scale-105"
              >
                Technology
              </Link>
              <Link
                href="/#team"
                className="hover:text-indigo-400 transition-all hover:scale-105"
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
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Search for a sign (e.g., Hello, Thank you, Bird...)"
                    className="w-full py-6 px-5 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl shadow-lg focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-colors duration:300"
                    value={searchQuery}
                    onChange={handleInputChange}
                  />
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white/40">
                    <FaSearch className="text-lg" />
                  </div>
                  {/* Improve the dropdown suggestions to make them more interactive */}
                  {searchQuery && showDropdown && (
                    <div className="absolute left-0 right-0 mt-2 rounded-md shadow-lg bg-black/70 backdrop-blur-md border border-white/10 overflow-hidden z-50">
                      {filteredSigns.length > 0 ? (
                        filteredSigns.slice(0, 5).map((sign) => (
                          <Button
                            key={sign.index}
                            variant="ghost"
                            className="w-full text-left px-4 py-2 text-white hover:bg-indigo-500/30 justify-start"
                            onClick={() => {
                              handleSignClick(sign.index);
                              setShowDropdown(false);
                              // Focus on the sign in the table by scrolling to it
                              document.getElementById(`sign-row-${sign.index}`)?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                              });
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <FaPlayCircle className="text-indigo-400" />
                              {sign.name}
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
                {searchQuery && (
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

                    <div className="bg-white/[0.03] backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl min-h-[300px]">
                      {currentSigns.length > 0 ? (
                        <Table>
                          <TableCaption>A list of your recent invoices.</TableCaption>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px] text-white font-semibold text-lg">Index</TableHead>
                              <TableHead className="text-white font-semibold text-lg">Sign Name</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
  {currentSigns.map((sign) => (
    <TableRow key={sign.index} id={`sign-row-${sign.index}`} className="hover:bg-white/5 cursor-pointer transition-colors">
      <TableCell className="font-medium text-white text-lg">{sign.index}</TableCell>
      <TableCell>
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              variant="link" 
              className="text-indigo-400 hover:text-indigo-500 font-semibold text-lg flex items-center gap-2"
              onClick={() => handleSignClick(sign.index)}
            >
              <FaPlayCircle className="text-sm" />
              {sign.name}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] bg-black border border-white/10">
            <DialogHeader>
              <DialogTitle className="text-white font-semibold text-2xl">{sign.name}</DialogTitle>
              <DialogDescription className="text-white/80 text-lg">
                Watch the video of {sign.name}
              </DialogDescription>
            </DialogHeader>
            <video
              ref={videoRef}
              width="560"
              height="315"
              controls
              autoPlay
              muted
              loop
              className="mx-auto rounded-md shadow-lg"
            >
              <source src={`/videos/signs/${sign.index}.mp4`} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  ))}
</TableBody>
                        </Table>
                      ) : searchQuery && (
                        <div className="flex flex-col items-center justify-center h-[300px]">
                          <div className="text-5xl mb-4 text-white/30">🔍</div>
                          <h3 className="text-xl font-medium text-white/70 mb-2">No matches found</h3>
                          <p className="text-white/50 text-center max-w-md">
                            Sorry, we couldn't find any signs matching "{searchQuery}".
                            Try a different search term or check your spelling.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {!searchQuery && (
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
                        {["Hello", "Thank", "Bird", "Apple", "Happy", "Boy", "Girl", "Home"].map((suggestion, i) => (
                          <Button
                            key={suggestion}
                            variant="outline"
                            onClick={() => setSearchQuery(suggestion)}
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
              {filteredSigns.length > 0 && (
                <Pagination>
                  <PaginationContent>
                    {currentPage > 1 && (
                      <PaginationPrevious
                        href="#"
                        onClick={() => setCurrentPage(currentPage - 1)}
                      />
                    )}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem
                        key={page}
                        className={cn({ "active-class": currentPage === page })}
                      >
                        <PaginationLink
                          href="#"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    {currentPage < totalPages && (
                      <PaginationNext
                        href="#"
                        onClick={() => setCurrentPage(currentPage + 1)}
                      />
                    )}
                  </PaginationContent>
                </Pagination>
              )}

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
