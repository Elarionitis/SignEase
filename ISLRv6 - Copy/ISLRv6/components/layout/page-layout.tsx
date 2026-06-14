"use client"

import React from "react"
import { motion } from "framer-motion"
import Background from "@/components/background"

interface PageLayoutProps {
  children: React.ReactNode
}

const PageLayout = ({ children }: PageLayoutProps) => {
  return (
    <div className="relative min-h-screen w-full bg-[#030303] overflow-hidden">
      <div className="fixed inset-0 w-full h-full">
        <div className="absolute inset-0 bg-[#030303]" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.05] via-transparent to-rose-500/[0.05] blur-3xl" />
        <Background />
      </div>
      <div className="relative z-10">
        {children}
      </div>
    </div>
  )
}

export default PageLayout
