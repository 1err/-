import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';

interface TimerProps {
  startDate: Date;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const Timer: React.FC<TimerProps> = ({ startDate }) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isFuture, setIsFuture] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const diff = now.getTime() - startDate.getTime();
      
      const isDateInFuture = diff < 0;
      setIsFuture(isDateInFuture);

      const absDiff = Math.abs(diff);

      const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);

    return () => clearInterval(timer);
  }, [startDate]);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center animate-fade-in">
      <h2 className="text-xl md:text-2xl text-orange-400 font-bold mb-6 serif tracking-wider">
        {isFuture ? "距离幸福开启还有" : "爱你已经"}
      </h2>
      
      <div className="flex flex-wrap justify-center gap-4 md:gap-8 items-baseline font-mono text-gray-700">
        <div className="flex flex-col items-center">
          <span className="text-4xl md:text-6xl font-bold tabular-nums text-gray-800 drop-shadow-sm">
            {timeLeft.days}
          </span>
          <span className="text-sm text-gray-400 mt-2 uppercase tracking-widest">天</span>
        </div>
        <div className="text-3xl font-light text-gray-300 self-start mt-2">:</div>
        <div className="flex flex-col items-center">
          <span className="text-4xl md:text-6xl font-bold tabular-nums text-gray-800 drop-shadow-sm">
            {timeLeft.hours.toString().padStart(2, '0')}
          </span>
          <span className="text-sm text-gray-400 mt-2 uppercase tracking-widest">小时</span>
        </div>
        <div className="text-3xl font-light text-gray-300 self-start mt-2">:</div>
        <div className="flex flex-col items-center">
          <span className="text-4xl md:text-6xl font-bold tabular-nums text-gray-800 drop-shadow-sm">
            {timeLeft.minutes.toString().padStart(2, '0')}
          </span>
          <span className="text-sm text-gray-400 mt-2 uppercase tracking-widest">分</span>
        </div>
        <div className="text-3xl font-light text-gray-300 self-start mt-2">:</div>
        <div className="flex flex-col items-center">
          <span className="text-4xl md:text-6xl font-bold tabular-nums text-pink-500 drop-shadow-sm animate-pulse">
            {timeLeft.seconds.toString().padStart(2, '0')}
          </span>
          <span className="text-sm text-gray-400 mt-2 uppercase tracking-widest">秒</span>
        </div>
      </div>
      
      <div className="mt-8 flex items-center justify-center gap-2 text-gray-400 text-sm">
         <Heart className="w-4 h-4 fill-pink-400 text-pink-400" /> 
         <span>{startDate.toLocaleDateString()}</span>
      </div>
    </div>
  );
};