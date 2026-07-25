import React, { useEffect, useState } from 'react';

interface CircularProgressProps {
  score: number;
}

const CircularProgress: React.FC<CircularProgressProps> = ({ score }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  
  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const stepTime = duration / steps;
    let currentStep = 0;
    
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const easeProgress = progress * (2 - progress);
      setAnimatedScore(Math.round(easeProgress * score));
      
      if (currentStep >= steps) {
        clearInterval(timer);
        setAnimatedScore(score);
      }
    }, stepTime);
    
    return () => clearInterval(timer);
  }, [score]);

  const getColor = (val: number) => {
    if (val < 60) return 'var(--alert-red)';
    if (val < 75) return 'var(--amber)';
    return 'var(--healthy-green)';
  };

  const size = 220;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;
  const color = getColor(animatedScore);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90 drop-shadow-md">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--line)"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-100 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-6xl font-bold text-[var(--navy)] tracking-tight">{animatedScore}</span>
        <span className="text-sm text-[var(--ink-muted)] font-medium uppercase tracking-wider mt-1">Score</span>
      </div>
    </div>
  );
};

export default CircularProgress;
