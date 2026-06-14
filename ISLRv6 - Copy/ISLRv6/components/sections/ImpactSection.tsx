// components/sections/ImpactSection.tsx
"use client"

import React, { useState } from "react";
import { motion, useInView } from "framer-motion"; // Revert to simple import
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { HiMiniUserGroup } from 'react-icons/hi2';
import { RiPercentLine, RiGovernmentLine } from 'react-icons/ri';
import { IoEarOutline, IoMedicalOutline, IoEarthOutline } from 'react-icons/io5';
import { indiaSeverityData, worldwideImpactData } from "./constants";
import Link from "next/link";
import { TbArrowBigRightFilled } from "react-icons/tb";
import { BsHospital, BsPeople, BsGlobe2, BsTranslate, BsLightningChargeFill, BsPercent as BsPercentIcon } from "react-icons/bs";
import { HiLanguage } from "react-icons/hi2";


const AnimatedProgressBar = ({ value, maxValue, color, label }: { value: number; maxValue: number; color: string; label: string }) => {
  // Fix: Use 'amount' instead of 'threshold' in useInView options
  const ref = React.useRef(null);
  const inView = useInView(ref, {
    once: true,
    amount: 0.1,
  });

  return (
    <div ref={ref} className="mb-4 space-y-1">
      <div className="flex justify-between">
        <span className="text-xs text-white/70">{label}</span>
        <span className="text-xs font-medium text-white/90">{value}%</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={inView ? { width: `${(value / maxValue) * 100}%` } : { width: 0 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
};

// Enhanced StatsCard component with better icon display and animations
const StatsCard = ({
  value,
  label,
  sub,
  icon,
  color
}: {
  value: string;
  label: string;
  sub: string;
  icon?: React.ReactNode;
  color?: string;
}) => {
  // Fix: Use 'amount' instead of 'threshold' in useInView options
  const ref = React.useRef(null);
  const inView = useInView(ref, {
    once: true,
    amount: 0.1,
  });

  return (
    <motion.div
      ref={ref}
      whileHover={{ scale: 1.05, y: -5 }}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.6 }}
      className="bg-white/[0.03] border border-white/10 rounded-lg p-4 flex flex-col justify-between relative overflow-hidden group"
    >
      {/* Enhanced background and color effects */}
      {color && (
        <>
          <div
            className="absolute top-0 left-0 w-full h-1"
            style={{ background: color }}
          />
          <div
            className="absolute bottom-0 left-0 w-full h-24 opacity-0 group-hover:opacity-10 transition-opacity duration-300"
            style={{ background: `linear-gradient(to top, ${color}, transparent)` }}
          />
        </>
      )}

      {/* Enhanced icon display with background glow effect */}
      {icon && (
        <div className="absolute top-4 right-4 text-xl">
          <motion.div
            className="w-12 h-12 rounded-full flex items-center justify-center relative"
            whileHover={{ scale: 1.1, rotate: [0, 5, -5, 0] }}
            transition={{ duration: 0.5 }}
          >
            <div className="absolute inset-0 rounded-full bg-white/5 backdrop-blur-sm"></div>
            {/* Add subtle glow effect */}
            <div
              className="absolute inset-0 rounded-full opacity-20"
              style={{ background: color, filter: "blur(8px)" }}
            ></div>
            <div className="relative z-10 text-2xl" style={{ color }}>
              {icon}
            </div>
          </motion.div>
        </div>
      )}

      <h3 className="text-white/60 text-xs">{label}</h3>
      <div className="mt-2">
        <motion.span
          className="text-2xl font-bold text-white block"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {value}
        </motion.span>
        <p className="text-white/40 text-xs mt-1">{sub}</p>
      </div>
    </motion.div>
  );
};


interface ImpactSectionProps {
  contentReady: boolean;
}

const ImpactSection: React.FC<ImpactSectionProps> = ({ contentReady }) => {
  const [activePieSector, setActivePieSector] = useState<number | null>(null);

  return (
    <section className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto bg-transparent">
      {/* Understanding the Impact section */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="space-y-6" // Reduced from space-y-12
      >
        <div className="text-center relative z-10">
          {/* Heading and underline in tighter spacing */}
          <div className="space-y-2">
            <motion.h2
              className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-white/90 to-rose-300"
              initial={{ opacity: 0, y: -20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              style={{ paddingBottom: "0.05em", lineHeight: 1.2 }}
            >
              Understanding the Impact
            </motion.h2>
            
            {/* Animated gradient underline with less margin */}
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: "80px" }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="h-1 bg-gradient-to-r from-indigo-500 via-rose-400 to-indigo-500 mx-auto rounded-full"
            />
          </div>
          
          {/* Paragraph with more space from the underline */}
          <motion.p
            className="text-white/60 max-w-2xl mx-auto mt-4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            In India, approximately 63 million people (6.3% of population) suffer from significant auditory impairment.
            Globally, over 1.5 billion people are affected by hearing loss, with projections showing this number
            will reach 2.5 billion by 2050.
          </motion.p>
        </div>

        {/* India and Global sections with charts and stats cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6 relative z-0">
          <motion.div
            className="grid gap-4"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <Card className="bg-white/[0.03] border-white/10 overflow-hidden">
              <CardHeader className="border-b border-white/10 py-4">
                <CardTitle className="text-white text-xl flex items-center gap-2">
                  <span className="inline-block w-5 h-5 bg-gradient-to-r from-pink-500 to-indigo-500 rounded-full"></span>
                  Hearing Impairment in India
                </CardTitle>
                <CardDescription>Ministry of Health & Family Welfare data</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 pb-4">
                {/* Pie Chart and Progress Bars */}
                <div className="space-y-6">
                  <div className="bg-white/[0.03] border border-white/10 rounded-lg p-5 relative">
                    <h4 className="text-white/80 text-sm font-medium mb-4 flex items-center">
                      <span className="inline-block w-2 h-2 bg-pink-400/80 rounded-full mr-2"></span>
                      Severity Distribution
                    </h4>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="w-full md:w-1/2 h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={indiaSeverityData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={2}
                              dataKey="value"
                              onMouseEnter={(_, index) => setActivePieSector(index)}
                              onMouseLeave={() => setActivePieSector(null)}
                            >
                              {indiaSeverityData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.color}
                                  stroke="transparent"
                                  opacity={activePieSector === index || activePieSector === null ? 1 : 0.6}
                                />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-full md:w-1/2 space-y-3">
                        {indiaSeverityData.map((item, index) => (
                          <motion.div
                            key={index}
                            className="flex items-center gap-3"
                            onHoverStart={() => setActivePieSector(index)}
                            onHoverEnd={() => setActivePieSector(null)}
                            whileHover={{ scale: 1.05, x: 5 }}
                          >
                            <div className="w-4 h-4 rounded-full" style={{ background: item.color }}></div>
                            <div>
                              <span className="text-white/90 text-sm font-medium">{item.value}%</span>
                              <span className="text-white/60 text-xs ml-2">{item.name}</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-white/10 rounded-lg p-5">
                    <h4 className="text-white/80 text-sm font-medium mb-4 flex items-center">
                      <span className="inline-block w-2 h-2 bg-indigo-400/80 rounded-full mr-2"></span>
                      Regional Distribution
                    </h4>

                    <div className="space-y-4">
                      <AnimatedProgressBar value={9} maxValue={10} color="hsl(214, 84%, 75%)" label="Urban Areas (% of all disabilities)" />
                      <AnimatedProgressBar value={10} maxValue={10} color="hsl(267, 84%, 75%)" label="Rural Areas (% of all disabilities)" />
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="text-xs text-white/50">
                        Source: Allied Academies, Ministry of Health & Family Welfare
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Stats Boxes with improved icons */}
            <div className="grid grid-cols-3 gap-3">
              <StatsCard
                label="Population"
                value="63M"
                sub="People affected"
                icon={<motion.div
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    repeatType: "reverse"
                  }}
                >
                  <HiMiniUserGroup className="text-indigo-300" />
                </motion.div>}
                color="hsl(330, 100%, 70%)"
              />
              <StatsCard
                label="Percentage"
                value="6.3%"
                sub="Of population"
                icon={<motion.div
                  animate={{
                    rotate: [0, 15, 0, -15, 0],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 6,
                    repeatType: "reverse"
                  }}
                >
                  <RiPercentLine className="text-purple-300" />
                </motion.div>}
                color="hsl(267, 84%, 75%)"
              />
              <StatsCard
                label="NPPCD"
                value="Active"
                sub="National program"
                icon={<motion.div
                  animate={{
                    y: [0, -3, 0],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    repeatType: "reverse"
                  }}
                >
                  <RiGovernmentLine className="text-blue-300" />
                </motion.div>}
                color="hsl(214, 84%, 75%)"
              />
            </div>
          </motion.div>

          {/* Global Section */}
          <motion.div
            className="grid gap-4"
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <Card className="bg-white/[0.03] border-white/10 overflow-hidden">
              <CardHeader className="border-b border-white/10 py-4">
                <CardTitle className="text-white text-xl flex items-center gap-2">
                  <span className="inline-block w-5 h-5 bg-gradient-to-r from-blue-500 to-teal-500 rounded-full"></span>
                  Global Hearing Impairment
                </CardTitle>
                <CardDescription>World Health Organization data</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 pb-4">
                {/* Current & Projected Impact and Demographic Distribution */}
                <div className="space-y-6">
                  <div className="bg-white/[0.03] border border-white/10 rounded-lg p-5">
                    <h4 className="text-white/80 text-sm font-medium mb-4 flex items-center">
                      <span className="inline-block w-2 h-2 bg-teal-400/80 rounded-full mr-2"></span>
                      Current & Projected Impact
                    </h4>

                    <div className="flex flex-col items-start">
                      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <motion.div
                          className="relative"
                          whileHover={{ scale: 1.05 }}
                          transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        >
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-lg opacity-30 blur"></div>
                          <div className="relative bg-black/40 rounded-lg p-4 flex flex-col items-center">
                            <motion.div
                              className="text-4xl font-extrabold text-white"
                              initial={{ opacity: 0, scale: 0.5 }}
                              whileInView={{ opacity: 1, scale: 1 }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.8 }}
                            >
                              1.5B+
                            </motion.div>
                            <p className="text-white/60 text-sm mt-1">Current affected</p>
                            <div className="w-10 h-1 bg-blue-500/50 rounded-full mt-2"></div>
                          </div>
                        </motion.div>

                        <motion.div
                          className="relative"
                          whileHover={{ scale: 1.05 }}
                          transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        >
                          <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 to-pink-500 rounded-lg opacity-30 blur"></div>
                          <div className="relative bg-black/40 rounded-lg p-4 flex flex-col items-center">
                            <div className="text-xs text-white/50 font-medium mb-1">Projected by 2050</div>
                            <motion.div
                              className="text-4xl font-extrabold text-white"
                              initial={{ opacity: 0, scale: 0.5 }}
                              whileInView={{ opacity: 1, scale: 1 }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.8, delay: 0.2 }}
                            >
                              2.5B
                            </motion.div>
                            <div className="w-10 h-1 bg-rose-500/50 rounded-full mt-2"></div>
                          </div>
                        </motion.div>
                      </div>

                      <div className="w-full mt-6 bg-white/[0.02] rounded-lg p-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-purple-500/5 to-pink-500/5"></div>
                        <h5 className="text-white/70 text-xs font-medium mb-3">Growth Projection</h5>
                        <div className="relative h-8 bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500/40 to-pink-500/40 rounded-full"
                            initial={{ width: '0%' }}
                            whileInView={{ width: '60%' }}
                            viewport={{ once: true }}
                            transition={{ duration: 2, ease: "easeOut" }}
                          ></motion.div>
                          <div className="absolute top-0 left-0 h-full flex items-center justify-end px-4">
                            <span className="text-xs font-medium text-white/90">+67% by 2050</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.03] border border-white/10 rounded-lg p-5">
                    <h4 className="text-white/80 text-sm font-medium mb-4 flex items-center">
                      <span className="inline-block w-2 h-2 bg-blue-400/80 rounded-full mr-2"></span>
                      Demographic Distribution
                    </h4>

                    <div className="space-y-5">
                      <div className="flex flex-wrap gap-4">
                        <motion.div
                          className="flex-1 min-w-[120px] bg-white/[0.02] rounded-lg p-3 relative overflow-hidden"
                          whileHover={{ y: -5 }}
                          transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-blue-400/80"></div>
                          <p className="text-white/50 text-xs">Males</p>
                          <p className="text-white text-lg font-medium mt-1">217M</p>
                          <p className="text-white/40 text-xs mt-1">5.6% prevalence</p>
                        </motion.div>

                        <motion.div
                          className="flex-1 min-w-[120px] bg-white/[0.02] rounded-lg p-3 relative overflow-hidden"
                          whileHover={{ y: -5 }}
                          transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-pink-400/80"></div>
                          <p className="text-white/50 text-xs">Females</p>
                          <p className="text-white text-lg font-medium mt-1">211M</p>
                          <p className="text-white/40 text-xs mt-1">5.5% prevalence</p>
                        </motion.div>
                      </div>

                      <div className="p-4 bg-white/[0.02] rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white/70 text-xs">Adults over 60 affected</span>
                          <span className="text-white font-medium text-sm">25%+</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
                            initial={{ width: 0 }}
                            whileInView={{ width: '25%' }}
                            viewport={{ once: true }}
                            transition={{ duration: 1.5, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="text-xs text-white/50">
                        Source: World Health Organization, NCOA
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Stats Boxes with improved icons */}
            <div className="grid grid-cols-3 gap-3">
              <StatsCard
                label="Disabling Loss"
                value="430M+"
                sub=">35 dB loss"
                icon={<motion.div
                  animate={{
                    rotateY: [0, 180, 0],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 5,
                    repeatType: "loop"
                  }}
                >
                  <IoEarOutline className="text-blue-300" />
                </motion.div>}
                color="hsl(214, 84%, 75%)"
              />
              <StatsCard
                label="Requiring Care"
                value="700M"
                sub="By 2050"
                icon={<motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 3,
                    repeatType: "reverse"
                  }}
                >
                  <IoMedicalOutline className="text-purple-300" />
                </motion.div>}
                color="hsl(267, 84%, 75%)"
              />
              <StatsCard
                label="Low-Income"
                value="80%"
                sub="Of affected people"
                icon={<motion.div
                  animate={{
                    rotate: [0, 360],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 10,
                    ease: "linear"
                  }}
                >
                  <IoEarthOutline className="text-rose-300" />
                </motion.div>}
                color="hsl(330, 100%, 70%)"
              />
            </div>
          </motion.div>
        </div>

        {/* Add a new section with global visual callout */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="w-full max-w-4xl mx-auto mt-10"
        >
          <div className="relative rounded-xl overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-rose-500/10"></div>
            <div className="absolute inset-0 backdrop-blur-[2px]"></div>

            {/* Content */}
            <div className="relative p-6 border border-white/10">
              <h3 className="text-xl text-center font-semibold text-white mb-6">
                Global Impact Visualization
              </h3>

              <div className="flex flex-wrap gap-5 justify-center">
                {worldwideImpactData.map((item, index) => (
                  <motion.div
                    key={index}
                    className="flex-1 min-w-[200px] max-w-[250px] bg-white/5 rounded-lg p-4 border border-white/10 relative overflow-hidden group"
                    whileHover={{ y: -5, scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  >
                    {/* Animated gradient background on hover */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 group-hover:opacity-30 transition-opacity duration-300`}></div>

                    <div className="flex items-start gap-3">
                      <div className="p-3 rounded-md bg-white/5 backdrop-blur-sm">
                        {/* Replace with custom SVG or high-quality icon */}
                        {index === 0 && <HiLanguage className="text-2xl text-indigo-300" />}
                        {index === 1 && <BsHospital className="text-2xl text-blue-300" />}
                        {index === 2 && <BsPeople className="text-2xl text-emerald-300" />}
                        {index === 3 && <BsGlobe2 className="text-2xl text-rose-300" />}
                      </div>
                      <div>
                        <h4 className="text-white/80 font-medium text-sm mb-1">{item.title}</h4>
                        <div className="text-xl font-bold text-white mb-1">{item.value}</div>
                        <p className="text-white/50 text-xs">{item.description}</p>
                      </div>
                    </div>

                    {/* Animated highlight line */}
                    <motion.div
                      className="absolute bottom-0 left-0 h-1 bg-gradient-to-r"
                      style={{
                        backgroundImage: index === 0 ? "linear-gradient(to right, #818cf8, #a78bfa)" :
                          index === 1 ? "linear-gradient(to right, #60a5fa, #22d3ee)" :
                            index === 2 ? "linear-gradient(to right, #34d399, #2dd4bf)" :
                              "linear-gradient(to right, #f472b6, #fb7185)"
                      }}
                      initial={{ width: 0 }}
                      whileInView={{ width: "100%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.3 + (index * 0.2) }}
                    />
                  </motion.div>
                ))}
              </div>

              {/* Call to action */}
              <div className="mt-8 flex justify-center">
                <Link href="/sign-detection">
                  <motion.button
                    className="px-6 py-3 bg-white/5 border border-white/10 rounded-full text-white hover:bg-white/10 transition-colors group flex items-center gap-2"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    <span>See how we're making a difference</span>
                    <motion.span
                      initial={{ x: 0 }}
                      animate={{ x: [0, 5, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                      <TbArrowBigRightFilled className="text-lg text-indigo-300" />
                    </motion.span>
                  </motion.button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default ImpactSection;