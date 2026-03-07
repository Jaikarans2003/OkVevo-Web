/**
 * DigitalWallet Component
 * 
 * A high-fidelity interactive digital wallet.
 * Features:
 * - 3D stacked card interface
 * - Smooth spring animations using Framer Motion
 * - Realistic metallic textures (Gold & Silver)
 * - Matte black wallet holder with depth
 * - Interactive states (Hover to peek, Click to select)
 */

'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Wifi, ChevronUp } from 'lucide-react';

// --- Types ---

interface CreatorCard {
  number: string;
  tag: string;
  title: string;
  description: string;
  img: string;
  accent: string;
}

interface DigitalWalletProps {
  balance?: string;
  className?: string;
  children?: React.ReactNode;
  cards?: CreatorCard[];
}

// --- Constants ---

const DEFAULT_CARDS: CreatorCard[] = [
  {
    number: '1',
    tag: 'CONTENT CREATOR',
    title: 'Content Creator',
    description: 'Create talking avatar videos in seconds.',
    img: '/avatar.png',
    accent: 'from-accent-orange/20 to-transparent'
  },
  {
    number: '2',
    tag: 'MARKETERS',
    title: 'Marketers',
    description: 'Generate product ads instantly.',
    img: '/movie-scene.png',
    accent: 'from-accent-sky/20 to-transparent'
  }
];

// --- Sub-Components ---

const Card = ({ 
  data, 
  index, 
  isActive, 
  isHovered, 
  onClick,
  totalCards 
}: { 
  data: CreatorCard; 
  index: number; 
  isActive: boolean; 
  isHovered: boolean;
  onClick: () => void;
  totalCards: number;
}) => {
  const cardBackgrounds = [
    'bg-[#FF6600]',       // Card 1: Orange
    'bg-[#2A2A2A]',       // Card 2: Dark grey
    'bg-[#D1D1D1]',       // Card 3: Light grey
    'bg-white'            // Card 4: White
  ];
  const cardBackground = cardBackgrounds[index % cardBackgrounds.length];
  
  const accentColors = [
    'border-transparent', // Card 1: No border
    'border-white/10',    // Card 2: Subtle border
    'border-black/10',    // Card 3: Subtle border
    'border-black/20'     // Card 4: Subtle border
  ];
  const accentColor = accentColors[index % accentColors.length];
  
  const textColors = [
    'text-white',         // Card 1: White text on black
    'text-white',         // Card 2: White text on dark grey
    'text-black',         // Card 3: Black text on light grey
    'text-black'          // Card 4: Black text on white
  ];
  const textColor = textColors[index % textColors.length];
  
  const tagBgColors = [
    'bg-black/20 border-black/30',           // Card 1: Dark tag on orange
    'bg-white/10 border-white/20',           // Card 2: White tag
    'bg-black/10 border-black/20',           // Card 3: Black tag
    'bg-black/10 border-black/20'            // Card 4: Black tag
  ];
  const tagBgColor = tagBgColors[index % tagBgColors.length];
  
  const numberColors = [
    'text-white/30',      // Card 1: White number on orange
    'text-white/20',      // Card 2: White number
    'text-black/20',      // Card 3: Black number
    'text-black/20'       // Card 4: Black number
  ];
  const numberColor = numberColors[index % numberColors.length];
  
  const xOffset = isActive 
    ? 0
    : isHovered 
      ? index < 2 
        ? -50 - ((1 - index) * 120)  // Cards 0,1 go left
        : 50 + ((index - 2) * 120)    // Cards 2,3 go right
      : index < 2
        ? 0 - ((1 - index) * 15)      // Cards 0,1 stack left
        : 0 + ((index - 2) * 15);     // Cards 2,3 stack right
  
  const yOffset = isActive ? 0 : 0;
      
  const zIndex = isActive ? 40 : 20 + (totalCards - 1 - index);
  const scale = isActive ? 1.05 : 1;
  const brightness = isActive ? 1 : isHovered ? 1 : 0.6 - (totalCards - 1 - index) * 0.1;
  const rotateY = isActive ? 0 : isHovered ? 0 : 0;

  return (
    <motion.div
      layout
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      initial={false}
      animate={{
        x: xOffset,
        y: yOffset,
        scale: scale,
        zIndex: zIndex,
        rotateY: rotateY,
        filter: `brightness(${brightness})`,
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
      }}
      className={`absolute left-0 w-full h-[240px] rounded-xl cursor-pointer shadow-xl overflow-hidden transform-gpu border-2 ${accentColor} ${cardBackground}`}
      style={{
        transformStyle: 'preserve-3d',
        top: '-50px',
        left: '-15px',
        transformOrigin: 'left center'
      }}
    >
      <div className="absolute inset-0 opacity-40 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative p-5 h-full flex flex-col justify-between text-shadow-sm select-none">
        <div className="flex justify-between items-start">
          <div className={`px-3 py-1 rounded-full border backdrop-blur-sm ${tagBgColor}`}>
            <span className={`text-[10px] font-bold tracking-wider ${textColor}`}>{data.tag}</span>
          </div>
          <div className={`text-3xl font-black ${numberColor}`}>{data.number}</div>
        </div>

        <div className="space-y-2">
          <div className={`text-xl font-black tracking-tight ${textColor}`}>
            {data.title}
          </div>
          
          <div className={`text-xs leading-relaxed overflow-hidden ${textColor} opacity-80`} style={{ maxHeight: '2.5rem' }}>
            {data.description}
          </div>
        </div>

        <div className="absolute bottom-5 right-5 w-12 h-12 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
          <div className="text-xl">✨</div>
        </div>
      </div>
    </motion.div>
  );
};

// --- Main Component ---

export function DigitalWallet({ balance = "$250,000", className, children, cards = DEFAULT_CARDS }: DigitalWalletProps) {
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isWalletHovered, setIsWalletHovered] = useState(false);

  const handleBackgroundClick = () => {
    setActiveCardId(null);
  };

  const currentBalance = activeCardId 
    ? cards.find(c => c.number === activeCardId)?.title 
    : balance;

  return (
    <div 
      className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden ${className || ''}`}
      onClick={handleBackgroundClick}
    >
      <div className="absolute inset-0 bg-black pointer-events-none" style={{
        backgroundImage: `
          linear-gradient(to right, rgba(255, 255, 255, 0.1) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px'
      }} />
      
      <div className="relative z-10 flex flex-col items-center w-full max-w-md perspective-1000 pointer-events-auto">
        
        <div 
          className="relative w-96 h-64 md:w-[500px] md:h-80"
          onMouseEnter={() => setIsWalletHovered(true)}
          onMouseLeave={() => setIsWalletHovered(false)}
        >
          <div className="absolute inset-x-6 top-0 bottom-0 perspective-1000 transform-style-3d pointer-events-none">
            {cards.map((card, index) => (
              <div key={card.number} className="pointer-events-auto">
                <Card 
                  data={card}
                  index={index}
                  isActive={activeCardId === card.number}
                  isHovered={isWalletHovered}
                  onClick={() => setActiveCardId(activeCardId === card.number ? null : card.number)}
                  totalCards={cards.length}
                />
              </div>
            ))}
          </div>

          <motion.div 
            className="absolute inset-0 bg-[#141414] rounded-2xl shadow-[0_30px_60px_-10px_rgba(0,0,0,0.9)] border border-white/5 z-30 flex flex-col items-center justify-center text-center overflow-visible"
            initial={false}
            animate={{
              rotateX: isWalletHovered || activeCardId ? 5 : 0,
              y: isWalletHovered ? 5 : 0,
            }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
          >
            <div className="absolute inset-0 opacity-60 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
            <div className="absolute inset-3 border border-dashed border-white/10 rounded-xl opacity-50 pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center space-y-2">
              <span className="text-[#5C7066] text-[10px] tracking-[0.25em] font-bold uppercase">Select a Card</span>
              <motion.div 
                key={currentBalance}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl text-[#E0E0E0] font-serif tracking-tight font-medium"
                style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
              >
                {currentBalance}
              </motion.div>
            </div>

            <div className="absolute top-0 inset-x-8 h-1 bg-black/40 rounded-b-lg blur-[1px]" />
          </motion.div>
          
          <motion.div 
            className="absolute inset-0 bg-[#080808] rounded-2xl z-0 transform translate-y-3 translate-z-[-10px] scale-[0.98]"
          />

        </div>

        {/* <motion.div 
          className="text-[#88A096]/40 text-[10px] tracking-widest uppercase mt-12 flex items-center gap-2 font-medium"
          animate={{ opacity: isWalletHovered ? 1 : 0.5 }}
        >
          <ChevronUp size={10} className={isWalletHovered ? "animate-bounce" : ""} />
          {activeCardId ? "Click background to close" : "Select a card"}
        </motion.div> */}
      </div>

      {children && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          {children}
        </div>
      )}
    </div>
  );
}

export default DigitalWallet;
